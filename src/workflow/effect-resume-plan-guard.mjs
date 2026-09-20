import { canonicalDigest } from '../contracts/adapter-receipt.mjs';
import { bridgeReceiptsToEffectEvidence } from './effect-receipt-bridge.mjs';
import { planEffectResume } from './effect-resume-planner.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const ALGORITHM='EFFECT_RESUME_PLAN_SHA256_V1';

function sortedBindings(bindings){
  return [...bindings].sort((a,b)=>String(a.binding_id).localeCompare(String(b.binding_id)));
}

function receiptDescriptors(receipts){
  const ids=receipts.map(x=>x?.receipt_id);
  need(ids.every(text),'RESUME_PLAN_RECEIPT_ID_REQUIRED');
  need(new Set(ids).size===ids.length,'RESUME_PLAN_RECEIPT_ID_DUPLICATE');
  return [...receipts]
    .sort((a,b)=>a.receipt_id.localeCompare(b.receipt_id))
    .map(receipt=>({
      receipt_id:receipt.receipt_id,
      receipt_digest:canonicalDigest(receipt)
    }));
}

function normalizedProofInputsMap(receipts,currentProofInputsByReceipt){
  const entries=[];
  for(const receipt of [...receipts].sort((a,b)=>a.receipt_id.localeCompare(b.receipt_id))){
    const value=currentProofInputsByReceipt?.get?.(receipt.receipt_id)
      ?? currentProofInputsByReceipt?.[receipt.receipt_id]
      ?? null;
    entries.push({
      receipt_id:receipt.receipt_id,
      inputs:Array.isArray(value)?structuredClone(value):null
    });
  }
  return entries;
}

function computePlannerResult({effects,bindings,receipts,target_execution,current_proof_inputs_by_receipt}){
  const bridge=bridgeReceiptsToEffectEvidence({
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });
  if(bridge.status==='HOLD'){
    return {
      status:'HOLD',
      reason:bridge.reason,
      bridge,
      resume_plan:null,
    };
  }
  const resumePlan=planEffectResume({
    effects,
    target_execution,
    evidence_records:bridge.evidence_records,
  });
  return {
    status:resumePlan.status,
    reason:resumePlan.reason,
    bridge,
    resume_plan:resumePlan,
  };
}

function computeDigests({effects,bindings,receipts,target_execution,current_proof_inputs_by_receipt,planner_result}){
  need(Array.isArray(effects)&&effects.length>0,'RESUME_PLAN_EFFECTS_REQUIRED');
  need(Array.isArray(bindings)&&bindings.length>0,'RESUME_PLAN_BINDINGS_REQUIRED');
  need(Array.isArray(receipts),'RESUME_PLAN_RECEIPTS_REQUIRED');
  need(target_execution&&text(target_execution.logical_execution_id)&&text(target_execution.identity_digest),'RESUME_PLAN_EXECUTION_REQUIRED');

  const effectsDigest=canonicalDigest(effects);
  const bindingsDigest=canonicalDigest(sortedBindings(bindings));
  const receiptsDigest=canonicalDigest(receiptDescriptors(receipts));
  const proofInputsDigest=canonicalDigest(normalizedProofInputsMap(receipts,current_proof_inputs_by_receipt));
  const plannerResultDigest=canonicalDigest(planner_result);
  const planDigest=canonicalDigest({
    algorithm:ALGORITHM,
    logical_execution_id:target_execution.logical_execution_id,
    identity_digest:target_execution.identity_digest,
    effects_digest:effectsDigest,
    bindings_digest:bindingsDigest,
    receipts_digest:receiptsDigest,
    proof_inputs_digest:proofInputsDigest,
    planner_result_digest:plannerResultDigest,
  });
  return {
    effects_digest:effectsDigest,
    bindings_digest:bindingsDigest,
    receipts_digest:receiptsDigest,
    proof_inputs_digest:proofInputsDigest,
    planner_result_digest:plannerResultDigest,
    plan_digest:planDigest,
  };
}

function planId(planDigest){
  return 'resume-plan.'+planDigest.slice('sha256:'.length,'sha256:'.length+32);
}

export function prepareEffectResumePlan({
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_proof_inputs_by_receipt=null,
  prepared_at=new Date().toISOString(),
}={}){
  const plannerResult=computePlannerResult({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });
  const digests=computeDigests({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
    planner_result:plannerResult,
  });
  return {
    schema_version:'workflow-effect-resume-plan/v1',
    algorithm:ALGORITHM,
    plan_id:planId(digests.plan_digest),
    logical_execution_id:target_execution.logical_execution_id,
    identity_digest:target_execution.identity_digest,
    ...digests,
    prepared_at,
    planner_result:plannerResult,
  };
}

export function verifyEffectResumePlan(preparedPlan,{
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_proof_inputs_by_receipt=null,
}={}){
  need(preparedPlan?.schema_version==='workflow-effect-resume-plan/v1','RESUME_PLAN_SCHEMA_INVALID');
  need(preparedPlan.algorithm===ALGORITHM,'RESUME_PLAN_ALGORITHM_INVALID');

  const plannerResult=computePlannerResult({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });
  const current=computeDigests({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
    planner_result:plannerResult,
  });

  const changes=[];
  if(preparedPlan.logical_execution_id!==target_execution.logical_execution_id
    || preparedPlan.identity_digest!==target_execution.identity_digest){
    changes.push('TARGET_EXECUTION_CHANGED');
  }
  if(preparedPlan.effects_digest!==current.effects_digest) changes.push('EFFECTS_CHANGED');
  if(preparedPlan.bindings_digest!==current.bindings_digest) changes.push('BINDINGS_CHANGED');
  if(preparedPlan.receipts_digest!==current.receipts_digest) changes.push('RECEIPTS_CHANGED');
  if(preparedPlan.proof_inputs_digest!==current.proof_inputs_digest) changes.push('PROOF_INPUTS_CHANGED');
  if(preparedPlan.planner_result_digest!==current.planner_result_digest) changes.push('PLANNER_RESULT_CHANGED');
  if(preparedPlan.plan_digest!==current.plan_digest) changes.push('PLAN_DIGEST_CHANGED');

  return {
    status:changes.length?'STALE':'CURRENT',
    reason:changes.length?'RESUME_PLAN_INPUTS_CHANGED':null,
    plan_id:preparedPlan.plan_id,
    expected_plan_digest:preparedPlan.plan_digest,
    actual_plan_digest:current.plan_digest,
    changes,
    current_planner_result:plannerResult,
  };
}

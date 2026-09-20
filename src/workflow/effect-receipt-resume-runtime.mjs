import { bridgeReceiptsToEffectEvidence } from './effect-receipt-bridge.mjs';
import { planEffectResume } from './effect-resume-planner.mjs';
import { executeEffectResume } from './effect-resume-runtime.mjs';
import { prepareEffectResumePlan, verifyEffectResumePlan } from './effect-resume-plan-guard.mjs';

export function planEffectResumeFromReceipts({
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_proof_inputs_by_receipt=null,
}={}){
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

export function prepareEffectResumeFromReceipts({
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_proof_inputs_by_receipt=null,
  prepared_at=new Date().toISOString(),
}={}){
  return prepareEffectResumePlan({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
    prepared_at,
  });
}

export async function executePreparedEffectResumeFromReceipts({
  prepared_plan,
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_attempt,
  current_proof_inputs_by_receipt=null,
  correlation_id,
  receipt,
  execute_effect,
  execute_compensation,
  clock=Date.now,
}={}){
  const freshness=verifyEffectResumePlan(prepared_plan,{
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });

  if(freshness.status==='STALE'){
    return {
      status:'HOLD',
      reason:'STALE_RESUME_PLAN',
      executed:false,
      freshness,
      bridge:freshness.current_planner_result?.bridge??null,
      plan:freshness.current_planner_result?.resume_plan??null,
      execution_result:null,
      receipt:null,
      action_receipts:[],
    };
  }

  const planned=freshness.current_planner_result;
  if(planned.status==='HOLD'){
    return {
      status:'HOLD',
      reason:planned.reason,
      executed:false,
      freshness,
      bridge:planned.bridge,
      plan:planned.resume_plan,
      execution_result:null,
      receipt:null,
      action_receipts:[],
    };
  }

  if(planned.status==='COMPLETE'){
    return {
      status:'COMPLETE',
      reason:planned.reason,
      executed:false,
      freshness,
      bridge:planned.bridge,
      plan:planned.resume_plan,
      execution_result:null,
      receipt:null,
      action_receipts:[],
    };
  }

  const result=await executeEffectResume({
    effects,
    evidence_records:planned.bridge.evidence_records,
    target_execution,
    current_attempt,
    correlation_id,
    receipt,
    execute_effect,
    execute_compensation,
    clock,
  });

  return {
    ...result,
    freshness,
    bridge:planned.bridge,
  };
}

export async function executeEffectResumeFromReceipts({
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_attempt,
  current_proof_inputs_by_receipt=null,
  correlation_id,
  receipt,
  execute_effect,
  execute_compensation,
  clock=Date.now,
}={}){
  const prepared_plan=prepareEffectResumeFromReceipts({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
    prepared_at:new Date(clock()).toISOString(),
  });

  return executePreparedEffectResumeFromReceipts({
    prepared_plan,
    effects,
    bindings,
    receipts,
    target_execution,
    current_attempt,
    current_proof_inputs_by_receipt,
    correlation_id,
    receipt,
    execute_effect,
    execute_compensation,
    clock,
  });
}

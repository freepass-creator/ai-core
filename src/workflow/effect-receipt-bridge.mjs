import { createHash } from 'node:crypto';
import { buildWorkflowActionReceipt } from '../contracts/workflow-execution-receipt.mjs';
import { sameLogicalExecution } from '../contracts/execution-identity.mjs';

const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

function validateBinding(binding,index){
  need(binding?.schema_version==='workflow-effect-receipt-binding/v1','EFFECT_RECEIPT_BINDING_SCHEMA_INVALID',{index});
  need(text(binding.binding_id),'EFFECT_RECEIPT_BINDING_ID_REQUIRED',{index});
  need(text(binding.effect_id),'EFFECT_RECEIPT_EFFECT_ID_REQUIRED',{index});
  need(['EFFECT','COMPENSATION'].includes(binding.phase),'EFFECT_RECEIPT_PHASE_INVALID',{index});
  need(text(binding.selector?.operation_kind),'EFFECT_RECEIPT_OPERATION_KIND_REQUIRED',{index});
  need(['PORT','ADAPTER','REPOSITORY','OTHER'].includes(binding.child_relation),'EFFECT_RECEIPT_CHILD_RELATION_INVALID',{index});
  need(binding.require_execution_binding===true,'EFFECT_RECEIPT_EXECUTION_BINDING_REQUIRED',{index});
  need(binding.partial_policy==='HOLD','EFFECT_RECEIPT_PARTIAL_POLICY_INVALID',{index});
  need(binding.proof_policy==='PRESERVE_AND_REVERIFY','EFFECT_RECEIPT_PROOF_POLICY_INVALID',{index});
  if(binding.phase==='COMPENSATION') need(text(binding.compensation_action),'EFFECT_RECEIPT_COMPENSATION_ACTION_REQUIRED',{index});
}

function selectorMatches(binding,receipt){
  if(receipt.operation_kind!==binding.selector.operation_kind) return false;
  if(binding.selector.executor&&receipt.executor!==binding.selector.executor) return false;
  if(binding.selector.source_revision&&receipt.source_revision!==binding.selector.source_revision) return false;
  return true;
}

function projectionId(bindingId,receiptId){
  const digest=createHash('sha256').update(bindingId+'::'+receiptId).digest('hex').slice(0,32);
  return 'effect.evidence.'+digest;
}

function currentInputsFor(map,receiptId){
  if(!map) return null;
  const value=map?.get?.(receiptId)??map?.[receiptId]??null;
  return Array.isArray(value)&&value.length?value:null;
}

export function bridgeReceiptsToEffectEvidence({
  bindings=[],
  receipts=[],
  target_execution,
  current_proof_inputs_by_receipt=null,
}={}){
  need(Array.isArray(bindings)&&bindings.length>0,'EFFECT_RECEIPT_BINDINGS_REQUIRED');
  need(Array.isArray(receipts),'EFFECT_RECEIPTS_REQUIRED');
  need(target_execution&&text(target_execution.logical_execution_id)&&text(target_execution.identity_digest),'EFFECT_RECEIPT_TARGET_EXECUTION_REQUIRED');

  bindings.forEach(validateBinding);
  const bindingIds=bindings.map(x=>x.binding_id);
  need(new Set(bindingIds).size===bindingIds.length,'EFFECT_RECEIPT_BINDING_ID_DUPLICATE');

  const phaseKeys=bindings.map(x=>x.phase+'::'+x.effect_id);
  need(new Set(phaseKeys).size===phaseKeys.length,'EFFECT_RECEIPT_EFFECT_PHASE_DUPLICATE');

  for(const [index,receipt] of receipts.entries()){
    need(receipt?.schema_version==='core-receipt/v1','EFFECT_SOURCE_RECEIPT_SCHEMA_INVALID',{index});
  }

  const claims=new Map();
  const projections=[];
  const evidenceRecords=[];
  const blocking=[];
  const unmatchedBindings=[];
  let foreignReceiptCount=0;

  for(const binding of bindings){
    const candidates=[];
    for(const receipt of receipts){
      if(!selectorMatches(binding,receipt)) continue;
      if(!receipt.execution){
        blocking.push({
          binding_id:binding.binding_id,
          effect_id:binding.effect_id,
          receipt_ref:receipt.receipt_id,
          reason:'SOURCE_RECEIPT_EXECUTION_BINDING_MISSING',
        });
        continue;
      }
      if(!sameLogicalExecution(receipt.execution,target_execution)){
        foreignReceiptCount+=1;
        continue;
      }
      candidates.push(receipt);
    }

    if(!candidates.length){
      unmatchedBindings.push(binding.binding_id);
      continue;
    }

    const byAttempt=new Map();
    for(const receipt of candidates){
      const attemptId=receipt.execution?.attempt_id??'__missing__';
      if(!byAttempt.has(attemptId)) byAttempt.set(attemptId,[]);
      byAttempt.get(attemptId).push(receipt);
    }
    for(const [attemptId,items] of byAttempt.entries()){
      if(items.length>1){
        blocking.push({
          binding_id:binding.binding_id,
          effect_id:binding.effect_id,
          receipt_refs:items.map(x=>x.receipt_id),
          attempt_id:attemptId,
          reason:'AMBIGUOUS_EFFECT_SOURCE_RECEIPTS',
        });
      }
    }

    for(const receipt of candidates){
      if(receipt.status==='PARTIAL'){
        blocking.push({
          binding_id:binding.binding_id,
          effect_id:binding.effect_id,
          receipt_ref:receipt.receipt_id,
          reason:'SOURCE_RECEIPT_PARTIAL',
        });
        continue;
      }

      const claimedBy=claims.get(receipt.receipt_id);
      if(claimedBy&&claimedBy!==binding.binding_id){
        blocking.push({
          binding_id:binding.binding_id,
          effect_id:binding.effect_id,
          receipt_ref:receipt.receipt_id,
          claimed_by:claimedBy,
          reason:'SOURCE_RECEIPT_MULTI_EFFECT_BINDING',
        });
        continue;
      }
      claims.set(receipt.receipt_id,binding.binding_id);

      const projectedId=projectionId(binding.binding_id,receipt.receipt_id);
      const result={
        status:receipt.status,
        ...(receipt.status==='SUCCEEDED'?{}:{error_code:receipt.reason_code??(binding.phase==='COMPENSATION'?'COMPENSATION_FAILED':'EFFECT_EXECUTION_FAILED')}),
        data:null,
        evidence_refs:[
          ...(receipt.evidence_refs??[]),
          'source-receipt:'+receipt.receipt_id
        ]
      };
      const projected=buildWorkflowActionReceipt({
        phase:binding.phase,
        receipt_id:projectedId,
        operation_id:projectedId+'.op',
        actor:'system:effect-receipt-bridge',
        executor:'workflow.effect-receipt-bridge',
        correlation_id:receipt.correlation_id,
        effect_id:binding.effect_id,
        action:binding.phase==='COMPENSATION'?binding.compensation_action:null,
        result,
        input:{
          source_receipt_id:receipt.receipt_id,
          source_operation_kind:receipt.operation_kind,
          binding_id:binding.binding_id,
        },
        source_revision:receipt.source_revision??null,
        reproducibility:{
          deterministic:true,
          executor_version:'effect-receipt-bridge/v1',
          environment_revision:receipt.source_revision??null,
          command_ref:binding.binding_id,
        },
        child_receipts:[{receipt_ref:receipt.receipt_id,relation:binding.child_relation}],
        proof_input_binding:receipt.proof_input_binding??null,
        started_at:receipt.started_at,
        ended_at:receipt.ended_at,
        execution:receipt.execution,
        metrics:{
          bridge_binding_id:binding.binding_id,
          source_operation_kind:receipt.operation_kind,
        },
      });

      const currentInputs=currentInputsFor(current_proof_inputs_by_receipt,receipt.receipt_id);
      projections.push({
        binding_id:binding.binding_id,
        effect_id:binding.effect_id,
        phase:binding.phase,
        source_receipt_ref:receipt.receipt_id,
        projected_receipt_ref:projected.receipt_id,
      });
      evidenceRecords.push({
        receipt:projected,
        ...(currentInputs?{current_proof_inputs:currentInputs}:{})
      });
    }
  }

  if(blocking.length){
    return {
      status:'HOLD',
      reason:blocking[0].reason,
      evidence_records:evidenceRecords,
      projections,
      blocking,
      unmatched_bindings:unmatchedBindings,
      foreign_receipt_count:foreignReceiptCount,
    };
  }

  return {
    status:'READY',
    reason:'EFFECT_RECEIPT_BRIDGE_READY',
    evidence_records:evidenceRecords,
    projections,
    blocking:[],
    unmatched_bindings:unmatchedBindings,
    foreign_receipt_count:foreignReceiptCount,
  };
}

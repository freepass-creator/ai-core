import { bridgeReceiptsToEffectEvidence } from './effect-receipt-bridge.mjs';
import { planEffectResume } from './effect-resume-planner.mjs';
import { executeEffectResume } from './effect-resume-runtime.mjs';

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
  const planned=planEffectResumeFromReceipts({
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });

  if(planned.status==='HOLD'){
    return {
      status:'HOLD',
      executed:false,
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
      executed:false,
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
    bridge:planned.bridge,
  };
}

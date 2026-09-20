import { executeCompensatedEffects } from './compensation.mjs';
import { buildWorkflowActionReceipt, buildCompensationExecutionReceipt } from '../contracts/workflow-execution-receipt.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};
const iso=clock=>new Date(clock()).toISOString();

function childEvidence(result){
  if(result?.receipt?.receipt_id){
    return [{receipt:result.receipt,relation:'OTHER'}];
  }
  if(text(result?.receipt_ref)){
    return [{receipt_ref:result.receipt_ref,relation:'OTHER'}];
  }
  return [];
}

function failedResult(error, fallback){
  return {
    status:'FAILED',
    error_code:text(error?.code)?error.code:fallback,
    detail:error?.message??null
  };
}

export async function executeCompensatedEffectsWithReceipts({
  effects,
  execute_effect,
  execute_compensation,
  correlation_id,
  receipt,
  clock=Date.now,
}={}){
  need(Array.isArray(effects)&&effects.length>0,'COMPENSATION_EFFECTS_REQUIRED');
  need(typeof execute_effect==='function','EFFECT_EXECUTOR_REQUIRED');
  need(typeof execute_compensation==='function','COMPENSATION_EXECUTOR_REQUIRED');
  need(text(correlation_id),'CORRELATION_ID_REQUIRED');
  need(receipt&&typeof receipt==='object','RECEIPT_OPTIONS_REQUIRED');
  need(text(receipt.receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(receipt.actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(receipt.executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(receipt.reproducibility&&typeof receipt.reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(receipt.reproducibility.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');

  const actionReceipts=[];
  let sequence=0;
  const overallStarted=iso(clock);

  const wrappedEffect=async(effect,context)=>{
    const started=iso(clock);
    let result;
    try{
      result=await execute_effect(effect,context);
    }catch(error){
      result=failedResult(error,'EFFECT_EXECUTION_FAILED');
    }
    if(!result||!['SUCCEEDED','HOLD','FAILED'].includes(result.status)){
      result={status:'FAILED',error_code:'EFFECT_RESULT_STATUS_INVALID'};
    }
    sequence+=1;
    const actionReceipt=buildWorkflowActionReceipt({
      phase:'EFFECT',
      receipt_id:`${receipt.receipt_id}.effect.${sequence}`,
      actor:receipt.actor,
      executor:result.executor??receipt.executor,
      correlation_id,
      effect_id:effect.effect_id,
      result,
      input:{effect_id:effect.effect_id,compensation_mode:effect.compensation_mode},
      input_refs:result.input_refs??[],
      output_refs:result.output_refs??[],
      evidence_refs:result.evidence_refs??[],
      source_revision:result.source_revision??receipt.source_revision??null,
      reproducibility:{
        ...receipt.reproducibility,
        command_ref:effect.effect_id,
        executor_version:result.executor_version??receipt.reproducibility.executor_version
      },
      child_receipts:childEvidence(result),
      proof_inputs:result.proof_inputs??null,
      started_at:started,
      ended_at:iso(clock),
      execution:result.execution??receipt.execution??null,
    });
    actionReceipts.push({phase:'EFFECT',effect_id:effect.effect_id,receipt:actionReceipt});
    return {...result,workflow_receipt_ref:actionReceipt.receipt_id};
  };

  const wrappedCompensation=async(step,context)=>{
    const started=iso(clock);
    let result;
    try{
      result=await execute_compensation(step,context);
    }catch(error){
      result=failedResult(error,'COMPENSATION_FAILED');
    }
    if(!result||!['SUCCEEDED','FAILED'].includes(result.status)){
      result={status:'FAILED',error_code:'COMPENSATION_RESULT_INVALID'};
    }
    sequence+=1;
    const actionReceipt=buildWorkflowActionReceipt({
      phase:'COMPENSATION',
      receipt_id:`${receipt.receipt_id}.compensation.${sequence}`,
      actor:receipt.actor,
      executor:result.executor??receipt.executor,
      correlation_id,
      effect_id:step.effect_id,
      action:step.action,
      result,
      input:{effect_id:step.effect_id,action:step.action},
      input_refs:result.input_refs??[],
      output_refs:result.output_refs??[],
      evidence_refs:result.evidence_refs??[],
      source_revision:result.source_revision??receipt.source_revision??null,
      reproducibility:{
        ...receipt.reproducibility,
        command_ref:step.action,
        executor_version:result.executor_version??receipt.reproducibility.executor_version
      },
      child_receipts:childEvidence(result),
      proof_inputs:result.proof_inputs??null,
      started_at:started,
      ended_at:iso(clock),
      execution:result.execution??receipt.execution??null,
    });
    actionReceipts.push({phase:'COMPENSATION',effect_id:step.effect_id,receipt:actionReceipt});
    return {...result,workflow_receipt_ref:actionReceipt.receipt_id};
  };

  const execution_result=await executeCompensatedEffects({
    effects,
    execute_effect:wrappedEffect,
    execute_compensation:wrappedCompensation,
    correlation_id,
  });

  const parentReceipt=buildCompensationExecutionReceipt({
    receipt_id:receipt.receipt_id,
    operation_id:receipt.operation_id??`${receipt.receipt_id}.operation`,
    operation_kind:receipt.operation_kind??'workflow.compensated-multiwrite',
    actor:receipt.actor,
    executor:receipt.executor,
    correlation_id,
    execution_result,
    input:receipt.input??effects,
    input_refs:receipt.input_refs??[],
    output_refs:receipt.output_refs??[],
    evidence_refs:receipt.evidence_refs??[],
    source_revision:receipt.source_revision??null,
    reproducibility:receipt.reproducibility,
    action_receipts:actionReceipts,
    proof_inputs:receipt.proof_inputs??null,
    started_at:overallStarted,
    ended_at:iso(clock),
    execution:receipt.execution??null,
  });

  return {
    execution_result,
    receipt:parentReceipt,
    action_receipts:actionReceipts.map(item=>item.receipt),
  };
}

import { planEffectResume } from './effect-resume-planner.mjs';
import { planReverseCompensation, resolveCompensationOutcome } from './compensation.mjs';
import { buildWorkflowActionReceipt, buildCompensationExecutionReceipt } from '../contracts/workflow-execution-receipt.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition){const error=new Error(code);error.code=code;throw error;}};
const iso=clock=>new Date(clock()).toISOString();

function childEvidence(result){
  if(result?.receipt?.receipt_id) return [{receipt:result.receipt,relation:'OTHER'}];
  if(text(result?.receipt_ref)) return [{receipt_ref:result.receipt_ref,relation:'OTHER'}];
  return [];
}

function failedResult(error,fallback){
  return {
    status:'FAILED',
    error_code:text(error?.code)?error.code:fallback,
    detail:error?.message??null
  };
}

export async function executeEffectResume({
  effects,
  evidence_records=[],
  target_execution,
  current_attempt,
  correlation_id,
  receipt,
  execute_effect,
  execute_compensation,
  before_effect=null,
  before_compensation=null,
  clock=Date.now,
}={}){
  need(Array.isArray(effects)&&effects.length>0,'EFFECT_RESUME_EFFECTS_REQUIRED');
  need(typeof execute_effect==='function','EFFECT_EXECUTOR_REQUIRED');
  need(typeof execute_compensation==='function','COMPENSATION_EXECUTOR_REQUIRED');
  need(text(correlation_id),'CORRELATION_ID_REQUIRED');
  need(receipt&&text(receipt.receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(receipt.actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(receipt.executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(receipt.reproducibility&&typeof receipt.reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(receipt.reproducibility.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');

  const plan=planEffectResume({effects,target_execution,evidence_records});
  if(plan.status==='HOLD'){
    return {status:'HOLD',executed:false,plan,execution_result:null,receipt:null,action_receipts:[]};
  }
  if(plan.status==='COMPLETE'){
    return {status:'COMPLETE',executed:false,plan,execution_result:null,receipt:null,action_receipts:[]};
  }

  const effectById=new Map(effects.map(effect=>[effect.effect_id,effect]));
  const priorAppliedIds=plan.actions.filter(x=>x.action==='SKIP_ALREADY_APPLIED').map(x=>x.effect_id);
  const priorActionRefs=plan.actions
    .filter(x=>x.action==='SKIP_ALREADY_APPLIED'&&text(x.receipt_ref))
    .map(x=>({phase:'EFFECT',effect_id:x.effect_id,receipt_ref:x.receipt_ref}));

  const newAppliedIds=[];
  const effectResults=[];
  const actionReceipts=[];
  let sequence=0;
  const overallStarted=iso(clock);

  for(const action of plan.actions){
    if(action.action!=='RUN') continue;
    const effect=effectById.get(action.effect_id);
    if(before_effect) await before_effect(effect,{
      correlation_id,
      target_execution,
      current_attempt,
      resume_plan:plan,
    });
    const started=iso(clock);
    let result;
    try{
      result=await execute_effect(effect,{
        correlation_id,
        target_execution,
        current_attempt,
        resume_plan:plan,
      });
    }catch(error){
      result=failedResult(error,'EFFECT_EXECUTION_FAILED');
    }
    if(!result||!['SUCCEEDED','HOLD','FAILED'].includes(result.status)){
      result={status:'FAILED',error_code:'EFFECT_RESULT_STATUS_INVALID'};
    }

    sequence+=1;
    const effectReceipt=buildWorkflowActionReceipt({
      phase:'EFFECT',
      receipt_id:`${receipt.receipt_id}.effect.${sequence}`,
      actor:receipt.actor,
      executor:result.executor??receipt.executor,
      correlation_id,
      effect_id:effect.effect_id,
      result,
      input:{effect_id:effect.effect_id,resumed:true},
      input_refs:result.input_refs??[],
      output_refs:result.output_refs??[],
      evidence_refs:result.evidence_refs??[],
      source_revision:result.source_revision??receipt.source_revision??null,
      reproducibility:{
        ...receipt.reproducibility,
        command_ref:effect.effect_id,
        executor_version:result.executor_version??receipt.reproducibility.executor_version,
      },
      child_receipts:childEvidence(result),
      proof_inputs:result.proof_inputs??null,
      started_at:started,
      ended_at:iso(clock),
      execution:result.execution??current_attempt??receipt.execution??null,
      metrics:{resumed:true},
    });
    actionReceipts.push({phase:'EFFECT',effect_id:effect.effect_id,receipt:effectReceipt});
    effectResults.push({effect_id:effect.effect_id,...result,workflow_receipt_ref:effectReceipt.receipt_id});

    if(result.status==='SUCCEEDED'){
      newAppliedIds.push(effect.effect_id);
      continue;
    }

    const originalError=result.error_code??(result.status==='HOLD'?'EFFECT_HOLD':'EFFECT_EXECUTION_FAILED');
    const appliedSet=new Set([...priorAppliedIds,...newAppliedIds]);
    const appliedInOrder=effects.filter(item=>appliedSet.has(item.effect_id)).map(item=>item.effect_id);
    const compensationPlan=planReverseCompensation({effects,applied_effect_ids:appliedInOrder});
    const compensationResults=[];

    for(const step of compensationPlan.steps){
      if(before_compensation) await before_compensation(step,{
        correlation_id,
        original_error_code:originalError,
        target_execution,
        current_attempt,
        resume_plan:plan,
      });
      const compStarted=iso(clock);
      let compensation;
      try{
        compensation=await execute_compensation(step,{
          correlation_id,
          original_error_code:originalError,
          target_execution,
          current_attempt,
          resume_plan:plan,
        });
      }catch(error){
        compensation=failedResult(error,'COMPENSATION_FAILED');
      }
      if(!compensation||!['SUCCEEDED','FAILED'].includes(compensation.status)){
        compensation={status:'FAILED',error_code:'COMPENSATION_RESULT_INVALID'};
      }

      sequence+=1;
      const compReceipt=buildWorkflowActionReceipt({
        phase:'COMPENSATION',
        receipt_id:`${receipt.receipt_id}.compensation.${sequence}`,
        actor:receipt.actor,
        executor:compensation.executor??receipt.executor,
        correlation_id,
        effect_id:step.effect_id,
        action:step.action,
        result:compensation,
        input:{effect_id:step.effect_id,action:step.action,resume_compensation:true},
        input_refs:compensation.input_refs??[],
        output_refs:compensation.output_refs??[],
        evidence_refs:compensation.evidence_refs??[],
        source_revision:compensation.source_revision??receipt.source_revision??null,
        reproducibility:{
          ...receipt.reproducibility,
          command_ref:step.action,
          executor_version:compensation.executor_version??receipt.reproducibility.executor_version,
        },
        child_receipts:childEvidence(compensation),
        proof_inputs:compensation.proof_inputs??null,
        started_at:compStarted,
        ended_at:iso(clock),
        execution:compensation.execution??current_attempt??receipt.execution??null,
        metrics:{resume_compensation:true},
      });
      actionReceipts.push({phase:'COMPENSATION',effect_id:step.effect_id,receipt:compReceipt});
      compensationResults.push({effect_id:step.effect_id,...compensation,workflow_receipt_ref:compReceipt.receipt_id});
    }

    const compensationOutcome=resolveCompensationOutcome({
      original_error_code:originalError,
      plan:compensationPlan,
      compensation_results:compensationResults,
    });
    const executionResult={
      status:compensationOutcome.status==='PARTIAL_STATE'?'PARTIAL_STATE':'FAILED',
      action:compensationOutcome.action,
      correlation_id,
      failed_effect_id:effect.effect_id,
      original_error_code:originalError,
      applied_effect_ids:appliedInOrder,
      effect_results:effectResults,
      compensation_plan:compensationPlan,
      compensation_results:compensationResults,
      compensation_outcome:compensationOutcome,
    };
    const allActionRefs=[...priorActionRefs,...actionReceipts];
    const parentReceipt=buildCompensationExecutionReceipt({
      receipt_id:receipt.receipt_id,
      operation_id:receipt.operation_id??`${receipt.receipt_id}.operation`,
      operation_kind:receipt.operation_kind??'workflow.effect-resume',
      actor:receipt.actor,
      executor:receipt.executor,
      correlation_id,
      execution_result:executionResult,
      input:receipt.input??effects,
      input_refs:receipt.input_refs??[],
      output_refs:receipt.output_refs??[],
      evidence_refs:receipt.evidence_refs??[],
      source_revision:receipt.source_revision??null,
      reproducibility:receipt.reproducibility,
      action_receipts:allActionRefs,
      proof_inputs:receipt.proof_inputs??null,
      started_at:overallStarted,
      ended_at:iso(clock),
      execution:current_attempt??receipt.execution??null,
    });

    return {
      status:executionResult.status,
      executed:true,
      plan,
      execution_result:executionResult,
      receipt:parentReceipt,
      action_receipts:actionReceipts.map(x=>x.receipt),
    };
  }

  const appliedSet=new Set([...priorAppliedIds,...newAppliedIds]);
  const appliedInOrder=effects.filter(item=>appliedSet.has(item.effect_id)).map(item=>item.effect_id);
  const executionResult={
    status:'SUCCEEDED',
    action:'CONTINUE',
    correlation_id,
    failed_effect_id:null,
    original_error_code:null,
    applied_effect_ids:appliedInOrder,
    effect_results:effectResults,
    compensation_plan:null,
    compensation_results:[],
    compensation_outcome:null,
  };
  const allActionRefs=[...priorActionRefs,...actionReceipts];
  const parentReceipt=buildCompensationExecutionReceipt({
    receipt_id:receipt.receipt_id,
    operation_id:receipt.operation_id??`${receipt.receipt_id}.operation`,
    operation_kind:receipt.operation_kind??'workflow.effect-resume',
    actor:receipt.actor,
    executor:receipt.executor,
    correlation_id,
    execution_result:executionResult,
    input:receipt.input??effects,
    input_refs:receipt.input_refs??[],
    output_refs:receipt.output_refs??[],
    evidence_refs:receipt.evidence_refs??[],
    source_revision:receipt.source_revision??null,
    reproducibility:receipt.reproducibility,
    action_receipts:allActionRefs,
    proof_inputs:receipt.proof_inputs??null,
    started_at:overallStarted,
    ended_at:iso(clock),
    execution:current_attempt??receipt.execution??null,
  });

  return {
    status:'SUCCEEDED',
    executed:true,
    plan,
    execution_result:executionResult,
    receipt:parentReceipt,
    action_receipts:actionReceipts.map(x=>x.receipt),
  };
}

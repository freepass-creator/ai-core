import { canonicalDigest } from './adapter-receipt.mjs';
import { buildProofInputBinding } from './proof-input-binding.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};
const machine=value=>typeof value==='string'&&/^[A-Z][A-Z0-9_]*$/.test(value);

function normalizeChildReceipts(items=[]){
  return (items??[]).map(item=>({
    receipt_ref:text(item?.receipt_ref)?item.receipt_ref:item?.receipt?.receipt_id,
    relation:item?.relation??'OTHER'
  })).filter(item=>text(item.receipt_ref));
}

function baseReproducibility(value){
  need(value&&typeof value.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(value.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');
  return {
    deterministic:value.deterministic,
    executor_version:value.executor_version,
    environment_revision:value.environment_revision??null,
    command_ref:value.command_ref??null
  };
}

export function buildWorkflowActionReceipt({
  phase,
  receipt_id,
  operation_id=null,
  actor,
  executor,
  correlation_id,
  effect_id,
  action=null,
  result,
  input=null,
  input_refs=[],
  output_refs=[],
  evidence_refs=[],
  source_revision=null,
  reproducibility,
  child_receipts=[],
  proof_inputs=null,
  proof_input_binding=null,
  started_at,
  ended_at,
  metrics=null,
  execution=null,
}={}){
  need(['EFFECT','COMPENSATION'].includes(phase),'WORKFLOW_RECEIPT_PHASE_INVALID');
  need(text(receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(text(correlation_id),'CORRELATION_ID_REQUIRED');
  need(text(effect_id),'EFFECT_ID_REQUIRED');
  need(result&&['SUCCEEDED','HOLD','FAILED'].includes(result.status),'WORKFLOW_ACTION_RESULT_INVALID');
  need(text(started_at)&&text(ended_at),'WORKFLOW_ACTION_TIME_REQUIRED');

  const reason=result.status==='SUCCEEDED'
    ? null
    : (machine(result.error_code)?result.error_code:(phase==='COMPENSATION'?'COMPENSATION_FAILED':'EFFECT_EXECUTION_FAILED'));
  const output=result.data??null;

  const receipt={
    schema_version:'core-receipt/v1',
    receipt_id,
    operation_id:operation_id??receipt_id,
    operation_kind:phase==='EFFECT'?'workflow.effect':'workflow.compensation',
    actor,
    executor,
    correlation_id,
    status:result.status,
    reason_code:reason,
    input:{
      digest:canonicalDigest(input??{effect_id,action}),
      refs:[...new Set((input_refs??[]).filter(text))]
    },
    output:{
      digest:output==null?null:canonicalDigest(output),
      refs:[...new Set((output_refs??[]).filter(text))]
    },
    source_revision:source_revision??null,
    started_at,
    ended_at,
    evidence_refs:[...new Set([...(result.evidence_refs??[]),...(evidence_refs??[])].filter(text))],
    reproducibility:baseReproducibility(reproducibility),
    child_receipts:normalizeChildReceipts(child_receipts),
    ...(execution?{execution:structuredClone(execution)}:{}),
    metrics:{
      phase,
      effect_id,
      ...(action?{action}:{}),
      ...(metrics&&typeof metrics==='object'&&!Array.isArray(metrics)?metrics:{})
    }
  };
  need(!(Array.isArray(proof_inputs)&&proof_inputs.length&&proof_input_binding),'WORKFLOW_RECEIPT_PROOF_SOURCE_CONFLICT');
  if(proof_input_binding){
    need(proof_input_binding.schema_version==='core-proof-input-binding/v1','WORKFLOW_RECEIPT_PROOF_BINDING_INVALID');
    receipt.proof_input_binding=structuredClone(proof_input_binding);
  }else if(Array.isArray(proof_inputs)&&proof_inputs.length){
    receipt.proof_input_binding=buildProofInputBinding(proof_inputs);
  }
  return receipt;
}

export function buildCompensationExecutionReceipt({
  receipt_id,
  operation_id=null,
  operation_kind='workflow.compensated-multiwrite',
  actor,
  executor,
  correlation_id,
  execution_result,
  input,
  input_refs=[],
  output_refs=[],
  evidence_refs=[],
  source_revision=null,
  reproducibility,
  action_receipts=[],
  proof_inputs=null,
  started_at,
  ended_at,
  execution=null,
}={}){
  need(text(receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(text(correlation_id),'CORRELATION_ID_REQUIRED');
  need(execution_result&&['SUCCEEDED','FAILED','PARTIAL_STATE','HOLD'].includes(execution_result.status),'COMPENSATION_EXECUTION_RESULT_INVALID');
  need(text(started_at)&&text(ended_at),'COMPENSATION_EXECUTION_TIME_REQUIRED');

  const status=execution_result.status==='PARTIAL_STATE'?'PARTIAL':execution_result.status;
  const reason=status==='SUCCEEDED'
    ? null
    : (machine(execution_result.original_error_code)
        ? execution_result.original_error_code
        : (status==='HOLD'?'EXECUTION_HOLD':'EFFECT_EXECUTION_FAILED'));

  const child_receipts=(action_receipts??[]).map(item=>({
    receipt_ref:item.receipt?.receipt_id??item.receipt_ref,
    relation:item.phase==='COMPENSATION'?'COMPENSATION':'EFFECT'
  })).filter(item=>text(item.receipt_ref));

  const receipt={
    schema_version:'core-receipt/v1',
    receipt_id,
    operation_id:operation_id??receipt_id,
    operation_kind,
    actor,
    executor,
    correlation_id,
    status,
    reason_code:reason,
    input:{
      digest:canonicalDigest(input??null),
      refs:[...new Set((input_refs??[]).filter(text))]
    },
    output:{
      digest:canonicalDigest({
        status:execution_result.status,
        action:execution_result.action,
        applied_effect_ids:execution_result.applied_effect_ids??[],
        failed_effect_id:execution_result.failed_effect_id??null,
        compensation_outcome:execution_result.compensation_outcome??null
      }),
      refs:[...new Set((output_refs??[]).filter(text))]
    },
    source_revision:source_revision??null,
    started_at,
    ended_at,
    evidence_refs:[...new Set((evidence_refs??[]).filter(text))],
    reproducibility:baseReproducibility(reproducibility),
    ...(execution?{execution:structuredClone(execution)}:{}),
    child_receipts,
    metrics:{
      effect_count:Array.isArray(execution_result.effect_results)?execution_result.effect_results.length:0,
      applied_effect_count:Array.isArray(execution_result.applied_effect_ids)?execution_result.applied_effect_ids.length:0,
      compensation_count:Array.isArray(execution_result.compensation_results)?execution_result.compensation_results.length:0,
      ...(execution_result.failed_effect_id?{failed_effect_id:execution_result.failed_effect_id}:{})
    }
  };
  if(Array.isArray(proof_inputs)&&proof_inputs.length) receipt.proof_input_binding=buildProofInputBinding(proof_inputs);
  return receipt;
}

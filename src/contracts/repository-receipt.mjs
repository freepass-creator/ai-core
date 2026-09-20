import { buildProofInputBinding } from './proof-input-binding.mjs';
import { canonicalDigest } from './adapter-receipt.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function buildRepositoryReceipt({
  receipt_id,
  operation_id,
  operation_kind,
  actor,
  executor,
  repository_result,
  input,
  input_refs=[],
  output_refs=[],
  evidence_refs=[],
  proof_inputs=null,
  reproducibility,
  milestones=[],
  metrics=null,
  source_revision=null,
}={}){
  need(text(receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(operation_id),'RECEIPT_OPERATION_ID_REQUIRED');
  need(text(operation_kind),'RECEIPT_OPERATION_KIND_REQUIRED');
  need(text(actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(repository_result?.schema_version==='core-repository-result/v1','REPOSITORY_RESULT_SCHEMA_INVALID');
  need(['SUCCEEDED','HOLD','FAILED'].includes(repository_result.status),'REPOSITORY_RESULT_STATUS_INVALID');
  need(text(repository_result.correlation_id),'REPOSITORY_RESULT_CORRELATION_REQUIRED');
  need(text(repository_result.started_at)&&text(repository_result.ended_at),'REPOSITORY_RESULT_TIME_REQUIRED');
  need(reproducibility&&typeof reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(reproducibility.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');

  const data=repository_result.data??null;
  const receipt={
    schema_version:'core-receipt/v1',
    receipt_id,
    operation_id,
    operation_kind,
    actor,
    executor,
    correlation_id:repository_result.correlation_id,
    status:repository_result.status,
    reason_code:repository_result.status==='SUCCEEDED'?null:(repository_result.error_code??'PERSISTENCE_ERROR'),
    input:{
      digest:canonicalDigest(input??null),
      refs:[...new Set((input_refs??[]).filter(text))]
    },
    output:{
      digest:data==null?null:canonicalDigest(data),
      refs:[...new Set((output_refs??[]).filter(text))]
    },
    source_revision:source_revision??null,
    started_at:repository_result.started_at,
    ended_at:repository_result.ended_at,
    evidence_refs:[...new Set([...(repository_result.evidence_refs??[]),...(evidence_refs??[])].filter(text))],
    reproducibility:{
      deterministic:reproducibility.deterministic,
      executor_version:reproducibility.executor_version,
      environment_revision:reproducibility.environment_revision??null,
      command_ref:reproducibility.command_ref??null
    }
  };
  if(Array.isArray(milestones)&&milestones.length) receipt.milestones=structuredClone(milestones);
  const mergedMetrics={
    ...(metrics&&typeof metrics==='object'&&!Array.isArray(metrics)?metrics:{}),
    ...(repository_result.revision==null?{}:{repository_revision:repository_result.revision})
  };
  if(Object.keys(mergedMetrics).length) receipt.metrics=mergedMetrics;
  if(Array.isArray(proof_inputs)&&proof_inputs.length) receipt.proof_input_binding=buildProofInputBinding(proof_inputs);
  return receipt;
}

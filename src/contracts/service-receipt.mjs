import { buildProofInputBinding } from './proof-input-binding.mjs';
import { canonicalDigest } from './adapter-receipt.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};

export function buildServiceReceipt({
  receipt_id,
  operation_id,
  operation_kind,
  actor,
  executor,
  service_result,
  input,
  input_refs=[],
  output_refs=[],
  evidence_refs=[],
  child_receipts=[],
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
  need(service_result&&['SUCCEEDED','HOLD','FAILED'].includes(service_result.status),'SERVICE_RESULT_STATUS_INVALID');
  need(text(service_result.correlation_id),'SERVICE_RESULT_CORRELATION_REQUIRED');
  need(reproducibility&&typeof reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(reproducibility.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');

  const data=service_result.result??null;
  const receipt={
    schema_version:'core-receipt/v1',
    receipt_id,
    operation_id,
    operation_kind,
    actor,
    executor,
    correlation_id:service_result.correlation_id,
    status:service_result.status,
    reason_code:service_result.status==='SUCCEEDED'?null:(service_result.reason??service_result.errors?.[0]??'INTERNAL_ERROR'),
    input:{
      digest:canonicalDigest(input??null),
      refs:[...new Set((input_refs??[]).filter(text))]
    },
    output:{
      digest:data==null?null:canonicalDigest(data),
      refs:[...new Set((output_refs??[]).filter(text))]
    },
    source_revision:source_revision??null,
    started_at:service_result.started_at??service_result.ended_at,
    ended_at:service_result.ended_at,
    evidence_refs:[...new Set((evidence_refs??[]).filter(text))],
    reproducibility:{
      deterministic:reproducibility.deterministic,
      executor_version:reproducibility.executor_version,
      environment_revision:reproducibility.environment_revision??null,
      command_ref:reproducibility.command_ref??null
    },
    child_receipts:(child_receipts??[]).map(item=>({
      receipt_ref:text(item?.receipt_ref)?item.receipt_ref:item?.receipt?.receipt_id,
      relation:item?.relation??'PORT'
    })).filter(item=>text(item.receipt_ref))
  };

  if(Array.isArray(milestones)&&milestones.length) receipt.milestones=structuredClone(milestones);
  if(metrics&&typeof metrics==='object'&&!Array.isArray(metrics)) receipt.metrics=structuredClone(metrics);
  if(Array.isArray(proof_inputs)&&proof_inputs.length) receipt.proof_input_binding=buildProofInputBinding(proof_inputs);
  return receipt;
}

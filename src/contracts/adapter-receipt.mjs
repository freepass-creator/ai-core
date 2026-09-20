import crypto from 'node:crypto';
import { buildProofInputBinding } from './proof-input-binding.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition) throw new Error(code);};

function canonical(value){
  if(Array.isArray(value)) return value.map(canonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  }
  return value;
}

export function canonicalDigest(value){
  return 'sha256:'+crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}

function primaryReason(adapterResult){
  if(adapterResult.status==='SUCCEEDED') return null;
  const issues=Array.isArray(adapterResult.issues)?adapterResult.issues:[];
  const issue=issues.find(x=>x?.severity==='BLOCKING')
    ?? issues.find(x=>x?.severity==='ERROR')
    ?? issues[0]
    ?? null;
  return text(issue?.code)?issue.code:'UPSTREAM_INVALID_RESPONSE';
}

export function buildAdapterReceipt({
  receipt_id,
  operation_id,
  operation_kind,
  actor,
  executor,
  adapter_result,
  input,
  input_refs=[],
  output_refs=[],
  evidence_refs=[],
  proof_inputs=null,
  reproducibility,
  milestones=[],
  metrics=null,
}={}){
  need(text(receipt_id),'RECEIPT_ID_REQUIRED');
  need(text(operation_id),'RECEIPT_OPERATION_ID_REQUIRED');
  need(text(operation_kind),'RECEIPT_OPERATION_KIND_REQUIRED');
  need(text(actor),'RECEIPT_ACTOR_REQUIRED');
  need(text(executor),'RECEIPT_EXECUTOR_REQUIRED');
  need(adapter_result?.schema_version==='core-adapter-result/v1','ADAPTER_RESULT_SCHEMA_INVALID');
  need(['SUCCEEDED','HOLD','FAILED'].includes(adapter_result.status),'ADAPTER_RESULT_STATUS_INVALID');
  need(text(adapter_result.correlation_id),'ADAPTER_RESULT_CORRELATION_REQUIRED');
  need(text(adapter_result.started_at)&&text(adapter_result.ended_at),'ADAPTER_RESULT_TIME_REQUIRED');
  need(reproducibility&&typeof reproducibility.deterministic==='boolean','RECEIPT_REPRODUCIBILITY_REQUIRED');
  need(text(reproducibility.executor_version),'RECEIPT_EXECUTOR_VERSION_REQUIRED');

  const allEvidence=[...(adapter_result.evidence_refs??[]),...(evidence_refs??[])].filter(text);
  const uniqueEvidence=[...new Set(allEvidence)];
  const data=adapter_result.data??null;

  const receipt={
    schema_version:'core-receipt/v1',
    receipt_id,
    operation_id,
    operation_kind,
    actor,
    executor,
    correlation_id:adapter_result.correlation_id,
    status:adapter_result.status,
    reason_code:primaryReason(adapter_result),
    input:{
      digest:canonicalDigest(input??null),
      refs:[...new Set((input_refs??[]).filter(text))]
    },
    output:{
      digest:data==null?null:canonicalDigest(data),
      refs:[...new Set((output_refs??[]).filter(text))]
    },
    source_revision:adapter_result.source_revision??null,
    started_at:adapter_result.started_at,
    ended_at:adapter_result.ended_at,
    evidence_refs:uniqueEvidence,
    reproducibility:{
      deterministic:reproducibility.deterministic,
      executor_version:reproducibility.executor_version,
      environment_revision:reproducibility.environment_revision??null,
      command_ref:reproducibility.command_ref??null
    }
  };

  if(Array.isArray(milestones)&&milestones.length) receipt.milestones=structuredClone(milestones);
  if(metrics&&typeof metrics==='object'&&!Array.isArray(metrics)) receipt.metrics=structuredClone(metrics);
  if(adapter_result.execution) receipt.execution=structuredClone(adapter_result.execution);
  if(Array.isArray(proof_inputs)&&proof_inputs.length) receipt.proof_input_binding=buildProofInputBinding(proof_inputs);

  return receipt;
}

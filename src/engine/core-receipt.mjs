import crypto from 'node:crypto';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));
  return value;
}

export function coreReceiptChecksum(value){
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

function requireString(name,value){
  if(typeof value!=='string'||!value.trim()){
    const error=new TypeError(`${name} must be a non-empty string`);
    error.code='CORE_RECEIPT_FIELD_REQUIRED';
    throw error;
  }
  return value;
}

function normalizeRefs(refs){
  if(!Array.isArray(refs)){
    const error=new TypeError('receipt refs must be an array');
    error.code='CORE_RECEIPT_REFS_INVALID';
    throw error;
  }
  return [...new Set(refs.map((ref)=>requireString('receipt ref',ref)))];
}

const TERMINAL_STATUS=new Set(['SUCCEEDED','HOLD','FAILED','PARTIAL']);

export function buildCoreReceipt({
  receiptId,
  operationId=receiptId,
  operationKind,
  actor,
  executor,
  correlationId=receiptId,
  status,
  reasonCode=null,
  inputPayload,
  outputPayload,
  inputRefs=[],
  outputRefs=[],
  sourceRevision=null,
  startedAt,
  endedAt,
  evidenceRefs=[],
  deterministic=true,
  executorVersion='1',
  environmentRevision=sourceRevision,
  commandRef=null
}){
  requireString('receiptId',receiptId);
  requireString('operationId',operationId);
  requireString('operationKind',operationKind);
  requireString('actor',actor);
  requireString('executor',executor);
  requireString('correlationId',correlationId);
  requireString('startedAt',startedAt);
  requireString('endedAt',endedAt);
  requireString('executorVersion',executorVersion);
  if(!TERMINAL_STATUS.has(status)){
    const error=new TypeError(`unsupported core receipt status: ${status}`);
    error.code='CORE_RECEIPT_STATUS_INVALID';
    throw error;
  }
  if(reasonCode!==null) requireString('reasonCode',reasonCode);
  if(sourceRevision!==null) requireString('sourceRevision',sourceRevision);
  if(environmentRevision!==null) requireString('environmentRevision',environmentRevision);
  if(commandRef!==null) requireString('commandRef',commandRef);

  return {
    schema_version:'core-receipt/v1',
    receipt_id:receiptId,
    operation_id:operationId,
    operation_kind:operationKind,
    actor,
    executor,
    correlation_id:correlationId,
    status,
    reason_code:reasonCode,
    input:{digest:coreReceiptChecksum(inputPayload),refs:normalizeRefs(inputRefs)},
    output:{digest:coreReceiptChecksum(outputPayload),refs:normalizeRefs(outputRefs)},
    source_revision:sourceRevision,
    started_at:startedAt,
    ended_at:endedAt,
    evidence_refs:normalizeRefs(evidenceRefs),
    reproducibility:{
      deterministic:Boolean(deterministic),
      executor_version:executorVersion,
      environment_revision:environmentRevision,
      command_ref:commandRef
    }
  };
}

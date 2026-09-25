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

function invalidField(name,rule){
  const error=new TypeError(`${name} must satisfy ${rule}`);
  error.code='CORE_RECEIPT_FIELD_INVALID';
  throw error;
}

const STABLE_ID_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const OPERATION_KIND_PATTERN=/^[a-z][a-z0-9._-]*$/;
const REASON_CODE_PATTERN=/^[A-Z][A-Z0-9_]*$/;
const RFC3339_PATTERN=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function requireStableId(name,value){
  const text=requireString(name,value);
  if(text.length>128||!STABLE_ID_PATTERN.test(text)) invalidField(name,'core stable_id');
  return text;
}

function requireOperationKind(name,value){
  const text=requireString(name,value);
  if(!OPERATION_KIND_PATTERN.test(text)) invalidField(name,'core receipt operation_kind');
  return text;
}

function requireReasonCode(name,value){
  const text=requireString(name,value);
  if(!REASON_CODE_PATTERN.test(text)) invalidField(name,'core receipt reason_code');
  return text;
}

function requireRevision(name,value){
  const text=requireString(name,value);
  if(text.length>256) invalidField(name,'core revision');
  return text;
}

function requireDateTime(name,value){
  const text=requireString(name,value);
  const match=RFC3339_PATTERN.exec(text);
  if(!match) invalidField(name,'RFC 3339 date-time');
  const [,year,month,day,hour,minute,second,zone]=match;
  const y=Number(year),mo=Number(month),d=Number(day),h=Number(hour),mi=Number(minute),s=Number(second);
  const calendar=new Date(Date.UTC(y,mo-1,d));
  const validDate=calendar.getUTCFullYear()===y&&calendar.getUTCMonth()===mo-1&&calendar.getUTCDate()===d;
  const validClock=h<=23&&mi<=59&&s<=59;
  let validZone=true;
  if(zone!=='Z'){
    const [zoneHour,zoneMinute]=zone.slice(1).split(':').map(Number);
    validZone=zoneHour<=23&&zoneMinute<=59;
  }
  if(!validDate||!validClock||!validZone) invalidField(name,'RFC 3339 date-time');
  return text;
}

function normalizeRefs(refs){
  if(!Array.isArray(refs)){
    const error=new TypeError('receipt refs must be an array');
    error.code='CORE_RECEIPT_REFS_INVALID';
    throw error;
  }
  return [...new Set(refs.map((ref)=>requireString('receipt ref',ref)))];
}

const CORE_TERMINAL_STATUS=new Set(['SUCCEEDED','HOLD','FAILED','PARTIAL']);

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
  requireStableId('receiptId',receiptId);
  requireStableId('operationId',operationId);
  requireOperationKind('operationKind',operationKind);
  requireString('actor',actor);
  requireString('executor',executor);
  requireStableId('correlationId',correlationId);
  requireDateTime('startedAt',startedAt);
  requireDateTime('endedAt',endedAt);
  if(Date.parse(endedAt)<Date.parse(startedAt)) invalidField('endedAt','not precede startedAt');
  requireString('executorVersion',executorVersion);
  if(!CORE_TERMINAL_STATUS.has(status)){
    const error=new TypeError(`unsupported core receipt status: ${status}`);
    error.code='CORE_RECEIPT_STATUS_INVALID';
    throw error;
  }
  if(reasonCode!==null) requireReasonCode('reasonCode',reasonCode);
  if(sourceRevision!==null) requireRevision('sourceRevision',sourceRevision);
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

function collectEvidence(value,refs=[]){
  if(Array.isArray(value)){
    for(const item of value) collectEvidence(item,refs);
  }else if(value&&typeof value==='object'){
    if(typeof value.ref==='string'&&value.ref) refs.push(value.ref);
    for(const [key,item] of Object.entries(value)){
      if(key==='ref') continue;
      if((key.endsWith('_ref')||key.endsWith('_refs'))&&typeof item==='string'&&item) refs.push(item);
      else if(key.endsWith('_refs')&&Array.isArray(item)) refs.push(...item.filter((entry)=>typeof entry==='string'&&entry));
      else collectEvidence(item,refs);
    }
  }else if(typeof value==='string'&&(value.includes('/')||value.includes('://'))){
    refs.push(value);
  }
  return [...new Set(refs)];
}

const STATUS={PASS:'SUCCEEDED',READY:'SUCCEEDED',READY_FOR_EXECUTION:'SUCCEEDED',NOTICE:'PARTIAL',HOLD:'HOLD',FAIL:'FAILED'};
const SCRIPT={quality:'quality-receipt',data:'data-hub',delivery:'delivery-gate','design-adoption':'design-feedback','design-visual':'design-visual-qa',document:'document-hub'};

export function finalizeCoreHubReceipt({
  kind,
  prefix,
  payload,
  legacyContract,
  subject=payload?.subject,
  legacyStatus=payload?.result?.status,
  createdAt=new Date().toISOString(),
  startedAt=payload?.execution?.started_at??createdAt,
  endedAt=payload?.execution?.finished_at??createdAt,
  executor=`devcenter-${kind}-v1`,
  inputRefs=[],
  outputRefs=[]
}){
  const receiptKind=`hub.${kind}`;
  const identity={receipt_kind:receiptKind,legacy_contract:legacyContract,payload};
  const receiptId=`${prefix}_${coreReceiptChecksum(identity).slice(7,31)}`;
  const status=STATUS[legacyStatus]??'HOLD';
  const coreReceipt=buildCoreReceipt({
    receiptId,
    operationKind:`hub.${kind}.verify`,
    actor:'devcenter',
    executor,
    status,
    reasonCode:status==='SUCCEEDED'?null:`HUB_${kind.toUpperCase().replaceAll('-','_')}_${status}`,
    inputPayload:{...payload,result:undefined},
    outputPayload:payload,
    inputRefs,
    outputRefs,
    sourceRevision:subject?.revision??null,
    startedAt,
    endedAt,
    evidenceRefs:collectEvidence(payload),
    environmentRevision:subject?.revision??null,
    commandRef:`devcenter/scripts/${SCRIPT[kind]??kind}.mjs`
  });
  return {
    ...coreReceipt,
    receipt_kind:receiptKind,
    payload:{legacy_contract:legacyContract,...payload}
  };
}

export function legacyPayload(receipt){
  return receipt?.payload??{};
}

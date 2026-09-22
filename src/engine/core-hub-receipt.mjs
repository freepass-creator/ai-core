import crypto from 'node:crypto';

function stable(value){
  if(Array.isArray(value)) return value.map(stable);
  if(value&&typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));
  return value;
}

function checksum(value){
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
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
  const receiptId=`${prefix}_${checksum(identity).slice(7,31)}`;
  const status=STATUS[legacyStatus]??'HOLD';
  return {
    schema_version:'core-receipt/v1',
    receipt_id:receiptId,
    operation_id:receiptId,
    operation_kind:`hub.${kind}.verify`,
    actor:'devcenter',
    executor,
    correlation_id:receiptId,
    status,
    reason_code:status==='SUCCEEDED'?null:`HUB_${kind.toUpperCase().replaceAll('-','_')}_${status}`,
    input:{digest:checksum({...payload,result:undefined}),refs:inputRefs},
    output:{digest:checksum(payload),refs:outputRefs},
    source_revision:subject?.revision??null,
    started_at:startedAt,
    ended_at:endedAt,
    evidence_refs:collectEvidence(payload),
    reproducibility:{
      deterministic:true,
      executor_version:'1',
      environment_revision:subject?.revision??null,
      command_ref:`devcenter/scripts/${SCRIPT[kind]??kind}.mjs`
    },
    receipt_kind:receiptKind,
    payload:{legacy_contract:legacyContract,...payload}
  };
}

export function legacyPayload(receipt){
  return receipt?.payload??{};
}

import {buildCoreReceipt,coreReceiptChecksum} from './execution-receipt.mjs';

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

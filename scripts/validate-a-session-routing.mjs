import { readFile } from 'node:fs/promises';

const SHA40=/^[0-9a-f]{40}$/;
const SESSIONS=new Set(['B','C','D']);
const ROUTE_STATUS=new Set(['SENT','RECEIVED','UNDER_REVIEW','CLOSED']);
const DECISIONS=new Set(['ADOPTED','HOLD','REJECTED','SUPERSEDED']);
const FEEDBACK=new Set(['PENDING','RECORDED']);

function add(errors,code,path,detail){errors.push({code,path,...(detail?{detail}:{})});}
function validDate(x){return typeof x==='string'&&!Number.isNaN(Date.parse(x));}
function strings(x){return Array.isArray(x)&&x.length>0&&x.every(v=>typeof v==='string'&&v.trim().length>0);}

export function validateARoutingReceipts(routes,evidence){
  const errors=[];
  if(!routes||typeof routes!=='object'||Array.isArray(routes)) return {status:'INVALID',errors:[{code:'ROUTING_REGISTRY_NOT_OBJECT',path:'$'}]};
  if(routes.schema!=='ai-core-a-session-routing-receipts/v1') add(errors,'ROUTING_SCHEMA_INVALID','/schema');
  if(routes.status!=='RESEARCH_ROUTING_RECEIPTS_NOT_CANONICAL') add(errors,'ROUTING_CANONICAL_BOUNDARY_INVALID','/status');
  if(!Array.isArray(routes.receipts)) return {status:'INVALID',errors:[...errors,{code:'RECEIPTS_NOT_ARRAY',path:'/receipts'}]};
  if(!evidence||evidence.schema!=='ai-core-a-session-evidence-registry/v1'||!Array.isArray(evidence.findings)){
    return {status:'INVALID',errors:[...errors,{code:'EVIDENCE_REGISTRY_INVALID',path:'$evidence'}]};
  }

  const findings=new Map(evidence.findings.map(f=>[f.id,f]));
  const expected=new Set();
  for(const f of evidence.findings) for(const s of f.routes||[]) expected.add(`${f.id}::${s}`);
  const seen=new Set();

  routes.receipts.forEach((r,i)=>{
    const p=`/receipts/${i}`;
    const expectedId=`${r?.finding_id}::${r?.target_session}`;
    if(typeof r?.route_id!=='string'||r.route_id!==expectedId) add(errors,'ROUTE_ID_INVALID',`${p}/route_id`);
    if(seen.has(expectedId)) add(errors,'ROUTE_RECEIPT_DUPLICATE',`${p}/route_id`);
    seen.add(expectedId);
    const f=findings.get(r?.finding_id);
    if(!f) add(errors,'ROUTE_FINDING_UNKNOWN',`${p}/finding_id`);
    if(!SESSIONS.has(r?.target_session)) add(errors,'TARGET_SESSION_INVALID',`${p}/target_session`);
    else if(f&&!f.routes.includes(r.target_session)) add(errors,'TARGET_SESSION_NOT_DECLARED_BY_FINDING',`${p}/target_session`);
    if(!ROUTE_STATUS.has(r?.route_status)) add(errors,'ROUTE_STATUS_INVALID',`${p}/route_status`);
    if(!SHA40.test(r?.source_evidence_revision??'')) add(errors,'SOURCE_EVIDENCE_REVISION_INVALID',`${p}/source_evidence_revision`);
    if(!validDate(r?.routed_at)) add(errors,'ROUTED_AT_INVALID',`${p}/routed_at`);
    if(!Array.isArray(r?.history)||r.history.length===0) add(errors,'ROUTE_HISTORY_REQUIRED',`${p}/history`);
    else {
      r.history.forEach((h,j)=>{
        const hp=`${p}/history/${j}`;
        if(!ROUTE_STATUS.has(h?.status)) add(errors,'HISTORY_STATUS_INVALID',`${hp}/status`);
        if(!validDate(h?.observed_at)) add(errors,'HISTORY_TIME_INVALID',`${hp}/observed_at`);
        if(!SHA40.test(h?.evidence_revision??'')) add(errors,'HISTORY_EVIDENCE_REVISION_INVALID',`${hp}/evidence_revision`);
        if(typeof h?.reason!=='string'||h.reason.trim().length<10) add(errors,'HISTORY_REASON_INVALID',`${hp}/reason`);
      });
      if(r.history.at(-1)?.status!==r.route_status) add(errors,'ROUTE_STATUS_NOT_HISTORY_TAIL',`${p}/route_status`);
    }

    const fb=r?.feedback;
    if(!fb||!FEEDBACK.has(fb.state)) add(errors,'FEEDBACK_STATE_INVALID',`${p}/feedback/state`);

    if(r.route_status==='SENT'){
      if(r.receiver!==null) add(errors,'SENT_RECEIVER_MUST_BE_NULL',`${p}/receiver`);
      if(r.decision!==null) add(errors,'SENT_DECISION_MUST_BE_NULL',`${p}/decision`);
      if(fb?.state!=='PENDING'||fb?.recorded_at!==null) add(errors,'SENT_FEEDBACK_MUST_BE_PENDING',`${p}/feedback`);
    } else {
      if(!r.receiver||typeof r.receiver!=='object') add(errors,'RECEIVER_REQUIRED',`${p}/receiver`);
      else {
        if(r.receiver.session!==r.target_session) add(errors,'RECEIVER_SESSION_MISMATCH',`${p}/receiver/session`);
        if(!SHA40.test(r.receiver.ai_core_revision??'')) add(errors,'RECEIVER_REVISION_INVALID',`${p}/receiver/ai_core_revision`);
        if(!validDate(r.receiver.observed_at)) add(errors,'RECEIVER_OBSERVED_AT_INVALID',`${p}/receiver/observed_at`);
        if(!strings(r.receiver.evidence_refs)) add(errors,'RECEIVER_EVIDENCE_REQUIRED',`${p}/receiver/evidence_refs`);
      }
      if(r.route_status==='CLOSED'){
        if(!r.decision||!DECISIONS.has(r.decision.outcome)) add(errors,'CLOSED_DECISION_REQUIRED',`${p}/decision`);
        else if(typeof r.decision.reason!=='string'||r.decision.reason.trim().length<10) add(errors,'CLOSED_DECISION_REASON_REQUIRED',`${p}/decision/reason`);
        if(fb?.state!=='RECORDED'||!validDate(fb?.recorded_at)||typeof fb?.note!=='string'||fb.note.trim().length<10) add(errors,'CLOSED_FEEDBACK_REQUIRED',`${p}/feedback`);
      } else {
        if(r.decision!==null) add(errors,'OPEN_ROUTE_DECISION_MUST_BE_NULL',`${p}/decision`);
        if(fb?.state!=='PENDING'||fb?.recorded_at!==null) add(errors,'OPEN_ROUTE_FEEDBACK_MUST_BE_PENDING',`${p}/feedback`);
      }
    }
  });

  for(const key of expected) if(!seen.has(key)) add(errors,'ROUTE_RECEIPT_MISSING','/receipts',key);
  for(const key of seen) if(!expected.has(key)) add(errors,'ROUTE_RECEIPT_ORPHAN','/receipts',key);
  return {status:errors.length?'INVALID':'VALID',errors};
}

if(process.argv[1]?.endsWith('validate-a-session-routing.mjs')){
  if(!process.argv[2]||!process.argv[3]){console.error('Usage: node scripts/validate-a-session-routing.mjs <routing.json> <evidence.json>');process.exit(2);}
  const routes=JSON.parse(await readFile(process.argv[2],'utf8'));
  const evidence=JSON.parse(await readFile(process.argv[3],'utf8'));
  const result=validateARoutingReceipts(routes,evidence);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='VALID') process.exitCode=1;
}

import { readFile, writeFile } from 'node:fs/promises';

const SESSIONS=['B','C','D'];
const paths={
  evidence:'docs/research/a-session-evidence-registry.v1.json',
  routing:'docs/research/a-session-routing-receipts.v1.json',
  B:'docs/research/a-session-receiver-inbox-B.v1.json',
  C:'docs/research/a-session-receiver-inbox-C.v1.json',
  D:'docs/research/a-session-receiver-inbox-D.v1.json'
};
const outPath=(s)=>`docs/research/a-session-review-queue-${s}.v1.json`;

function clone(v){ return structuredClone(v); }
function maxTime(...values){
  const valid=values.filter((v)=>typeof v==='string'&&!Number.isNaN(Date.parse(v)));
  return valid.sort((a,b)=>Date.parse(b)-Date.parse(a))[0] ?? null;
}
function questions(finding){
  if(finding.classification==='PROJECT_GT_CORE'){
    const q=[
      'Is the behavior reusable outside the source project rather than domain-specific?',
      'Does the evidence support the current maturity level and exact revisions?',
      'Should the receiver ADOPT, HOLD, REJECT or mark the route SUPERSEDED?'
    ];
    if(finding.evidence_level==='PROJECT_VERIFIED') q.splice(2,0,'Is a second independent project required before broader adoption?');
    return q;
  }
  if(finding.classification==='CORE_GT_PROJECT'){
    return [
      'Does the current project evidence satisfy every listed verification need?',
      'Is production/runtime evidence exact-revision and strong enough to close the migration gap?',
      'Should the receiver keep HOLD, accept closure evidence, reject the gap, or mark it SUPERSEDED?'
    ];
  }
  return [
    'Does new evidence now justify PROJECT_GT_CORE or CORE_GT_PROJECT classification?',
    'If neither side is ahead, what additional evidence is required?',
    'Should the receiver keep the DIFFERENT finding active, HOLD it, reject it, or supersede it?'
  ];
}
function queueStatus(routeStatus){
  if(routeStatus==='SENT') return 'WAITING_ACK';
  if(routeStatus==='RECEIVED') return 'READY_FOR_REVIEW';
  if(routeStatus==='UNDER_REVIEW') return 'IN_REVIEW';
  if(routeStatus==='CLOSED') return 'RESOLVED';
  throw new Error(`unknown route status ${routeStatus}`);
}

export function buildReviewQueues(evidence,routing,inboxes){
  const findings=new Map(evidence.findings.map((f)=>[f.id,f]));
  const inboxItems=new Map();
  for(const inbox of Object.values(inboxes)){
    for(const item of inbox.items) inboxItems.set(item.route_id,{session:inbox.session,item});
  }

  const queues={};
  for(const session of SESSIONS){
    const items=[];
    for(const route of routing.receipts.filter((r)=>r.target_session===session)){
      const finding=findings.get(route.finding_id);
      if(!finding) throw new Error(`missing finding ${route.finding_id}`);
      const receiver=inboxItems.get(route.route_id);
      if(!receiver) throw new Error(`missing receiver item ${route.route_id}`);
      if(receiver.session!==session) throw new Error(`receiver session mismatch ${route.route_id}`);
      const item=receiver.item;
      items.push({
        pack_id:route.route_id,
        route_id:route.route_id,
        finding_id:finding.id,
        target_session:session,
        queue_status:queueStatus(route.route_status),
        classification:finding.classification,
        evidence_level:finding.evidence_level,
        finding_status:finding.current_status,
        source_evidence_revision:route.source_evidence_revision,
        summary:finding.summary,
        route_priority:finding.route_priority?.[session] ?? null,
        evidence_bundle:{
          revision_evidence:clone(finding.revision_evidence),
          source_registry:finding.source_registry ?? null,
          migration:clone(finding.migration ?? null),
          difference_reason:finding.difference_reason ?? null,
          state_history:clone(finding.state_history)
        },
        receiver_snapshot:{
          receiver_status:item.receiver_status,
          acknowledgement:clone(item.acknowledgement),
          review:clone(item.review),
          decision:clone(item.decision),
          central_route_status:route.route_status,
          central_decision:clone(route.decision),
          feedback:clone(route.feedback)
        },
        review_questions:questions(finding),
        authority:{
          pack_is_derived:true,
          may_change_canon:false,
          decision_owner:session,
          automatic_decision_forbidden:true
        }
      });
    }
    items.sort((a,b)=>a.route_id.localeCompare(b.route_id));
    queues[session]={
      schema:'ai-core-a-session-review-queue/v1',
      status:'DERIVED_REVIEW_QUEUE_NOT_CANONICAL',
      session,
      observed_at:maxTime(evidence.observed_at,routing.observed_at,inboxes[session].observed_at),
      generated_from:{
        evidence_observed_at:evidence.observed_at,
        routing_observed_at:routing.observed_at,
        inbox_observed_at:inboxes[session].observed_at
      },
      policy:{
        source_only:'This queue is derived from A Evidence, Routing and receiver Inbox state. Do not hand-edit it as authority.',
        review_only:'The pack prepares evidence and questions but cannot review or decide for B/C/D.',
        resolved_history:'CLOSED routes remain in the queue as RESOLVED evidence history.'
      },
      items
    };
  }
  return queues;
}

export function compareReviewQueues(actual,expected){
  const drift=[];
  for(const session of SESSIONS){
    if(JSON.stringify(actual[session])!==JSON.stringify(expected[session])) drift.push(session);
  }
  return drift;
}

if(process.argv[1]?.endsWith('a-session-review-pack.mjs')){
  const write=process.argv.includes('--write');
  const check=process.argv.includes('--check') || !write;
  const evidence=JSON.parse(await readFile(paths.evidence,'utf8'));
  const routing=JSON.parse(await readFile(paths.routing,'utf8'));
  const inboxes={};
  for(const s of SESSIONS) inboxes[s]=JSON.parse(await readFile(paths[s],'utf8'));
  const expected=buildReviewQueues(evidence,routing,inboxes);

  if(write){
    for(const s of SESSIONS) await writeFile(outPath(s),JSON.stringify(expected[s],null,2)+'\n');
    console.log(JSON.stringify({written:SESSIONS,counts:Object.fromEntries(SESSIONS.map(s=>[s,expected[s].items.length]))},null,2));
  }else if(check){
    const actual={};
    for(const s of SESSIONS) actual[s]=JSON.parse(await readFile(outPath(s),'utf8'));
    const drift=compareReviewQueues(actual,expected);
    const states={};
    for(const s of SESSIONS) states[s]=expected[s].items.reduce((m,x)=>(m[x.queue_status]=(m[x.queue_status]||0)+1,m),{});
    console.log(JSON.stringify({status:drift.length?'DRIFT':'CLEAN',drift,states},null,2));
    if(drift.length) process.exitCode=1;
  }
}

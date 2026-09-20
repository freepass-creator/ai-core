import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAReceiverInboxes } from '../scripts/validate-a-session-receiver-inboxes.mjs';
import { syncReceiverInboxes } from '../scripts/sync-a-session-receiver-inboxes.mjs';
import { reconcileRoutingReceipts } from '../scripts/reconcile-a-session-routing.mjs';

const sha='a'.repeat(40);
const rev='b'.repeat(40);

function route(status='SENT'){
  return {
    schema:'ai-core-a-session-routing-receipts/v1',
    receipts:[{
      route_id:'x::C',finding_id:'x',target_session:'C',route_status:status,
      source_evidence_revision:sha,routed_at:'2026-09-20T00:00:00Z',
      receiver:null,decision:null,feedback:{state:'PENDING',recorded_at:null,note:null},
      history:[{status:'SENT',observed_at:'2026-09-20T00:00:00Z',evidence_revision:sha,reason:'Initial route delivery is recorded.'}]
    }]
  };
}
function inbox(session,items=[]){
  return {schema:'ai-core-a-session-receiver-inbox/v1',status:'RESEARCH_RECEIVER_INBOX_NOT_CANONICAL',session,items};
}
function pending(){
  return {
    route_id:'x::C',finding_id:'x',source_evidence_revision:sha,delivered_at:'2026-09-20T00:00:00Z',
    receiver_status:'PENDING',acknowledgement:null,review:null,decision:null,
    history:[{status:'PENDING',observed_at:'2026-09-20T00:00:00Z',basis_revision:sha,reason:'Initial receiver queue entry is recorded.'}]
  };
}
function ackItem(){
  const x=pending();
  x.receiver_status='ACKNOWLEDGED';
  x.acknowledgement={session:'C',ai_core_revision:rev,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['docs/C_ACK.md']};
  x.history.push({status:'ACKNOWLEDGED',observed_at:'2026-09-20T00:01:00Z',basis_revision:rev,reason:'C explicitly acknowledged the routed finding.'});
  return x;
}
function all(cItem=pending()){return [inbox('B'),inbox('C',[cItem]),inbox('D')];}

test('accepts pending receiver queues matching all A routes',()=>{
  assert.equal(validateAReceiverInboxes(all(),route()).status,'VALID');
});
test('receiver may acknowledge before A central receipt reconciliation',()=>{
  const result=validateAReceiverInboxes(all(ackItem()),route());
  assert.equal(result.status,'VALID');
  assert.deepEqual(result.pending_reconciliation,['x::C']);
});
test('A central receipt may never be ahead of receiver inbox',()=>{
  const r=route('RECEIVED');
  r.receipts[0].receiver={session:'C',ai_core_revision:rev,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['docs/C_ACK.md']};
  const result=validateAReceiverInboxes(all(),r);
  assert.ok(result.errors.some((e)=>e.code==='ROUTING_RECEIPT_AHEAD_OF_RECEIVER'));
});
test('sync seeds a new route without mutating existing receiver state',()=>{
  const r=route();
  const inboxes={B:inbox('B'),C:inbox('C'),D:inbox('D')};
  const result=syncReceiverInboxes(r,inboxes,'2026-09-20T00:02:00Z');
  assert.deepEqual(result.changed,['x::C']);
  assert.equal(result.inboxes.C.items[0].receiver_status,'PENDING');
});
test('reconcile turns an acknowledgement into RECEIVED with revision evidence',()=>{
  const r=route();
  const result=reconcileRoutingReceipts(r,all(ackItem()));
  assert.deepEqual(result.changed,['x::C']);
  assert.equal(result.routing.receipts[0].route_status,'RECEIVED');
  assert.equal(result.routing.receipts[0].receiver.ai_core_revision,rev);
});
test('decided inbox reconciles to CLOSED with receiver decision and A feedback',()=>{
  const x=ackItem();
  x.receiver_status='DECIDED';
  x.decision={outcome:'HOLD',ai_core_revision:rev,decided_at:'2026-09-20T00:03:00Z',evidence_refs:['docs/C_DECISION.md'],reason:'Second independent production evidence is still required.'};
  x.history.push({status:'DECIDED',observed_at:'2026-09-20T00:03:00Z',basis_revision:rev,reason:'C completed review and returned a HOLD decision.'});
  const result=reconcileRoutingReceipts(route(),all(x));
  const rec=result.routing.receipts[0];
  assert.equal(rec.route_status,'CLOSED');
  assert.equal(rec.decision.outcome,'HOLD');
  assert.equal(rec.feedback.state,'RECORDED');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { runReceiverIntake } from '../scripts/a-session-receiver-worker.mjs';

const source='a'.repeat(40);
const workerRev='b'.repeat(40);
const at='2026-09-20T01:20:00Z';

function routing(){
  return {
    schema:'ai-core-a-session-routing-receipts/v1',
    observed_at:'2026-09-20T01:00:00Z',
    receipts:[{
      route_id:'x::C',finding_id:'x',target_session:'C',route_status:'SENT',
      source_evidence_revision:source,routed_at:'2026-09-20T01:00:00Z',
      receiver:null,decision:null,feedback:{state:'PENDING',recorded_at:null,note:null},
      history:[{status:'SENT',observed_at:'2026-09-20T01:00:00Z',evidence_revision:source,reason:'Initial route delivery is recorded.'}]
    }]
  };
}
function inbox(session,items=[]){return {schema:'ai-core-a-session-receiver-inbox/v1',status:'RESEARCH_RECEIVER_INBOX_NOT_CANONICAL',session,observed_at:'2026-09-20T01:00:00Z',items};}
function pending(){
  return {route_id:'x::C',finding_id:'x',source_evidence_revision:source,delivered_at:'2026-09-20T01:00:00Z',receiver_status:'PENDING',acknowledgement:null,review:null,decision:null,history:[{status:'PENDING',observed_at:'2026-09-20T01:00:00Z',basis_revision:source,reason:'Initial receiver queue entry is recorded.'}]};
}
function inboxes(withItem=true){return {B:inbox('B'),C:inbox('C',withItem?[pending()]:[]),D:inbox('D')};}
function config(autoAck=true){return {workers:[
  {session:'B',enabled:true,inbox_path:'docs/research/a-session-receiver-inbox-B.v1.json',auto_ack:autoAck,auto_review:false,auto_decide:false},
  {session:'C',enabled:true,inbox_path:'docs/research/a-session-receiver-inbox-C.v1.json',auto_ack:autoAck,auto_review:false,auto_decide:false},
  {session:'D',enabled:true,inbox_path:'docs/research/a-session-receiver-inbox-D.v1.json',auto_ack:autoAck,auto_review:false,auto_decide:false}
]};}

test('worker mechanically ACKs PENDING and reconciles SENT to RECEIVED',()=>{
  const r=runReceiverIntake({routing:routing(),inboxes:inboxes(),config:config(),sessions:['C'],revision:workerRev,observedAt:at});
  assert.deepEqual(r.acknowledged,['x::C']);
  assert.deepEqual(r.reconciled,['x::C']);
  assert.equal(r.inboxes.C.items[0].receiver_status,'ACKNOWLEDGED');
  assert.equal(r.routing.receipts[0].route_status,'RECEIVED');
  assert.equal(r.routing.receipts[0].receiver.ai_core_revision,workerRev);
});
test('worker syncs a missing inbox item before ACK',()=>{
  const r=runReceiverIntake({routing:routing(),inboxes:inboxes(false),config:config(),sessions:['C'],revision:workerRev,observedAt:at});
  assert.deepEqual(r.synced,['x::C']);
  assert.equal(r.inboxes.C.items[0].receiver_status,'ACKNOWLEDGED');
});
test('worker is idempotent after acknowledgement and reconciliation',()=>{
  const first=runReceiverIntake({routing:routing(),inboxes:inboxes(),config:config(),sessions:['C'],revision:workerRev,observedAt:at});
  const second=runReceiverIntake({routing:first.routing,inboxes:first.inboxes,config:config(),sessions:['C'],revision:workerRev,observedAt:at});
  assert.deepEqual(second.synced,[]);
  assert.deepEqual(second.acknowledged,[]);
  assert.deepEqual(second.reconciled,[]);
});
test('auto_ack false leaves route PENDING/SENT',()=>{
  const r=runReceiverIntake({routing:routing(),inboxes:inboxes(),config:config(false),sessions:['C'],revision:workerRev,observedAt:at});
  assert.equal(r.inboxes.C.items[0].receiver_status,'PENDING');
  assert.equal(r.routing.receipts[0].route_status,'SENT');
});
test('worker never invents review or decision',()=>{
  const r=runReceiverIntake({routing:routing(),inboxes:inboxes(),config:config(),sessions:['C'],revision:workerRev,observedAt:at});
  const item=r.inboxes.C.items[0];
  assert.equal(item.review,null);
  assert.equal(item.decision,null);
});
test('worker rejects any configuration that attempts auto review/decision',()=>{
  const cfg=config(); cfg.workers.find(x=>x.session==='C').auto_review=true;
  assert.throws(()=>runReceiverIntake({routing:routing(),inboxes:inboxes(),config:cfg,sessions:['C'],revision:workerRev,observedAt:at}),/must not auto-review/);
});

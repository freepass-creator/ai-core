import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewQueues, compareReviewQueues } from '../scripts/a-session-review-pack.mjs';

const sha='a'.repeat(40);
function evidence(classification='CORE_GT_PROJECT'){
  const f={
    id:'x',classification,current_status:classification==='PROJECT_GT_CORE'?'ROUTED':'MIGRATION_REQUIRED',
    evidence_level:'PROJECT_VERIFIED',routes:['C'],summary:'A sufficiently detailed finding summary for receiver review.',
    revision_evidence:[{repository:'o/r',revision:sha,evidence_types:['CODE','TEST']}],
    state_history:[{status:classification==='PROJECT_GT_CORE'?'ROUTED':'MIGRATION_REQUIRED',observed_at:'2026-09-20T00:00:00Z',reason:'Revision-bound evidence supports this finding.'}]
  };
  if(classification==='CORE_GT_PROJECT') f.migration={target_repository:'o/r',breaking_impact:['impact'],verification_needs:['need']};
  if(classification==='DIFFERENT'){f.current_status='ACTIVE';f.difference_reason='Neither side is currently proven ahead by reusable implementation evidence.';}
  return {observed_at:'2026-09-20T00:00:00Z',findings:[f]};
}
function routing(status='RECEIVED'){
  return {observed_at:'2026-09-20T00:01:00Z',receipts:[{
    route_id:'x::C',finding_id:'x',target_session:'C',route_status:status,source_evidence_revision:sha,
    routed_at:'2026-09-20T00:00:00Z',receiver:{session:'C',ai_core_revision:sha,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['x']},
    decision:status==='CLOSED'?{outcome:'HOLD',reason:'More evidence is required.'}:null,
    feedback:status==='CLOSED'?{state:'RECORDED',recorded_at:'2026-09-20T00:02:00Z',note:'A recorded the receiver decision.'}:{state:'PENDING',recorded_at:null,note:null}
  }]};
}
function inboxes(status='ACKNOWLEDGED'){
  const item={route_id:'x::C',finding_id:'x',source_evidence_revision:sha,delivered_at:'2026-09-20T00:00:00Z',receiver_status:status,
    acknowledgement:{session:'C',ai_core_revision:sha,observed_at:'2026-09-20T00:01:00Z',evidence_refs:['x']},review:null,decision:null};
  if(status==='DECIDED') item.decision={outcome:'HOLD',ai_core_revision:sha,decided_at:'2026-09-20T00:02:00Z',evidence_refs:['x'],reason:'More evidence is required.'};
  return {
    B:{session:'B',observed_at:'2026-09-20T00:00:00Z',items:[]},
    C:{session:'C',observed_at:'2026-09-20T00:02:00Z',items:[item]},
    D:{session:'D',observed_at:'2026-09-20T00:00:00Z',items:[]}
  };
}

test('RECEIVED becomes READY_FOR_REVIEW with evidence bundle',()=>{
  const q=buildReviewQueues(evidence(),routing('RECEIVED'),inboxes());
  assert.equal(q.C.items[0].queue_status,'READY_FOR_REVIEW');
  assert.equal(q.C.items[0].evidence_bundle.migration.target_repository,'o/r');
  assert.equal(q.C.items[0].authority.automatic_decision_forbidden,true);
});
test('CLOSED remains RESOLVED and carries receiver decision history',()=>{
  const q=buildReviewQueues(evidence(),routing('CLOSED'),inboxes('DECIDED'));
  assert.equal(q.C.items[0].queue_status,'RESOLVED');
  assert.equal(q.C.items[0].receiver_snapshot.decision.outcome,'HOLD');
});
test('Project > Core pack asks about reuse and second evidence',()=>{
  const q=buildReviewQueues(evidence('PROJECT_GT_CORE'),routing(),inboxes());
  assert.ok(q.C.items[0].review_questions.some(x=>x.includes('reusable')));
  assert.ok(q.C.items[0].review_questions.some(x=>x.includes('second independent project')));
});
test('Different pack preserves difference reason without inventing a decision',()=>{
  const q=buildReviewQueues(evidence('DIFFERENT'),routing(),inboxes());
  assert.match(q.C.items[0].evidence_bundle.difference_reason,/Neither side/);
  assert.equal(q.C.items[0].receiver_snapshot.decision,null);
});
test('generation is deterministic and drift is detectable',()=>{
  const q1=buildReviewQueues(evidence(),routing(),inboxes());
  const q2=buildReviewQueues(evidence(),routing(),inboxes());
  assert.deepEqual(compareReviewQueues(q1,q2),[]);
  q2.C.items[0].summary='tampered';
  assert.deepEqual(compareReviewQueues(q2,q1),['C']);
});

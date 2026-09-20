import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRevision } from '../scripts/a-session-review-pack.mjs';
import { scoreReviewItem, rankReviewItems, reviewClaimRequest, availableReviewItems, validateReviewAllocatorState } from '../scripts/a-session-review-next.mjs';

const baseItem=(overrides={})=>({
  route_id:'x::C',finding_id:'x',target_session:'C',queue_status:'READY_FOR_REVIEW',
  classification:'PROJECT_GT_CORE',evidence_level:'PROJECT_VERIFIED',finding_status:'ROUTED',
  source_evidence_revision:'a'.repeat(40),summary:'review item',
  route_priority:null,
  evidence_bundle:{revision_evidence:[],source_registry:null,migration:null,difference_reason:null,state_history:[]},
  receiver_snapshot:{receiver_status:'ACKNOWLEDGED',acknowledgement:{observed_at:'2026-09-20T01:00:00Z'},review:null,decision:null,central_route_status:'RECEIVED',central_decision:null,feedback:{state:'PENDING'}},
  review_questions:['q'],
  authority:{pack_is_derived:true,may_change_canon:false,decision_owner:'C',automatic_decision_forbidden:true},
  ...overrides
});
const withRevision=(item)=>({...item,review_revision:reviewRevision(item)});
const policy={
  schema:'ai-core-a-session-review-allocation-policy/v1',status:'RESEARCH_REVIEW_ALLOCATION_NOT_CANONICAL',candidate_status:'READY_FOR_REVIEW',
  weights:{classification:{CORE_GT_PROJECT:400,PROJECT_GT_CORE:300,DIFFERENT:200},evidence_level:{CROSS_PROJECT_VERIFIED:100,FAILURE_RUNTIME_EVIDENCE:80,PROJECT_VERIFIED:70},route_priority:{PRIMARY:120,SECONDARY:-20,NONE:0},breaking_impact_each:8,verification_need_each:5}
};
const queues=(items)=>({B:{session:'B',items:[]},C:{session:'C',items},D:{session:'D',items:[]}});

test('review revision is deterministic and changes with evidence-pack content',()=>{
  const a=baseItem();
  const b=baseItem({summary:'changed'});
  assert.match(reviewRevision(a),/^[0-9a-f]{40}$/);
  assert.equal(reviewRevision(a),reviewRevision(structuredClone(a)));
  assert.notEqual(reviewRevision(a),reviewRevision(b));
});
test('Core > Project migration risk outranks Project > Core under default policy',()=>{
  const p=withRevision(baseItem({route_id:'p::C'}));
  const g=withRevision(baseItem({
    route_id:'g::C',classification:'CORE_GT_PROJECT',finding_status:'MIGRATION_REQUIRED',
    evidence_bundle:{revision_evidence:[],source_registry:null,difference_reason:null,state_history:[],migration:{breaking_impact:['a','b'],verification_needs:['c','d']}}
  }));
  const ranked=rankReviewItems(queues([p,g]),policy,{session:'C'});
  assert.equal(ranked[0].route_id,'g::C');
});
test('PRIMARY route boosts otherwise equal review item',()=>{
  const normal=withRevision(baseItem({route_id:'a::C'}));
  const primary=withRevision(baseItem({route_id:'b::C',route_priority:'PRIMARY'}));
  assert.equal(rankReviewItems(queues([normal,primary]),policy,{session:'C'})[0].route_id,'b::C');
});
test('resolved items are excluded and oldest ACK breaks a score tie',()=>{
  const newer=withRevision(baseItem({route_id:'b::C',receiver_snapshot:{...baseItem().receiver_snapshot,acknowledgement:{observed_at:'2026-09-20T02:00:00Z'}}}));
  const older=withRevision(baseItem({route_id:'a::C',receiver_snapshot:{...baseItem().receiver_snapshot,acknowledgement:{observed_at:'2026-09-20T01:00:00Z'}}}));
  const resolved=withRevision(baseItem({route_id:'z::C',queue_status:'RESOLVED'}));
  const ranked=rankReviewItems(queues([newer,resolved,older]),policy,{session:'C'});
  assert.deepEqual(ranked.map(x=>x.route_id),['a::C','b::C']);
});
test('claim identity binds to review fingerprint and route scope',()=>{
  const item=withRevision(baseItem());
  const req=reviewClaimRequest(item,'C-review');
  assert.equal(req.repository,'freepass-creator/ai-core');
  assert.equal(req.revision,item.review_revision);
  assert.equal(req.scope,'review/x::C');
});
test('live or completed claim removes an item from available candidates',()=>{
  const item=withRevision(baseItem());
  const req=reviewClaimRequest(item,'C-review');
  const claim=(state)=>({claim_id:'id',claim_key:`${req.repository}@${req.revision}::${req.scope}`,repository:req.repository,subject_revision:req.revision,scope:req.scope,owner_session:'other',state,claimed_at:'2026-09-20T00:00:00Z',lease_until:'2026-09-20T03:00:00Z',completed_at:state==='COMPLETED'?'2026-09-20T01:00:00Z':null,evidence_refs:state==='COMPLETED'?['x']:[]});
  assert.equal(availableReviewItems([item],{claims:[claim('ACTIVE')]},new Date('2026-09-20T01:00:00Z')).length,0);
  assert.equal(availableReviewItems([item],{claims:[claim('COMPLETED')]},new Date('2026-09-20T01:00:00Z')).length,0);
});
test('local allocator state validates queue identity and revision fingerprint shape',()=>{
  const item=withRevision(baseItem());
  assert.equal(validateReviewAllocatorState(queues([item]),policy).status,'VALID');
});

test('score exposes transparent components',()=>{
  const item=withRevision(baseItem({classification:'CORE_GT_PROJECT',finding_status:'MIGRATION_REQUIRED',evidence_bundle:{revision_evidence:[],source_registry:null,difference_reason:null,state_history:[],migration:{breaking_impact:['a'],verification_needs:['b','c']}}}));
  const scored=scoreReviewItem(item,policy);
  assert.equal(scored.components.breaking_impact,8);
  assert.equal(scored.components.verification_need,10);
  assert.equal(scored.score,488);
});

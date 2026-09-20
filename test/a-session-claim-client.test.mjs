import test from 'node:test';
import assert from 'node:assert/strict';
import { claimKey, evaluateClaim, acquireClaim, renewClaim, transitionClaim, completionHeadDecision } from '../scripts/a-session-claim.mjs';

const revision='2ec46bb2e88b10a31915b68ec77b2eecbdac57bd';
const request={ repository:'freepass-creator/freepass-sales', revision, scope:'repo-rescan', owner:'A-session-owner-one' };
const registry=()=>({
  schema:'ai-core-a-session-work-claims/v1',
  status:'RESEARCH_COORDINATION_NOT_CANONICAL',
  observed_at:'2026-09-20T01:30:00Z',
  claims:[]
});

test('claim key is revision and scope bound', () => {
  assert.equal(claimKey(request), `freepass-creator/freepass-sales@${revision}::repo-rescan`);
});

test('active claim causes duplicate skip', () => {
  const r=registry();
  r.claims.push({
    claim_id:'A-old', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
    owner_session:'A-session-owner-other', state:'ACTIVE', claimed_at:'2026-09-20T01:20:00Z', lease_until:'2026-09-20T02:20:00Z',
    completed_at:null, evidence_refs:[]
  });
  const result=evaluateClaim(r, request, new Date('2026-09-20T01:30:00Z'));
  assert.equal(result.action,'SKIP_DUPLICATE');
});

test('completed claim causes already completed skip', () => {
  const r=registry();
  r.claims.push({
    claim_id:'A-done', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
    owner_session:'A-session-owner-other', state:'COMPLETED', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:20:00Z',
    completed_at:'2026-09-20T01:10:00Z', evidence_refs:['commit:abc']
  });
  assert.equal(evaluateClaim(r, request, new Date('2026-09-20T01:30:00Z')).action,'SKIP_ALREADY_COMPLETED');
});

test('expired active claim can be reacquired', () => {
  const r=registry();
  r.claims.push({
    claim_id:'A-expired', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
    owner_session:'A-session-owner-other', state:'ACTIVE', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:20:00Z',
    completed_at:null, evidence_refs:[]
  });
  const result=acquireClaim(r, request, { now:new Date('2026-09-20T01:30:00Z'), leaseMinutes:45, claimId:'A-new' });
  assert.equal(result.decision.action,'ACQUIRED');
  assert.equal(result.decision.claim.claim_id,'A-new');
  assert.equal(result.decision.claim.lease_until,'2026-09-20T02:15:00.000Z');
});

test('v2 completion requires subject binding and verifiable proof syntax', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), claimId:'A-new' });
  assert.equal(acquired.decision.claim.evidence_contract,'v2');
  assert.throws(() => transitionClaim(acquired.registry,'A-new','COMPLETED',{
    now:new Date('2026-09-20T01:40:00Z'),
    owner:'A-session-owner-one'
  }), /COMPLETION_EVIDENCE_INVALID/);
  assert.throws(() => transitionClaim(acquired.registry,'A-new','COMPLETED',{
    now:new Date('2026-09-20T01:40:00Z'),
    owner:'A-session-owner-one',
    evidenceRefs:['commit:af9e51b']
  }), /COMPLETION_EVIDENCE_INVALID/);

  const refs=[
    `subject:freepass-creator/freepass-sales@${revision}`,
    'commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  ];
  const done=transitionClaim(acquired.registry,'A-new','COMPLETED',{
    now:new Date('2026-09-20T01:40:00Z'),
    owner:'A-session-owner-one',
    evidenceRefs:refs
  });
  assert.equal(done.claim.state,'COMPLETED');
  assert.deepEqual(done.claim.evidence_refs,refs);
});


test('renew extends a live claim for the same owner', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), leaseMinutes:30, claimId:'A-live' });
  const renewed=renewClaim(acquired.registry,'A-live','A-session-owner-one',{
    now:new Date('2026-09-20T01:45:00Z'),
    leaseMinutes:60
  });
  assert.equal(renewed.action,'RENEWED');
  assert.equal(renewed.claim.lease_until,'2026-09-20T02:45:00.000Z');
  assert.equal(renewed.claim.heartbeat_at,'2026-09-20T01:45:00.000Z');
});

test('expired claim can be safely recovered by the same owner when nobody replaced it', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:00:00Z'), leaseMinutes:15, claimId:'A-expired' });
  const recovered=renewClaim(acquired.registry,'A-expired','A-session-owner-one',{
    now:new Date('2026-09-20T01:30:00Z'),
    leaseMinutes:45
  });
  assert.equal(recovered.action,'RECOVERED');
  assert.equal(recovered.claim.lease_until,'2026-09-20T02:15:00.000Z');
});

test('renew rejects owner mismatch', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), claimId:'A-owned' });
  assert.throws(() => renewClaim(acquired.registry,'A-owned','A-session-owner-other',{
    now:new Date('2026-09-20T01:40:00Z')
  }), /CLAIM_OWNER_MISMATCH/);
});

test('expired owner cannot recover after another live claimant replaced it', () => {
  const r=registry();
  r.claims=[
    {
      claim_id:'A-old', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
      owner_session:'A-session-owner-one', state:'ACTIVE', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:10:00Z',
      completed_at:null, evidence_refs:[]
    },
    {
      claim_id:'A-new', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
      owner_session:'A-session-owner-two', state:'ACTIVE', claimed_at:'2026-09-20T01:20:00Z', lease_until:'2026-09-20T02:20:00Z',
      completed_at:null, evidence_refs:[]
    }
  ];
  assert.throws(() => renewClaim(r,'A-old','A-session-owner-one',{
    now:new Date('2026-09-20T01:30:00Z')
  }), /CLAIM_SUPERSEDED_BY_LIVE_OWNER/);
});


test('transition rejects another owner from closing the claim', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), claimId:'A-owned-close' });
  assert.throws(() => transitionClaim(acquired.registry,'A-owned-close','ABANDONED',{
    now:new Date('2026-09-20T01:40:00Z'),
    owner:'A-session-owner-other'
  }), /CLAIM_OWNER_MISMATCH/);
});


test('owner with an existing live claim is busy even for a different repository', () => {
  const r=registry();
  r.claims=[{
    claim_id:'A-owner-busy',
    claim_key:'freepass-creator/freepass-admin@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::repo-rescan',
    repository:'freepass-creator/freepass-admin',
    subject_revision:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    scope:'repo-rescan',
    owner_session:'A-session-owner-one',
    state:'ACTIVE',
    claimed_at:'2026-09-20T01:20:00Z',
    lease_until:'2026-09-20T02:20:00Z',
    completed_at:null,
    evidence_refs:[]
  }];
  const result=evaluateClaim(r,request,new Date('2026-09-20T01:30:00Z'));
  assert.equal(result.action,'SKIP_OWNER_BUSY');
  assert.equal(result.claim.claim_id,'A-owner-busy');
});

test('another owner may claim non-conflicting work', () => {
  const r=registry();
  r.claims=[{
    claim_id:'A-other-live',
    claim_key:'freepass-creator/freepass-admin@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::coordination:docs',
    repository:'freepass-creator/freepass-admin',
    subject_revision:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    scope:'coordination:docs',
    owner_session:'A-session-owner-other',
    state:'ACTIVE',
    claimed_at:'2026-09-20T01:20:00Z',
    lease_until:'2026-09-20T02:20:00Z',
    completed_at:null,
    evidence_refs:[]
  }];
  const result=acquireClaim(r,request,{now:new Date('2026-09-20T01:30:00Z'),claimId:'A-new-owner'});
  assert.equal(result.decision.action,'ACQUIRED');
});


test('completion head decision allows exact subject revision', () => {
  const claim={ scope:'repo-rescan', subject_revision:revision };
  assert.deepEqual(
    completionHeadDecision(claim, revision),
    { action:'ALLOW_COMPLETION' }
  );
});

test('completion head decision supersedes moved repository', () => {
  const claim={ scope:'repo-rescan', subject_revision:revision };
  const moved='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  const result=completionHeadDecision(claim,moved);
  assert.equal(result.action,'SUPERSEDE');
  assert.equal(result.reason,'SUBJECT_HEAD_MOVED');
  assert.equal(result.expected_revision,revision);
  assert.equal(result.current_revision,moved);
});

test('coordination completion ignores ai-core head movement', () => {
  const claim={ scope:'coordination:owner-policy', subject_revision:revision };
  assert.deepEqual(
    completionHeadDecision(claim,'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
    { action:'ALLOW_COMPLETION' }
  );
});

test('inspection completion fails closed when subject head is unknown', () => {
  const claim={ scope:'runtime-evidence:production', subject_revision:revision };
  assert.deepEqual(
    completionHeadDecision(claim,null),
    { action:'BLOCK_COMPLETION', reason:'SUBJECT_HEAD_UNKNOWN' }
  );
});

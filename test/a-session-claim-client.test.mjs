import test from 'node:test';
import assert from 'node:assert/strict';
import { claimKey, evaluateClaim, acquireClaim, renewClaim, transitionClaim } from '../scripts/a-session-claim.mjs';

const revision='2ec46bb2e88b10a31915b68ec77b2eecbdac57bd';
const request={ repository:'freepass-creator/freepass-sales', revision, scope:'repo-rescan', owner:'A-one' };
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
    owner_session:'A-other', state:'ACTIVE', claimed_at:'2026-09-20T01:20:00Z', lease_until:'2026-09-20T02:20:00Z',
    completed_at:null, evidence_refs:[]
  });
  const result=evaluateClaim(r, request, new Date('2026-09-20T01:30:00Z'));
  assert.equal(result.action,'SKIP_DUPLICATE');
});

test('completed claim causes already completed skip', () => {
  const r=registry();
  r.claims.push({
    claim_id:'A-done', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
    owner_session:'A-other', state:'COMPLETED', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:20:00Z',
    completed_at:'2026-09-20T01:10:00Z', evidence_refs:['commit:abc']
  });
  assert.equal(evaluateClaim(r, request, new Date('2026-09-20T01:30:00Z')).action,'SKIP_ALREADY_COMPLETED');
});

test('expired active claim can be reacquired', () => {
  const r=registry();
  r.claims.push({
    claim_id:'A-expired', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
    owner_session:'A-other', state:'ACTIVE', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:20:00Z',
    completed_at:null, evidence_refs:[]
  });
  const result=acquireClaim(r, request, { now:new Date('2026-09-20T01:30:00Z'), leaseMinutes:45, claimId:'A-new' });
  assert.equal(result.decision.action,'ACQUIRED');
  assert.equal(result.decision.claim.claim_id,'A-new');
  assert.equal(result.decision.claim.lease_until,'2026-09-20T02:15:00.000Z');
});

test('completion requires evidence and preserves claim identity', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), claimId:'A-new' });
  assert.throws(() => transitionClaim(acquired.registry,'A-new','COMPLETED',{ now:new Date('2026-09-20T01:40:00Z') }), /COMPLETION_EVIDENCE_REQUIRED/);
  const done=transitionClaim(acquired.registry,'A-new','COMPLETED',{
    now:new Date('2026-09-20T01:40:00Z'), evidenceRefs:['commit:af9e51b']
  });
  assert.equal(done.claim.state,'COMPLETED');
  assert.deepEqual(done.claim.evidence_refs,['commit:af9e51b']);
});


test('renew extends a live claim for the same owner', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), leaseMinutes:30, claimId:'A-live' });
  const renewed=renewClaim(acquired.registry,'A-live','A-one',{
    now:new Date('2026-09-20T01:45:00Z'),
    leaseMinutes:60
  });
  assert.equal(renewed.action,'RENEWED');
  assert.equal(renewed.claim.lease_until,'2026-09-20T02:45:00.000Z');
  assert.equal(renewed.claim.heartbeat_at,'2026-09-20T01:45:00.000Z');
});

test('expired claim can be safely recovered by the same owner when nobody replaced it', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:00:00Z'), leaseMinutes:15, claimId:'A-expired' });
  const recovered=renewClaim(acquired.registry,'A-expired','A-one',{
    now:new Date('2026-09-20T01:30:00Z'),
    leaseMinutes:45
  });
  assert.equal(recovered.action,'RECOVERED');
  assert.equal(recovered.claim.lease_until,'2026-09-20T02:15:00.000Z');
});

test('renew rejects owner mismatch', () => {
  const acquired=acquireClaim(registry(), request, { now:new Date('2026-09-20T01:30:00Z'), claimId:'A-owned' });
  assert.throws(() => renewClaim(acquired.registry,'A-owned','A-other',{
    now:new Date('2026-09-20T01:40:00Z')
  }), /CLAIM_OWNER_MISMATCH/);
});

test('expired owner cannot recover after another live claimant replaced it', () => {
  const r=registry();
  r.claims=[
    {
      claim_id:'A-old', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
      owner_session:'A-one', state:'ACTIVE', claimed_at:'2026-09-20T01:00:00Z', lease_until:'2026-09-20T01:10:00Z',
      completed_at:null, evidence_refs:[]
    },
    {
      claim_id:'A-new', claim_key:claimKey(request), repository:request.repository, subject_revision:revision, scope:request.scope,
      owner_session:'A-two', state:'ACTIVE', claimed_at:'2026-09-20T01:20:00Z', lease_until:'2026-09-20T02:20:00Z',
      completed_at:null, evidence_refs:[]
    }
  ];
  assert.throws(() => renewClaim(r,'A-old','A-one',{
    now:new Date('2026-09-20T01:30:00Z')
  }), /CLAIM_SUPERSEDED_BY_LIVE_OWNER/);
});

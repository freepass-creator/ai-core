import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAWorkClaims } from '../scripts/validate-a-session-work-claims.mjs';

const base = () => ({
  schema:'ai-core-a-session-work-claims/v1',
  status:'RESEARCH_COORDINATION_NOT_CANONICAL',
  observed_at:'2026-09-20T01:30:00Z',
  claims:[]
});

const claim = (overrides = {}) => ({
  claim_id:'A-001',
  claim_key:'freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd::repo-rescan',
  repository:'freepass-creator/freepass-sales',
  subject_revision:'2ec46bb2e88b10a31915b68ec77b2eecbdac57bd',
  scope:'repo-rescan',
  owner_session:'A-session-owner-one',
  state:'ACTIVE',
  claimed_at:'2026-09-20T01:20:00Z',
  lease_until:'2026-09-20T02:20:00Z',
  completed_at:null,
  evidence_refs:[],
  ...overrides
});

test('one live claim is valid', () => {
  const r = base();
  r.claims = [claim()];
  assert.equal(validateAWorkClaims(r).status, 'VALID');
});

test('two live claims for same revision and scope are rejected', () => {
  const r = base();
  r.claims = [claim(), claim({ claim_id:'A-002', owner_session:'A-session-owner-two' })];
  const result = validateAWorkClaims(r);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(x => x.code === 'LIVE_CLAIM_DUPLICATE'));
});

test('expired claim does not block a new live claim', () => {
  const r = base();
  r.claims = [
    claim({ claim_id:'A-session-owner-old', owner_session:'A-session-owner-old', lease_until:'2026-09-20T01:25:00Z' }),
    claim({ claim_id:'A-session-owner-new', owner_session:'A-session-owner-new' })
  ];
  assert.equal(validateAWorkClaims(r).status, 'VALID');
});

test('completed claim requires completion evidence', () => {
  const r = base();
  r.claims = [claim({
    state:'COMPLETED',
    lease_until:'2026-09-20T01:25:00Z',
    completed_at:'2026-09-20T01:24:00Z',
    evidence_refs:[]
  })];
  const result = validateAWorkClaims(r);
  assert.ok(result.errors.some(x => x.code === 'COMPLETION_EVIDENCE_REQUIRED'));
});


test('generic active owner is rejected', () => {
  const r = base();
  r.claims = [claim({ owner_session:'A_SESSION' })];
  const result = validateAWorkClaims(r);
  assert.ok(result.errors.some(x => x.code === 'ACTIVE_OWNER_NOT_STABLE'));
});


test('same owner cannot hold two live claims on different work items', () => {
  const r = base();
  r.claims = [
    claim({ claim_id:'A-101', owner_session:'A-session-owner-shared' }),
    {
      ...claim({
        claim_id:'A-102',
        owner_session:'A-session-owner-shared',
        repository:'freepass-creator/freepass-admin',
        subject_revision:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        scope:'coordination:docs'
      }),
      claim_key:'freepass-creator/freepass-admin@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa::coordination:docs'
    }
  ];
  const result = validateAWorkClaims(r);
  assert.ok(result.errors.some(x => x.code === 'LIVE_OWNER_DUPLICATE'));
});


test('activation boundary requires evidence contract v2 for new claims', () => {
  const r = base();
  r.policy={ evidence_contract:{ active_from:'2026-09-20T02:35:00Z' } };
  r.observed_at='2026-09-20T02:40:00Z';
  r.claims=[claim({
    claim_id:'A-v2-required',
    claimed_at:'2026-09-20T02:36:00Z',
    lease_until:'2026-09-20T03:36:00Z'
  })];
  const result=validateAWorkClaims(r);
  assert.ok(result.errors.some(x=>x.code==='EVIDENCE_CONTRACT_V2_REQUIRED'));
});

test('completed v2 claim rejects weak evidence refs', () => {
  const r = base();
  r.policy={ evidence_contract:{ active_from:'2026-09-20T02:35:00Z' } };
  r.observed_at='2026-09-20T02:40:00Z';
  r.claims=[claim({
    claim_id:'A-v2-bad',
    state:'COMPLETED',
    claimed_at:'2026-09-20T02:36:00Z',
    lease_until:'2026-09-20T02:38:00Z',
    completed_at:'2026-09-20T02:39:00Z',
    evidence_contract:'v2',
    evidence_refs:['commit:abc']
  })];
  const result=validateAWorkClaims(r);
  assert.ok(result.errors.some(x=>x.code==='COMPLETION_EVIDENCE_V2_INVALID'));
});

test('completed v2 guarded claim accepts exact subject and full commit proof', () => {
  const r = base();
  r.policy={ evidence_contract:{ active_from:'2026-09-20T02:35:00Z' } };
  r.observed_at='2026-09-20T02:40:00Z';
  const revision='2ec46bb2e88b10a31915b68ec77b2eecbdac57bd';
  r.claims=[claim({
    claim_id:'A-v2-good',
    state:'COMPLETED',
    claimed_at:'2026-09-20T02:36:00Z',
    lease_until:'2026-09-20T02:38:00Z',
    completed_at:'2026-09-20T02:39:00Z',
    evidence_contract:'v2',
    evidence_refs:[
      `subject:freepass-creator/freepass-sales@${revision}`,
      'commit:freepass-creator/ai-core@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    ]
  })];
  assert.equal(validateAWorkClaims(r).status,'VALID');
});

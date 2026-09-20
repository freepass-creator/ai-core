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
  owner_session:'A-session-one',
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
  r.claims = [claim(), claim({ claim_id:'A-002', owner_session:'A-session-two' })];
  const result = validateAWorkClaims(r);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(x => x.code === 'LIVE_CLAIM_DUPLICATE'));
});

test('expired claim does not block a new live claim', () => {
  const r = base();
  r.claims = [
    claim({ claim_id:'A-old', owner_session:'A-old', lease_until:'2026-09-20T01:25:00Z' }),
    claim({ claim_id:'A-new', owner_session:'A-new' })
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

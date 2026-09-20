import test from 'node:test';
import assert from 'node:assert/strict';
import { parseASessionScope, isCanonicalASessionScope, aSessionScopesConflict, requiresSubjectHeadGuard } from '../scripts/a-session-scope-policy.mjs';
import { evaluateClaim } from '../scripts/a-session-claim.mjs';

const rev='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const registry=(claims=[])=>({
  schema:'ai-core-a-session-work-claims/v1',
  status:'RESEARCH_COORDINATION_NOT_CANONICAL',
  observed_at:'2026-09-20T02:00:00Z',
  claims
});
const active=(scope,id='A-1')=>({
  claim_id:id,
  claim_key:`freepass-creator/x@${rev}::${scope}`,
  repository:'freepass-creator/x',
  subject_revision:rev,
  scope,
  owner_session:'A-one',
  state:'ACTIVE',
  claimed_at:'2026-09-20T01:50:00Z',
  lease_until:'2026-09-20T03:00:00Z',
  completed_at:null,
  evidence_refs:[]
});

test('canonical scope grammar accepts exact families and rejects aliases',()=>{
  assert.equal(isCanonicalASessionScope('repo-rescan'),true);
  assert.equal(isCanonicalASessionScope('runtime-evidence:promotion'),true);
  assert.equal(isCanonicalASessionScope('migration-gap:core-contract.sales-shadow-runtime-binding'),true);
  assert.equal(isCanonicalASessionScope('routing:workflow.forward-skip-evidence-integrity'),true);
  assert.equal(isCanonicalASessionScope('coordination:scope-policy'),true);
  assert.equal(isCanonicalASessionScope('audit'),false);
  assert.equal(isCanonicalASessionScope('runtime-evidence'),false);
  assert.equal(parseASessionScope('coordination:scope-policy').family,'coordination');
});

test('repo-rescan conflicts live with runtime and migration scopes',()=>{
  assert.equal(aSessionScopesConflict('repo-rescan','runtime-evidence:production'),true);
  assert.equal(aSessionScopesConflict('repo-rescan','migration-gap:gap-a'),true);
  assert.equal(aSessionScopesConflict('repo-rescan','routing:gap-a'),false);
  assert.equal(aSessionScopesConflict('coordination:a','coordination:b'),false);
});

test('evaluateClaim blocks overlapping live scope even when claim keys differ',()=>{
  const r=registry([active('repo-rescan')]);
  const result=evaluateClaim(r,{repository:'freepass-creator/x',revision:rev,scope:'runtime-evidence:production',owner:'A-two'},new Date('2026-09-20T02:00:00Z'));
  assert.equal(result.action,'SKIP_SCOPE_CONFLICT');
  assert.equal(result.claim.scope,'repo-rescan');
});

test('completed repo-rescan does not permanently suppress later runtime evidence checks',()=>{
  const done={...active('repo-rescan'),state:'COMPLETED',completed_at:'2026-09-20T01:55:00Z',evidence_refs:['commit:x']};
  const result=evaluateClaim(registry([done]),{repository:'freepass-creator/x',revision:rev,scope:'runtime-evidence:production',owner:'A-two'},new Date('2026-09-20T02:00:00Z'));
  assert.equal(result.action,'ACQUIRE');
});

test('unknown scope is rejected rather than becoming an alias loophole',()=>{
  assert.throws(()=>evaluateClaim(registry(),{repository:'freepass-creator/x',revision:rev,scope:'audit',owner:'A-two'},new Date('2026-09-20T02:00:00Z')),/CLAIM_SCOPE_INVALID/);
});


test('completion head guard applies only to inspection scopes',()=> {
  assert.equal(requiresSubjectHeadGuard('repo-rescan'),true);
  assert.equal(requiresSubjectHeadGuard('runtime-evidence:production'),true);
  assert.equal(requiresSubjectHeadGuard('migration-gap:gap-a'),true);
  assert.equal(requiresSubjectHeadGuard('routing:gap-a'),false);
  assert.equal(requiresSubjectHeadGuard('coordination:claim-health'),false);
});

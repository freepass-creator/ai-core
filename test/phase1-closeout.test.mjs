import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePhase1Closeout } from '../src/engine/phase1-closeout.mjs';

const sha = 'a'.repeat(40);
const base = {
  schema_version: '1.0',
  phase: 'PHASE_1',
  status: 'HOLD',
  observed_revision: sha,
  ci: { run_id: 1, head_sha: sha, conclusion: 'failure' },
  gates: {
    ownership_linked: true,
    executable_baseline: false,
    registry_linkage: false,
    revision_evidence: true,
    validation_green: false,
    no_false_completion: true
  },
  lanes: ['A','B','C','D'].map(id => ({ id, owner: id, status: 'HOLD', blockers: ['pending'], evidence: [] })),
  deferrable: []
};

test('HOLD manifest can be structurally valid without pretending Phase 1 is complete', () => {
  const result = evaluatePhase1Closeout(base);
  assert.equal(result.valid, true);
  assert.equal(result.lockable, false);
});

test('BASELINE_LOCKED requires every lane, gate and CI observation to pass at the same revision', () => {
  const locked = {
    ...base,
    status: 'BASELINE_LOCKED',
    ci: { run_id: 2, head_sha: sha, conclusion: 'success' },
    gates: Object.fromEntries(Object.keys(base.gates).map(key => [key, true])),
    lanes: ['A','B','C','D'].map(id => ({ id, owner: id, status: 'PASS', blockers: [], evidence: [{ path: `${id}.md` }] }))
  };
  const result = evaluatePhase1Closeout(locked);
  assert.equal(result.valid, true);
  assert.equal(result.lockable, true);
});

test('duplicate or missing lane identity is rejected', () => {
  const result = evaluatePhase1Closeout({ ...base, lanes: [base.lanes[0], base.lanes[0], base.lanes[2], base.lanes[3]] });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('exactly once')));
});

test('a PASS lane cannot hide blockers', () => {
  const lanes = base.lanes.map(lane => ({ ...lane }));
  lanes[0] = { ...lanes[0], status: 'PASS', evidence: [{ path: 'A.md' }] };
  const result = evaluatePhase1Closeout({ ...base, lanes });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(error => error.includes('PASS lane has blockers')));
});

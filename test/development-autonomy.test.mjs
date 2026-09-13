import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCapsuleStale,
  compileChangePacket,
  selectVerificationLayers,
  buildProofBundle,
  evaluateProofBundle
} from '../src/development-autonomy.mjs';

test('capsule becomes stale when revision changes', () => {
  assert.equal(isCapsuleStale({ source_revision: 'abc' }, 'abc'), false);
  assert.equal(isCapsuleStale({ source_revision: 'abc' }, 'def'), true);
});

test('change compiler requires acceptance and verification obligations', () => {
  assert.throws(() => compileChangePacket({
    taskId: 'T1', projectId: 'P1', sourceRevision: 'abc', userIntent: 'move price section', desiredOutcome: 'price section lower'
  }), /acceptance criteria/);
});

test('change compiler never grants execution authority itself', () => {
  const packet = compileChangePacket({
    taskId: 'T1',
    projectId: 'P1',
    sourceRevision: 'abc',
    userIntent: 'move price section',
    desiredOutcome: 'price section appears below vehicle details',
    acceptanceCriteria: ['web placement changed', 'mobile placement changed', 'price values unchanged'],
    nonGoals: ['change pricing logic'],
    verificationObligations: ['web preview', 'mobile preview', 'price regression']
  });
  assert.equal(packet.authorization.execution_authorized, false);
});

test('verification planner adds visual and responsive checks for UI work', () => {
  const layers = selectVerificationLayers({ desired_outcome: 'mobile page layout component change' });
  assert.ok(layers.includes('visual'));
  assert.ok(layers.includes('responsive'));
  assert.ok(layers.includes('runtime-smoke'));
});

test('verification planner adds state and integration checks for workflow changes', () => {
  const layers = selectVerificationLayers({ desired_outcome: 'status transition workflow change' });
  assert.ok(layers.includes('state-transition'));
  assert.ok(layers.includes('integration'));
});

test('proof with zero checks cannot pass', () => {
  const proof = buildProofBundle({
    taskId: 'T1',
    subjectRevision: 'abc',
    requirementResults: [{ id: 'R1', status: 'PASS', evidence_refs: ['e1'] }]
  });
  assert.deepEqual(evaluateProofBundle(proof), { status: 'HOLD', reason: 'NO_CHECKS' });
});

test('skipped checks produce partial rather than pass', () => {
  const proof = buildProofBundle({
    taskId: 'T1',
    subjectRevision: 'abc',
    requirementResults: [{ id: 'R1', status: 'PASS', evidence_refs: ['e1'] }],
    checks: [{ name: 'mobile preview', status: 'SKIP', executed: true }]
  });
  assert.deepEqual(evaluateProofBundle(proof), { status: 'PARTIAL', reason: 'INCOMPLETE_CHECKS' });
});

test('unexecuted checks hold the result', () => {
  const proof = buildProofBundle({
    taskId: 'T1',
    subjectRevision: 'abc',
    requirementResults: [{ id: 'R1', status: 'PASS', evidence_refs: ['e1'] }],
    checks: [{ name: 'regression', status: 'PASS', executed: false }]
  });
  assert.deepEqual(evaluateProofBundle(proof), { status: 'HOLD', reason: 'UNEXECUTED_CHECK' });
});

test('remaining unknowns prevent full scoped pass', () => {
  const proof = buildProofBundle({
    taskId: 'T1',
    subjectRevision: 'abc',
    requirementResults: [{ id: 'R1', status: 'PASS', evidence_refs: ['e1'] }],
    checks: [{ name: 'regression', status: 'PASS', executed: true }],
    unknowns: ['production environment not observed']
  });
  assert.deepEqual(evaluateProofBundle(proof), { status: 'PARTIAL', reason: 'REMAINING_UNKNOWNS' });
});

test('fully evidenced declared scope can pass without claiming deployment/outcome', () => {
  const proof = buildProofBundle({
    taskId: 'T1',
    subjectRevision: 'abc',
    requirementResults: [
      { id: 'R1', status: 'PASS', evidence_refs: ['preview:web'] },
      { id: 'R2', status: 'PASS', evidence_refs: ['preview:mobile'] }
    ],
    checks: [
      { name: 'web preview', status: 'PASS', executed: true, evidence_ref: 'preview:web' },
      { name: 'mobile preview', status: 'PASS', executed: true, evidence_ref: 'preview:mobile' }
    ],
    deploymentState: 'NOT_DEPLOYED',
    outcomeState: 'NOT_MEASURED'
  });
  assert.deepEqual(evaluateProofBundle(proof), { status: 'PASSED_WITHIN_SCOPE', reason: 'CURRENT_EVIDENCE_SATISFIES_DECLARED_SCOPE' });
});

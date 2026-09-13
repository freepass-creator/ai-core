import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileEvolutionPlan,
  createImprovementCandidate,
  evaluateTransferGate,
  reviewLensesFor,
  routeImprovementSignal
} from '../src/evolution-kernel.mjs';

test('routes operational, development and core gaps to their owning systems', () => {
  assert.equal(routeImprovementSignal({ kind: 'operational_failure' }), 'aiops');
  assert.equal(routeImprovementSignal({ kind: 'capability_gap' }), 'devcenter');
  assert.equal(routeImprovementSignal({ kind: 'routing_gap' }), 'ai-core');
});

test('development work receives proactive lenses the user did not have to enumerate', () => {
  const lenses = reviewLensesFor({ domain: 'development' });
  assert.ok(lenses.includes('security_privacy_and_authority'));
  assert.ok(lenses.includes('deployment_migration_rollback_and_compatibility'));
  assert.ok(lenses.includes('observability_and_real_outcome'));
});

test('an improvement signal creates a candidate but never auto-adopts it', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'CAP-1',
    kind: 'capability_gap',
    summary: 'Reusable validator is missing'
  }, { taskId: 'TASK-1' });
  assert.equal(candidate.target_system, 'devcenter');
  assert.equal(candidate.status, 'CANDIDATE');
  assert.equal(candidate.auto_adopted, false);
  assert.equal(candidate.execution_authorized, false);
});

test('transfer gate holds without reproducible evidence and independent review', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'CAP-1',
    kind: 'capability_gap',
    summary: 'Reusable validator is missing',
    change_class: 'C'
  }, { taskId: 'TASK-1' });
  const gate = evaluateTransferGate(candidate, {});
  assert.equal(gate.status, 'HOLD');
  assert.ok(gate.missing.includes('candidate_revision'));
  assert.ok(gate.missing.includes('independent_review'));
  assert.ok(gate.missing.includes('claude_design'));
});

test('transfer gate becomes ready only for the same reviewed revision', () => {
  const candidate = createImprovementCandidate({
    signal_id: 'OPS-1',
    kind: 'workflow_friction',
    summary: 'Repeated manual handoff',
    change_class: 'B',
    created_by: 'AI_CORE'
  }, { taskId: 'TASK-1' });
  const evidence = {
    problem_reproduced: true,
    candidate_revision: 'abc123',
    checks: [{ id: 'regression', result: 'PASS' }],
    independent_review: { reviewer: 'CLAUDE', decision: 'APPROVE', revision: 'abc123' },
    rollback_plan: 'Revert candidate commit',
    target_acceptance: { reviewer: 'AIOPS', decision: 'APPROVE', revision: 'abc123' }
  };
  assert.equal(evaluateTransferGate(candidate, evidence).status, 'TRANSFER_READY');

  const stale = {
    ...evidence,
    independent_review: { reviewer: 'CLAUDE', decision: 'APPROVE', revision: 'old' }
  };
  assert.equal(evaluateTransferGate(candidate, stale).status, 'HOLD');
});

test('invalid observations are rejected without crashing the evolution plan', () => {
  const plan = compileEvolutionPlan({
    task: { task_id: 'TASK-1' },
    observations: [
      { signal_id: 'OK', kind: 'routing_gap', summary: 'Route was wrong' },
      { signal_id: 'BAD', kind: 'unknown', summary: 'Unknown signal' }
    ]
  });
  assert.equal(plan.candidates.length, 1);
  assert.equal(plan.rejected.length, 1);
  assert.equal(plan.auto_adopted, false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateSelfEvolution } from '../scripts/evaluate-self-evolution.mjs';

const candidate = {
  candidate_id: 'EVOL-001', source_episode_id: 'DEV-EPISODE-001', scope: 'ai-core',
  cause_hypothesis: 'prose-only state drifted', before_behavior: 'manual claims',
  after_behavior: 'reject known state drift', counterexample: 'missing entrypoint',
  rollback: 'revert candidate commit', expected_benefit: 'fewer false claims',
  possible_harm: 'brittle checks', target_metrics: ['false_completion_events']
};

function episode(overrides = {}) {
  return {
    status: 'CLOSED', project: { id: 'ai-core' },
    execution: { subject_revision: 'commit' },
    evidence_state: { proof_revision_matches_subject: true, independent_review: 'CONFIRMED', failures: 0 },
    metrics: {
      false_completion_events: 1, unverified_criteria_count: 0,
      regression_events: 0, user_correction_count: 1, rework_loop_count: 1
    },
    ...overrides
  };
}

test('incomplete candidate cannot enter a trial', () => {
  assert.equal(evaluateSelfEvolution({ candidate: {}, baseline: episode(), trial: episode() }).status,
    'HOLD_INCOMPLETE_CANDIDATE');
});

test('open or self-reviewed episodes cannot prove evolution', () => {
  const result = evaluateSelfEvolution({
    candidate, baseline: episode(),
    trial: episode({ status: 'AWAITING_USER_REVIEW', evidence_state: {
      proof_revision_matches_subject: null, independent_review: 'PARTIAL', failures: 0
    } })
  });
  assert.equal(result.status, 'HOLD_INSUFFICIENT_EVIDENCE');
  assert.ok(result.reasons.includes('TRIAL_NOT_CLOSED'));
});

test('safety or evidence regression rejects a faster-looking trial', () => {
  const result = evaluateSelfEvolution({
    candidate, baseline: episode(),
    trial: episode({ metrics: { ...episode().metrics, false_completion_events: 0, regression_events: 1 } })
  });
  assert.equal(result.status, 'REJECTED_REGRESSION');
});

test('no observed benefit remains HOLD', () => {
  assert.equal(evaluateSelfEvolution({ candidate, baseline: episode(), trial: episode() }).status,
    'HOLD_NO_OBSERVED_BENEFIT');
});

test('comparable closed evidence produces only an adoption candidate', () => {
  const trial = episode({ metrics: { ...episode().metrics, false_completion_events: 0 } });
  const result = evaluateSelfEvolution({ candidate, baseline: episode(), trial });
  assert.equal(result.status, 'ADOPTION_CANDIDATE');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

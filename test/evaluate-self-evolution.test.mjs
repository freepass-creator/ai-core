import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateDigest, evaluateSelfEvolution } from '../scripts/evaluate-self-evolution.mjs';

function makeCandidate(overrides = {}) {
  const value = {
    candidate_id: 'EVOL-001', source_episode_id: 'BASE-1', baseline_episode_id: 'BASE-1',
    trial_episode_id: 'TRIAL-1', scope: 'ai-core', confidence: 0.7,
    cause_hypothesis: 'prose-only state drifted', before_behavior: 'manual claims',
    after_behavior: 'reject known state drift', counterexample: 'missing entrypoint',
    executable_check: 'node --test', rollback: 'revert candidate commit',
    expected_benefit: 'fewer false claims', possible_harm: 'brittle checks',
    current_state: 'TRIAL_READY', candidate_revision: 'candidate-commit',
    registered_at: '2026-09-01T12:00:00Z', trial_started_at: '2026-09-02T00:00:00Z',
    target_metrics: ['false_completion_events'],
    non_application_conditions: ['other repositories'], evidence_refs: ['commit:candidate'],
    ...overrides
  };
  value.candidate_digest = candidateDigest(value);
  return value;
}

function episode(id, observedAt, overrides = {}) {
  const base = {
    episode_id: id, status: 'CLOSED', project: { id: 'ai-core' },
    intent: { requirement_set_digest: `${id}-requirements` },
    execution: { subject_revision: `${id}-commit` },
    evidence_state: {
      proof_revision_matches_subject: true, independent_review: 'CONFIRMED', failures: 0,
      unresolved_p0: 0, unresolved_p1: 0, authority_violations: 0,
      evidence_loss_events: 0, user_control_violations: 0
    },
    metrics: {
      false_completion_events: 1, unverified_criteria_count: 0, regression_events: 0,
      user_correction_count: 1, rework_loop_count: 1,
      acceptance_criteria_total: 2, criteria_with_current_evidence: 2
    },
    comparison: {
      key: 'docs-consistency', requirement_family_digest: 'family-1',
      metric_schema_version: '1', observation_window: 'task-through-review', observed_at: observedAt
    },
    outcome: { observed: true, success: true }
  };
  return { ...base, ...overrides };
}

const baseline = episode('BASE-1', '2026-09-01T00:00:00Z');
const improvedTrial = episode('TRIAL-1', '2026-09-03T00:00:00Z', {
  metrics: { ...episode('x', '2026-09-03T00:00:00Z').metrics, false_completion_events: 0 }
});

test('incomplete or semantically invalid candidate remains HOLD', () => {
  assert.equal(evaluateSelfEvolution({ candidate: {}, baseline, trial: improvedTrial }).status,
    'HOLD_INCOMPLETE_CANDIDATE');
  const invalid = makeCandidate({ current_state: 'WHATEVER', non_application_conditions: [null] });
  assert.equal(evaluateSelfEvolution({ candidate: invalid, baseline, trial: improvedTrial }).status,
    'HOLD_INCOMPLETE_CANDIDATE');
});

test('candidate mutation after digesting is rejected', () => {
  const candidate = makeCandidate();
  candidate.target_metrics = ['user_correction_count'];
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: improvedTrial }).status,
    'HOLD_INCOMPLETE_CANDIDATE');
});

test('candidate must be registered before the trial begins', () => {
  const candidate = makeCandidate({ registered_at: '2026-09-02T01:00:00Z' });
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: improvedTrial }).status,
    'HOLD_NOT_COMPARABLE');
});

test('open or incomplete evidence cannot prove evolution', () => {
  const trial = { ...improvedTrial, status: 'AWAITING_USER_REVIEW', outcome: {} };
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial }).status,
    'HOLD_INSUFFICIENT_EVIDENCE');
});

test('same, mislinked, older or differently observed episodes are not comparable', () => {
  const sameEpisode = { ...improvedTrial, episode_id: 'BASE-1' };
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial: sameEpisode }).status,
    'HOLD_NOT_COMPARABLE');
  const mismatched = { ...improvedTrial, comparison: { ...improvedTrial.comparison, observation_window: 'shorter' } };
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial: mismatched }).status,
    'HOLD_NOT_COMPARABLE');
});

test('safety, authority, evidence or outcome regression rejects a trial', () => {
  const unsafe = { ...improvedTrial,
    evidence_state: { ...improvedTrial.evidence_state, authority_violations: 1 } };
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial: unsafe }).status,
    'REJECTED_REGRESSION');
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline,
    trial: { ...improvedTrial, outcome: { observed: true, success: false } } }).status,
  'REJECTED_REGRESSION');
});

test('negative, fractional or impossible counts are invalid evidence', () => {
  const invalid = { ...improvedTrial,
    metrics: { ...improvedTrial.metrics, false_completion_events: -1,
      acceptance_criteria_total: 0, criteria_with_current_evidence: 0.5 } };
  assert.equal(evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial: invalid }).status,
    'HOLD_INSUFFICIENT_EVIDENCE');
});

test('no observed target benefit remains HOLD', () => {
  const safeMetrics = { ...baseline.metrics, false_completion_events: 0 };
  const safeBaseline = episode('BASE-1', '2026-09-01T00:00:00Z', { metrics: safeMetrics });
  const unchanged = episode('TRIAL-1', '2026-09-03T00:00:00Z', { metrics: safeMetrics });
  assert.equal(evaluateSelfEvolution({
    candidate: makeCandidate({ target_metrics: ['user_correction_count'] }),
    baseline: safeBaseline, trial: unchanged
  }).status, 'HOLD_NO_OBSERVED_BENEFIT');
});

test('even favorable local evidence cannot self-issue adoption status', () => {
  const result = evaluateSelfEvolution({ candidate: makeCandidate(), baseline, trial: improvedTrial,
    trustedEvidence: { verifyEpisode: () => ({ everything: true }) } });
  assert.equal(result.status, 'HOLD_EXTERNAL_ATTESTATION_REQUIRED');
  assert.equal(result.provisional_finding, 'OUTCOME_BENEFIT_OBSERVED');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

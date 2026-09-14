import test from 'node:test';
import assert from 'node:assert/strict';
import { episodeDigest, evaluateSelfEvolution } from '../scripts/evaluate-self-evolution.mjs';

const candidate = {
  candidate_id: 'EVOL-001', source_episode_id: 'BASE-1', baseline_episode_id: 'BASE-1',
  trial_episode_id: 'TRIAL-1', scope: 'ai-core', confidence: 0.7,
  cause_hypothesis: 'prose-only state drifted', before_behavior: 'manual claims',
  after_behavior: 'reject known state drift', counterexample: 'missing entrypoint',
  executable_check: 'node --test', rollback: 'revert candidate commit',
  expected_benefit: 'fewer false claims', possible_harm: 'brittle checks',
  current_state: 'LOCALLY_TESTED', target_metrics: ['false_completion_events'],
  non_application_conditions: ['other repositories'], evidence_refs: ['commit:candidate']
};

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
const improvedTrial = episode('TRIAL-1', '2026-09-02T00:00:00Z', {
  metrics: { ...episode('x', '2026-09-02T00:00:00Z').metrics, false_completion_events: 0 }
});
function trustedFor(...episodes) {
  const receipts = new Map(episodes.map(value => [value.episode_id, {
    revision_exists: true, proof_bound: true, review_result: 'CONFIRMED',
    subject_revision: value.execution.subject_revision,
    requirement_set_digest: value.intent.requirement_set_digest,
    episode_digest: episodeDigest(value), author_id: 'author',
    reviewer_id: 'independent-reviewer', evidence_ref: `trusted:${value.episode_id}`
  }]));
  return { verifyEpisode: value => receipts.get(value.episode_id) };
}

test('incomplete candidate cannot enter a trial', () => {
  assert.equal(evaluateSelfEvolution({ candidate: {}, baseline, trial: improvedTrial }).status,
    'HOLD_INCOMPLETE_CANDIDATE');
});

test('open or incomplete evidence cannot prove evolution', () => {
  const trial = { ...improvedTrial, status: 'AWAITING_USER_REVIEW', outcome: {} };
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial, trustedEvidence: trustedFor(baseline, trial) }).status,
    'HOLD_INSUFFICIENT_EVIDENCE');
});

test('forged confirmation strings cannot cross the trust boundary', () => {
  const result = evaluateSelfEvolution({ candidate, baseline, trial: improvedTrial });
  assert.equal(result.status, 'HOLD_UNTRUSTED_EVIDENCE');
});

test('same, mislinked, older or differently observed episodes are not comparable', () => {
  const sameEpisode = { ...improvedTrial, episode_id: 'BASE-1' };
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: sameEpisode, trustedEvidence: trustedFor(baseline, sameEpisode) }).status,
    'HOLD_NOT_COMPARABLE');
  const mismatched = { ...improvedTrial, comparison: { ...improvedTrial.comparison, observation_window: 'shorter' } };
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: mismatched, trustedEvidence: trustedFor(baseline, mismatched) }).status,
    'HOLD_NOT_COMPARABLE');
});

test('safety, authority, evidence or outcome regression rejects a trial', () => {
  const unsafe = {
    ...improvedTrial,
    evidence_state: { ...improvedTrial.evidence_state, authority_violations: 1 }
  };
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: unsafe, trustedEvidence: trustedFor(baseline, unsafe) }).status,
    'REJECTED_REGRESSION');
  assert.equal(evaluateSelfEvolution({
    candidate, baseline,
    trial: { ...improvedTrial, outcome: { observed: true, success: false } },
    trustedEvidence: trustedFor(baseline, { ...improvedTrial, outcome: { observed: true, success: false } })
  }).status, 'REJECTED_REGRESSION');
});

test('no observed target benefit remains HOLD', () => {
  const safeBaseline = episode('BASE-1', '2026-09-01T00:00:00Z', {
    metrics: { ...baseline.metrics, false_completion_events: 0 }
  });
  const unchanged = episode('TRIAL-1', '2026-09-02T00:00:00Z', {
    metrics: { ...baseline.metrics, false_completion_events: 0 }
  });
  const correctionCandidate = { ...candidate, target_metrics: ['user_correction_count'] };
  assert.equal(evaluateSelfEvolution({
    candidate: correctionCandidate, baseline: safeBaseline, trial: unchanged,
    trustedEvidence: trustedFor(safeBaseline, unchanged)
  }).status,
    'HOLD_NO_OBSERVED_BENEFIT');
});

test('trusted comparable outcomes produce only an adoption candidate', () => {
  const result = evaluateSelfEvolution({
    candidate, baseline, trial: improvedTrial, trustedEvidence: trustedFor(baseline, improvedTrial)
  });
  assert.equal(result.status, 'ADOPTION_CANDIDATE');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

test('receipt binds the complete episode including metrics and outcome', () => {
  const trustedEvidence = trustedFor(baseline, improvedTrial);
  const mutated = { ...improvedTrial, outcome: { observed: true, success: false } };
  assert.equal(evaluateSelfEvolution({ candidate, baseline, trial: mutated, trustedEvidence }).status,
    'HOLD_UNTRUSTED_EVIDENCE');
});

test('absolute safety violations cannot survive into an adoption candidate', () => {
  const unsafe = {
    ...improvedTrial,
    evidence_state: { ...improvedTrial.evidence_state, user_control_violations: 1 }
  };
  assert.equal(evaluateSelfEvolution({
    candidate, baseline, trial: unsafe, trustedEvidence: trustedFor(baseline, unsafe)
  }).status, 'REJECTED_REGRESSION');
});

test('negative, fractional or impossible counts are invalid evidence', () => {
  const invalid = {
    ...improvedTrial,
    metrics: { ...improvedTrial.metrics, false_completion_events: -1, acceptance_criteria_total: 0,
      criteria_with_current_evidence: 0.5 }
  };
  assert.equal(evaluateSelfEvolution({
    candidate, baseline, trial: invalid, trustedEvidence: trustedFor(baseline, invalid)
  }).status, 'HOLD_INSUFFICIENT_EVIDENCE');
});

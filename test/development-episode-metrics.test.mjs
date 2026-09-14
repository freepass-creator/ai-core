import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeDevelopmentEpisode, compareEpisodes } from '../src/development-episode-metrics.mjs';

const baseEpisode = {
  episode_id: 'DEV-EPISODE-001',
  status: 'VERIFYING',
  metrics: {
    clarification_question_count: 1,
    repeated_information_request_count: 0,
    user_correction_count: 0,
    user_review_round_count: 1,
    stale_plan_events: 0,
    stale_proof_events: 0,
    context_reread_count: 1,
    resume_time_minutes: 5,
    candidate_reuse_count: 2,
    reused_capability_count: 1,
    new_capability_count: 1,
    files_touched_count: 4,
    rework_loop_count: 1,
    intent_to_first_preview_minutes: 35,
    acceptance_criteria_total: 4,
    criteria_with_current_evidence: 4,
    false_completion_events: 0,
    regression_events: 0,
    unverified_criteria_count: 0
  },
  evidence_state: {
    proof_revision_matches_subject: true,
    failures: 0,
    unknowns: 0,
    false_completion_events: 0
  }
};

test('completion claim requires complete current evidence', () => {
  const result = summarizeDevelopmentEpisode(baseEpisode);
  assert.equal(result.evidence_coverage, 1);
  assert.equal(result.ready_for_completion_claim, true);
});

test('stale or missing proof blocks completion claim', () => {
  const episode = structuredClone(baseEpisode);
  episode.evidence_state.proof_revision_matches_subject = false;
  assert.equal(summarizeDevelopmentEpisode(episode).ready_for_completion_claim, false);
});

test('unverified criterion blocks completion claim', () => {
  const episode = structuredClone(baseEpisode);
  episode.metrics.criteria_with_current_evidence = 3;
  episode.metrics.unverified_criteria_count = 1;
  const result = summarizeDevelopmentEpisode(episode);
  assert.equal(result.evidence_coverage, 0.75);
  assert.equal(result.ready_for_completion_claim, false);
});

test('impossible evidence counts are rejected', () => {
  const episode = structuredClone(baseEpisode);
  episode.metrics.criteria_with_current_evidence = 5;
  assert.throws(() => summarizeDevelopmentEpisode(episode), /cannot exceed/);
});

test('comparison reports raw deltas without claiming improvement', () => {
  const current = structuredClone(baseEpisode);
  const baseline = structuredClone(baseEpisode);
  baseline.metrics.clarification_question_count = 3;
  baseline.metrics.rework_loop_count = 2;
  const result = compareEpisodes(current, baseline);
  assert.equal(result.status, 'BASELINE_AVAILABLE');
  assert.equal(result.deltas.clarification_questions, -2);
  assert.equal(result.deltas.rework_loops, -1);
});

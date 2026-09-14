export function summarizeDevelopmentEpisode(episode) {
  if (!episode || typeof episode !== 'object') throw new TypeError('episode object required');
  const m = episode.metrics || {};
  const total = Number(m.acceptance_criteria_total ?? 0);
  const evidenced = Number(m.criteria_with_current_evidence ?? 0);
  const unverified = Number(m.unverified_criteria_count ?? Math.max(total - evidenced, 0));

  if (evidenced > total) throw new Error('criteria_with_current_evidence cannot exceed acceptance_criteria_total');
  if (unverified > total) throw new Error('unverified_criteria_count cannot exceed acceptance_criteria_total');

  const proofMatches = episode.evidence_state?.proof_revision_matches_subject;
  const falseCompletion = Number(episode.evidence_state?.false_completion_events ?? m.false_completion_events ?? 0);
  const failures = Number(episode.evidence_state?.failures ?? 0);
  const unknowns = Number(episode.evidence_state?.unknowns ?? 0);

  const evidenceCoverage = total === 0 ? null : evidenced / total;
  const readyForCompletionClaim =
    total > 0 &&
    evidenced === total &&
    unverified === 0 &&
    proofMatches === true &&
    falseCompletion === 0 &&
    failures === 0 &&
    unknowns === 0;

  return {
    episode_id: episode.episode_id,
    status: episode.status,
    evidence_coverage: evidenceCoverage,
    ready_for_completion_claim: readyForCompletionClaim,
    human_friction: {
      clarification_questions: Number(m.clarification_question_count ?? 0),
      repeated_information_requests: Number(m.repeated_information_request_count ?? 0),
      user_corrections: Number(m.user_correction_count ?? 0),
      review_rounds: Number(m.user_review_round_count ?? 0)
    },
    continuity: {
      stale_plan_events: Number(m.stale_plan_events ?? 0),
      stale_proof_events: Number(m.stale_proof_events ?? 0),
      context_rereads: Number(m.context_reread_count ?? 0),
      resume_time_minutes: m.resume_time_minutes ?? null
    },
    implementation: {
      candidate_reuse_count: Number(m.candidate_reuse_count ?? 0),
      reused_capability_count: Number(m.reused_capability_count ?? 0),
      new_capability_count: Number(m.new_capability_count ?? 0),
      files_touched_count: Number(m.files_touched_count ?? 0),
      rework_loop_count: Number(m.rework_loop_count ?? 0),
      intent_to_first_preview_minutes: m.intent_to_first_preview_minutes ?? null
    },
    reliability: {
      acceptance_criteria_total: total,
      criteria_with_current_evidence: evidenced,
      unverified_criteria_count: unverified,
      false_completion_events: falseCompletion,
      regression_events: Number(m.regression_events ?? 0),
      proof_revision_matches_subject: proofMatches ?? null
    }
  };
}

export function compareEpisodes(current, baseline) {
  const c = summarizeDevelopmentEpisode(current);
  if (!baseline) return { current: c, baseline: null, deltas: null, status: 'BASELINE_UNKNOWN' };
  const b = summarizeDevelopmentEpisode(baseline);
  const delta = (a, z) => (a == null || z == null ? null : a - z);
  return {
    current: c,
    baseline: b,
    status: 'BASELINE_AVAILABLE',
    deltas: {
      clarification_questions: delta(c.human_friction.clarification_questions, b.human_friction.clarification_questions),
      repeated_information_requests: delta(c.human_friction.repeated_information_requests, b.human_friction.repeated_information_requests),
      user_corrections: delta(c.human_friction.user_corrections, b.human_friction.user_corrections),
      rework_loops: delta(c.implementation.rework_loop_count, b.implementation.rework_loop_count),
      intent_to_first_preview_minutes: delta(c.implementation.intent_to_first_preview_minutes, b.implementation.intent_to_first_preview_minutes),
      evidence_coverage: delta(c.evidence_coverage, b.evidence_coverage),
      false_completion_events: delta(c.reliability.false_completion_events, b.reliability.false_completion_events),
      regression_events: delta(c.reliability.regression_events, b.reliability.regression_events)
    }
  };
}

const METRIC_FIELDS = [
  'clarification_question_count',
  'repeated_information_request_count',
  'user_correction_count',
  'user_review_round_count',
  'rework_loop_count',
  'false_completion_events',
  'unverified_criteria_count',
  'regression_events',
  'acceptance_criteria_total',
  'criteria_with_current_evidence'
];

const SAFETY_FIELDS = [
  'unresolved_p0',
  'unresolved_p1',
  'authority_violations',
  'evidence_loss_events',
  'user_control_violations'
];

const LESSON_KINDS = new Set([
  'USER_CORRECTION',
  'FAILURE',
  'REWORK',
  'FALSE_COMPLETION',
  'SUCCESS_PATTERN'
]);

const TARGET_SCOPES = new Set(['LOCAL', 'DOMAIN', 'UNIVERSAL_CANDIDATE']);

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function count(value) {
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))];
}

function collectEvidenceRefs(episode, observations) {
  const refs = [];
  if (Array.isArray(episode?.evidence_refs)) refs.push(...episode.evidence_refs);
  for (const requirement of episode?.intent?.requirements ?? []) {
    if (Array.isArray(requirement?.evidence_refs)) refs.push(...requirement.evidence_refs);
  }
  for (const observation of observations) if (observation.evidence_ref) refs.push(observation.evidence_ref);
  return uniqueStrings(refs);
}

function normalizeObservation(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { index, valid: false, reason: 'OBSERVATION_NOT_OBJECT' };
  }
  const kind = text(value.kind);
  const sanitizedSummary = text(value.sanitized_summary);
  const targetScope = text(value.target_scope) ?? 'LOCAL';
  if (!LESSON_KINDS.has(kind)) return { index, valid: false, reason: 'OBSERVATION_KIND_INVALID' };
  if (!sanitizedSummary) return { index, valid: false, reason: 'SANITIZED_SUMMARY_MISSING' };
  if (!TARGET_SCOPES.has(targetScope)) return { index, valid: false, reason: 'TARGET_SCOPE_INVALID' };
  return {
    index,
    valid: true,
    kind,
    sanitized_summary: sanitizedSummary,
    evidence_ref: text(value.evidence_ref),
    proposed_change: text(value.proposed_change),
    prediction: text(value.prediction),
    target_scope: targetScope
  };
}

function makeLessonCandidate({ episodeId, projectId, subjectRevision, observation }) {
  const ready = Boolean(
    observation.evidence_ref &&
    observation.proposed_change &&
    observation.prediction &&
    subjectRevision
  );
  return {
    lesson_id: `LESSON-${episodeId ?? 'UNKNOWN'}-${String(observation.index + 1).padStart(2, '0')}`,
    source_episode_id: episodeId,
    project_id: projectId,
    source_revision: subjectRevision,
    observed_kind: observation.kind,
    observed_friction: observation.sanitized_summary,
    proposed_change: observation.proposed_change,
    prediction: observation.prediction,
    target_scope: observation.target_scope,
    evidence_refs: uniqueStrings([observation.evidence_ref]),
    status: observation.kind === 'SUCCESS_PATTERN'
      ? 'OBSERVED_PATTERN'
      : ready ? 'RESEARCH_CANDIDATE' : 'HOLD_NEEDS_CAUSAL_DETAIL',
    auto_adopted: false,
    execution_authorized: false
  };
}

export function buildEpisodeFeedback(episode) {
  if (!episode || typeof episode !== 'object' || Array.isArray(episode)) {
    throw new TypeError('episode must be an object');
  }

  const episodeId = text(episode.episode_id);
  const projectId = text(episode.project?.id);
  const subjectRevision =
    text(episode.execution?.subject_revision) ??
    text(episode.project?.base_revision);
  const intentSummary = text(episode.intent?.summary);
  const normalized = (episode.lesson_observations ?? []).map(normalizeObservation);
  const observations = normalized.filter(item => item.valid);
  const invalidObservations = normalized.filter(item => !item.valid);
  const metrics = {};
  for (const key of METRIC_FIELDS) metrics[key] = count(episode.metrics?.[key]) ?? 'UNKNOWN';

  const safety = {};
  for (const key of SAFETY_FIELDS) safety[key] = count(episode.evidence_state?.[key]) ?? 'UNKNOWN';

  const unresolved = [];
  if (!episodeId) unresolved.push('EPISODE_ID_MISSING');
  if (!projectId) unresolved.push('PROJECT_ID_MISSING');
  if (!subjectRevision) unresolved.push('SUBJECT_REVISION_MISSING');
  if (!intentSummary) unresolved.push('USER_INTENT_SUMMARY_MISSING');
  if (episode.status !== 'CLOSED') unresolved.push('EPISODE_NOT_CLOSED');
  if (episode.evidence_state?.proof_revision_matches_subject !== true) unresolved.push('PROOF_REVISION_UNBOUND');
  if (episode.evidence_state?.independent_review !== 'CONFIRMED') unresolved.push('INDEPENDENT_REVIEW_UNCONFIRMED');
  if (episode.outcome?.observed !== true) unresolved.push('OUTCOME_UNOBSERVED');
  for (const [key, value] of Object.entries(metrics)) if (value === 'UNKNOWN') unresolved.push(`METRIC_${key.toUpperCase()}_UNKNOWN`);
  for (const [key, value] of Object.entries(safety)) if (value === 'UNKNOWN') unresolved.push(`SAFETY_${key.toUpperCase()}_UNKNOWN`);
  for (const item of invalidObservations) unresolved.push(`LESSON_${item.index + 1}_${item.reason}`);

  const whatFailed = [];
  if (count(episode.evidence_state?.failures) > 0) whatFailed.push('VERIFICATION_FAILURES_OBSERVED');
  if (count(episode.metrics?.false_completion_events) > 0) whatFailed.push('FALSE_COMPLETION_OBSERVED');
  if (count(episode.metrics?.user_correction_count) > 0) whatFailed.push('USER_CORRECTIONS_OBSERVED');
  if (count(episode.metrics?.rework_loop_count) > 0) whatFailed.push('REWORK_OBSERVED');
  if (count(episode.metrics?.regression_events) > 0) whatFailed.push('REGRESSION_OBSERVED');
  if (count(episode.metrics?.unverified_criteria_count) > 0) whatFailed.push('UNVERIFIED_CRITERIA_REMAIN');

  const whatWorked = [];
  if (episode.evidence_state?.proof_revision_matches_subject === true) whatWorked.push('PROOF_BOUND_TO_SUBJECT_REVISION');
  if (episode.evidence_state?.independent_review === 'CONFIRMED') whatWorked.push('INDEPENDENT_REVIEW_CONFIRMED');
  if (episode.outcome?.observed === true && episode.outcome?.success === true) whatWorked.push('REAL_OUTCOME_OBSERVED_SUCCESS');
  const total = count(episode.metrics?.acceptance_criteria_total);
  const covered = count(episode.metrics?.criteria_with_current_evidence);
  if (total && covered === total) whatWorked.push('ACCEPTANCE_EVIDENCE_COMPLETE');

  const lessonCandidates = observations.map(observation =>
    makeLessonCandidate({ episodeId, projectId, subjectRevision, observation })
  );

  const correctionObservedCount = observations.filter(item => item.kind === 'USER_CORRECTION').length;
  const correctionMetric = count(episode.metrics?.user_correction_count);
  const candidateImplications = [];
  if (correctionMetric != null && correctionMetric > correctionObservedCount) {
    candidateImplications.push({
      kind: 'USER_CORRECTION_DETAIL_MISSING',
      observed_count: correctionMetric,
      structured_count: correctionObservedCount,
      status: 'HOLD',
      action: 'Add non-sensitive lesson_observations with evidence refs before proposing a reusable lesson.'
    });
  }

  const evidenceRefs = collectEvidenceRefs(episode, observations);
  const feedbackStatus = unresolved.length ? 'HOLD' : 'READY';

  return {
    feedback_id: `FB-${projectId ?? 'UNKNOWN'}-${episodeId ?? 'UNKNOWN'}`,
    feedback_status: feedbackStatus,
    source_episode_id: episodeId,
    subject_revision: subjectRevision,
    user_intent: intentSummary,
    what_worked: whatWorked,
    what_failed: whatFailed,
    metrics,
    safety,
    unresolved: uniqueStrings(unresolved),
    evidence_refs: evidenceRefs,
    lesson_candidates: lessonCandidates,
    candidate_implications: candidateImplications,
    privacy: {
      raw_conversation_copied: false,
      raw_customer_data_copied: false,
      note: 'Only non-sensitive summaries and evidence pointers belong in Academy feedback.'
    },
    auto_adopted: false,
    execution_authorized: false
  };
}

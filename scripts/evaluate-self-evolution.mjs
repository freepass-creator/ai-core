import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_TEXT = [
  'candidate_id', 'source_episode_id', 'baseline_episode_id', 'trial_episode_id',
  'scope', 'cause_hypothesis', 'before_behavior', 'after_behavior', 'counterexample',
  'executable_check', 'rollback', 'expected_benefit', 'possible_harm', 'current_state',
  'candidate_revision', 'registered_at', 'trial_started_at'
];
const SAFE_METRICS = new Set([
  'user_correction_count', 'rework_loop_count', 'false_completion_events',
  'unverified_criteria_count', 'regression_events'
]);
const SAFETY_COUNTS = [
  'unresolved_p0', 'unresolved_p1', 'authority_violations',
  'evidence_loss_events', 'user_control_violations'
];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function episodeDigest(episode) {
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(episode))).digest('hex')}`;
}

export function candidateDigest(candidate) {
  const { candidate_digest: ignored, ...content } = candidate ?? {};
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex')}`;
}

function isCount(value, { positive = false } = {}) {
  return Number.isInteger(value) && (positive ? value > 0 : value >= 0);
}

function metric(episode, key) {
  const value = episode?.metrics?.[key];
  return Number.isFinite(value) ? value : null;
}

function candidateProblems(candidate = {}) {
  const problems = REQUIRED_TEXT.filter(field => !String(candidate[field] ?? '').trim());
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) {
    problems.push('confidence');
  }
  for (const field of ['target_metrics', 'non_application_conditions', 'evidence_refs']) {
    if (!Array.isArray(candidate[field]) || !candidate[field].length ||
        candidate[field].some(value => typeof value !== 'string' || !value.trim())) problems.push(field);
  }
  if (candidate.target_metrics?.some(key => !SAFE_METRICS.has(key))) problems.push('target_metrics');
  if (candidate.current_state !== 'TRIAL_READY') problems.push('current_state');
  for (const field of ['candidate_id', 'source_episode_id', 'baseline_episode_id', 'trial_episode_id']) {
    if (!/^[A-Z0-9][A-Z0-9._-]*$/i.test(candidate[field] ?? '')) problems.push(field);
  }
  if (candidate.candidate_digest !== candidateDigest(candidate)) problems.push('candidate_digest');
  if (!Number.isFinite(Date.parse(candidate.registered_at ?? ''))) problems.push('registered_at');
  if (!Number.isFinite(Date.parse(candidate.trial_started_at ?? ''))) problems.push('trial_started_at');
  return [...new Set(problems)].sort();
}

function episodeProblems(label, episode) {
  if (!episode) return [`${label}_MISSING`];
  const problems = [];
  if (episode.status !== 'CLOSED') problems.push(`${label}_NOT_CLOSED`);
  if (!episode.execution?.subject_revision) problems.push(`${label}_SUBJECT_UNBOUND`);
  if (!episode.intent?.requirement_set_digest) problems.push(`${label}_REQUIREMENTS_UNBOUND`);
  if (episode.evidence_state?.proof_revision_matches_subject !== true) problems.push(`${label}_PROOF_UNBOUND`);
  if (episode.evidence_state?.independent_review !== 'CONFIRMED') problems.push(`${label}_REVIEW_UNCONFIRMED`);
  if (!isCount(episode.evidence_state?.failures)) problems.push(`${label}_FAILURES_INVALID`);
  for (const key of SAFETY_COUNTS) {
    if (!isCount(episode.evidence_state?.[key])) problems.push(`${label}_${key.toUpperCase()}_INVALID`);
  }
  if (!isCount(metric(episode, 'acceptance_criteria_total'), { positive: true })) {
    problems.push(`${label}_ACCEPTANCE_CRITERIA_TOTAL_INVALID`);
  }
  if (!isCount(metric(episode, 'criteria_with_current_evidence')) ||
      metric(episode, 'criteria_with_current_evidence') > metric(episode, 'acceptance_criteria_total')) {
    problems.push(`${label}_CRITERIA_WITH_CURRENT_EVIDENCE_INVALID`);
  }
  for (const key of ['false_completion_events', 'unverified_criteria_count', 'regression_events']) {
    if (!isCount(metric(episode, key))) problems.push(`${label}_${key.toUpperCase()}_INVALID`);
  }
  for (const key of ['key', 'requirement_family_digest', 'metric_schema_version', 'observation_window']) {
    if (!String(episode.comparison?.[key] ?? '').trim()) problems.push(`${label}_COMPARISON_${key.toUpperCase()}_MISSING`);
  }
  if (!Number.isFinite(Date.parse(episode.comparison?.observed_at ?? ''))) {
    problems.push(`${label}_OBSERVED_AT_INVALID`);
  }
  if (episode.outcome?.observed !== true || typeof episode.outcome?.success !== 'boolean') {
    problems.push(`${label}_OUTCOME_UNOBSERVED`);
  }
  return problems;
}

function comparabilityProblems(candidate, baseline, trial) {
  const problems = [];
  if (candidate.source_episode_id !== baseline.episode_id ||
      candidate.baseline_episode_id !== baseline.episode_id ||
      candidate.trial_episode_id !== trial.episode_id) problems.push('EPISODE_LINK_MISMATCH');
  if (baseline.episode_id === trial.episode_id) problems.push('SAME_EPISODE_COMPARISON');
  if (baseline.project?.id !== candidate.scope || trial.project?.id !== candidate.scope) {
    problems.push('SCOPE_NOT_COMPARABLE');
  }
  for (const key of ['key', 'requirement_family_digest', 'metric_schema_version', 'observation_window']) {
    if (baseline.comparison?.[key] !== trial.comparison?.[key]) problems.push(`COMPARISON_${key.toUpperCase()}_MISMATCH`);
  }
  if (Date.parse(trial.comparison?.observed_at) <= Date.parse(baseline.comparison?.observed_at)) {
    problems.push('TRIAL_NOT_LATER_THAN_BASELINE');
  }
  if (Date.parse(candidate.registered_at) < Date.parse(baseline.comparison?.observed_at) ||
      Date.parse(candidate.registered_at) >= Date.parse(candidate.trial_started_at) ||
      Date.parse(candidate.trial_started_at) > Date.parse(trial.comparison?.observed_at)) {
    problems.push('CANDIDATE_NOT_REGISTERED_BEFORE_TRIAL');
  }
  return problems;
}

export function evaluateSelfEvolution({ candidate, baseline, trial }) {
  const incomplete = candidateProblems(candidate);
  if (incomplete.length) return { status: 'HOLD_INCOMPLETE_CANDIDATE', reasons: incomplete, auto_adopted: false };

  const evidence = [...episodeProblems('BASELINE', baseline), ...episodeProblems('TRIAL', trial)];
  for (const key of candidate.target_metrics) {
    if (!isCount(metric(baseline, key)) || !isCount(metric(trial, key))) {
      evidence.push(`TARGET_${key.toUpperCase()}_INVALID`);
    }
  }
  if (evidence.length) return { status: 'HOLD_INSUFFICIENT_EVIDENCE', reasons: evidence, auto_adopted: false };

  const comparison = comparabilityProblems(candidate, baseline, trial);
  if (comparison.length) return { status: 'HOLD_NOT_COMPARABLE', reasons: comparison, auto_adopted: false };

  const regressions = [];
  for (const key of SAFETY_COUNTS) if (trial.evidence_state[key] !== 0) regressions.push(key);
  for (const key of ['false_completion_events', 'unverified_criteria_count', 'regression_events']) {
    if (metric(trial, key) !== 0) regressions.push(key);
  }
  if (trial.evidence_state.failures !== 0 || trial.outcome.success !== true) {
    regressions.push('verification_or_outcome');
  }
  const baselineCoverage = metric(baseline, 'criteria_with_current_evidence') / metric(baseline, 'acceptance_criteria_total');
  const trialCoverage = metric(trial, 'criteria_with_current_evidence') / metric(trial, 'acceptance_criteria_total');
  if (!Number.isFinite(baselineCoverage) || !Number.isFinite(trialCoverage) ||
      trialCoverage !== 1 || trialCoverage < baselineCoverage) {
    regressions.push('acceptance_coverage');
  }
  if (regressions.length) return { status: 'REJECTED_REGRESSION', reasons: [...new Set(regressions)], auto_adopted: false };

  const comparisons = candidate.target_metrics.map(key => ({ key, before: metric(baseline, key), after: metric(trial, key) }));
  if (comparisons.some(item => item.before == null || item.after == null)) {
    return { status: 'HOLD_INSUFFICIENT_EVIDENCE', reasons: ['TARGET_METRIC_UNOBSERVED'], auto_adopted: false };
  }
  if (comparisons.some(item => item.after > item.before)) {
    return { status: 'REJECTED_REGRESSION', reasons: ['TARGET_METRIC_WORSENED'], comparisons, auto_adopted: false };
  }
  if (!comparisons.some(item => item.after < item.before)) {
    return { status: 'HOLD_NO_OBSERVED_BENEFIT', reasons: [], comparisons, auto_adopted: false };
  }
  return {
    status: 'HOLD_EXTERNAL_ATTESTATION_REQUIRED',
    provisional_finding: 'OUTCOME_BENEFIT_OBSERVED',
    scope: candidate.scope,
    candidate_digest: candidate.candidate_digest,
    baseline_episode_digest: episodeDigest(baseline),
    trial_episode_digest: episodeDigest(trial),
    comparisons,
    auto_adopted: false,
    execution_authorized: false
  };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), 'utf8'));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 5) {
    console.error('Usage: node scripts/evaluate-self-evolution.mjs <candidate.json> <baseline.json> <trial.json>');
    process.exitCode = 2;
  } else {
    const [candidate, baseline, trial] = await Promise.all(process.argv.slice(2).map(readJson));
    console.log(JSON.stringify(evaluateSelfEvolution({ candidate, baseline, trial }), null, 2));
  }
}

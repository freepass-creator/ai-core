import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_CANDIDATE_FIELDS = [
  'candidate_id', 'source_episode_id', 'scope', 'cause_hypothesis',
  'before_behavior', 'after_behavior', 'counterexample', 'rollback',
  'expected_benefit', 'possible_harm'
];

const SAFE_METRICS = new Set([
  'user_correction_count', 'rework_loop_count', 'false_completion_events',
  'unverified_criteria_count', 'regression_events'
]);

function metric(episode, key) {
  const value = episode?.metrics?.[key];
  return Number.isFinite(value) ? value : null;
}

function evidenceProblems(label, episode) {
  const problems = [];
  if (!episode) return [`${label}_MISSING`];
  if (episode.status !== 'CLOSED') problems.push(`${label}_NOT_CLOSED`);
  if (!episode.execution?.subject_revision) problems.push(`${label}_SUBJECT_UNBOUND`);
  if (episode.evidence_state?.proof_revision_matches_subject !== true) problems.push(`${label}_PROOF_UNBOUND`);
  if (episode.evidence_state?.independent_review !== 'CONFIRMED') problems.push(`${label}_REVIEW_UNCONFIRMED`);
  return problems;
}

export function evaluateSelfEvolution({ candidate, baseline, trial }) {
  const missing = REQUIRED_CANDIDATE_FIELDS.filter(field => !String(candidate?.[field] ?? '').trim());
  const targetMetrics = candidate?.target_metrics;
  if (!Array.isArray(targetMetrics) || !targetMetrics.length ||
      targetMetrics.some(key => !SAFE_METRICS.has(key))) {
    missing.push('target_metrics');
  }
  if (missing.length) {
    return { status: 'HOLD_INCOMPLETE_CANDIDATE', reasons: [...new Set(missing)].sort(), auto_adopted: false };
  }

  const evidence = [...evidenceProblems('BASELINE', baseline), ...evidenceProblems('TRIAL', trial)];
  if (baseline?.project?.id !== trial?.project?.id || baseline?.project?.id !== candidate.scope) {
    evidence.push('SCOPE_NOT_COMPARABLE');
  }
  if (evidence.length) {
    return { status: 'HOLD_INSUFFICIENT_EVIDENCE', reasons: evidence, auto_adopted: false };
  }

  const guardMetrics = ['false_completion_events', 'unverified_criteria_count', 'regression_events'];
  const regressions = guardMetrics.filter(key => {
    const before = metric(baseline, key);
    const after = metric(trial, key);
    return before == null || after == null || after > before;
  });
  if (trial.evidence_state.failures > baseline.evidence_state.failures) regressions.push('verification_failures');
  if (regressions.length) {
    return { status: 'REJECTED_REGRESSION', reasons: regressions, auto_adopted: false };
  }

  const comparisons = targetMetrics.map(key => ({ key, before: metric(baseline, key), after: metric(trial, key) }));
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
    status: 'ADOPTION_CANDIDATE',
    scope: candidate.scope,
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

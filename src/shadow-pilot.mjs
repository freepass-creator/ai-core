export function compareOutcomes({ baseline, candidate }) {
  const keys = ['rework_count','repeated_context_count','context_items_loaded','work_execution_count','elapsed_seconds'];
  const deltas = Object.fromEntries(keys.map(k => [k, number(candidate?.metrics?.[k]) - number(baseline?.metrics?.[k])]));
  const baselineFirstPass = Boolean(baseline?.metrics?.first_pass_success);
  const candidateFirstPass = Boolean(candidate?.metrics?.first_pass_success);
  const safetyRegression = Boolean(candidate?.safety_regression);
  const qualityRegression = Boolean(candidate?.quality_regression);
  const evidenceComplete = Boolean(candidate?.evidence_complete);
  const improvesAnyCost = keys.some(k => deltas[k] < 0) || (!baselineFirstPass && candidateFirstPass);
  const worsensAnyCost = keys.some(k => deltas[k] > 0);

  let decision = 'HOLD';
  const reasons = [];
  if (!evidenceComplete) reasons.push('EVIDENCE_INCOMPLETE');
  if (safetyRegression) reasons.push('SAFETY_REGRESSION');
  if (qualityRegression) reasons.push('QUALITY_REGRESSION');
  if (!improvesAnyCost) reasons.push('NO_OBSERVED_IMPROVEMENT');
  if (worsensAnyCost) reasons.push('COST_REGRESSION_PRESENT');

  if (evidenceComplete && !safetyRegression && !qualityRegression && improvesAnyCost && !worsensAnyCost) {
    decision = 'PROMOTION_CANDIDATE';
  } else if (safetyRegression || qualityRegression) {
    decision = 'REVERT_CANDIDATE';
  }

  return {
    decision,
    reasons,
    baseline_id: baseline?.id ?? null,
    candidate_id: candidate?.id ?? null,
    deltas,
    first_pass_change: { baseline: baselineFirstPass, candidate: candidateFirstPass },
    authorization: 'NOT_GRANTED',
    caveat: 'This compares observed task outcomes only; it does not prove general superiority or authorize adoption.'
  };
}

function number(v){ return Number.isFinite(Number(v)) ? Number(v) : 0; }

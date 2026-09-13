const FORBIDDEN_AUTO_SCOPES = new Set(['deployment','production_data','delete','permissions','payment','legal_filing','physical_harm','weapons']);

export function classifyLearningDestination(candidate={}) {
  const t = `${candidate.type ?? ''} ${candidate.area ?? ''}`.toLowerCase();
  if (/(context|routing|handoff|orchestration|work packet|learning loop)/.test(t)) return 'AI_CORE';
  if (/(component|test|build|lint|ui token|dev standard|tooling)/.test(t)) return 'DEVCENTER';
  if (/(operation|business rule|incident|authority|approval|failure pattern)/.test(t)) return 'AIOPS';
  return 'PROJECT_LOCAL';
}

export function proposeImprovement(observation={}) {
  return {
    candidate_id: observation.candidate_id ?? `EV-${Date.now()}`,
    problem: observation.problem ?? null,
    previous_failure: observation.previous_failure ?? null,
    proposed_change: observation.proposed_change ?? null,
    target_scope: observation.target_scope ?? 'project_local',
    destination: classifyLearningDestination(observation),
    status: 'DESIGN',
    authorization: 'NOT_GRANTED'
  };
}

export function evaluateImprovement(candidate, evidence={}) {
  const findings=[];
  if (!candidate.problem) findings.push('MISSING_PROBLEM');
  if (!candidate.previous_failure) findings.push('MISSING_PREVIOUS_FAILURE');
  if (!candidate.proposed_change) findings.push('MISSING_PROPOSED_CHANGE');
  if (FORBIDDEN_AUTO_SCOPES.has(candidate.target_scope)) findings.push('HUMAN_GATE_REQUIRED');
  if (!evidence.failure_reproduced) findings.push('FAILURE_NOT_REPRODUCED');
  if (!evidence.candidate_prevents_failure) findings.push('IMPROVEMENT_NOT_PROVEN');
  if (evidence.false_positive_regression === true) findings.push('NORMAL_CASE_REGRESSION');
  if (!evidence.independent_review) findings.push('INDEPENDENT_REVIEW_MISSING');
  const hard = findings.some(x => ['MISSING_PROBLEM','MISSING_PREVIOUS_FAILURE','MISSING_PROPOSED_CHANGE','HUMAN_GATE_REQUIRED','FAILURE_NOT_REPRODUCED','IMPROVEMENT_NOT_PROVEN','NORMAL_CASE_REGRESSION'].includes(x));
  const stage = hard ? 'REJECT_OR_REWORK' : evidence.shadow_validated ? 'SHADOW_VALIDATED' : 'INDEPENDENTLY_VERIFIED';
  return {
    candidate_id: candidate.candidate_id,
    stage,
    findings,
    destination: candidate.destination,
    authorization: 'NOT_GRANTED',
    auto_promote: false,
    next_step: stage === 'INDEPENDENTLY_VERIFIED' ? 'RUN_SHADOW_PILOT' : stage === 'SHADOW_VALIDATED' ? 'OUTCOME_REVIEW' : 'REWORK'
  };
}

export function compareOutcome(baseline={}, candidate={}) {
  const fields=['rework_count','repeated_context_count','context_items_loaded','work_execution_count','elapsed_seconds'];
  const delta={};
  for (const f of fields) {
    if (Number.isFinite(baseline[f]) && Number.isFinite(candidate[f])) delta[f]=candidate[f]-baseline[f];
  }
  if (typeof baseline.first_pass_success === 'boolean' && typeof candidate.first_pass_success === 'boolean') {
    delta.first_pass_success = Number(candidate.first_pass_success)-Number(baseline.first_pass_success);
  }
  return {baseline,candidate,delta,interpretation:'observed_delta_only'};
}

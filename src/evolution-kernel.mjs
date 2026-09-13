const SIGNAL_TARGET = Object.freeze({
  operational_failure: 'aiops',
  workflow_friction: 'aiops',
  business_knowledge_gap: 'aiops',
  capability_gap: 'devcenter',
  reusable_asset_gap: 'devcenter',
  verification_gap: 'devcenter',
  standard_drift: 'devcenter',
  project_onboarding_gap: 'devcenter',
  routing_gap: 'ai-core',
  context_gap: 'ai-core',
  governance_gap: 'ai-core',
  cross_system_conflict: 'ai-core'
});

const DEVELOPMENT_REVIEW_LENSES = Object.freeze([
  'requirements_and_done_when',
  'ssot_and_source_revision',
  'data_integrity_and_state_transitions',
  'security_privacy_and_authority',
  'reuse_and_maintainability',
  'empty_loading_failure_permission_and_concurrency_states',
  'performance_cost_and_scalability',
  'ui_consistency_accessibility_and_mobile',
  'deployment_migration_rollback_and_compatibility',
  'observability_and_real_outcome'
]);

const DOCUMENT_REVIEW_LENSES = Object.freeze([
  'source_accuracy_and_revision',
  'structure_and_visual_hierarchy',
  'privacy_and_audience',
  'rendering_and_export_integrity',
  'accessibility_and_reuse'
]);

const GENERAL_REVIEW_LENSES = Object.freeze([
  'source_accuracy_and_revision',
  'authority_and_privacy',
  'operational_risk_and_reversibility',
  'cost_and_expected_outcome',
  'evidence_and_follow_up'
]);

export function reviewLensesFor(task) {
  if (task?.domain === 'development') return [...DEVELOPMENT_REVIEW_LENSES];
  if (task?.domain === 'document') return [...DOCUMENT_REVIEW_LENSES];
  return [...GENERAL_REVIEW_LENSES];
}

export function routeImprovementSignal(signal) {
  const target = SIGNAL_TARGET[signal?.kind];
  if (!target) throw new Error(`unsupported improvement signal: ${signal?.kind ?? 'missing'}`);
  return target;
}

function normalizedEvidenceRefs(references = []) {
  return references
    .filter(reference => reference?.location && reference?.revision_or_sha)
    .map(reference => ({
      location: reference.location,
      revision_or_sha: reference.revision_or_sha
    }));
}

export function createImprovementCandidate(signal, {
  taskId = 'UNSCOPED',
  sourcePointers = []
} = {}) {
  if (!signal?.signal_id || !signal?.summary) {
    throw new Error('signal_id and summary are required');
  }

  const targetSystem = routeImprovementSignal(signal);
  return {
    candidate_id: `${taskId}:${signal.signal_id}`,
    status: 'CANDIDATE',
    target_system: targetSystem,
    kind: signal.kind,
    summary: signal.summary,
    scope: signal.scope ?? '*',
    severity: signal.severity ?? 'hold',
    change_class: signal.change_class ?? 'C',
    created_by: signal.created_by ?? 'AI_CORE',
    evidence_refs: normalizedEvidenceRefs([
      ...sourcePointers,
      ...(signal.evidence_refs ?? [])
    ]),
    required_evidence: [
      'problem_reproduced',
      'candidate_revision',
      'checks_passed',
      'independent_review',
      'rollback_plan',
      'target_acceptance'
    ],
    next_gate: 'TRANSFER_GATE',
    auto_adopted: false,
    execution_authorized: false
  };
}

function approvalRequirements(changeClass) {
  if (changeClass === 'D') {
    return ['claude_design', 'claude_final', 'user_just_in_time'];
  }
  if (changeClass === 'C') return ['claude_design'];
  return [];
}

function approvedForRevision(review, revision) {
  return Boolean(
    review
    && review.decision === 'APPROVE'
    && review.revision === revision
  );
}

export function evaluateTransferGate(candidate, evidence = {}) {
  const missing = [];
  const candidateRevision = evidence.candidate_revision;

  if (evidence.problem_reproduced !== true) missing.push('problem_reproduced');
  if (!candidateRevision) missing.push('candidate_revision');
  if (!Array.isArray(evidence.checks) || !evidence.checks.length) {
    missing.push('checks_passed');
  } else if (evidence.checks.some(check => check?.result !== 'PASS')) {
    missing.push('checks_passed');
  }

  if (!approvedForRevision(evidence.independent_review, candidateRevision)) {
    missing.push('independent_review');
  } else if (evidence.independent_review.reviewer === candidate.created_by) {
    missing.push('independent_reviewer_required');
  }

  if (!evidence.rollback_plan) missing.push('rollback_plan');
  if (!approvedForRevision(evidence.target_acceptance, candidateRevision)) {
    missing.push('target_acceptance');
  }

  const requiredApprovals = approvalRequirements(candidate.change_class);
  for (const approval of requiredApprovals) {
    if (evidence.approvals?.[approval] !== true) missing.push(approval);
  }

  const uniqueMissing = [...new Set(missing)];
  return {
    candidate_id: candidate.candidate_id,
    target_system: candidate.target_system,
    candidate_revision: candidateRevision ?? null,
    status: uniqueMissing.length ? 'HOLD' : 'TRANSFER_READY',
    missing: uniqueMissing,
    required_approvals: requiredApprovals,
    next_action: uniqueMissing.length ? 'COMPLETE_EVIDENCE' : 'SUBMIT_TO_TARGET_SYSTEM',
    execution_authorized: false
  };
}

export function derivePreflightSignals({
  task,
  sourceBindings = [],
  capabilityBindings = [],
  holds = []
}) {
  const signals = [];

  for (const binding of sourceBindings) {
    if (!binding.required || binding.status === 'BOUND') continue;
    const kind = binding.system === 'aiops'
      ? 'business_knowledge_gap'
      : binding.system === 'devcenter'
        ? 'capability_gap'
        : 'project_onboarding_gap';
    signals.push({
      signal_id: `source:${binding.system}:${binding.kind}`,
      kind,
      summary: `Required source is not pinned: ${binding.system}:${binding.kind}`,
      scope: task.project ?? task.domain,
      severity: 'hold',
      change_class: 'C'
    });
  }

  for (const binding of capabilityBindings) {
    if (binding.status === 'RESOLVED') continue;
    signals.push({
      signal_id: `capability:${binding.scope}`,
      kind: binding.status === 'HOLD' ? 'cross_system_conflict' : 'capability_gap',
      summary: `Capability is not pinned: ${binding.scope} (${binding.status})`,
      scope: binding.scope,
      severity: binding.status === 'HOLD' ? 'fail' : 'hold',
      change_class: 'C'
    });
  }

  if (holds.includes('SUBJECT_REVISION_UNRESOLVED')) {
    signals.push({
      signal_id: 'core:subject-revision',
      kind: 'context_gap',
      summary: 'Target project revision could not be pinned',
      scope: task.project ?? '*',
      severity: 'hold',
      change_class: 'C'
    });
  }
  if (holds.includes('DONE_WHEN_UNSPECIFIED')) {
    signals.push({
      signal_id: 'intake:done-when',
      kind: 'workflow_friction',
      summary: 'Task intake did not provide verifiable completion conditions',
      scope: task.project ?? task.domain,
      severity: 'hold',
      change_class: 'B'
    });
  }

  return deduplicateSignals(signals);
}

function deduplicateSignals(signals) {
  const seen = new Set();
  return signals.filter(signal => {
    if (seen.has(signal.signal_id)) return false;
    seen.add(signal.signal_id);
    return true;
  });
}

export function compileEvolutionPlan({
  task,
  observations = [],
  sourcePointers = []
}) {
  const candidates = [];
  const rejected = [];

  for (const observation of deduplicateSignals(observations)) {
    try {
      const candidate = createImprovementCandidate(observation, {
        taskId: task.task_id,
        sourcePointers
      });
      candidates.push({
        ...candidate,
        transfer_gate: evaluateTransferGate(candidate)
      });
    } catch (error) {
      rejected.push({
        signal_id: observation?.signal_id ?? null,
        reason: error?.message ?? 'invalid observation'
      });
    }
  }

  return {
    status: candidates.length ? 'CANDIDATES_CREATED' : 'NO_SIGNAL',
    candidates,
    rejected,
    auto_adopted: false,
    execution_authorized: false
  };
}

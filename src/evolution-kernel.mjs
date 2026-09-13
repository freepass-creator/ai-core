import { effectiveDomains } from './domain-policy.mjs';
import { createHash } from 'node:crypto';
import {
  buildCapabilityRevisionSet,
  buildRequirementSet,
  buildSourceRevisionSet,
  PROOF_POLICY_REVISION
} from './domain-quality.mjs';

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

const CONVERSATION_DOMAIN_TARGET = Object.freeze({
  development: 'devcenter',
  legal: 'aiops',
  business: 'aiops',
  document: 'aiops',
  communication: 'aiops',
  general: 'ai-core',
  core: 'ai-core'
});
const CHANGE_CLASSES = new Set(['A', 'B', 'C', 'D']);
const SEVERITIES = new Set(['notice', 'hold', 'fail']);
const TARGET_SYSTEMS = new Set(['ai-core', 'aiops', 'devcenter']);
const CANDIDATE_KINDS = new Set([...Object.keys(SIGNAL_TARGET), 'conversation_lesson']);
const REQUIRED_TRANSFER_EVIDENCE = Object.freeze([
  'task_context_binding',
  'subject_revision_binding',
  'source_revision_set_binding',
  'capability_revision_set_binding',
  'policy_revision_binding',
  'problem_reproduction_receipt',
  'candidate_revision',
  'same_revision_check_receipts',
  'independent_review',
  'revision_bound_rollback_plan',
  'target_acceptance'
]);
const CANDIDATE_FIELDS = new Set([
  'candidate_id', 'candidate_digest', 'task_id', 'signal_id', 'task_context_digest',
  'subject_revision', 'source_revision_set_digest', 'capability_revision_set_digest',
  'policy_revision', 'transfer_context_digest',
  'status', 'target_system', 'kind', 'summary',
  'scope', 'severity', 'change_class', 'created_by', 'routing_domains',
  'evidence_refs', 'required_evidence', 'next_gate', 'auto_adopted',
  'execution_authorized'
]);
const TRANSFER_EVIDENCE_FIELDS = new Set([
  'candidate_revision', 'reproduction_receipt', 'checks', 'independent_review',
  'rollback_plan', 'target_acceptance', 'approvals'
]);
const APPROVAL_RECEIPT_FIELDS = new Set([
  'reviewer', 'authority', 'decision', 'revision', 'candidate_id',
  'candidate_digest', 'task_context_digest', 'transfer_context_digest', 'evidence_ref'
]);
const CHECK_RECEIPT_FIELDS = new Set([
  'id', 'result', 'revision', 'candidate_id', 'candidate_digest',
  'task_context_digest', 'transfer_context_digest', 'executed_checks', 'failures', 'skips',
  'execution_ref', 'evidence_refs'
]);
const ROLLBACK_RECEIPT_FIELDS = new Set([
  'summary', 'revision', 'candidate_id', 'candidate_digest',
  'task_context_digest', 'transfer_context_digest', 'evidence_ref'
]);
const REPRODUCTION_RECEIPT_FIELDS = new Set([
  'result', 'candidate_revision', 'reproduced_against_revision', 'candidate_id',
  'candidate_digest', 'task_context_digest', 'transfer_context_digest',
  'executed_checks', 'failures', 'skips', 'evidence_ref'
]);

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
  'purpose_audience_and_requested_action',
  'source_claim_citation_and_revision_alignment',
  'cross_section_number_term_and_date_consistency',
  'structure_visual_hierarchy_and_reader_clarity',
  'privacy_confidentiality_and_audience',
  'rendering_and_export_integrity',
  'accessibility_and_reuse'
]);

const LEGAL_REVIEW_LENSES = Object.freeze([
  'objective_jurisdiction_issues_and_remedy',
  'fact_evidence_opponent_claim_inference_authority_uncertainty',
  'sourced_chronology_and_procedural_deadlines',
  'current_official_law_and_case_authority',
  'adverse_evidence_counterarguments_and_exceptions',
  'citation_quote_and_evidence_number_integrity',
  'confidentiality_privilege_and_minimum_disclosure',
  'responsible_human_final_review'
]);

const BUSINESS_REVIEW_LENSES = Object.freeze([
  'contract_revenue_cash_customer_behavior_and_outcome_separation',
  'cost_margin_cashflow_and_working_capital',
  'assumptions_scenarios_sensitivity_and_unknowns',
  'downside_risk_stop_conditions_and_reversibility',
  'baseline_metric_time_horizon_and_measured_outcome'
]);

const COMMUNICATION_REVIEW_LENSES = Object.freeze([
  'sender_recipient_channel_and_authority',
  'fact_number_promise_attachment_accuracy',
  'tone_relationship_and_minimum_disclosure',
  'recipient_action_deadline_and_reply_path',
  'draft_approval_delivery_receipt_and_outcome_separation'
]);

const GENERAL_REVIEW_LENSES = Object.freeze([
  'source_accuracy_and_revision',
  'authority_and_privacy',
  'operational_risk_and_reversibility',
  'cost_and_expected_outcome',
  'evidence_and_follow_up'
]);

function lensesForDomain(domain) {
  if (domain === 'development') return DEVELOPMENT_REVIEW_LENSES;
  if (domain === 'document') return DOCUMENT_REVIEW_LENSES;
  if (domain === 'legal') return LEGAL_REVIEW_LENSES;
  if (domain === 'business') return BUSINESS_REVIEW_LENSES;
  if (domain === 'communication') return COMMUNICATION_REVIEW_LENSES;
  return GENERAL_REVIEW_LENSES;
}

export function reviewLensesFor(task) {
  const domains = effectiveDomains(task);
  return [...new Set(domains.flatMap(lensesForDomain))];
}

export function routeImprovementSignal(signal) {
  if (signal?.kind === 'conversation_lesson') {
    if (!Array.isArray(signal.domains) || !signal.domains.length) {
      throw new Error('conversation_lesson requires a supported domain');
    }
    const domains = signal.domains;
    if (domains.some(domain => !Object.hasOwn(CONVERSATION_DOMAIN_TARGET, domain))) {
      throw new Error('conversation_lesson contains an unsupported domain');
    }
    const targets = new Set(domains.map(domain => CONVERSATION_DOMAIN_TARGET[domain]).filter(Boolean));
    return targets.size === 1 ? [...targets][0] : 'ai-core';
  }
  const target = SIGNAL_TARGET[signal?.kind];
  if (!target) throw new Error('unsupported improvement signal kind');
  return target;
}

function normalizedEvidenceRefs(references = []) {
  return references
    .filter(reference => (
      reference?.location && (reference?.revision_or_sha || reference?.observed_at)
    ))
    .map(reference => ({
      location: reference.location,
      ...(reference.revision_or_sha ? { revision_or_sha: reference.revision_or_sha } : {}),
      ...(reference.observed_at ? { observed_at: reference.observed_at } : {}),
      ...(reference.kind ? { kind: reference.kind } : {})
    }));
}

export function taskContextDigestFor(task = {}) {
  return buildRequirementSet(task).digest;
}

function digestFor(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function rejectedSignalIdFor(value) {
  if (value == null) return null;
  try {
    return `rejected:${digestFor({ signal_id: value })}`;
  } catch {
    return 'rejected:unavailable';
  }
}

function transferContextDigestFromParts({
  task_context_digest: taskContextDigest,
  subject_revision: subjectRevision,
  source_revision_set_digest: sourceRevisionSetDigest,
  capability_revision_set_digest: capabilityRevisionSetDigest,
  policy_revision: policyRevision
}) {
  return digestFor({
    task_context_digest: taskContextDigest ?? null,
    subject_revision: subjectRevision ?? null,
    source_revision_set_digest: sourceRevisionSetDigest ?? null,
    capability_revision_set_digest: capabilityRevisionSetDigest ?? null,
    policy_revision: policyRevision ?? null
  });
}

export function transferContextFor({
  task,
  subjectRevision = null,
  sourcePointers = [],
  capabilityRefs = [],
  policyRevision = PROOF_POLICY_REVISION
} = {}) {
  if (subjectRevision != null && (
    typeof subjectRevision !== 'string' || !subjectRevision.trim()
  )) throw new Error('subjectRevision must be null or a non-empty string');
  if (typeof policyRevision !== 'string' || !policyRevision.trim()) {
    throw new Error('policyRevision must be a non-empty string');
  }
  const context = {
    task_context_digest: taskContextDigestFor(task),
    subject_revision: subjectRevision?.trim() ?? null,
    source_revision_set_digest: buildSourceRevisionSet(sourcePointers).digest,
    capability_revision_set_digest: buildCapabilityRevisionSet(capabilityRefs).digest,
    policy_revision: policyRevision.trim()
  };
  return {
    ...context,
    transfer_context_digest: transferContextDigestFromParts(context)
  };
}

function candidateIdFor(taskId, signalId, transferContextDigest) {
  const identity = JSON.stringify({
    task_id: taskId,
    signal_id: signalId,
    transfer_context_digest: transferContextDigest
  });
  const digest = createHash('sha256').update(identity).digest('hex');
  return `candidate:${digest.slice(0, 24)}`;
}

export function createImprovementCandidate(signal, {
  task,
  subjectRevision = null,
  sourcePointers = [],
  capabilityRefs = [],
  policyRevision = PROOF_POLICY_REVISION
} = {}) {
  const taskId = typeof task?.task_id === 'string' ? task.task_id.trim() : '';
  const signalId = typeof signal?.signal_id === 'string' ? signal.signal_id.trim() : '';
  if (!taskId) throw new Error('task with a non-empty task_id is required');
  if (!signalId || typeof signal?.summary !== 'string' || !signal.summary.trim()) {
    throw new Error('signal_id and summary are required');
  }

  const targetSystem = routeImprovementSignal(signal);
  const changeClass = signal.change_class ?? 'C';
  const severity = signal.severity ?? 'hold';
  if (!CHANGE_CLASSES.has(changeClass)) throw new Error('unsupported change_class');
  if (!SEVERITIES.has(severity)) throw new Error('unsupported severity');
  const createdBy = canonicalPrincipal(signal.created_by ?? 'AI_CORE');
  if (!createdBy) throw new Error('created_by must be a non-empty principal ID');
  const transferContext = transferContextFor({
    task,
    subjectRevision,
    sourcePointers,
    capabilityRefs,
    policyRevision
  });
  const candidate = {
    candidate_id: candidateIdFor(
      taskId,
      signalId,
      transferContext.transfer_context_digest
    ),
    task_id: taskId,
    signal_id: signalId,
    ...transferContext,
    status: 'CANDIDATE',
    target_system: targetSystem,
    kind: signal.kind,
    summary: signal.summary,
    scope: signal.scope ?? '*',
    severity,
    change_class: changeClass,
    created_by: createdBy,
    routing_domains: signal.kind === 'conversation_lesson'
      ? [...new Set((signal.domains ?? []).map(String))].sort()
      : [],
    evidence_refs: normalizedEvidenceRefs([
      ...sourcePointers,
      ...(signal.evidence_refs ?? [])
    ]),
    required_evidence: [...REQUIRED_TRANSFER_EVIDENCE],
    next_gate: 'TRANSFER_GATE',
    auto_adopted: false,
    execution_authorized: false
  };
  return { ...candidate, candidate_digest: candidateDigestFor(candidate) };
}

export function candidateDigestFor(candidate) {
  const payload = {
    candidate_id: candidate?.candidate_id ?? null,
    task_id: candidate?.task_id ?? null,
    signal_id: candidate?.signal_id ?? null,
    task_context_digest: candidate?.task_context_digest ?? null,
    subject_revision: candidate?.subject_revision ?? null,
    source_revision_set_digest: candidate?.source_revision_set_digest ?? null,
    capability_revision_set_digest: candidate?.capability_revision_set_digest ?? null,
    policy_revision: candidate?.policy_revision ?? null,
    transfer_context_digest: candidate?.transfer_context_digest ?? null,
    status: candidate?.status ?? null,
    target_system: candidate?.target_system ?? null,
    kind: candidate?.kind ?? null,
    summary: candidate?.summary ?? null,
    scope: candidate?.scope ?? null,
    severity: candidate?.severity ?? null,
    change_class: candidate?.change_class ?? null,
    created_by: candidate?.created_by ?? null,
    routing_domains: Array.isArray(candidate?.routing_domains)
      ? candidate.routing_domains
      : [],
    evidence_refs: Array.isArray(candidate?.evidence_refs) ? candidate.evidence_refs : [],
    required_evidence: Array.isArray(candidate?.required_evidence)
      ? candidate.required_evidence
      : [],
    next_gate: candidate?.next_gate ?? null,
    auto_adopted: candidate?.auto_adopted ?? null,
    execution_authorized: candidate?.execution_authorized ?? null
  };
  return `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
}

function canonicalPrincipal(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  return normalized && /^[a-z0-9][a-z0-9._:@/-]*$/.test(normalized)
    ? normalized
    : null;
}

function dateTimeEpoch(value) {
  if (
    typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  ) return Number.NaN;
  return Date.parse(value);
}

function hasOnlyFields(value, allowed) {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.has(key))
  );
}

function approvalRequirements(changeClass) {
  if (changeClass === 'D') {
    return ['claude_design', 'claude_final', 'user_just_in_time'];
  }
  if (changeClass === 'C') return ['claude_design'];
  return [];
}

function approvedForRevision(review, revision, candidate, authority, evaluationEpoch) {
  const reviewer = canonicalPrincipal(review?.reviewer);
  return Boolean(
    hasOnlyFields(review, APPROVAL_RECEIPT_FIELDS)
    && review.decision === 'APPROVE'
    && review.revision === revision
    && reviewer
    && review.authority === authority
    && review.candidate_id === candidate.candidate_id
    && review.candidate_digest === candidate.candidate_digest
    && review.task_context_digest === candidate.task_context_digest
    && review.transfer_context_digest === candidate.transfer_context_digest
    && versionedPointer(review.evidence_ref, evaluationEpoch)
  );
}

function versionedPointer(pointer, evaluationEpoch = Date.now()) {
  const location = typeof pointer?.location === 'string' ? pointer.location.trim() : '';
  const revision = typeof pointer?.revision_or_sha === 'string'
    ? pointer.revision_or_sha.trim()
    : '';
  const observedAt = typeof pointer?.observed_at === 'string'
    ? pointer.observed_at.trim()
    : '';
  const observedEpoch = dateTimeEpoch(observedAt);
  if (observedAt && (Number.isNaN(observedEpoch) || observedEpoch > evaluationEpoch)) return false;
  return Boolean(location && (revision || observedAt));
}

function checkPassesForRevision(check, revision, candidate, evaluationEpoch) {
  return Boolean(
    hasOnlyFields(check, CHECK_RECEIPT_FIELDS)
    && check.result === 'PASS'
    && check.revision === revision
    && check.candidate_id === candidate.candidate_id
    && check.candidate_digest === candidate.candidate_digest
    && check.task_context_digest === candidate.task_context_digest
    && check.transfer_context_digest === candidate.transfer_context_digest
    && Number.isInteger(check.executed_checks)
    && check.executed_checks > 0
    && check.failures === 0
    && check.skips === 0
    && versionedPointer(check.execution_ref, evaluationEpoch)
    && Array.isArray(check.evidence_refs)
    && check.evidence_refs.length > 0
    && check.evidence_refs.every(pointer => versionedPointer(pointer, evaluationEpoch))
  );
}

function rollbackPlanPasses(plan, revision, candidate, evaluationEpoch) {
  return Boolean(
    hasOnlyFields(plan, ROLLBACK_RECEIPT_FIELDS)
    && typeof plan.summary === 'string'
    && plan.summary.trim()
    && plan.revision === revision
    && plan.candidate_id === candidate.candidate_id
    && plan.candidate_digest === candidate.candidate_digest
    && plan.task_context_digest === candidate.task_context_digest
    && plan.transfer_context_digest === candidate.transfer_context_digest
    && versionedPointer(plan.evidence_ref, evaluationEpoch)
  );
}

function reproductionPasses(receipt, revision, candidate, evaluationEpoch) {
  return Boolean(
    hasOnlyFields(receipt, REPRODUCTION_RECEIPT_FIELDS)
    && receipt.result === 'REPRODUCED'
    && receipt.candidate_revision === revision
    && typeof receipt.reproduced_against_revision === 'string'
    && receipt.reproduced_against_revision.trim()
    && receipt.candidate_id === candidate.candidate_id
    && receipt.candidate_digest === candidate.candidate_digest
    && receipt.task_context_digest === candidate.task_context_digest
    && receipt.transfer_context_digest === candidate.transfer_context_digest
    && Number.isInteger(receipt.executed_checks)
    && receipt.executed_checks > 0
    && receipt.failures === 0
    && receipt.skips === 0
    && versionedPointer(receipt.evidence_ref, evaluationEpoch)
  );
}

function candidateContractValid(candidate, evaluationEpoch) {
  const expectedEvidence = JSON.stringify(REQUIRED_TRANSFER_EVIDENCE);
  let routingValid = false;
  try {
    const canonicalRoutingDomains = Array.isArray(candidate?.routing_domains)
      ? [...new Set(candidate.routing_domains)].sort()
      : [];
    const routingBasisValid = candidate?.kind === 'conversation_lesson'
      ? canonicalRoutingDomains.length > 0
        && JSON.stringify(canonicalRoutingDomains) === JSON.stringify(candidate.routing_domains)
        && canonicalRoutingDomains.every(domain => (
          Object.hasOwn(CONVERSATION_DOMAIN_TARGET, domain)
        ))
      : Array.isArray(candidate?.routing_domains) && candidate.routing_domains.length === 0;
    routingValid = routeImprovementSignal({
      kind: candidate?.kind,
      domains: candidate?.routing_domains
    }) === candidate?.target_system && routingBasisValid;
  } catch {
    routingValid = false;
  }
  return Boolean(
    hasOnlyFields(candidate, CANDIDATE_FIELDS)
    && typeof candidate.candidate_id === 'string'
    && candidate.candidate_id === candidateIdFor(
      candidate.task_id,
      candidate.signal_id,
      candidate.transfer_context_digest
    )
    && typeof candidate.task_id === 'string'
    && candidate.task_id.trim()
    && typeof candidate.signal_id === 'string'
    && candidate.signal_id.trim()
    && typeof candidate.task_context_digest === 'string'
    && /^sha256:[a-f0-9]{64}$/.test(candidate.task_context_digest)
    && (
      candidate.subject_revision === null
      || (
        typeof candidate.subject_revision === 'string'
        && candidate.subject_revision.trim() === candidate.subject_revision
        && candidate.subject_revision.length > 0
      )
    )
    && /^sha256:[a-f0-9]{64}$/.test(candidate.source_revision_set_digest)
    && /^sha256:[a-f0-9]{64}$/.test(candidate.capability_revision_set_digest)
    && typeof candidate.policy_revision === 'string'
    && candidate.policy_revision.trim() === candidate.policy_revision
    && candidate.policy_revision.length > 0
    && /^sha256:[a-f0-9]{64}$/.test(candidate.transfer_context_digest)
    && candidate.transfer_context_digest === transferContextDigestFromParts(candidate)
    && candidate.status === 'CANDIDATE'
    && TARGET_SYSTEMS.has(candidate.target_system)
    && CANDIDATE_KINDS.has(candidate.kind)
    && routingValid
    && typeof candidate.summary === 'string'
    && candidate.summary.trim()
    && typeof candidate.scope === 'string'
    && candidate.scope.trim()
    && SEVERITIES.has(candidate.severity)
    && CHANGE_CLASSES.has(candidate.change_class)
    && canonicalPrincipal(candidate.created_by) === candidate.created_by
    && Array.isArray(candidate.evidence_refs)
    && candidate.evidence_refs.every(pointer => versionedPointer(pointer, evaluationEpoch))
    && JSON.stringify(candidate.required_evidence) === expectedEvidence
    && candidate.next_gate === 'TRANSFER_GATE'
    && candidate.auto_adopted === false
    && candidate.execution_authorized === false
  );
}

export function evaluateTransferGate(candidate, evidence = {}, {
  currentTime = new Date().toISOString(),
  task = null,
  subjectRevision = null,
  sourcePointers = [],
  capabilityRefs = [],
  policyRevision = PROOF_POLICY_REVISION
} = {}) {
  const missing = [];
  const evaluationEpoch = dateTimeEpoch(currentTime);
  const candidateRevision = typeof evidence.candidate_revision === 'string'
    ? evidence.candidate_revision.trim()
    : '';

  const expectedCandidateDigest = candidateDigestFor(candidate);
  const boundCandidate = { ...candidate, candidate_digest: expectedCandidateDigest };
  if (Number.isNaN(evaluationEpoch)) missing.push('valid_evaluation_time');
  let currentTransferContext = null;
  try {
    currentTransferContext = task?.task_id
      ? transferContextFor({
          task,
          subjectRevision,
          sourcePointers,
          capabilityRefs,
          policyRevision
        })
      : null;
  } catch {
    currentTransferContext = null;
  }
  if (
    !currentTransferContext
    || currentTransferContext.task_context_digest !== candidate?.task_context_digest
    || task?.task_id !== candidate?.task_id
  ) {
    missing.push('task_context_binding');
  }
  if (
    !currentTransferContext
    || currentTransferContext.subject_revision !== candidate?.subject_revision
    || (
      typeof task?.project === 'string'
      && task.project.trim().length > 0
      && !currentTransferContext.subject_revision
    )
  ) missing.push('subject_revision_binding');
  if (
    !currentTransferContext
    || currentTransferContext.source_revision_set_digest
      !== candidate?.source_revision_set_digest
  ) missing.push('source_revision_set_binding');
  if (
    !currentTransferContext
    || currentTransferContext.capability_revision_set_digest
      !== candidate?.capability_revision_set_digest
  ) missing.push('capability_revision_set_binding');
  if (
    !currentTransferContext
    || currentTransferContext.policy_revision !== candidate?.policy_revision
  ) missing.push('policy_revision_binding');
  if (
    !currentTransferContext
    || currentTransferContext.transfer_context_digest
      !== candidate?.transfer_context_digest
  ) missing.push('transfer_context_binding');
  if (!hasOnlyFields(evidence, TRANSFER_EVIDENCE_FIELDS)) {
    missing.push('invalid_transfer_evidence_contract');
  }
  if (!candidateContractValid(candidate, evaluationEpoch)) {
    missing.push('invalid_candidate_contract');
  }
  if (!CHANGE_CLASSES.has(candidate?.change_class)) missing.push('valid_change_class');
  if (!candidate?.candidate_id || !candidate?.candidate_digest) {
    missing.push('candidate_identity');
  } else if (candidate.candidate_digest !== expectedCandidateDigest) {
    missing.push('candidate_integrity');
  }

  if (!candidateRevision) missing.push('candidate_revision');
  if (!reproductionPasses(
    evidence.reproduction_receipt,
    candidateRevision,
    boundCandidate,
    evaluationEpoch
  )) missing.push('problem_reproduction_receipt');
  if (!Array.isArray(evidence.checks) || !evidence.checks.length) {
    missing.push('checks_passed');
  } else if (evidence.checks.some(check => (
    !checkPassesForRevision(check, candidateRevision, boundCandidate, evaluationEpoch)
  ))) {
    missing.push('checks_passed');
  }

  if (!approvedForRevision(
    evidence.independent_review,
    candidateRevision,
    boundCandidate,
    'independent_reviewer',
    evaluationEpoch
  )) {
    missing.push('independent_review');
  } else if (
    canonicalPrincipal(evidence.independent_review.reviewer)
    === canonicalPrincipal(candidate.created_by)
  ) {
    missing.push('independent_reviewer_required');
  }

  if (!rollbackPlanPasses(
    evidence.rollback_plan,
    candidateRevision,
    boundCandidate,
    evaluationEpoch
  )) missing.push('rollback_plan');
  if (!approvedForRevision(
    evidence.target_acceptance,
    candidateRevision,
    boundCandidate,
    candidate.target_system,
    evaluationEpoch
  )) {
    missing.push('target_acceptance');
  }

  const requiredApprovals = CHANGE_CLASSES.has(candidate?.change_class)
    ? approvalRequirements(candidate.change_class)
    : [];
  if (
    evidence.approvals != null
    && (
      !hasOnlyFields(evidence.approvals, new Set(requiredApprovals))
      || Object.keys(evidence.approvals).length !== requiredApprovals.length
    )
  ) missing.push('invalid_approval_set');
  for (const approval of requiredApprovals) {
    if (!approvedForRevision(
      evidence.approvals?.[approval],
      candidateRevision,
      boundCandidate,
      approval,
      evaluationEpoch
    )) {
      missing.push(approval);
    }
  }

  const uniqueMissing = [...new Set(missing)];
  return {
    candidate_id: candidate.candidate_id,
    task_id: candidate.task_id,
    task_context_digest: candidate.task_context_digest,
    transfer_context_digest: candidate.transfer_context_digest,
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
    const kind = ['aiops', 'domain'].includes(binding.system)
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

function canonicalJsonValue(value, seen = new WeakSet()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object') {
    throw new Error('observation must contain JSON-compatible values');
  }
  if (seen.has(value)) throw new Error('observation must not contain cycles');
  seen.add(value);
  let canonical;
  if (Array.isArray(value)) {
    canonical = value.map(item => canonicalJsonValue(item, seen));
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new Error('observation must be a plain JSON object');
    }
    canonical = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      canonical[key] = canonicalJsonValue(value[key], seen);
    }
  }
  seen.delete(value);
  return canonical;
}

function signalPayloadDigest(signal) {
  return digestFor(canonicalJsonValue(signal));
}

export function compileEvolutionPlan({
  task,
  observations = [],
  subjectRevision = null,
  sourcePointers = [],
  capabilityRefs = [],
  policyRevision = PROOF_POLICY_REVISION
}) {
  const rejected = [];
  const validated = [];

  if (!Array.isArray(observations)) {
    rejected.push({
      signal_id: null,
      reason: 'observations must be an array'
    });
  }

  for (const observation of Array.isArray(observations) ? observations : []) {
    try {
      const payloadDigest = signalPayloadDigest(observation);
      const candidate = createImprovementCandidate(observation, {
        task,
        subjectRevision,
        sourcePointers,
        capabilityRefs,
        policyRevision
      });
      validated.push({ candidate, payloadDigest });
    } catch (error) {
      rejected.push({
        signal_id: rejectedSignalIdFor(observation?.signal_id),
        reason: error?.message ?? 'invalid observation'
      });
    }
  }

  const bySignalId = new Map();
  for (const entry of validated) {
    const group = bySignalId.get(entry.candidate.signal_id) ?? [];
    group.push(entry);
    bySignalId.set(entry.candidate.signal_id, group);
  }

  const candidates = [];
  for (const [signalId, group] of bySignalId.entries()) {
    if (new Set(group.map(entry => entry.payloadDigest)).size > 1) {
      rejected.push({
        signal_id: rejectedSignalIdFor(signalId),
        reason: 'conflicting observations share a signal_id'
      });
      continue;
    }
    const candidate = group[0].candidate;
    candidates.push({
      ...candidate,
      transfer_gate: evaluateTransferGate(candidate, {}, {
        task,
        subjectRevision,
        sourcePointers,
        capabilityRefs,
        policyRevision
      })
    });
  }

  return {
    status: rejected.length
      ? 'HOLD_INVALID_INPUT'
      : candidates.length
        ? 'CANDIDATES_CREATED'
        : 'NO_SIGNAL',
    candidates,
    rejected,
    auto_adopted: false,
    execution_authorized: false
  };
}

import { canonicalDigest } from './canonical-json.mjs';
import { effectiveDomains, effectiveRisk } from './domain-policy.mjs';
import { assessActionSemantics } from './action-semantics.mjs';

export const STEWARDSHIP_CONTRACT_REVISION = '2026-09-13.4';
const PORTFOLIO_FRESHNESS_MS = 24 * 60 * 60 * 1000;

const SUPPORT_DIMENSIONS = [
  'direction',
  'reality',
  'foresight',
  'choice',
  'commitment',
  'resource',
  'agency',
  'resilience',
  'growth'
];
const COMMITMENT_FIELDS = new Set([
  'commitment_id', 'goal_summary', 'status', 'due_at', 'dependencies',
  'resource_claims', 'priority', 'source_ref', 'sanitized'
]);
const REQUIRED_COMMITMENT_FIELDS = new Set(
  [...COMMITMENT_FIELDS].filter(field => field !== 'due_at')
);
const SNAPSHOT_FIELDS = new Set(['revision', 'observed_at', 'commitments']);
const COMMITMENT_STATES = new Set(['PLANNED', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'CANCELLED']);
const PRIORITIES = new Set([
  'USER_CONFIRMED_HIGH', 'USER_CONFIRMED_MEDIUM', 'USER_CONFIRMED_LOW', 'UNKNOWN'
]);
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function requiredString(value, label, maximum = 2000) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must not be empty`);
  if (normalized.length > maximum) throw new Error(`${label} is too long`);
  return normalized;
}

function stringArray(value, label, maximumItems = 50) {
  if (!Array.isArray(value) || value.length > maximumItems) {
    throw new Error(`${label} must be an array with at most ${maximumItems} items`);
  }
  return [...new Set(value.map((entry, index) => (
    requiredString(entry, `${label}[${index}]`, 300)
  )))].sort();
}

function exactFields(value, fields, label, required = fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const unknown = Object.keys(value).filter(key => !fields.has(key));
  if (unknown.length) throw new Error(`${label} contains unsupported fields`);
  const missing = [...required].filter(key => !Object.hasOwn(value, key));
  if (missing.length) throw new Error(`${label} is missing required fields`);
}

function dateTime(value, label) {
  const normalized = requiredString(value, label, 100);
  if (!DATE_TIME_PATTERN.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    throw new Error(`${label} must be a date-time`);
  }
  return new Date(Date.parse(normalized)).toISOString();
}

function normalizeSourceRef(value, label) {
  exactFields(value, new Set(['location', 'revision_or_sha']), label);
  return {
    location: requiredString(value.location, `${label}.location`, 1000),
    revision_or_sha: requiredString(value.revision_or_sha, `${label}.revision_or_sha`, 300)
  };
}

function normalizeCommitment(value, index) {
  const label = `portfolio_snapshot.commitments[${index}]`;
  exactFields(value, COMMITMENT_FIELDS, label, REQUIRED_COMMITMENT_FIELDS);
  if (value.sanitized !== true) throw new Error(`${label} must be sanitized`);
  const status = requiredString(value.status, `${label}.status`, 40);
  if (!COMMITMENT_STATES.has(status)) throw new Error(`${label}.status is unsupported`);
  const priority = value.priority == null ? 'UNKNOWN' : requiredString(
    value.priority, `${label}.priority`, 40
  );
  if (!PRIORITIES.has(priority)) throw new Error(`${label}.priority is unsupported`);
  const commitment = {
    commitment_id: requiredString(value.commitment_id, `${label}.commitment_id`, 300),
    goal_summary: requiredString(value.goal_summary, `${label}.goal_summary`, 1000),
    status,
    due_at: value.due_at == null ? null : dateTime(value.due_at, `${label}.due_at`),
    dependencies: stringArray(value.dependencies, `${label}.dependencies`),
    resource_claims: stringArray(value.resource_claims, `${label}.resource_claims`),
    priority,
    source_ref: normalizeSourceRef(value.source_ref, `${label}.source_ref`),
    sanitized: true
  };
  return {
    ...commitment,
    commitment_digest: canonicalDigest(commitment)
  };
}

export function normalizePortfolioSnapshot(snapshot, {
  currentTime = new Date().toISOString()
} = {}) {
  if (snapshot == null) return null;
  exactFields(snapshot, SNAPSHOT_FIELDS, 'portfolio_snapshot');
  if (!Array.isArray(snapshot.commitments) || snapshot.commitments.length > 100) {
    throw new Error('portfolio_snapshot.commitments must be an array with at most 100 items');
  }
  const commitments = snapshot.commitments.map(normalizeCommitment);
  const ids = commitments.map(item => item.commitment_id);
  if (new Set(ids).size !== ids.length) throw new Error('portfolio commitment IDs must be unique');
  const observedAt = dateTime(snapshot.observed_at, 'portfolio_snapshot.observed_at');
  const currentEpoch = Date.parse(dateTime(currentTime, 'currentTime'));
  if (Date.parse(observedAt) > currentEpoch) {
    throw new Error('portfolio_snapshot.observed_at cannot be in the future');
  }
  return {
    revision: requiredString(snapshot.revision, 'portfolio_snapshot.revision', 300),
    observed_at: observedAt,
    commitments
  };
}

function portfolioContract(task, snapshot, issues, currentTime) {
  const relatedIds = new Set(task.related_commitment_ids ?? []);
  if (!relatedIds.size) {
    const actionAssessments = (task.proposed_actions ?? []).map(action => (
      assessActionSemantics(action, {
        taskProject: task.project ?? null,
        taskScope: {
          allowed: task.allowed_scope ?? [],
          forbidden: task.forbidden_scope ?? []
        }
      })
    ));
    const consequential = task.external_effect !== 'none'
      || ['C', 'D'].includes(effectiveRisk(task, effectiveDomains(task)))
      || actionAssessments.some(item => item.classification === 'CONSEQUENTIAL');
    const portfolioEffect = task.portfolio_effect ?? 'unknown';
    const explicitPortfolioImpact = !['none', 'unknown'].includes(portfolioEffect);
    return {
      status: explicitPortfolioImpact
        ? 'NOT_DECLARED'
        : portfolioEffect === 'unknown' && consequential
          ? 'NOT_ASSESSED_ADVISORY'
          : 'NOT_REQUIRED',
      recommendation: explicitPortfolioImpact
        ? 'DISCOVER_SCOPED_AIOPS_COMMITMENTS'
        : portfolioEffect === 'unknown' && consequential
          ? 'ASSESS_PORTFOLIO_IMPACT_IF_COMMITMENTS_OR_RESOURCES_CHANGE'
          : 'NO_PORTFOLIO_CLAIM',
      relevant_commitments: [],
      conflicts: [],
      priority_change_authorized: false,
      reason: explicitPortfolioImpact
        ? 'The action explicitly changes a portfolio concern without a declared commitment scope'
        : portfolioEffect === 'unknown' && consequential
          ? 'No portfolio relationship is evidenced; this is advisory, not a conflict claim'
          : 'No decision-relevant commitment IDs were declared'
    };
  }
  if (!snapshot) {
    return {
      status: 'NOT_EVALUATED',
      recommendation: 'FETCH_SCOPED_AIOPS_COMMITMENTS',
      relevant_commitments: [],
      conflicts: [],
      missing_commitment_ids: [...relatedIds].sort(),
      priority_change_authorized: false
    };
  }
  const relevant = snapshot.commitments.filter(item => relatedIds.has(item.commitment_id));
  const found = new Set(relevant.map(item => item.commitment_id));
  const missing = [...relatedIds].filter(id => !found.has(id)).sort();
  if (missing.length) issues.push('PORTFOLIO_COMMITMENT_UNRESOLVED');
  const conflicts = [];
  for (const commitment of relevant) {
    if (commitment.status === 'BLOCKED') {
      conflicts.push({
        code: 'RELATED_COMMITMENT_BLOCKED_STATUS_CANDIDATE',
        commitment_id: commitment.commitment_id,
        evidence_digest: commitment.commitment_digest
      });
    }
  }
  const stale = Date.parse(currentTime) - Date.parse(snapshot.observed_at) > PORTFOLIO_FRESHNESS_MS;
  return {
    status: stale
      ? 'STALE_UNAUTHENTICATED'
      : 'STRUCTURALLY_ANALYZED_UNAUTHENTICATED',
    snapshot_revision: snapshot.revision,
    snapshot_observed_at: snapshot.observed_at,
    snapshot_digest: canonicalDigest(snapshot),
    recommendation: stale
      ? 'REFETCH_SCOPED_AIOPS_COMMITMENTS'
      : conflicts.length
      ? 'REVALIDATE_RELATION_BEFORE_SEQUENCE_DECISION'
      : missing.length
        ? 'FETCH_MISSING_COMMITMENTS'
        : 'PROCEED_CANDIDATE',
    relevant_commitments: relevant.map(item => ({
      commitment_id: item.commitment_id,
      status: item.status,
      due_at: item.due_at,
      dependencies: item.dependencies,
      resource_claims: item.resource_claims,
      priority: item.priority,
      source_ref: item.source_ref,
      commitment_digest: item.commitment_digest
    })),
    conflicts,
    missing_commitment_ids: missing,
    priority_change_authorized: false,
    trust: 'UNAUTHENTICATED_CALLER_INPUT',
    conflict_claims_are_advisory: true
  };
}

function conditionalRisk(code, condition, consequence, evidence, response, stopCondition) {
  return {
    code,
    claim_class: 'CONDITIONAL_SCENARIO_NOT_FACT',
    if: condition,
    then: consequence,
    evidence,
    uncertainty: 'UNKNOWN_UNTIL_OBSERVED',
    early_warning: response.early_warning,
    prevention: response.prevention,
    rollback_or_containment: response.rollback_or_containment,
    stop_condition: stopCondition
  };
}

function foresightContract(task, humanOrchestration, holds) {
  const domains = effectiveDomains(task);
  const risk = effectiveRisk(task, domains);
  const actions = [
    ...(humanOrchestration.actions?.prepare_now ?? []),
    ...(humanOrchestration.actions?.approval_required ?? [])
  ];
  const assessments = actions.map(action => assessActionSemantics(action, {
    taskProject: task.project ?? null,
    taskScope: {
      allowed: task.allowed_scope ?? [],
      forbidden: task.forbidden_scope ?? []
    }
  }));
  const consequential = task.external_effect !== 'none'
    || ['C', 'D'].includes(risk)
    || assessments.some(assessment => assessment.classification === 'CONSEQUENTIAL');
  const scopeConflict = assessments.some(assessment => (
    assessment.issues.some(issue => issue.startsWith('ACTION_OPERATION_SCOPE_'))
  ));
  const semanticConflict = assessments.some(assessment => (
    assessment.issues.some(issue => !issue.startsWith('ACTION_OPERATION_SCOPE_'))
  ));
  const irreversible = actions.some(action => action.reversible === false)
    || assessments.some(assessment => assessment.known_non_retractable);
  const risks = [];
  if (task.external_effect === 'unknown') {
    risks.push(conditionalRisk(
      'UNCLASSIFIED_EXTERNAL_EFFECT',
      'the planned action has an external effect that was not classified',
      'the action may change people, money, production data, rights, or commitments',
      ['task.external_effect'],
      {
        early_warning: 'an executor requests a network, production, send, delete, payment, or permission capability',
        prevention: 'classify the exact effect and target before handoff',
        rollback_or_containment: 'keep work inside a local or isolated preparation boundary'
      },
      'effect or target remains unknown'
    ));
  }
  if (semanticConflict) {
    risks.push(conditionalRisk(
      'ACTION_METADATA_CONTRADICTION',
      'declared effect or reversibility conflicts with target or operation semantics',
      'a consequential action may be misrouted as local preparation',
      assessments.flatMap(assessment => assessment.issues).slice(0, 3),
      {
        early_warning: 'operation or target implies deploy, send, delete, payment, or permission change',
        prevention: 'resolve the contradiction using trusted capability metadata before handoff',
        rollback_or_containment: 'keep the contradictory action outside the preparation gate'
      },
      'the action metadata contradiction remains unresolved'
    ));
  }
  if (scopeConflict) {
    risks.push(conditionalRisk(
      'ACTION_SCOPE_CONTRACT_CONFLICT',
      'a local operation names a non-canonical, wildcard, forbidden, or out-of-plan path',
      'an executor may touch artifacts outside the human-approved preparation boundary',
      assessments.flatMap(assessment => assessment.issues)
        .filter(issue => issue.startsWith('ACTION_OPERATION_SCOPE_'))
        .slice(0, 3),
      {
        early_warning: 'the operation path cannot be proven inside the allowed scope',
        prevention: 'replace it with one canonical concrete path inside the allowed scope',
        rollback_or_containment: 'do not hand the action to an executor'
      },
      'the operation path remains outside the declared scope contract'
    ));
  }
  if (irreversible) {
    const irreversibleActionIds = actions.filter((action, index) => (
      action.reversible === false || assessments[index]?.known_non_retractable
    )).map(action => action.id);
    risks.push(conditionalRisk(
      'IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY',
      'an irreversible action proceeds without a verified recovery or containment path',
      'the prior state may not be restorable',
      irreversibleActionIds,
      {
        early_warning: 'the proposed action cannot produce a tested rollback or containment receipt',
        prevention: 'prepare and verify the recovery or containment path first',
        rollback_or_containment: task.recovery_strategy
          ? 'CALLER_RECOVERY_PLAN_PRESENT_BUT_UNVERIFIED'
          : 'UNRESOLVED'
      },
      'recovery or containment remains unresolved'
    ));
  }
  if (domains.includes('legal')) {
    risks.push(conditionalRisk(
      'LEGAL_AUTHORITY_OR_DEADLINE_DRIFT',
      'official authority, procedure, or deadline changes after planning',
      'the legal result may be outdated or procedurally ineffective',
      ['domain:legal', 'source_revision_set'],
      {
        early_warning: 'the official source revision or observation time differs at final review',
        prevention: 're-fetch current official authority and deadline evidence',
        rollback_or_containment: 'hold submission and preserve a reviewable draft'
      },
      'responsible human review or current official source is unavailable'
    ));
  }
  if (!risks.length && consequential && holds.length) {
    risks.push(conditionalRisk(
      'UNRESOLVED_CRITICAL_BASIS',
      'a consequential plan proceeds while a required basis remains unresolved',
      'the plan may act on the wrong target or stale requirements',
      holds.slice(0, 3),
      {
        early_warning: 'a required Core hold remains at handoff',
        prevention: 'resolve and recompile the revision-bound plan',
        rollback_or_containment: 'do not cross the preparation boundary'
      },
      'any critical hold remains'
    ));
  }
  if (!risks.length && consequential) {
    risks.push(conditionalRisk(
      'CONSEQUENTIAL_EFFECT_REQUIRES_SCOPED_REVIEW',
      'a consequential action proceeds without a target-specific second-order review',
      'people, production state, money, rights, or commitments may change unexpectedly',
      actions.map(action => action.id).slice(0, 3),
      {
        early_warning: 'the target-specific failure modes and downstream owners are not evidenced',
        prevention: 'obtain scoped source, capability, approval, and rollback evidence',
        rollback_or_containment: 'do not cross the preparation boundary'
      },
      'target-specific evidence or responsible review is unavailable'
    ));
  }
  const riskPriority = new Map([
    ['LEGAL_AUTHORITY_OR_DEADLINE_DRIFT', 0],
    ['IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY', 1],
    ['ACTION_METADATA_CONTRADICTION', 2],
    ['ACTION_SCOPE_CONTRACT_CONFLICT', 3],
    ['UNCLASSIFIED_EXTERNAL_EFFECT', 4],
    ['UNRESOLVED_CRITICAL_BASIS', 5],
    ['CONSEQUENTIAL_EFFECT_REQUIRES_SCOPED_REVIEW', 6]
  ]);
  const selectedRisks = [...risks].sort((left, right) => (
    (riskPriority.get(left.code) ?? Number.MAX_SAFE_INTEGER)
    - (riskPriority.get(right.code) ?? Number.MAX_SAFE_INTEGER)
  )).slice(0, 3);
  return {
    mode: consequential || irreversible ? 'DEEP' : 'LIGHT',
    assessment_status: consequential || irreversible
      ? 'CONDITIONAL_ONLY_NOT_EXECUTION_CLEARANCE'
      : 'BOUNDED_LIGHT_REVIEW',
    risks: selectedRisks,
    smallest_reversible_next_step: irreversible
      ? 'PREPARE_RECOVERY_OR_CONTAINMENT_EVIDENCE'
      : semanticConflict || scopeConflict
        ? 'RESOLVE_ACTION_METADATA_AND_SCOPE_CONTRACT'
        : (humanOrchestration.actions?.prepare_now ?? []).length
          ? 'USE_ONLY_PLAN_SLICE_PREPARATION_ACTIONS'
          : 'NO_SAFE_PREPARATION_ACTION_AVAILABLE',
    // A caller-supplied recovery sentence is a plan, not verified recovery
    // evidence. v0.6 has no trusted recovery-receipt adapter, so every
    // irreversible action remains held.
    execution_hold_required: irreversible || semanticConflict || scopeConflict,
    future_claims_promoted_to_fact: false,
    automatic_action_selected: false
  };
}

function followThroughContract(task, humanOrchestration, subjectRevision) {
  const actions = [
    ...(humanOrchestration.actions?.prepare_now ?? []),
    ...(humanOrchestration.actions?.approval_required ?? [])
  ];
  const consequentialActions = actions.filter(action => (
    assessActionSemantics(action, {
      taskProject: task.project ?? null,
      taskScope: {
        allowed: task.allowed_scope ?? [],
        forbidden: task.forbidden_scope ?? []
      }
    }).classification
      === 'CONSEQUENTIAL'
  ));
  const outcomeObservationNeeded = task.outcome_observation != null
    || task.external_effect !== 'none'
    || consequentialActions.length > 0;
  if (!outcomeObservationNeeded) {
    return {
      status: 'NOT_REQUIRED',
      deliverable_state: 'NOT_STARTED',
      outcome_state: 'NOT_STARTED',
      active_observations: [],
      tracking_active: false,
      automation_binding: 'NOT_IMPLEMENTED'
    };
  }
  if (
    task.outcome_observation == null
    && task.external_effect !== 'none'
    && consequentialActions.length === 0
  ) {
    return {
      status: 'DEFERRED_UNTIL_CONSEQUENTIAL_ACTION_BOUND',
      deliverable_state: 'NOT_STARTED',
      outcome_state: 'NOT_STARTED',
      active_observations: [],
      tracking_active: false,
      automation_binding: 'NOT_IMPLEMENTED',
      outcome_confirmation_requires_receipt: true,
      transition_implemented: false
    };
  }
  const observationActions = consequentialActions.length ? consequentialActions : actions;
  const actionIds = observationActions.map(action => action.id).sort();
  const taskContext = {
    task_id: task.task_id,
    project: task.project ?? null,
    project_ref: task.project_ref ?? null,
    goal: task.goal,
    desired_outcome: task.desired_outcome ?? null,
    done_when: task.done_when ?? [],
    constraints: task.constraints ?? [],
    allowed_scope: task.allowed_scope ?? [],
    forbidden_scope: task.forbidden_scope ?? [],
    related_commitment_ids: task.related_commitment_ids ?? [],
    resource_claims: task.resource_claims ?? [],
    recovery_strategy: task.recovery_strategy ?? null,
    domain: task.domain ?? null,
    applicable_domains: effectiveDomains(task),
    risk: effectiveRisk(task),
    authority_required: task.authority_required === true,
    external_effect: task.external_effect ?? 'unknown',
    portfolio_effect: task.portfolio_effect ?? 'unknown',
    outcome_observation: task.outcome_observation ?? null
  };
  const taskContextDigest = canonicalDigest(taskContext);
  const eventOrMetric = task.outcome_observation?.event_or_metric
    ?? 'declared real-world result or external effect';
  const evidenceRequired = task.outcome_observation?.evidence_required
    ?? 'task-context-bound outcome receipt, plus subject revision when applicable';
  const binding = {
    task_context_digest: taskContextDigest,
    event_or_metric: eventOrMetric,
    evidence_required: evidenceRequired,
    action_digests: observationActions.map(action => action.action_digest).sort(),
    base_subject_revision: subjectRevision ?? null
  };
  const bindingDigest = canonicalDigest(binding);
  return {
    status: 'PLANNED_UNBOUND',
    deliverable_state: 'NOT_STARTED',
    outcome_state: 'NOT_STARTED',
    active_observations: [{
      observation_id: `FOLLOW-${bindingDigest.slice(7, 23)}`,
      event_or_metric: eventOrMetric,
      owner: 'UNASSIGNED',
      trigger: 'TRUSTED_EXECUTION_RECEIPT_ACCEPTED',
      evidence_required: evidenceRequired,
      task_id: task.task_id,
      action_ids: actionIds,
      task_context_digest: taskContextDigest,
      base_subject_revision: subjectRevision ?? null,
      binding_digest: bindingDigest,
      activation_requires: 'TRUSTED_EXECUTION_RECEIPT'
    }],
    tracking_active: false,
    automation_binding: 'NOT_IMPLEMENTED',
    outcome_confirmation_requires_receipt: true,
    transition_implemented: false
  };
}

export function compileHumanStewardship(task, {
  humanOrchestration,
  holds = [],
  portfolioSnapshot = null,
  subjectRevision = null,
  currentTime = new Date().toISOString()
} = {}) {
  const issues = [];
  let snapshot = null;
  if ((task.related_commitment_ids ?? []).length) {
    try {
      snapshot = normalizePortfolioSnapshot(portfolioSnapshot, { currentTime });
    } catch {
      issues.push('PORTFOLIO_INPUT_REJECTED');
    }
  }
  const portfolio = portfolioContract(task, snapshot, issues, currentTime);
  const foresight = foresightContract(task, humanOrchestration, holds);
  const followThrough = followThroughContract(task, humanOrchestration, subjectRevision);
  const supportVector = Object.fromEntries(SUPPORT_DIMENSIONS.map(key => [key, 'UNKNOWN']));
  return {
    architecture_version: 'human-stewardship/0.6-candidate',
    contract_revision: STEWARDSHIP_CONTRACT_REVISION,
    status: issues.length ? 'HOLD_INVALID_INPUT' : 'CANDIDATE',
    issues,
    portfolio_contract: portfolio,
    foresight_contract: foresight,
    follow_through_contract: followThrough,
    support_quality_vector: supportVector,
    composite_support_score: null,
    user_priority_changed: false,
    user_commitment_cancelled: false,
    outcome_observed: false,
    authorization: 'NOT_GRANTED'
  };
}

import { randomUUID } from 'node:crypto';
import { canonicalDigest, canonicalJson } from './canonical-json.mjs';
import { parseStrictJson } from './strict-json.mjs';
import { assessActionSemantics } from './action-semantics.mjs';
import { redactSensitiveText, sensitivePaths } from './disclosure.mjs';
import {
  artifactLocationToScope,
  isConcreteScope,
  isConcreteScopeAllowed,
  isSafeEvidenceLocation,
  isValidScopePattern,
  operationPathScope
} from './scope-contract.mjs';

export const PLAN_CONTRACT_REVISION = '2026-09-13.4';
export const PLAN_SLICE_SCHEMA_VERSION = 'plan-slice/0.6-candidate';
export const WORK_RETURN_SCHEMA_VERSION = 'work-return/0.6-candidate';
export const RUNTIME_HEAD_SCHEMA_VERSION = 'runtime-head/0.6-candidate';

const BASIS_FIELDS = [
  'task_contract_digest',
  'requirement_set_digest',
  'base_subject_revision',
  'source_revision_set_digest',
  'capability_revision_set_digest',
  'policy_revision',
  'decision_context_digest',
  'action_graph_digest',
  'gate_contract_digest',
  'blocker_set_digest',
  'stewardship_contract_digest',
  'work_packet_basis_digest',
  'plan_projection_digest',
  'plan_contract_revision'
];
const RETURN_ROOT_FIELDS = new Set([
  'schema_version', 'return_id', 'reported_at', 'slice_id', 'slice_digest',
  'attempt_id', 'task_id', 'audience', 'target', 'basis', 'action_results',
  'requirement_results'
]);
const RETURN_TARGET_FIELDS = new Set(['project', 'repository_identity', 'project_ref']);
const ACTION_RESULT_FIELDS = new Set([
  'action_id', 'action_context_digest', 'result', 'executed_checks', 'failures',
  'skips', 'start_subject_revision', 'end_subject_revision', 'changed_scopes',
  'changed_artifact_refs', 'evidence_refs', 'residual_risk_codes'
]);
const REQUIREMENT_RESULT_FIELDS = new Set([
  'requirement_id', 'requirement_fingerprint', 'result', 'executed_checks',
  'failures', 'skips', 'subject_revision', 'evidence_refs'
]);
const POINTER_FIELDS = new Set(['location', 'revision_or_sha']);
const RETURN_RESULTS = new Set(['COMPLETED', 'PARTIAL', 'FAILED', 'NOT_RUN']);
const REQUIRED_RETURN_BINDINGS = Object.freeze([
  'slice_id', 'slice_digest', 'attempt_id', 'task_id', 'audience', 'target', 'basis'
]);
const FORBIDDEN_RETURN_KEYS = new Set([
  'authority', 'authorized', 'verified', 'accepted', 'pass', 'trusted_adapter',
  'raw_content', 'raw_source', 'transcript', 'message_body', 'log', 'logs',
  'stdout', 'stderr', 'secret', 'token', 'credential', 'credentials', 'memory',
  'human_agency_contract'
]);
const FORBIDDEN_PLAN_KEYS = new Set([
  'raw_content', 'raw_source', 'transcript', 'message_body', 'full_text',
  'sensitive_payload', 'stdout', 'stderr', 'secret', 'token', 'credential',
  'credentials', 'memory_summary'
]);
const MAX_RETURN_BYTES = 262_144;
const MAX_PLAN_BYTES = 262_144;
const MAX_PLAN_ARRAY_ITEMS = 1000;
const MAX_PLAN_STRING_LENGTH = 10_000;
const DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PLAN_ROOT_FIELDS = new Set([
  'schema_version', 'slice_id', 'attempt_id', 'issued_at', 'expires_at',
  'lifecycle', 'freshness', 'handoff_status', 'audience', 'target', 'task_id',
  'objective', 'scope', 'basis', 'requirements', 'source_revision_set',
  'capability_revision_set', 'decision_context_fingerprint', 'decision_gaps',
  'actions', 'gates', 'stewardship_projection', 'disclosure_review',
  'work_return_contract', 'invariant_kernel',
  'trust_boundary', 'authorization', 'slice_digest'
]);
const PLAN_ACTION_FIELDS = new Set([
  'id', 'description', 'description_digest', 'target', 'operation', 'effect', 'reversible',
  'depends_on', 'phase', 'action_context_digest'
]);
const PLAN_SCOPE_FIELDS = new Set([
  'status', 'allowed', 'forbidden', 'constraints',
  'constraints_are_allowed_scope', 'forbidden_precedence'
]);
const PLAN_TARGET_FIELDS = new Set([
  'project', 'repository_identity', 'project_ref', 'subject_revision'
]);
const PLAN_OBJECTIVE_FIELDS = new Set([
  'goal', 'goal_digest', 'desired_outcome', 'desired_outcome_digest'
]);
const PLAN_REQUIREMENT_FIELDS = new Set([
  'id', 'text', 'text_digest', 'mode', 'required', 'fingerprint'
]);
const PLAN_DECISION_FINGERPRINT_FIELDS = new Set([
  'digest', 'confirmed_intent_ids', 'resolved_question_ids',
  'applicable_memory_ids', 'selected_failure_ids', 'selected_decision_ids',
  'raw_conversation_included', 'memory_summaries_included'
]);
const PLAN_GAP_FIELDS = new Set(['gap_id', 'type', 'blocks', 'resolution']);
const PLAN_GATES_FIELDS = new Set(['preparation', 'execution']);
const PLAN_PREPARATION_GATE_FIELDS = new Set(['status', 'allowed_action_ids', 'blockers']);
const PLAN_EXECUTION_GATE_FIELDS = new Set([
  'status', 'authorized', 'blockers', 'required_approvals', 'approval_action_ids'
]);
const PLAN_WORK_RETURN_CONTRACT_FIELDS = new Set([
  'schema_version', 'required_binding_fields', 'proof_must_bind_end_revision',
  'structural_validation_only', 'trusted_acceptance_requires_issued_slice_store',
  'replay_protection'
]);
const PLAN_INVARIANT_FIELDS = new Set([
  'plan_slice_is_projection_not_ssot', 'capability_reference_is_not_authority',
  'hash_is_not_signature', 'stale_slice_cannot_authorize_work',
  'forbidden_scope_precedes_allowed_scope', 'result_claim_is_not_proof'
]);
const PLAN_TRUST_FIELDS = new Set([
  'issued_slice_store', 'cryptographic_signature', 'transport_identity',
  'current_head_revalidation', 'authenticity'
]);
const PLAN_DISCLOSURE_FIELDS = new Set([
  'status', 'method', 'redacted_field_paths', 'raw_conversation_included'
]);
const PLAN_STEWARDSHIP_FIELDS = new Set(['portfolio', 'foresight', 'follow_through']);
const PLAN_STEWARDSHIP_PORTFOLIO_FIELDS = new Set([
  'status', 'recommendation', 'snapshot_digest', 'relevant_commitment_digests',
  'conflict_codes', 'trust', 'priority_change_authorized'
]);
const PLAN_STEWARDSHIP_FORESIGHT_FIELDS = new Set([
  'mode', 'assessment_status', 'risk_codes', 'risk_digests',
  'smallest_reversible_next_step', 'execution_hold_required',
  'automatic_action_selected'
]);
const PLAN_STEWARDSHIP_FOLLOW_FIELDS = new Set([
  'status', 'observation_ids', 'observation_binding_digests',
  'tracking_active', 'automation_binding'
]);
const PLAN_SOURCE_FIELDS = new Set([
  'system', 'kind', 'location', 'revision_or_sha', 'observed_at'
]);
const PLAN_CAPABILITY_FIELDS = new Set(['id', 'scope', 'location', 'revision_or_sha']);

export function parseWorkReturnJson(text) {
  return parseStrictJson(text, { maximumBytes: MAX_RETURN_BYTES, maximumDepth: 64 });
}

function dateTimeEpoch(value) {
  if (typeof value !== 'string' || !DATE_TIME_PATTERN.test(value)) return Number.NaN;
  return Date.parse(value);
}

function opaqueId(prefix, idFactory) {
  const value = idFactory();
  if (typeof value !== 'string' || !value.trim()) throw new Error('idFactory must return a string');
  return `${prefix}:${value.trim()}`;
}

function exactFields(value, allowed, label, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(`${label.toUpperCase()}_SHAPE_INVALID`);
    return false;
  }
  const keys = Object.keys(value);
  if (
    keys.length !== allowed.size
    || keys.some(key => !allowed.has(key))
    || [...allowed].some(key => !Object.hasOwn(value, key))
  ) {
    issues.push(`${label.toUpperCase()}_FIELDS_INVALID`);
    return false;
  }
  return true;
}

function repositoryIdentityFromSourceSet(items, project) {
  if (typeof project !== 'string' || !project) return null;
  const candidates = [...new Set((Array.isArray(items) ? items : [])
    .filter(item => item?.system === 'project' && typeof item.location === 'string')
    .map(item => item.location.slice(0, item.location.indexOf(':')))
    .filter(identity => (
      /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/.test(identity)
      && (identity === project || identity.split('/').at(-1) === project)
    )))];
  return candidates.length === 1 ? candidates[0] : null;
}

function sanitizedProjection(value, findings, path = 'projection') {
  if (typeof value === 'string') return redactSensitiveText(value, findings, path);
  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizedProjection(item, findings, `${path}[${index}]`));
  }
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    sanitizedProjection(child, findings, `${path}.${key}`)
  ]));
}

function boundedPlanStructure(value) {
  const seen = new WeakSet();
  function visit(current, depth) {
    if (typeof current === 'string') return current.length <= MAX_PLAN_STRING_LENGTH;
    if (!current || typeof current !== 'object') return depth <= 64;
    if (depth > 64 || seen.has(current)) return false;
    seen.add(current);
    const entries = Array.isArray(current) ? current : Object.values(current);
    if (entries.length > MAX_PLAN_ARRAY_ITEMS) return false;
    const valid = entries.every(item => visit(item, depth + 1));
    seen.delete(current);
    return valid;
  }
  return visit(value, 0);
}

function hasForbiddenPlanField(value, seen = new WeakSet(), depth = 0) {
  if (!value || typeof value !== 'object') return false;
  if (depth > 64 || seen.has(value)) return true;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PLAN_KEYS.has(key.toLowerCase())) return true;
    if (hasForbiddenPlanField(child, seen, depth + 1)) return true;
  }
  seen.delete(value);
  return false;
}

function hasRedactedDisplay(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') return /^\[REDACTED:[a-f0-9]{16}\]$/.test(value);
  if (!value || typeof value !== 'object') return false;
  if (depth > 64 || seen.has(value)) return true;
  seen.add(value);
  const found = Object.values(value).some(child => hasRedactedDisplay(child, seen, depth + 1));
  seen.delete(value);
  return found;
}

function selectedDecisionContext(humanOrchestration = {}, context = {}) {
  const confirmedIntents = (humanOrchestration.intent?.hypotheses ?? [])
    .filter(item => item.status === 'CONFIRMED')
    .map(item => ({
      id: item.id,
      statement_digest: item.statement_digest,
      intent_context_digest: item.intent_context_digest,
      source_ref: item.confirmation?.source_ref ?? null,
      verification: item.confirmation?.verification ?? null
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const resolvedQuestions = (humanOrchestration.resolved_questions ?? []).map(item => ({
    id: item.id,
    prompt_digest: item.prompt_digest,
    question_context_digest: item.question_context_digest,
    resolution_digest: item.resolution_digest ?? null,
    resolution_ref: item.resolution_ref ?? null,
    resolution_verification: item.resolution_verification ?? null
  })).sort((left, right) => left.id.localeCompare(right.id));
  const memories = (humanOrchestration.memory?.applicable ?? []).map(item => ({
    memory_id: item.memory_id,
    rule_key: item.rule_key,
    scope: item.scope,
    state: item.state,
    kind: item.kind,
    source_ref: item.source_ref,
    expires_at: item.expires_at,
    summary_digest: canonicalDigest(item.summary)
  })).sort((left, right) => left.memory_id.localeCompare(right.memory_id));
  const memoryExclusions = (humanOrchestration.memory?.excluded ?? []).map(item => ({
    memory_id: item.memory_id,
    rule_key: item.rule_key,
    state: item.state,
    reason: item.reason
  })).sort((left, right) => left.memory_id.localeCompare(right.memory_id));
  const contextEntries = kind => (context[kind] ?? []).map(item => {
    const projection = {
      scope: item.scope,
      source_ref: item.source_ref ?? null,
      revision: item.source_ref?.revision_or_sha ?? item.observed_at ?? null,
      summary_digest: item.sanitized === true && typeof item.summary === 'string'
        ? canonicalDigest(item.summary)
        : null
    };
    return {
      id: typeof item.id === 'string' && item.id
        ? item.id
        : `context:${canonicalDigest(projection).slice(7, 31)}`,
      ...projection
    };
  }).sort((left, right) => left.id.localeCompare(right.id));
  return {
    confirmed_intents: confirmedIntents,
    resolved_questions: resolvedQuestions,
    applicable_memory_fingerprints: memories,
    memory_exclusion_events: memoryExclusions,
    memory_revocation_set_digest: humanOrchestration.memory?.revocation_set_digest ?? null,
    selected_failures: contextEntries('relevant_failures'),
    selected_decisions: contextEntries('relevant_decisions')
  };
}

function normalizedActionGraph(task, humanOrchestration, target, audience, scope, findings) {
  const decisions = new Map([
    ...(humanOrchestration.actions?.prepare_now ?? []).map(item => [item.id, 'PREPARATION']),
    ...(humanOrchestration.actions?.approval_required ?? []).map(item => [item.id, 'EXECUTION_REVIEW'])
  ]);
  return (task.proposed_actions ?? []).map((action, index) => {
    const actionTarget = action.target == null
      ? null
      : redactSensitiveText(action.target, findings, `actions[${index}].target`);
    const operation = action.operation == null
      ? null
      : redactSensitiveText(action.operation, findings, `actions[${index}].operation`);
    const effect = redactSensitiveText(
      action.effect,
      findings,
      `actions[${index}].effect`
    );
    const description = redactSensitiveText(
      action.description,
      findings,
      `actions[${index}].description`
    );
    const payload = {
      task_id: task.task_id,
      action_id: action.id,
      description_digest: canonicalDigest(action.description),
      target: actionTarget,
      operation,
      effect,
      reversible: action.reversible,
      depends_on: action.depends_on ?? [],
      allowed_scope: scope.allowed,
      forbidden_scope: scope.forbidden,
      base_subject_revision: target.subject_revision,
      audience
    };
    return {
      id: action.id,
      description,
      description_digest: canonicalDigest(action.description),
      target: actionTarget,
      operation,
      effect,
      reversible: action.reversible,
      depends_on: action.depends_on ?? [],
      phase: decisions.get(action.id) ?? 'BLOCKED',
      action_context_digest: canonicalDigest(payload)
    };
  });
}

function buildScope(task, findings) {
  const hasActions = Boolean(task.proposed_actions?.length);
  if (!hasActions) {
    return {
      status: 'NOT_REQUIRED',
      allowed: [],
      forbidden: [],
      constraints: (task.constraints ?? []).map((item, index) => (
        redactSensitiveText(item, findings, `scope.constraints[${index}]`)
      )),
      constraints_are_allowed_scope: false,
      forbidden_precedence: true
    };
  }
  const allowed = [...new Set((task.allowed_scope ?? []).map((item, index) => (
    redactSensitiveText(item, findings, `scope.allowed[${index}]`)
  )))].sort();
  const forbidden = [...new Set((task.forbidden_scope ?? []).map((item, index) => (
    redactSensitiveText(item, findings, `scope.forbidden[${index}]`)
  )))].sort();
  return {
    status: allowed.length ? 'EXPLICIT' : 'UNRESOLVED',
    allowed,
    forbidden,
    constraints: (task.constraints ?? []).map((item, index) => (
      redactSensitiveText(item, findings, `scope.constraints[${index}]`)
    )),
    constraints_are_allowed_scope: false,
    forbidden_precedence: true
  };
}

function projectedRequirements(requirements, findings) {
  return requirements.map((requirement, index) => ({
    id: requirement.id,
    text: redactSensitiveText(
      requirement.text,
      findings,
      `requirements[${index}].text`
    ),
    text_digest: requirement.text_digest ?? canonicalDigest(requirement.text),
    mode: requirement.mode,
    required: requirement.required,
    fingerprint: requirement.fingerprint
  }));
}

function stewardshipProjection(stewardship) {
  const portfolio = stewardship?.portfolio_contract ?? {};
  const foresight = stewardship?.foresight_contract ?? {};
  const followThrough = stewardship?.follow_through_contract ?? {};
  return {
    portfolio: {
      status: portfolio.status ?? 'NOT_EVALUATED',
      recommendation: portfolio.recommendation ?? 'NO_PORTFOLIO_CLAIM',
      snapshot_digest: portfolio.snapshot_digest ?? null,
      relevant_commitment_digests: (portfolio.relevant_commitments ?? [])
        .map(item => item.commitment_digest)
        .filter(Boolean)
        .sort(),
      conflict_codes: (portfolio.conflicts ?? []).map(item => item.code).sort(),
      trust: portfolio.trust ?? 'NOT_APPLICABLE',
      priority_change_authorized: false
    },
    foresight: {
      mode: foresight.mode ?? 'LIGHT',
      assessment_status: foresight.assessment_status ?? 'BOUNDED_LIGHT_REVIEW',
      risk_codes: (foresight.risks ?? []).map(item => item.code).sort(),
      risk_digests: (foresight.risks ?? []).map(item => canonicalDigest(item)).sort(),
      smallest_reversible_next_step: foresight.smallest_reversible_next_step
        ?? 'NO_AUTOMATIC_ACTION',
      execution_hold_required: foresight.execution_hold_required === true,
      automatic_action_selected: false
    },
    follow_through: {
      status: followThrough.status ?? 'NOT_REQUIRED',
      observation_ids: (followThrough.active_observations ?? [])
        .map(item => item.observation_id)
        .sort(),
      observation_binding_digests: (followThrough.active_observations ?? [])
        .map(item => item.binding_digest)
        .filter(Boolean)
        .sort(),
      tracking_active: false,
      automation_binding: followThrough.automation_binding ?? 'NOT_IMPLEMENTED'
    }
  };
}

function decisionGaps({ task, holds, scope, actions, stewardship, disclosureFindings = [] }) {
  const gaps = [];
  for (const hold of [...new Set(holds)].sort()) {
    gaps.push({
      gap_id: `hold:${hold}`,
      type: hold,
      blocks: ['HANDOFF_REVIEW'],
      resolution: hold.includes('SOURCE') || hold.includes('CONTEXT')
        ? 'FETCH_OR_REVALIDATE_TRUSTED_SOURCE'
        : 'RECOMPILE_AFTER_RESOLUTION'
    });
  }
  if (scope.status === 'UNRESOLVED') {
    gaps.push({
      gap_id: 'scope:allowed',
      type: 'SCOPE_UNRESOLVED',
      blocks: ['HANDOFF_REVIEW'],
      resolution: 'DECLARE_EXACT_ALLOWED_AND_FORBIDDEN_SCOPE'
    });
  }
  if (actions.some(action => !action.target || !action.operation)) {
    gaps.push({
      gap_id: 'actions:exact-operation',
      type: 'ACTION_TARGET_OR_OPERATION_UNRESOLVED',
      blocks: ['HANDOFF_REVIEW'],
      resolution: 'DECLARE_EXACT_TARGET_AND_OPERATION'
    });
  }
  const explicitPortfolioAction = !['none', 'unknown'].includes(
    task.portfolio_effect ?? 'unknown'
  );
  if (!actions.length && (task.external_effect !== 'none' || explicitPortfolioAction)) {
    gaps.push({
      gap_id: 'actions:none',
      type: 'ACTION_GRAPH_EMPTY',
      blocks: ['HANDOFF_REVIEW'],
      resolution: 'PLAN_BOUNDED_ACTIONS'
    });
  }
  if (disclosureFindings.length) {
    gaps.push({
      gap_id: 'disclosure:sensitive-content',
      type: 'DISCLOSURE_REVIEW_REQUIRED',
      blocks: ['HANDOFF_REVIEW'],
      resolution: 'REPLACE_SECRET_OR_PRIVATE_VALUES_WITH_SCOPED_REFERENCES'
    });
  }
  if (stewardship?.portfolio_contract?.status === 'NOT_EVALUATED') {
    gaps.push({
      gap_id: 'portfolio:scoped-context',
      type: 'PORTFOLIO_CONTEXT_UNRESOLVED',
      blocks: ['CONSEQUENTIAL_EXECUTION_REVIEW'],
      resolution: 'FETCH_SCOPED_AIOPS_COMMITMENTS'
    });
  }
  return gaps;
}

function handoffStatus({ gaps, preparationGate, executionGate, actions }) {
  if (!actions.length && !gaps.some(gap => gap.blocks.includes('HANDOFF_REVIEW'))) {
    return 'NOT_REQUIRED';
  }
  const absoluteHandoffGaps = new Set([
    'SCOPE_UNRESOLVED',
    'ACTION_TARGET_OR_OPERATION_UNRESOLVED',
    'ACTION_GRAPH_EMPTY',
    'DISCLOSURE_REVIEW_REQUIRED'
  ]);
  if (gaps.some(gap => absoluteHandoffGaps.has(gap.type))) return 'BLOCKED';
  const hardGaps = gaps.filter(gap => gap.blocks.includes('HANDOFF_REVIEW'));
  if (hardGaps.length) {
    if (preparationGate.status === 'ALLOWED' && preparationGate.allowed_action_ids.length) {
      return 'PREPARE_ONLY';
    }
    return 'BLOCKED';
  }
  if (
    executionGate.status !== 'REVIEW_READY'
    && preparationGate.status === 'ALLOWED'
    && preparationGate.allowed_action_ids.length
  ) return 'PREPARE_ONLY';
  return actions.length ? 'READY_FOR_EXECUTOR_REVIEW' : 'NOT_REQUIRED';
}

function sliceDigestPayload(slice) {
  const { slice_digest: _digest, signature: _signature, ...payload } = slice;
  return payload;
}

function planProjectionPayload(slice) {
  const { basis: _basis, slice_digest: _digest, signature: _signature, ...projection } = slice;
  return projection;
}

export function computePlanProjectionDigest(slice) {
  return canonicalDigest(planProjectionPayload(slice));
}

export function computePlanSliceDigest(slice) {
  return canonicalDigest(sliceDigestPayload(slice));
}

export function compilePlanSlice({
  task,
  assurance,
  context,
  humanOrchestration,
  stewardship,
  holds,
  preparationGate,
  executionGate,
  workPacketBasis
}, {
  now = new Date().toISOString(),
  ttlMs = 15 * 60 * 1000,
  idFactory = randomUUID,
  audience = 'EXTERNAL_EXECUTOR_REVIEW'
} = {}) {
  const issuedEpoch = dateTimeEpoch(now);
  if (!Number.isFinite(issuedEpoch)) throw new Error('now must be a valid date-time');
  if (!Number.isInteger(ttlMs) || ttlMs < 1 || ttlMs > 60 * 60 * 1000) {
    throw new Error('ttlMs must be an integer from 1 to 3600000');
  }
  const disclosureFindings = [];
  const projectedAudience = redactSensitiveText(audience, disclosureFindings, 'audience');
  const scope = buildScope(task, disclosureFindings);
  const sourceRevisionSet = sanitizedProjection(
    assurance.source_revision_set.items,
    disclosureFindings,
    'source_revision_set'
  );
  const target = {
    project: task.project == null
      ? null
      : redactSensitiveText(task.project, disclosureFindings, 'target.project'),
    repository_identity: repositoryIdentityFromSourceSet(sourceRevisionSet, task.project),
    project_ref: redactSensitiveText(
      task.project_ref,
      disclosureFindings,
      'target.project_ref'
    ),
    subject_revision: assurance.subject_revision == null
      ? null
      : redactSensitiveText(
          assurance.subject_revision,
          disclosureFindings,
          'target.subject_revision'
        )
  };
  const actions = normalizedActionGraph(
    task,
    humanOrchestration,
    target,
    projectedAudience,
    scope,
    disclosureFindings
  );
  const decisionContext = sanitizedProjection(
    selectedDecisionContext(humanOrchestration, context),
    disclosureFindings,
    'decision_context'
  );
  const requirements = assurance.requirement_set.status === 'DEFINED'
    ? projectedRequirements(
        assurance.requirement_set.requirements,
        disclosureFindings
      )
    : [];
  const capabilityRevisionSet = sanitizedProjection(
    assurance.capability_revision_set.items,
    disclosureFindings,
    'capability_revision_set'
  );
  const projectedStewardship = sanitizedProjection(
    stewardshipProjection(stewardship),
    disclosureFindings,
    'stewardship_projection'
  );
  const objective = {
    goal: redactSensitiveText(task.goal, disclosureFindings, 'objective.goal'),
    goal_digest: canonicalDigest(task.goal),
    desired_outcome: task.desired_outcome == null
      ? null
      : redactSensitiveText(
          task.desired_outcome,
          disclosureFindings,
          'objective.desired_outcome'
        ),
    desired_outcome_digest: task.desired_outcome == null
      ? null
      : canonicalDigest(task.desired_outcome)
  };
  const blockerSet = [...new Set([
    ...holds,
    ...(disclosureFindings.length ? ['DISCLOSURE_REVIEW_REQUIRED'] : [])
  ])].sort();
  const disclosureBlocked = disclosureFindings.length > 0;
  const gates = {
    preparation: {
      status: disclosureBlocked ? 'BLOCKED' : preparationGate.status,
      allowed_action_ids: disclosureBlocked
        ? []
        : [...preparationGate.allowed_action_ids].sort(),
      blockers: [...new Set([
        ...preparationGate.blockers,
        ...(disclosureBlocked ? ['DISCLOSURE_REVIEW_REQUIRED'] : [])
      ])].sort()
    },
    execution: {
      status: disclosureBlocked
        ? 'HOLD'
        : executionGate.status === 'READY'
          ? 'REVIEW_READY'
          : executionGate.status,
      authorized: false,
      blockers: blockerSet,
      required_approvals: [...executionGate.required_approvals].sort(),
      approval_action_ids: [...executionGate.approval_action_ids].sort()
    }
  };
  const basis = {
    task_contract_digest: assurance.requirement_set.task_contract_digest,
    requirement_set_digest: canonicalDigest({
      task_contract_digest: assurance.requirement_set.task_contract_digest,
      requirements
    }),
    base_subject_revision: target.subject_revision,
    source_revision_set_digest: canonicalDigest(sourceRevisionSet),
    capability_revision_set_digest: canonicalDigest(capabilityRevisionSet),
    policy_revision: assurance.policy_revision,
    decision_context_digest: canonicalDigest(decisionContext),
    action_graph_digest: canonicalDigest(actions),
    gate_contract_digest: canonicalDigest(gates),
    blocker_set_digest: canonicalDigest(blockerSet),
    stewardship_contract_digest: canonicalDigest(stewardship),
    work_packet_basis_digest: canonicalDigest(workPacketBasis),
    plan_projection_digest: null,
    plan_contract_revision: PLAN_CONTRACT_REVISION
  };
  const gaps = decisionGaps({
    task,
    holds: blockerSet,
    scope,
    actions,
    stewardship,
    disclosureFindings
  });
  const slice = {
    schema_version: PLAN_SLICE_SCHEMA_VERSION,
    slice_id: opaqueId('slice', idFactory),
    attempt_id: opaqueId('attempt', idFactory),
    issued_at: new Date(issuedEpoch).toISOString(),
    expires_at: new Date(issuedEpoch + ttlMs).toISOString(),
    lifecycle: 'COMPILED_CANDIDATE',
    freshness: 'COMPILED_UNVERIFIED',
    handoff_status: handoffStatus({
      gaps,
      preparationGate: gates.preparation,
      executionGate: gates.execution,
      actions
    }),
    audience: projectedAudience,
    target,
    task_id: task.task_id,
    objective,
    scope,
    basis,
    requirements,
    source_revision_set: sourceRevisionSet,
    capability_revision_set: capabilityRevisionSet,
    decision_context_fingerprint: {
      digest: basis.decision_context_digest,
      confirmed_intent_ids: decisionContext.confirmed_intents.map(item => item.id),
      resolved_question_ids: decisionContext.resolved_questions.map(item => item.id),
      applicable_memory_ids: decisionContext.applicable_memory_fingerprints.map(item => item.memory_id),
      selected_failure_ids: decisionContext.selected_failures.map(item => item.id),
      selected_decision_ids: decisionContext.selected_decisions.map(item => item.id),
      raw_conversation_included: false,
      memory_summaries_included: false
    },
    decision_gaps: gaps,
    actions,
    gates,
    stewardship_projection: projectedStewardship,
    disclosure_review: {
      status: disclosureFindings.length ? 'REDACTED_BLOCKED' : 'STRUCTURAL_SCAN_CLEAR',
      method: 'SECRET_PATTERN_SCAN_NOT_DLP',
      redacted_field_paths: [...new Set(disclosureFindings)].sort(),
      raw_conversation_included: false
    },
    work_return_contract: {
      schema_version: WORK_RETURN_SCHEMA_VERSION,
      required_binding_fields: [...REQUIRED_RETURN_BINDINGS],
      proof_must_bind_end_revision: true,
      structural_validation_only: true,
      trusted_acceptance_requires_issued_slice_store: true,
      replay_protection: 'NOT_IMPLEMENTED'
    },
    invariant_kernel: {
      plan_slice_is_projection_not_ssot: true,
      capability_reference_is_not_authority: true,
      hash_is_not_signature: true,
      stale_slice_cannot_authorize_work: true,
      forbidden_scope_precedes_allowed_scope: true,
      result_claim_is_not_proof: true
    },
    trust_boundary: {
      issued_slice_store: 'NOT_IMPLEMENTED',
      cryptographic_signature: 'NOT_IMPLEMENTED',
      transport_identity: 'NOT_IMPLEMENTED',
      current_head_revalidation: 'REQUIRED_AT_DISPATCH_AND_RETURN',
      authenticity: 'UNAUTHENTICATED'
    },
    authorization: 'NOT_GRANTED'
  };
  slice.basis.plan_projection_digest = computePlanProjectionDigest(slice);
  if (!boundedPlanStructure(slice) || Buffer.byteLength(canonicalJson(slice)) > MAX_PLAN_BYTES) {
    throw new Error('Plan Slice exceeds bounded structural limits');
  }
  const finalized = { ...slice, slice_digest: computePlanSliceDigest(slice) };
  const compiledIssues = integrityIssues(finalized);
  if (compiledIssues.length) {
    throw new Error(`compiled Plan Slice violates its contract: ${compiledIssues.join(',')}`);
  }
  return finalized;
}

function planArrayOfStrings(value) {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0);
}

function digestString(value) {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
}

function safeCanonicalDigest(value) {
  try {
    return canonicalDigest(value);
  } catch {
    return null;
  }
}

function hasAcyclicActions(actions) {
  if (actions.some(action => (
    !action
    || typeof action !== 'object'
    || typeof action.id !== 'string'
    || !Array.isArray(action.depends_on)
  ))) return false;
  const ids = new Set(actions.map(action => action.id));
  if (ids.size !== actions.length) return false;
  if (actions.some(action => action.depends_on.some(id => !ids.has(id) || id === action.id))) {
    return false;
  }
  const remaining = new Map(actions.map(action => [action.id, action.depends_on.length]));
  const dependents = new Map(actions.map(action => [action.id, []]));
  for (const action of actions) {
    for (const dependency of action.depends_on) dependents.get(dependency).push(action.id);
  }
  const queue = [...remaining].filter(([, count]) => count === 0).map(([id]) => id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift();
    visited += 1;
    for (const dependent of dependents.get(id)) {
      const count = remaining.get(dependent) - 1;
      remaining.set(dependent, count);
      if (count === 0) queue.push(dependent);
    }
  }
  return visited === actions.length;
}

function displayMatchesDigest(value, digest) {
  if (typeof value !== 'string' || !digestString(digest)) return false;
  if (value === `[REDACTED:${digest.slice(7, 23)}]`) return true;
  return safeCanonicalDigest(value) === digest;
}

function uniqueStrings(value) {
  return planArrayOfStrings(value) && new Set(value).size === value.length;
}

function integrityIssues(slice) {
  const issues = [];
  if (!slice || typeof slice !== 'object' || Array.isArray(slice)) return ['SLICE_SHAPE_INVALID'];
  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(canonicalJson(slice));
  } catch {
    issues.push('SLICE_NON_JSON_VALUE');
  }
  if (bytes > MAX_PLAN_BYTES || !boundedPlanStructure(slice)) {
    issues.push('SLICE_STRUCTURAL_LIMIT_EXCEEDED');
  }
  if (hasForbiddenPlanField(slice) || sensitivePaths(slice).length) {
    issues.push('SLICE_FORBIDDEN_OR_SENSITIVE_FIELD');
  }
  exactFields(slice, PLAN_ROOT_FIELDS, 'slice', issues);
  if (slice.schema_version !== PLAN_SLICE_SCHEMA_VERSION) issues.push('SLICE_SCHEMA_VERSION_MISMATCH');
  if (slice.authorization !== 'NOT_GRANTED') issues.push('SLICE_AUTHORIZATION_INVALID');
  if (slice.lifecycle !== 'COMPILED_CANDIDATE' || slice.freshness !== 'COMPILED_UNVERIFIED') {
    issues.push('SLICE_LIFECYCLE_INVALID');
  }
  if (!['NOT_REQUIRED', 'BLOCKED', 'PREPARE_ONLY', 'READY_FOR_EXECUTOR_REVIEW'].includes(
    slice.handoff_status
  )) issues.push('SLICE_HANDOFF_STATUS_INVALID');
  if (typeof slice.slice_id !== 'string' || !/^slice:.+$/.test(slice.slice_id)) {
    issues.push('SLICE_ID_INVALID');
  }
  if (typeof slice.attempt_id !== 'string' || !/^attempt:.+$/.test(slice.attempt_id)) {
    issues.push('SLICE_ATTEMPT_ID_INVALID');
  }
  if (typeof slice.task_id !== 'string' || !slice.task_id) issues.push('SLICE_TASK_ID_INVALID');
  if (typeof slice.audience !== 'string' || !slice.audience) issues.push('SLICE_AUDIENCE_INVALID');
  const issuedEpoch = dateTimeEpoch(slice.issued_at);
  const expiresEpoch = dateTimeEpoch(slice.expires_at);
  if (
    !Number.isFinite(issuedEpoch)
    || !Number.isFinite(expiresEpoch)
    || expiresEpoch <= issuedEpoch
    || expiresEpoch - issuedEpoch > 60 * 60 * 1000
  ) {
    issues.push('SLICE_TIME_WINDOW_INVALID');
  }

  const objectiveValid = exactFields(slice.objective, PLAN_OBJECTIVE_FIELDS, 'slice_objective', issues);
  if (objectiveValid && (
    !displayMatchesDigest(slice.objective.goal, slice.objective.goal_digest)
    || (
      slice.objective.desired_outcome == null
        ? slice.objective.desired_outcome_digest !== null
        : !displayMatchesDigest(
            slice.objective.desired_outcome,
            slice.objective.desired_outcome_digest
          )
    )
  )) issues.push('SLICE_OBJECTIVE_DIGEST_MISMATCH');

  const targetValid = exactFields(slice.target, PLAN_TARGET_FIELDS, 'slice_target', issues);
  if (targetValid) {
    if (
      (slice.target.project !== null && typeof slice.target.project !== 'string')
      || (
        slice.target.repository_identity !== null
        && (
          typeof slice.target.repository_identity !== 'string'
          || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?$/.test(
            slice.target.repository_identity
          )
        )
      )
      || typeof slice.target.project_ref !== 'string'
      || !slice.target.project_ref
      || (
        slice.target.subject_revision !== null
        && typeof slice.target.subject_revision !== 'string'
      )
    ) issues.push('SLICE_TARGET_INVALID');
    if ((slice.target.subject_revision ?? null) !== (slice.basis?.base_subject_revision ?? null)) {
      issues.push('SLICE_TARGET_REVISION_MISMATCH');
    }
  }

  const scopeShapeValid = exactFields(slice.scope, PLAN_SCOPE_FIELDS, 'slice_scope', issues);
  if (scopeShapeValid) {
    const allowed = slice.scope.allowed;
    const forbidden = slice.scope.forbidden;
    const constraints = slice.scope.constraints;
    if (
      !uniqueStrings(allowed)
      || !uniqueStrings(forbidden)
      || !planArrayOfStrings(constraints)
      || !allowed.every(isValidScopePattern)
      || !forbidden.every(isValidScopePattern)
      || !['NOT_REQUIRED', 'EXPLICIT', 'UNRESOLVED'].includes(slice.scope.status)
      || slice.scope.constraints_are_allowed_scope !== false
      || slice.scope.forbidden_precedence !== true
      || (slice.scope.status === 'EXPLICIT' && !allowed.length)
      || (slice.scope.status === 'UNRESOLVED' && allowed.length)
      || (slice.scope.status === 'NOT_REQUIRED' && (allowed.length || forbidden.length))
    ) issues.push('SLICE_SCOPE_INVALID');
  }

  const basisValid = exactFields(slice.basis, new Set(BASIS_FIELDS), 'slice_basis', issues);
  if (basisValid) {
    for (const field of BASIS_FIELDS.filter(field => field.endsWith('_digest'))) {
      if (!digestString(slice.basis[field])) issues.push('SLICE_BASIS_DIGEST_INVALID');
    }
    if (
      slice.basis.plan_contract_revision !== PLAN_CONTRACT_REVISION
      || typeof slice.basis.policy_revision !== 'string'
      || !slice.basis.policy_revision
    ) issues.push('SLICE_BASIS_REVISION_INVALID');
    if (safeCanonicalDigest(planProjectionPayload(slice)) !== slice.basis.plan_projection_digest) {
      issues.push('SLICE_PLAN_PROJECTION_DIGEST_MISMATCH');
    }
  }

  if (!Array.isArray(slice.source_revision_set) || slice.source_revision_set.length > 1000) {
    issues.push('SLICE_SOURCE_REVISION_SET_INVALID');
  } else {
    for (const item of slice.source_revision_set) {
      if (!exactFields(item, PLAN_SOURCE_FIELDS, 'slice_source', issues)) continue;
      if (
        typeof item.system !== 'string'
        || !item.system
        || typeof item.kind !== 'string'
        || !item.kind
        || typeof item.location !== 'string'
        || !item.location
        || typeof item.revision_or_sha !== 'string'
        || !item.revision_or_sha
        || (
          item.observed_at !== null
          && !Number.isFinite(dateTimeEpoch(item.observed_at))
        )
      ) issues.push('SLICE_SOURCE_REVISION_SET_INVALID');
    }
    const identities = slice.source_revision_set.map(item => (
      `${item?.system}\u0000${item?.kind}\u0000${item?.location}`
    ));
    if (new Set(identities).size !== identities.length) issues.push('SLICE_SOURCE_IDENTITY_DUPLICATE');
    if (safeCanonicalDigest(slice.source_revision_set) !== slice.basis?.source_revision_set_digest) {
      issues.push('SLICE_SOURCE_REVISION_SET_DIGEST_MISMATCH');
    }
    if (targetValid && repositoryIdentityFromSourceSet(
      slice.source_revision_set,
      slice.target.project
    ) !== slice.target.repository_identity) {
      issues.push('SLICE_TARGET_REPOSITORY_IDENTITY_MISMATCH');
    }
  }

  if (!Array.isArray(slice.capability_revision_set) || slice.capability_revision_set.length > 1000) {
    issues.push('SLICE_CAPABILITY_REVISION_SET_INVALID');
  } else {
    for (const item of slice.capability_revision_set) {
      if (!exactFields(item, PLAN_CAPABILITY_FIELDS, 'slice_capability', issues)) continue;
      if (
        typeof item.id !== 'string'
        || !item.id
        || typeof item.scope !== 'string'
        || !item.scope
        || typeof item.location !== 'string'
        || !item.location
        || typeof item.revision_or_sha !== 'string'
        || !item.revision_or_sha
      ) issues.push('SLICE_CAPABILITY_REVISION_SET_INVALID');
    }
    const identities = slice.capability_revision_set.map(item => (
      `${item?.id}\u0000${item?.scope}\u0000${item?.location}`
    ));
    if (new Set(identities).size !== identities.length) issues.push('SLICE_CAPABILITY_IDENTITY_DUPLICATE');
    if (
      safeCanonicalDigest(slice.capability_revision_set)
      !== slice.basis?.capability_revision_set_digest
    ) issues.push('SLICE_CAPABILITY_REVISION_SET_DIGEST_MISMATCH');
  }

  if (!Array.isArray(slice.requirements) || slice.requirements.length > 1000) {
    issues.push('SLICE_REQUIREMENTS_INVALID');
  } else {
    const ids = [];
    for (const requirement of slice.requirements) {
      if (!exactFields(requirement, PLAN_REQUIREMENT_FIELDS, 'slice_requirement', issues)) continue;
      ids.push(requirement.id);
      const expectedFingerprint = safeCanonicalDigest({
        id: requirement.id,
        text_digest: requirement.text_digest,
        mode: requirement.mode,
        required: requirement.required
      });
      if (
        typeof requirement.id !== 'string'
        || !requirement.id
        || !['automated', 'manual', 'external'].includes(requirement.mode)
        || typeof requirement.required !== 'boolean'
        || !displayMatchesDigest(requirement.text, requirement.text_digest)
        || expectedFingerprint !== requirement.fingerprint
      ) issues.push('SLICE_REQUIREMENT_FINGERPRINT_INVALID');
    }
    if (new Set(ids).size !== ids.length) issues.push('SLICE_REQUIREMENT_ID_INVALID_OR_DUPLICATE');
    const expectedRequirementSetDigest = safeCanonicalDigest({
      task_contract_digest: slice.basis?.task_contract_digest,
      requirements: slice.requirements
    });
    if (expectedRequirementSetDigest !== slice.basis?.requirement_set_digest) {
      issues.push('SLICE_REQUIREMENT_SET_DIGEST_MISMATCH');
    }
  }

  const actionMap = new Map();
  if (!Array.isArray(slice.actions) || slice.actions.length > 1000) {
    issues.push('SLICE_ACTIONS_INVALID');
  } else {
    for (const action of slice.actions) {
      if (!exactFields(action, PLAN_ACTION_FIELDS, 'slice_action', issues)) continue;
      actionMap.set(action.id, action);
      if (
        typeof action.id !== 'string'
        || !action.id
        || !displayMatchesDigest(action.description, action.description_digest)
        || (action.target !== null && typeof action.target !== 'string')
        || (action.operation !== null && typeof action.operation !== 'string')
        || typeof action.effect !== 'string'
        || !action.effect
        || typeof action.reversible !== 'boolean'
        || !uniqueStrings(action.depends_on)
        || !['PREPARATION', 'EXECUTION_REVIEW', 'BLOCKED'].includes(action.phase)
        || !digestString(action.action_context_digest)
      ) issues.push('SLICE_ACTION_INVALID');
      const semantics = assessActionSemantics(action, {
        taskProject: slice.target?.project ?? null,
        taskScope: slice.scope
      });
      if (semantics.classification === 'CONSEQUENTIAL' && action.phase === 'PREPARATION') {
        issues.push('SLICE_ACTION_PHASE_SEMANTICS_CONFLICT');
      }
      if (scopeShapeValid && targetValid) {
        const expectedActionDigest = safeCanonicalDigest({
          task_id: slice.task_id,
          action_id: action.id,
          description_digest: action.description_digest,
          target: action.target,
          operation: action.operation,
          effect: action.effect,
          reversible: action.reversible,
          depends_on: action.depends_on,
          allowed_scope: slice.scope.allowed,
          forbidden_scope: slice.scope.forbidden,
          base_subject_revision: slice.target.subject_revision,
          audience: slice.audience
        });
        if (expectedActionDigest !== action.action_context_digest) {
          issues.push('SLICE_ACTION_CONTEXT_DIGEST_MISMATCH');
        }
      }
    }
    if (actionMap.size !== slice.actions.length || !hasAcyclicActions(slice.actions)) {
      issues.push('SLICE_ACTION_GRAPH_INVALID');
    }
    if (safeCanonicalDigest(slice.actions) !== slice.basis?.action_graph_digest) {
      issues.push('SLICE_ACTION_GRAPH_DIGEST_MISMATCH');
    }
  }

  const gapTypes = new Set();
  const gapIds = new Set();
  if (!Array.isArray(slice.decision_gaps) || slice.decision_gaps.length > 1000) {
    issues.push('SLICE_DECISION_GAPS_INVALID');
  } else {
    for (const gap of slice.decision_gaps) {
      if (!exactFields(gap, PLAN_GAP_FIELDS, 'slice_decision_gap', issues)) continue;
      if (
        typeof gap.gap_id !== 'string'
        || !gap.gap_id
        || typeof gap.type !== 'string'
        || !gap.type
        || !uniqueStrings(gap.blocks)
        || typeof gap.resolution !== 'string'
        || !gap.resolution
      ) issues.push('SLICE_DECISION_GAP_INVALID');
      if (gapIds.has(gap.gap_id)) issues.push('SLICE_DECISION_GAP_ID_DUPLICATE');
      gapIds.add(gap.gap_id);
      gapTypes.add(gap.type);
    }
  }

  const gatesValid = exactFields(slice.gates, PLAN_GATES_FIELDS, 'slice_gates', issues);
  const preparationGateValid = gatesValid && exactFields(
    slice.gates.preparation,
    PLAN_PREPARATION_GATE_FIELDS,
    'slice_preparation_gate',
    issues
  );
  const executionGateValid = gatesValid && exactFields(
    slice.gates.execution,
    PLAN_EXECUTION_GATE_FIELDS,
    'slice_execution_gate',
    issues
  );
  if (preparationGateValid && executionGateValid) {
    const preparationIds = slice.gates.preparation.allowed_action_ids;
    const approvalIds = slice.gates.execution.approval_action_ids;
    const blockers = slice.gates.execution.blockers;
    const expectedPreparationIds = [...actionMap.values()]
      .filter(action => action.phase === 'PREPARATION')
      .map(action => action.id)
      .sort();
    const expectedApprovalIds = [...actionMap.values()]
      .filter(action => action.phase === 'EXECUTION_REVIEW')
      .map(action => action.id)
      .sort();
    if (
      !['ALLOWED', 'BLOCKED'].includes(slice.gates.preparation.status)
      || !uniqueStrings(preparationIds)
      || !uniqueStrings(slice.gates.preparation.blockers)
      || preparationIds.some(id => actionMap.get(id)?.phase !== 'PREPARATION')
      || (slice.gates.preparation.status === 'ALLOWED' && !preparationIds.length)
      || (
        slice.gates.preparation.status === 'ALLOWED'
        && canonicalJson([...preparationIds].sort()) !== canonicalJson(expectedPreparationIds)
      )
      || (slice.gates.preparation.status === 'BLOCKED' && preparationIds.length)
      || slice.gates.execution.authorized !== false
      || !['REVIEW_READY', 'HOLD', 'APPROVAL_REQUIRED'].includes(slice.gates.execution.status)
      || !uniqueStrings(blockers)
      || !uniqueStrings(slice.gates.execution.required_approvals)
      || !uniqueStrings(approvalIds)
      || approvalIds.some(id => actionMap.get(id)?.phase !== 'EXECUTION_REVIEW')
      || canonicalJson([...approvalIds].sort()) !== canonicalJson(expectedApprovalIds)
      || (slice.gates.execution.status === 'REVIEW_READY' && blockers.length)
    ) issues.push('SLICE_GATE_STATE_INVALID');
    if (safeCanonicalDigest(slice.gates) !== slice.basis?.gate_contract_digest) {
      issues.push('SLICE_GATE_CONTRACT_DIGEST_MISMATCH');
    }
    if (safeCanonicalDigest(blockers) !== slice.basis?.blocker_set_digest) {
      issues.push('SLICE_BLOCKER_SET_DIGEST_MISMATCH');
    }
    for (const blocker of blockers) {
      if (!slice.decision_gaps?.some(gap => (
        gap.gap_id === `hold:${blocker}` && gap.type === blocker
      ))) issues.push('SLICE_BLOCKER_GAP_MISSING');
    }
  }

  const decisionFingerprintValid = exactFields(
    slice.decision_context_fingerprint,
    PLAN_DECISION_FINGERPRINT_FIELDS,
    'slice_decision_context_fingerprint',
    issues
  );
  if (decisionFingerprintValid) {
    for (const field of [
      'confirmed_intent_ids', 'resolved_question_ids', 'applicable_memory_ids',
      'selected_failure_ids', 'selected_decision_ids'
    ]) {
      if (!uniqueStrings(slice.decision_context_fingerprint[field])) {
        issues.push('SLICE_DECISION_CONTEXT_FINGERPRINT_INVALID');
      }
    }
    if (
      slice.decision_context_fingerprint.digest !== slice.basis?.decision_context_digest
      || slice.decision_context_fingerprint.raw_conversation_included !== false
      || slice.decision_context_fingerprint.memory_summaries_included !== false
    ) issues.push('SLICE_DECISION_CONTEXT_DIGEST_MISMATCH');
  }

  const stewardshipValid = exactFields(
    slice.stewardship_projection,
    PLAN_STEWARDSHIP_FIELDS,
    'slice_stewardship',
    issues
  );
  if (stewardshipValid) {
    const portfolioValid = exactFields(
      slice.stewardship_projection.portfolio,
      PLAN_STEWARDSHIP_PORTFOLIO_FIELDS,
      'slice_stewardship_portfolio',
      issues
    );
    const foresightValid = exactFields(
      slice.stewardship_projection.foresight,
      PLAN_STEWARDSHIP_FORESIGHT_FIELDS,
      'slice_stewardship_foresight',
      issues
    );
    const followValid = exactFields(
      slice.stewardship_projection.follow_through,
      PLAN_STEWARDSHIP_FOLLOW_FIELDS,
      'slice_stewardship_follow_through',
      issues
    );
    if (portfolioValid && (
      ![
        'NOT_REQUIRED', 'NOT_DECLARED', 'NOT_ASSESSED_ADVISORY', 'NOT_EVALUATED',
        'STRUCTURALLY_ANALYZED_UNAUTHENTICATED', 'STALE_UNAUTHENTICATED'
      ].includes(slice.stewardship_projection.portfolio.status)
      || typeof slice.stewardship_projection.portfolio.recommendation !== 'string'
      || !slice.stewardship_projection.portfolio.recommendation
      || (
        slice.stewardship_projection.portfolio.snapshot_digest !== null
        && !digestString(slice.stewardship_projection.portfolio.snapshot_digest)
      )
      || !uniqueStrings(slice.stewardship_projection.portfolio.relevant_commitment_digests)
      || !uniqueStrings(slice.stewardship_projection.portfolio.conflict_codes)
      || !slice.stewardship_projection.portfolio.relevant_commitment_digests.every(digestString)
      || !['NOT_APPLICABLE', 'UNAUTHENTICATED_CALLER_INPUT'].includes(
        slice.stewardship_projection.portfolio.trust
      )
      || slice.stewardship_projection.portfolio.priority_change_authorized !== false
    )) issues.push('SLICE_STEWARDSHIP_PORTFOLIO_INVALID');
    if (foresightValid && (
      !['LIGHT', 'DEEP'].includes(slice.stewardship_projection.foresight.mode)
      || ![
        'BOUNDED_LIGHT_REVIEW', 'CONDITIONAL_ONLY_NOT_EXECUTION_CLEARANCE'
      ].includes(slice.stewardship_projection.foresight.assessment_status)
      || !uniqueStrings(slice.stewardship_projection.foresight.risk_codes)
      || !uniqueStrings(slice.stewardship_projection.foresight.risk_digests)
      || !slice.stewardship_projection.foresight.risk_digests.every(digestString)
      || typeof slice.stewardship_projection.foresight.smallest_reversible_next_step !== 'string'
      || !slice.stewardship_projection.foresight.smallest_reversible_next_step
      || typeof slice.stewardship_projection.foresight.execution_hold_required !== 'boolean'
      || (
        slice.stewardship_projection.foresight.risk_codes.some(code => [
          'ACTION_METADATA_CONTRADICTION',
          'ACTION_SCOPE_CONTRACT_CONFLICT',
          'IRREVERSIBLE_ACTION_WITHOUT_VERIFIED_RECOVERY'
        ].includes(code))
        && slice.stewardship_projection.foresight.execution_hold_required !== true
      )
      || slice.stewardship_projection.foresight.automatic_action_selected !== false
    )) issues.push('SLICE_STEWARDSHIP_FORESIGHT_INVALID');
    if (followValid && (
      ![
        'NOT_REQUIRED', 'PLANNED_UNBOUND',
        'DEFERRED_UNTIL_CONSEQUENTIAL_ACTION_BOUND'
      ].includes(
        slice.stewardship_projection.follow_through.status
      )
      || !uniqueStrings(slice.stewardship_projection.follow_through.observation_ids)
      || !uniqueStrings(slice.stewardship_projection.follow_through.observation_binding_digests)
      || slice.stewardship_projection.follow_through.tracking_active !== false
      || slice.stewardship_projection.follow_through.automation_binding !== 'NOT_IMPLEMENTED'
    )) issues.push('SLICE_STEWARDSHIP_FOLLOW_THROUGH_INVALID');
    if (foresightValid && executionGateValid) {
      const foresightBlockerPresent = slice.gates.execution.blockers.some(blocker => [
        'FORESIGHT_RECOVERY_PATH_REQUIRED',
        'ACTION_SEMANTICS_CONFLICT',
        'ACTION_SCOPE_CONFLICT'
      ].includes(blocker));
      if (
        slice.stewardship_projection.foresight.execution_hold_required
          !== foresightBlockerPresent
      ) issues.push('SLICE_STEWARDSHIP_FORESIGHT_GATE_MISMATCH');
    }
  }

  const disclosureValid = exactFields(
    slice.disclosure_review,
    PLAN_DISCLOSURE_FIELDS,
    'slice_disclosure_review',
    issues
  );
  const redactedDisplayPresent = hasRedactedDisplay({
    audience: slice.audience,
    target: slice.target,
    objective: slice.objective,
    scope: slice.scope,
    requirements: slice.requirements,
    source_revision_set: slice.source_revision_set,
    capability_revision_set: slice.capability_revision_set,
    decision_context_fingerprint: slice.decision_context_fingerprint,
    actions: slice.actions,
    stewardship_projection: slice.stewardship_projection
  });
  if (disclosureValid && (
    !['STRUCTURAL_SCAN_CLEAR', 'REDACTED_BLOCKED'].includes(slice.disclosure_review.status)
    || slice.disclosure_review.method !== 'SECRET_PATTERN_SCAN_NOT_DLP'
    || !uniqueStrings(slice.disclosure_review.redacted_field_paths)
    || slice.disclosure_review.raw_conversation_included !== false
    || (
      slice.disclosure_review.status === 'STRUCTURAL_SCAN_CLEAR'
      && (slice.disclosure_review.redacted_field_paths.length || redactedDisplayPresent)
    )
    || (
      slice.disclosure_review.status === 'REDACTED_BLOCKED'
      && (
        !slice.disclosure_review.redacted_field_paths.length
        || !redactedDisplayPresent
        || !gapTypes.has('DISCLOSURE_REVIEW_REQUIRED')
        || !slice.gates?.execution?.blockers?.includes('DISCLOSURE_REVIEW_REQUIRED')
        || slice.gates?.preparation?.status !== 'BLOCKED'
      )
    )
  )) issues.push('SLICE_DISCLOSURE_REVIEW_INVALID');

  const returnContractValid = exactFields(
    slice.work_return_contract,
    PLAN_WORK_RETURN_CONTRACT_FIELDS,
    'slice_work_return_contract',
    issues
  );
  if (returnContractValid && (
    slice.work_return_contract.schema_version !== WORK_RETURN_SCHEMA_VERSION
    || !uniqueStrings(slice.work_return_contract.required_binding_fields)
    || canonicalJson(slice.work_return_contract.required_binding_fields)
      !== canonicalJson(REQUIRED_RETURN_BINDINGS)
    || slice.work_return_contract.proof_must_bind_end_revision !== true
    || slice.work_return_contract.structural_validation_only !== true
    || slice.work_return_contract.trusted_acceptance_requires_issued_slice_store !== true
    || slice.work_return_contract.replay_protection !== 'NOT_IMPLEMENTED'
  )) issues.push('SLICE_WORK_RETURN_CONTRACT_INVALID');

  const invariantValid = exactFields(
    slice.invariant_kernel,
    PLAN_INVARIANT_FIELDS,
    'slice_invariant_kernel',
    issues
  );
  if (invariantValid && Object.values(slice.invariant_kernel).some(value => value !== true)) {
    issues.push('SLICE_INVARIANT_KERNEL_INVALID');
  }

  const trustValid = exactFields(slice.trust_boundary, PLAN_TRUST_FIELDS, 'slice_trust_boundary', issues);
  if (trustValid && (
    slice.trust_boundary.issued_slice_store !== 'NOT_IMPLEMENTED'
    || slice.trust_boundary.cryptographic_signature !== 'NOT_IMPLEMENTED'
    || slice.trust_boundary.transport_identity !== 'NOT_IMPLEMENTED'
    || slice.trust_boundary.current_head_revalidation !== 'REQUIRED_AT_DISPATCH_AND_RETURN'
    || slice.trust_boundary.authenticity !== 'UNAUTHENTICATED'
  )) issues.push('SLICE_TRUST_BOUNDARY_INVALID');

  if (scopeShapeValid) {
    const hasScopeGap = gapTypes.has('SCOPE_UNRESOLVED');
    const hasActionDetailGap = gapTypes.has('ACTION_TARGET_OR_OPERATION_UNRESOLVED');
    const expectedScopeGap = slice.scope.status === 'UNRESOLVED';
    const expectedActionDetailGap = [...actionMap.values()].some(action => (
      !action.target || !action.operation
    ));
    if (hasScopeGap !== expectedScopeGap) issues.push('SLICE_SCOPE_GAP_MISMATCH');
    if (hasActionDetailGap !== expectedActionDetailGap) {
      issues.push('SLICE_ACTION_DETAIL_GAP_MISMATCH');
    }
  }
  if (preparationGateValid && executionGateValid && Array.isArray(slice.actions)) {
    const expectedHandoff = handoffStatus({
      gaps: Array.isArray(slice.decision_gaps) ? slice.decision_gaps : [],
      preparationGate: slice.gates.preparation,
      executionGate: slice.gates.execution,
      actions: slice.actions
    });
    if (expectedHandoff !== slice.handoff_status) issues.push('SLICE_HANDOFF_STATUS_CONTRADICTION');
  }

  if (
    typeof slice.slice_digest !== 'string'
    || safeCanonicalDigest(sliceDigestPayload(slice)) !== slice.slice_digest
  ) issues.push('SLICE_DIGEST_MISMATCH');
  return [...new Set(issues)];
}
export function evaluatePlanSliceFreshness(slice, currentSnapshot, {
  knownStaleSliceIds = [],
  now = new Date().toISOString()
} = {}) {
  const issues = integrityIssues(slice);
  if (!Array.isArray(knownStaleSliceIds) || !uniqueStrings(knownStaleSliceIds)) {
    return {
      freshness: 'INVALID',
      handoff_status: 'BLOCKED',
      issues: ['KNOWN_STALE_SLICE_IDS_INVALID'],
      authorization: 'NOT_GRANTED'
    };
  }
  const nowEpoch = dateTimeEpoch(now);
  if (!Number.isFinite(nowEpoch)) throw new Error('now must be a valid date-time');
  if (nowEpoch < dateTimeEpoch(slice?.issued_at)) {
    return {
      freshness: 'INVALID',
      handoff_status: 'BLOCKED',
      issues: ['EVALUATION_BEFORE_SLICE_ISSUED'],
      authorization: 'NOT_GRANTED'
    };
  }
  if (issues.length) {
    return {
      freshness: 'INVALID',
      handoff_status: 'BLOCKED',
      issues,
      authorization: 'NOT_GRANTED'
    };
  }
  const currentIssues = integrityIssues(currentSnapshot);
  if (nowEpoch < dateTimeEpoch(currentSnapshot?.issued_at)) {
    currentIssues.push('EVALUATION_BEFORE_SLICE_ISSUED');
  }
  if (nowEpoch >= dateTimeEpoch(currentSnapshot?.expires_at)) {
    currentIssues.push('SLICE_EXPIRED_AT_EVALUATION_TIME');
  }
  if (currentIssues.length) {
    return {
      freshness: 'INVALID',
      handoff_status: 'BLOCKED',
      issues: currentIssues.map(issue => `CURRENT_${issue}`),
      authorization: 'NOT_GRANTED'
    };
  }
  const changes = [];
  if (slice.task_id !== currentSnapshot.task_id) changes.push('task_id');
  if (slice.target.project !== currentSnapshot.target.project) changes.push('target_project');
  if (
    slice.target.repository_identity !== currentSnapshot.target.repository_identity
  ) changes.push('target_repository_identity');
  if (slice.target.project_ref !== currentSnapshot.target.project_ref) changes.push('target_project_ref');
  for (const field of BASIS_FIELDS) {
    if ((slice.basis?.[field] ?? null) !== (currentSnapshot?.basis?.[field] ?? null)) {
      changes.push(field);
    }
  }
  if (knownStaleSliceIds.includes(slice.slice_id)) changes.push('permanent_stale_tombstone');
  if (dateTimeEpoch(slice.expires_at) <= nowEpoch) changes.push('expires_at');
  return {
    freshness: changes.length ? 'STALE' : 'MATCHED_TO_CALLER_SNAPSHOT',
    handoff_status: changes.length ? 'BLOCKED' : slice.handoff_status,
    changes,
    validation_scope: 'STRUCTURAL_ONLY',
    trust: 'UNAUTHENTICATED',
    current_head_verified: false,
    authorization: 'NOT_GRANTED'
  };
}

function runtimeStateId(payload) {
  return `state:${canonicalDigest(payload).slice(7)}`;
}

const RUNTIME_HEAD_FIELDS = new Set([
  'schema_version', 'runtime_id', 'task_id', 'target', 'generation',
  'previous_state_id', 'latest_slice_issued_at', 'active_slice_id', 'active_slice_digest',
  'active_basis_digest', 'stale_slice_ids', 'lifecycle', 'transition_record',
  'persistence', 'authorization', 'state_id'
]);
const RUNTIME_TARGET_FIELDS = new Set(['project', 'repository_identity', 'project_ref']);
const RUNTIME_TRANSITION_FIELDS = new Set([
  'kind', 'reason_codes', 'reason_digest', 'from_basis_digest', 'to_basis_digest'
]);

function runtimeIdentity(taskId, target) {
  return `task:${canonicalDigest({
    task_id: taskId,
    project: target?.project ?? null,
    repository_identity: target?.repository_identity ?? null,
    project_ref: target?.project_ref ?? null
  }).slice(7, 31)}`;
}

function runtimeHeadIsStructurallyValid(head) {
  const issues = [];
  try {
    if (Buffer.byteLength(canonicalJson(head)) > 65_536) return false;
  } catch {
    return false;
  }
  if (sensitivePaths(head).length) return false;
  if (!exactFields(head, RUNTIME_HEAD_FIELDS, 'runtime_head', issues)) return false;
  const targetValid = exactFields(head.target, RUNTIME_TARGET_FIELDS, 'runtime_target', issues);
  const transitionValid = exactFields(
    head.transition_record,
    RUNTIME_TRANSITION_FIELDS,
    'runtime_transition',
    issues
  );
  const { state_id: stateId, ...payload } = head;
  const active = head.lifecycle === 'ACTIVE_CANDIDATE';
  const replan = head.lifecycle === 'REPLAN_REQUIRED';
  const predecessorValid = head.generation === 1
    ? head.previous_state_id === null && head.transition_record?.kind === 'CREATED'
    : typeof head.previous_state_id === 'string' && head.previous_state_id.startsWith('state:');
  const activeFieldsValid = active
    ? (
        typeof head.active_slice_id === 'string'
        && /^slice:.+$/.test(head.active_slice_id)
        && digestString(head.active_slice_digest)
        && digestString(head.active_basis_digest)
        && !head.stale_slice_ids.includes(head.active_slice_id)
      )
    : replan
      ? (
          head.active_slice_id === null
          && head.active_slice_digest === null
          && head.active_basis_digest === null
        )
      : false;
  const transitionConsistent = head.generation === 1
    ? (
        active
        && head.transition_record.kind === 'CREATED'
        && head.transition_record.reason_codes.length === 0
        && head.transition_record.reason_digest === null
        && head.transition_record.from_basis_digest === null
        && head.transition_record.to_basis_digest === head.active_basis_digest
      )
    : (
        head.transition_record.reason_codes.length > 0
        && digestString(head.transition_record.from_basis_digest)
        && digestString(head.transition_record.to_basis_digest)
        && (
          active
            ? (
                head.transition_record.kind === 'SUPERSEDED'
                && head.transition_record.to_basis_digest === head.active_basis_digest
                && (
                  head.transition_record.reason_codes.includes('EXPLICIT_SUPERSEDE')
                    ? digestString(head.transition_record.reason_digest)
                    : head.transition_record.reason_digest === null
                )
              )
            : (
                head.transition_record.kind === 'INVALIDATED'
                && head.transition_record.reason_digest === null
              )
        )
      );
  return issues.length === 0
    && targetValid
    && transitionValid
    && head.schema_version === RUNTIME_HEAD_SCHEMA_VERSION
    && typeof head.task_id === 'string'
    && Boolean(head.task_id)
    && typeof head.target.project_ref === 'string'
    && Boolean(head.target.project_ref)
    && (head.target.project === null || typeof head.target.project === 'string')
    && (
      head.target.repository_identity === null
      || typeof head.target.repository_identity === 'string'
    )
    && head.runtime_id === runtimeIdentity(head.task_id, head.target)
    && Number.isInteger(head.generation)
    && head.generation >= 1
    && Number.isFinite(dateTimeEpoch(head.latest_slice_issued_at))
    && predecessorValid
    && uniqueStrings(head.stale_slice_ids)
    && ['CREATED', 'INVALIDATED', 'SUPERSEDED'].includes(head.transition_record.kind)
    && uniqueStrings(head.transition_record.reason_codes)
    && (
      head.transition_record.reason_digest === null
      || digestString(head.transition_record.reason_digest)
    )
    && (
      head.transition_record.from_basis_digest === null
      || digestString(head.transition_record.from_basis_digest)
    )
    && (
      head.transition_record.to_basis_digest === null
      || digestString(head.transition_record.to_basis_digest)
    )
    && activeFieldsValid
    && transitionConsistent
    && head.persistence === 'CALLER_MANAGED_NOT_TRUSTED'
    && head.authorization === 'NOT_GRANTED'
    && stateId === runtimeStateId(payload);
}

function buildRuntimeHead(slice, {
  generation = 1,
  previousStateId = null,
  staleSliceIds = [],
  transitionRecord = null
} = {}) {
  const issues = integrityIssues(slice);
  if (issues.length) throw new Error('cannot create runtime head from an invalid slice');
  if (!Number.isInteger(generation) || generation < 1) {
    throw new Error('generation must be a positive integer');
  }
  if (generation > 1 && (
    typeof previousStateId !== 'string' || !previousStateId.startsWith('state:')
  )) throw new Error('later runtime generations require a previous state ID');
  if (staleSliceIds.includes(slice.slice_id)) {
    throw new Error('active slice cannot already be stale');
  }
  const target = {
    project: slice.target.project,
    repository_identity: slice.target.repository_identity,
    project_ref: slice.target.project_ref
  };
  const basisDigest = canonicalDigest(slice.basis);
  const record = transitionRecord ?? {
    kind: 'CREATED',
    reason_codes: [],
    reason_digest: null,
    from_basis_digest: null,
    to_basis_digest: basisDigest
  };
  const payload = {
    schema_version: RUNTIME_HEAD_SCHEMA_VERSION,
    runtime_id: runtimeIdentity(slice.task_id, target),
    task_id: slice.task_id,
    target,
    generation,
    previous_state_id: previousStateId,
    latest_slice_issued_at: slice.issued_at,
    active_slice_id: slice.slice_id,
    active_slice_digest: slice.slice_digest,
    active_basis_digest: basisDigest,
    stale_slice_ids: [...new Set(staleSliceIds)].sort(),
    lifecycle: 'ACTIVE_CANDIDATE',
    transition_record: record,
    persistence: 'CALLER_MANAGED_NOT_TRUSTED',
    authorization: 'NOT_GRANTED'
  };
  const head = { ...payload, state_id: runtimeStateId(payload) };
  if (!runtimeHeadIsStructurallyValid(head)) throw new Error('constructed runtime head is invalid');
  return head;
}

export function createRuntimeHead(slice, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Runtime Head options must be an object');
  }
  const unsupported = Object.keys(options).filter(key => key !== 'now');
  if (unsupported.length) {
    throw new Error('initial Runtime Head creation does not accept lifecycle overrides');
  }
  const nowEpoch = dateTimeEpoch(options.now ?? new Date().toISOString());
  if (
    !Number.isFinite(nowEpoch)
    || nowEpoch < dateTimeEpoch(slice?.issued_at)
    || nowEpoch >= dateTimeEpoch(slice?.expires_at)
  ) throw new Error('initial Runtime Head requires a currently valid Plan Slice');
  return buildRuntimeHead(slice);
}

export function transitionRuntimeHead(head, {
  activeSlice,
  currentSnapshot,
  replacementSlice = null,
  supersedeReason = null,
  now = new Date().toISOString()
} = {}) {
  if (!runtimeHeadIsStructurallyValid(head)) throw new Error('runtime head is invalid');
  const nowEpoch = dateTimeEpoch(now);
  const currentIssues = integrityIssues(currentSnapshot);
  const currentIssuedEpoch = dateTimeEpoch(currentSnapshot?.issued_at);
  const currentExpiresEpoch = dateTimeEpoch(currentSnapshot?.expires_at);
  const currentExpired = currentExpiresEpoch <= nowEpoch;
  if (
    !Number.isFinite(nowEpoch)
    || currentIssues.length
    || currentIssuedEpoch > nowEpoch
    || (currentExpired && head.lifecycle !== 'ACTIVE_CANDIDATE')
  ) {
    throw new Error('runtime transition requires a currently valid snapshot');
  }
  if (
    currentSnapshot.task_id !== head.task_id
    || currentSnapshot.target.project !== head.target.project
    || currentSnapshot.target.repository_identity !== head.target.repository_identity
    || currentSnapshot.target.project_ref !== head.target.project_ref
  ) throw new Error('current snapshot crosses the runtime identity boundary');
  if (currentIssuedEpoch < dateTimeEpoch(head.latest_slice_issued_at)) {
    throw new Error('current snapshot predates the runtime high-water mark');
  }

  if (head.lifecycle === 'REPLAN_REQUIRED') {
    if (activeSlice != null) {
      throw new Error('a replan-required runtime has no active slice');
    }
    if (!replacementSlice) {
      return {
        transition: 'REPLAN_STILL_REQUIRED',
        freshness: {
          freshness: 'STALE',
          handoff_status: 'BLOCKED',
          changes: [...head.transition_record.reason_codes],
          authorization: 'NOT_GRANTED'
        },
        head,
        authorization: 'NOT_GRANTED'
      };
    }
    const replacementIssues = integrityIssues(replacementSlice);
    if (
      replacementIssues.length
      || replacementSlice.task_id !== head.task_id
      || replacementSlice.target.project !== head.target.project
      || replacementSlice.target.repository_identity !== head.target.repository_identity
      || replacementSlice.target.project_ref !== head.target.project_ref
      || head.stale_slice_ids.includes(replacementSlice.slice_id)
    ) throw new Error('replacement slice must be a new valid slice in the same runtime');
    if (
      replacementSlice.slice_digest !== currentSnapshot.slice_digest
      || replacementSlice.basis.plan_contract_revision !== PLAN_CONTRACT_REVISION
      || dateTimeEpoch(replacementSlice.issued_at) < dateTimeEpoch(head.latest_slice_issued_at)
    ) throw new Error('replacement slice must exactly match the current snapshot and high-water mark');
    const replacementHead = buildRuntimeHead(replacementSlice, {
      generation: head.generation + 1,
      previousStateId: head.state_id,
      staleSliceIds: head.stale_slice_ids,
      transitionRecord: {
        kind: 'SUPERSEDED',
        reason_codes: ['REPLAN_COMPLETED'],
        reason_digest: null,
        from_basis_digest: head.transition_record.to_basis_digest,
        to_basis_digest: canonicalDigest(replacementSlice.basis)
      }
    });
    return {
      transition: 'REPLAN_ACTIVATED_WITH_NEW_CANDIDATE',
      freshness: evaluatePlanSliceFreshness(replacementSlice, currentSnapshot, {
        knownStaleSliceIds: head.stale_slice_ids,
        now
      }),
      head: replacementHead,
      authorization: 'NOT_GRANTED'
    };
  }

  const activeIssues = integrityIssues(activeSlice);
  if (activeIssues.length) {
    throw new Error('runtime transition requires a valid active slice');
  }
  const expectedRuntimeId = runtimeIdentity(activeSlice.task_id, activeSlice.target);
  if (
    head.runtime_id !== expectedRuntimeId
    || head.task_id !== activeSlice.task_id
    || head.target.project !== activeSlice.target.project
    || head.target.repository_identity !== activeSlice.target.repository_identity
    || head.target.project_ref !== activeSlice.target.project_ref
    || head.latest_slice_issued_at !== activeSlice.issued_at
    || head.active_slice_id !== activeSlice.slice_id
    || head.active_slice_digest !== activeSlice.slice_digest
    || head.active_basis_digest !== canonicalDigest(activeSlice.basis)
  ) throw new Error('active slice does not match runtime head');
  if (
    currentExpired
    && (
      currentSnapshot.slice_digest !== activeSlice.slice_digest
      || replacementSlice !== null
    )
  ) throw new Error('an expired snapshot may only invalidate its matching active slice');

  const freshness = evaluatePlanSliceFreshness(activeSlice, currentSnapshot, {
    knownStaleSliceIds: head.stale_slice_ids,
    now
  });
  if (freshness.freshness === 'MATCHED_TO_CALLER_SNAPSHOT' && !replacementSlice) {
    return {
      transition: 'NO_CHANGE',
      freshness,
      head,
      authorization: 'NOT_GRANTED'
    };
  }

  const staleSliceIds = [...new Set([...head.stale_slice_ids, activeSlice.slice_id])].sort();
  const fromBasisDigest = canonicalDigest(activeSlice.basis);
  const currentBasisDigest = canonicalDigest(currentSnapshot.basis);
  if (!replacementSlice) {
    const reasonCodes = freshness.freshness === 'STALE'
      ? freshness.changes
      : freshness.issues ?? ['CURRENT_STATE_INVALID'];
    const payload = {
      schema_version: RUNTIME_HEAD_SCHEMA_VERSION,
      runtime_id: head.runtime_id,
      task_id: head.task_id,
      target: { ...head.target },
      generation: head.generation + 1,
      previous_state_id: head.state_id,
      latest_slice_issued_at: currentSnapshot.issued_at,
      active_slice_id: null,
      active_slice_digest: null,
      active_basis_digest: null,
      stale_slice_ids: staleSliceIds,
      lifecycle: 'REPLAN_REQUIRED',
      transition_record: {
        kind: 'INVALIDATED',
        reason_codes: [...new Set(reasonCodes)].sort(),
        reason_digest: null,
        from_basis_digest: fromBasisDigest,
        to_basis_digest: currentBasisDigest
      },
      persistence: 'CALLER_MANAGED_NOT_TRUSTED',
      authorization: 'NOT_GRANTED'
    };
    const nextHead = { ...payload, state_id: runtimeStateId(payload) };
    if (!runtimeHeadIsStructurallyValid(nextHead)) {
      throw new Error('constructed invalidation head is invalid');
    }
    return {
      transition: 'INVALIDATED',
      freshness: { ...freshness, freshness: 'STALE', handoff_status: 'BLOCKED' },
      head: nextHead,
      authorization: 'NOT_GRANTED'
    };
  }

  const replacementIssues = integrityIssues(replacementSlice);
  if (
    replacementIssues.length
    || dateTimeEpoch(replacementSlice.issued_at) < dateTimeEpoch(head.latest_slice_issued_at)
    || replacementSlice.slice_id === activeSlice.slice_id
    || head.stale_slice_ids.includes(replacementSlice.slice_id)
    || replacementSlice.task_id !== head.task_id
    || replacementSlice.target.project !== head.target.project
    || replacementSlice.target.repository_identity !== head.target.repository_identity
    || replacementSlice.target.project_ref !== head.target.project_ref
  ) throw new Error('replacement slice must be a new valid slice in the same runtime');
  if (
    replacementSlice.slice_digest !== currentSnapshot.slice_digest
    || replacementSlice.basis.plan_contract_revision !== PLAN_CONTRACT_REVISION
  ) throw new Error('replacement slice must exactly match the current snapshot');
  const explicitSupersede = freshness.freshness === 'MATCHED_TO_CALLER_SNAPSHOT'
    || (
      freshness.freshness === 'STALE'
      && freshness.changes.every(change => change === 'plan_projection_digest')
    );
  if (
    explicitSupersede
    && (typeof supersedeReason !== 'string' || !supersedeReason.trim())
  ) throw new Error('a semantically unchanged replacement requires an explicit supersede reason');

  const reasonCodes = explicitSupersede
    ? ['EXPLICIT_SUPERSEDE']
    : freshness.changes;
  const replacementHead = buildRuntimeHead(replacementSlice, {
    generation: head.generation + 1,
    previousStateId: head.state_id,
    staleSliceIds,
    transitionRecord: {
      kind: 'SUPERSEDED',
      reason_codes: [...new Set(reasonCodes)].sort(),
      reason_digest: explicitSupersede ? canonicalDigest(supersedeReason.trim()) : null,
      from_basis_digest: fromBasisDigest,
      to_basis_digest: canonicalDigest(replacementSlice.basis)
    }
  });
  return {
    transition: 'SUPERSEDED_WITH_NEW_CANDIDATE',
    freshness: { ...freshness, freshness: 'STALE', handoff_status: 'BLOCKED' },
    head: replacementHead,
    authorization: 'NOT_GRANTED'
  };
}
function hasForbiddenKey(value, seen = new WeakSet(), depth = 0) {
  if (typeof value === 'string') {
    return /(?:bearer\s+[a-z0-9._-]{12,}|(?:token|secret|password|credential|api[_-]?key)=|gh[pousr]_[a-z0-9]{20,})/i.test(value);
  }
  if (!value || typeof value !== 'object') return false;
  if (depth > 24 || seen.has(value)) return true;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_RETURN_KEYS.has(key.toLowerCase())) return true;
    if (hasForbiddenKey(child, seen, depth + 1)) return true;
  }
  seen.delete(value);
  return false;
}

function requiredString(value, code, issues) {
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(code);
    return null;
  }
  return value.trim();
}

function requiredCount(value, code, issues) {
  if (!Number.isInteger(value) || value < 0) {
    issues.push(code);
    return null;
  }
  return value;
}

function validatePointer(pointer, label, issues) {
  if (!exactFields(pointer, POINTER_FIELDS, label, issues)) return null;
  const location = requiredString(pointer.location, `${label.toUpperCase()}_LOCATION_INVALID`, issues);
  const revision = requiredString(
    pointer.revision_or_sha,
    `${label.toUpperCase()}_REVISION_INVALID`,
    issues
  );
  if (location && !isSafeEvidenceLocation(location)) {
    issues.push(`${label.toUpperCase()}_LOCATION_UNSAFE`);
    return null;
  }
  return location && revision ? { location, revision_or_sha: revision } : null;
}

function safeIncidentRef(issues, slice) {
  return `incident:${canonicalDigest({ issues: [...new Set(issues)].sort(), slice: slice?.slice_digest ?? null }).slice(7, 23)}`;
}

export function evaluateWorkReturn(slice, workReturn, {
  now = new Date().toISOString(),
  currentSnapshot = null,
  knownStaleSliceIds = []
} = {}) {
  const issues = integrityIssues(slice);
  if (issues.length) return rejectedReturn(issues, slice);

  let bytes = Number.POSITIVE_INFINITY;
  try {
    bytes = Buffer.byteLength(canonicalJson(workReturn));
  } catch {
    issues.push('RETURN_NON_JSON_VALUE');
  }
  if (bytes > MAX_RETURN_BYTES) issues.push('RETURN_PAYLOAD_TOO_LARGE');
  if (hasForbiddenKey(workReturn) || sensitivePaths(workReturn).length) {
    issues.push('RETURN_FORBIDDEN_OR_RAW_FIELD');
  }
  if (!exactFields(workReturn, RETURN_ROOT_FIELDS, 'return', issues)) {
    return rejectedReturn(issues, slice);
  }
  if (workReturn.schema_version !== WORK_RETURN_SCHEMA_VERSION) issues.push('RETURN_SCHEMA_MISMATCH');
  for (const field of [
    'return_id', 'reported_at', 'slice_id', 'slice_digest',
    'attempt_id', 'task_id', 'audience'
  ]) requiredString(workReturn[field], `RETURN_${field.toUpperCase()}_INVALID`, issues);

  const reportedEpoch = dateTimeEpoch(workReturn.reported_at);
  const nowEpoch = dateTimeEpoch(now);
  const issuedEpoch = dateTimeEpoch(slice.issued_at);
  const expiresEpoch = dateTimeEpoch(slice.expires_at);
  if (!Number.isFinite(nowEpoch)) throw new Error('now must be a valid date-time');
  if (
    !Number.isFinite(reportedEpoch)
    || reportedEpoch < issuedEpoch
    || reportedEpoch > nowEpoch
  ) issues.push('RETURN_TIME_INVALID');
  if (reportedEpoch >= expiresEpoch) issues.push('SLICE_EXPIRED_AT_REPORTED_TIME');
  if (nowEpoch >= expiresEpoch) issues.push('SLICE_EXPIRED_AT_EVALUATION_TIME');

  for (const field of ['slice_id', 'slice_digest', 'attempt_id', 'task_id', 'audience']) {
    if (workReturn[field] !== slice[field]) issues.push(`RETURN_${field.toUpperCase()}_MISMATCH`);
  }
  if (exactFields(workReturn.target, RETURN_TARGET_FIELDS, 'return_target', issues)) {
    if ((workReturn.target.project ?? null) !== (slice.target.project ?? null)) {
      issues.push('RETURN_TARGET_PROJECT_MISMATCH');
    }
    if (workReturn.target.project_ref !== slice.target.project_ref) {
      issues.push('RETURN_TARGET_REF_MISMATCH');
    }
    if (workReturn.target.repository_identity !== slice.target.repository_identity) {
      issues.push('RETURN_TARGET_REPOSITORY_IDENTITY_MISMATCH');
    }
  }
  if (!exactFields(workReturn.basis, new Set(BASIS_FIELDS), 'return_basis', issues)) {
    // Shape issue already recorded.
  } else {
    for (const field of BASIS_FIELDS) {
      if ((workReturn.basis[field] ?? null) !== (slice.basis[field] ?? null)) {
        issues.push(`RETURN_BASIS_${field.toUpperCase()}_MISMATCH`);
      }
    }
  }

  if (!currentSnapshot) {
    issues.push('CURRENT_SNAPSHOT_MISSING');
  } else {
    const freshness = evaluatePlanSliceFreshness(slice, currentSnapshot, {
      knownStaleSliceIds,
      now
    });
    if (freshness.freshness !== 'MATCHED_TO_CALLER_SNAPSHOT') {
      issues.push(`SLICE_${freshness.freshness}`);
    }
  }
  if (['BLOCKED', 'NOT_REQUIRED'].includes(slice.handoff_status)) {
    issues.push('RETURN_FOR_NON_HANDOFF_SLICE');
  }
  if (!Array.isArray(workReturn.action_results)) issues.push('ACTION_RESULTS_SHAPE_INVALID');
  if (!Array.isArray(workReturn.requirement_results)) issues.push('REQUIREMENT_RESULTS_SHAPE_INVALID');

  const sliceActions = new Map(slice.actions.map(action => [action.id, action]));
  const expectedActionIds = new Set(slice.gates.preparation.allowed_action_ids);
  const actionIds = new Set();
  const actionResults = new Map();
  const completedActionIds = new Set();
  const endRevisions = new Set();
  let mutationEvidencePresent = false;
  let allActionsStructurallyComplete = expectedActionIds.size > 0;

  for (const [index, result] of (Array.isArray(workReturn.action_results)
    ? workReturn.action_results
    : []).entries()) {
    const label = `action_result_${index}`;
    if (!exactFields(result, ACTION_RESULT_FIELDS, label, issues)) {
      allActionsStructurallyComplete = false;
      continue;
    }
    const actionId = requiredString(result.action_id, 'ACTION_RESULT_ID_INVALID', issues);
    if (actionIds.has(actionId)) issues.push('ACTION_RESULT_ID_DUPLICATE');
    actionIds.add(actionId);
    actionResults.set(actionId, result);
    const action = sliceActions.get(actionId);
    if (!action) {
      issues.push('ACTION_OUTSIDE_PLAN');
      allActionsStructurallyComplete = false;
      continue;
    }
    if (!expectedActionIds.has(actionId) || action.phase !== 'PREPARATION') {
      issues.push('UNAUTHORIZED_EXECUTION_ACTION_CLAIM');
    }
    if (result.action_context_digest !== action.action_context_digest) {
      issues.push('ACTION_CONTEXT_DIGEST_MISMATCH');
    }
    const semantics = assessActionSemantics(action, {
      taskProject: slice.target.project,
      taskScope: slice.scope
    });
    const plannedOperationScope = operationPathScope(action.operation);
    if (!plannedOperationScope) issues.push('ACTION_OPERATION_SCOPE_UNRESOLVED');
    if (!RETURN_RESULTS.has(result.result)) issues.push('ACTION_RESULT_STATUS_INVALID');
    const checks = requiredCount(result.executed_checks, 'ACTION_CHECK_COUNT_INVALID', issues);
    const failures = requiredCount(result.failures, 'ACTION_FAILURE_COUNT_INVALID', issues);
    const skips = requiredCount(result.skips, 'ACTION_SKIP_COUNT_INVALID', issues);
    if (result.start_subject_revision !== slice.basis.base_subject_revision) {
      issues.push('ACTION_START_REVISION_MISMATCH');
    }
    const endRevision = requiredString(
      result.end_subject_revision,
      'ACTION_END_REVISION_INVALID',
      issues
    );
    if (endRevision) endRevisions.add(endRevision);

    let changedScopes = [];
    if (!Array.isArray(result.changed_scopes) || !uniqueStrings(result.changed_scopes)) {
      issues.push('ACTION_CHANGED_SCOPES_INVALID');
    } else {
      changedScopes = result.changed_scopes;
      if (changedScopes.some(candidate => (
        !isConcreteScope(candidate) || !isConcreteScopeAllowed(candidate, slice.scope)
      ))) issues.push('ACTION_SCOPE_OUTSIDE_PLAN');
      if (
        plannedOperationScope
        && changedScopes.some(candidate => candidate !== plannedOperationScope)
      ) issues.push('ACTION_SCOPE_NOT_BOUND_TO_OPERATION');
    }

    const artifactPointers = [];
    for (const field of ['changed_artifact_refs', 'evidence_refs']) {
      if (!Array.isArray(result[field])) {
        issues.push(`ACTION_${field.toUpperCase()}_INVALID`);
      } else {
        for (const [pointerIndex, pointer] of result[field].entries()) {
          const validated = validatePointer(pointer, `${label}_${field}_${pointerIndex}`, issues);
          if (!validated) continue;
          if (endRevision && validated.revision_or_sha !== endRevision) {
            issues.push(`ACTION_${field.toUpperCase()}_REVISION_MISMATCH`);
          }
          if (field === 'changed_artifact_refs') artifactPointers.push(validated);
        }
      }
    }
    for (const pointer of artifactPointers) {
      const artifactScope = artifactLocationToScope(
        pointer.location,
        slice.target.repository_identity
      );
      if (
        !artifactScope
        || !changedScopes.includes(artifactScope)
        || !isConcreteScopeAllowed(artifactScope, slice.scope)
        || (plannedOperationScope && artifactScope !== plannedOperationScope)
      ) issues.push('ACTION_ARTIFACT_SCOPE_OR_TARGET_MISMATCH');
    }

    if (!uniqueStrings(result.residual_risk_codes)) {
      issues.push('ACTION_RESIDUAL_RISKS_INVALID');
    }
    if (
      !semantics.mutating_operation
      && (
        changedScopes.length
        || artifactPointers.length
      )
    ) issues.push('READ_ONLY_ACTION_CHANGE_CLAIM');
    if (
      semantics.mutating_operation
      && changedScopes.length
      && artifactPointers.length
      && endRevision
      && endRevision !== slice.basis.base_subject_revision
    ) mutationEvidencePresent = true;
    if (
      result.result === 'COMPLETED'
      && semantics.mutating_operation
      && (
        changedScopes.some(candidate => candidate !== plannedOperationScope)
        || !changedScopes.length
        || !artifactPointers.length
        || endRevision === slice.basis.base_subject_revision
      )
    ) issues.push('MUTATING_ACTION_CHANGE_EVIDENCE_MISSING');

    const structurallyComplete = result.result === 'COMPLETED'
      && checks > 0
      && failures === 0
      && skips === 0
      && Array.isArray(result.evidence_refs)
      && result.evidence_refs.length > 0;
    if (result.result === 'COMPLETED' && !structurallyComplete) {
      issues.push('ACTION_COMPLETION_CLAIM_INVALID');
    }
    if (structurallyComplete) completedActionIds.add(actionId);
    else allActionsStructurallyComplete = false;
  }

  for (const expectedId of expectedActionIds) {
    if (!actionResults.has(expectedId)) allActionsStructurallyComplete = false;
  }
  if (endRevisions.size > 1) issues.push('ACTION_END_REVISION_SET_AMBIGUOUS');
  if (
    endRevisions.size === 1
    && [...endRevisions][0] !== slice.basis.base_subject_revision
    && !mutationEvidencePresent
  ) issues.push('READ_ONLY_BATCH_REVISION_CHANGED');
  for (const [actionId, result] of actionResults) {
    if (result.result !== 'COMPLETED') continue;
    const action = sliceActions.get(actionId);
    if (!action) continue;
    if (action.depends_on.some(dependency => !completedActionIds.has(dependency))) {
      issues.push('ACTION_DEPENDENCY_NOT_COMPLETED');
    }
  }

  const resultRevision = endRevisions.size === 1
    ? [...endRevisions][0]
    : slice.basis.base_subject_revision;
  const requirementIds = new Set();
  const requiredRequirements = new Map(slice.requirements
    .filter(item => item.required !== false)
    .map(item => [item.id, item]));
  const structurallySatisfied = new Set();
  for (const [index, result] of (Array.isArray(workReturn.requirement_results)
    ? workReturn.requirement_results
    : []).entries()) {
    const label = `requirement_result_${index}`;
    if (!exactFields(result, REQUIREMENT_RESULT_FIELDS, label, issues)) continue;
    const requirementId = requiredString(
      result.requirement_id,
      'REQUIREMENT_RESULT_ID_INVALID',
      issues
    );
    if (requirementIds.has(requirementId)) issues.push('REQUIREMENT_RESULT_ID_DUPLICATE');
    requirementIds.add(requirementId);
    const requirement = requiredRequirements.get(requirementId)
      ?? slice.requirements.find(item => item.id === requirementId);
    if (!requirement) {
      issues.push('REQUIREMENT_OUTSIDE_PLAN');
      continue;
    }
    if (result.requirement_fingerprint !== requirement.fingerprint) {
      issues.push('REQUIREMENT_FINGERPRINT_MISMATCH');
    }
    if (!RETURN_RESULTS.has(result.result)) issues.push('REQUIREMENT_RESULT_STATUS_INVALID');
    const checks = requiredCount(result.executed_checks, 'REQUIREMENT_CHECK_COUNT_INVALID', issues);
    const failures = requiredCount(result.failures, 'REQUIREMENT_FAILURE_COUNT_INVALID', issues);
    const skips = requiredCount(result.skips, 'REQUIREMENT_SKIP_COUNT_INVALID', issues);
    if (result.subject_revision !== resultRevision) {
      issues.push('REQUIREMENT_RESULT_REVISION_MISMATCH');
    }
    if (!Array.isArray(result.evidence_refs) || !result.evidence_refs.length) {
      issues.push('REQUIREMENT_EVIDENCE_MISSING');
    } else {
      for (const [pointerIndex, pointer] of result.evidence_refs.entries()) {
        const validated = validatePointer(pointer, `${label}_evidence_${pointerIndex}`, issues);
        if (validated && validated.revision_or_sha !== result.subject_revision) {
          issues.push('REQUIREMENT_EVIDENCE_REVISION_MISMATCH');
        }
      }
    }
    const requirementStructurallyComplete = (
      result.result === 'COMPLETED'
      && checks > 0
      && failures === 0
      && skips === 0
      && Array.isArray(result.evidence_refs)
      && result.evidence_refs.length > 0
    );
    if (result.result === 'COMPLETED' && !requirementStructurallyComplete) {
      issues.push('REQUIREMENT_COMPLETION_CLAIM_INVALID');
    }
    if (requirementStructurallyComplete) structurallySatisfied.add(requirementId);
  }

  if (issues.length) return rejectedReturn(issues, slice);
  const everyRequired = [...requiredRequirements.keys()].every(id => structurallySatisfied.has(id));
  const candidateDisposition = everyRequired && allActionsStructurallyComplete
    ? 'REVIEW_CANDIDATE'
    : 'INCOMPLETE_EVIDENCE';
  return {
    evaluation: 'STRUCTURALLY_MATCHED',
    candidate_disposition: candidateDisposition,
    validation_scope: 'STRUCTURAL_ONLY',
    consistency: 'MATCHED_TO_CALLER_SUPPLIED_SLICE_AND_SNAPSHOT',
    revision_transition: 'UNVERIFIED_REQUIRES_TRUSTED_ANCESTRY',
    trust: 'UNAUTHENTICATED',
    acceptance: 'HOLD_TRUSTED_ADAPTER_REQUIRED',
    issued_record_found: false,
    replay_checked: false,
    current_head_verified: false,
    evidence_verified: false,
    proof_accepted: false,
    task_completed: false,
    outcome_observed: false,
    execution_authorized: false,
    authorization: 'NOT_GRANTED'
  };
}

function rejectedReturn(issues, slice) {
  const safeIssues = [...new Set(issues)].sort();
  return {
    evaluation: 'REJECTED',
    incident_ref: safeIncidentRef(safeIssues, slice),
    issues: safeIssues,
    validation_scope: 'STRUCTURAL_ONLY',
    trust: 'UNAUTHENTICATED',
    acceptance: 'HOLD_TRUSTED_ADAPTER_REQUIRED',
    issued_record_found: false,
    replay_checked: false,
    current_head_verified: false,
    evidence_verified: false,
    proof_accepted: false,
    task_completed: false,
    outcome_observed: false,
    execution_authorized: false,
    authorization: 'NOT_GRANTED'
  };
}

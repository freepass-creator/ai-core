import { randomUUID } from 'node:crypto';

export class WorkflowError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'WorkflowError';
    this.code = code;
    this.details = details;
  }
}

const need = (condition, code, details = {}) => {
  if (!condition) throw new WorkflowError(code, details);
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function indexWorkflow(workflow) {
  const axes = new Map(workflow.state_axes.map(axis => [axis.axis_id, {
    ...axis,
    statesById: new Map(axis.states.map(state => [state.state_id, state])),
  }]));
  return {
    workflow,
    axes,
    facts: new Map(workflow.facts.map(item => [item.fact_id, item])),
    guards: new Map(workflow.guards.map(item => [item.guard_id, item])),
    evidence: new Map(workflow.evidence_requirements.map(item => [item.evidence_id, item])),
    commands: new Map(workflow.commands.map(item => [item.command_id, item])),
    events: new Map(workflow.events.map(item => [item.event_type, item])),
    transitions: new Map(workflow.transitions.map(item => [item.transition_id, item])),
  };
}

function permissionSet(input) {
  return new Set(Array.isArray(input) ? input : []);
}

function evidenceMap(input) {
  if (!input) return new Map();
  if (Array.isArray(input)) return new Map(input.map(item => [item.evidence_id, item]));
  return new Map(Object.entries(input).map(([evidence_id, value]) => [evidence_id, {
    evidence_id,
    ...(typeof value === 'object' && value !== null ? value : { value }),
  }]));
}

function approvalsByRole(input) {
  const map = new Map();
  for (const item of input ?? []) {
    if (!item?.role || !item?.actor_id) continue;
    if (!map.has(item.role)) map.set(item.role, []);
    map.get(item.role).push(item);
  }
  return map;
}

function currentState(projection, axis) {
  return projection?.states?.[axis.axis_id] ?? axis.initial_state;
}

function evaluateBuiltInGuard(guard, facts) {
  if (guard.kind === 'FACT_PRESENT') return Object.prototype.hasOwnProperty.call(facts, guard.fact_id);
  if (guard.kind === 'FACT_EQUALS') return same(facts?.[guard.fact_id], guard.expected);
  return null;
}

function computeDelay(retry, attempt) {
  if (retry.strategy === 'FIXED') return retry.base_delay_ms;
  if (retry.strategy === 'EXPONENTIAL') return retry.base_delay_ms * (2 ** Math.max(0, attempt - 1));
  return 0;
}

export function createWorkflowEngine(workflow, {
  now = () => new Date().toISOString(),
  idFactory = () => randomUUID(),
  evaluateGuard = null,
} = {}) {
  const idx = indexWorkflow(workflow);

  function inspectTransition(projection, transition, context = {}) {
    const axis = idx.axes.get(transition.axis_id);
    if (!axis) return { eligible: false, reasons: ['AXIS_UNKNOWN'] };
    const fromState = currentState(projection, axis);
    const reasons = [];
    if (!transition.from.includes(fromState)) reasons.push('FROM_STATE_NOT_ALLOWED');

    const permissions = permissionSet(context.permissions);
    for (const required of transition.permissions) {
      if (!permissions.has(required)) reasons.push(`PERMISSION_MISSING:${required}`);
    }

    const facts = context.facts ?? {};
    for (const guardId of transition.guards) {
      const guard = idx.guards.get(guardId);
      if (!guard) { reasons.push(`GUARD_UNKNOWN:${guardId}`); continue; }
      const builtIn = evaluateBuiltInGuard(guard, facts);
      const result = builtIn === null
        ? (evaluateGuard ? Boolean(evaluateGuard(guard, context, projection, transition)) : false)
        : builtIn;
      if (!result) reasons.push(`GUARD_FAILED:${guardId}`);
    }

    const submittedEvidence = evidenceMap(context.evidence);
    for (const evidenceId of transition.required_evidence) {
      const requirement = idx.evidence.get(evidenceId);
      const supplied = submittedEvidence.get(evidenceId);
      if (!requirement) { reasons.push(`EVIDENCE_REQUIREMENT_UNKNOWN:${evidenceId}`); continue; }
      if (!supplied) { reasons.push(`EVIDENCE_MISSING:${evidenceId}`); continue; }
      if (supplied.verification !== requirement.verification) {
        reasons.push(`EVIDENCE_VERIFICATION_MISMATCH:${evidenceId}`);
      }
    }

    const approval = transition.approval;
    if (approval.policy !== 'NONE') {
      const byRole = approvalsByRole(context.approvals);
      const roleSatisfied = role => (byRole.get(role)?.length ?? 0) > 0;
      if (approval.policy === 'ALL') {
        for (const role of approval.required_roles) if (!roleSatisfied(role)) reasons.push(`APPROVAL_MISSING:${role}`);
      } else if (approval.policy === 'ANY_ONE' && !approval.required_roles.some(roleSatisfied)) {
        reasons.push('APPROVAL_MISSING:ANY_ONE');
      }
      if (approval.separation_of_duties && context.actor?.actor_id) {
        const approverIds = [...byRole.values()].flat().map(item => item.actor_id);
        if (approverIds.includes(context.actor.actor_id)) reasons.push('SEPARATION_OF_DUTIES_VIOLATION');
      }
    }

    return { eligible: reasons.length === 0, reasons, from_state: fromState, to_state: transition.to };
  }

  function availableActions(projection, context = {}) {
    const actions = [];
    for (const transition of workflow.transitions) {
      const inspected = inspectTransition(projection, transition, context);
      if (transition.from.includes(inspected.from_state)) {
        actions.push({
          transition_id: transition.transition_id,
          command_id: transition.command_id,
          purpose: transition.purpose,
          axis_id: transition.axis_id,
          from_state: inspected.from_state,
          to_state: transition.to,
          eligible: inspected.eligible,
          reasons: inspected.reasons,
        });
      }
    }
    return actions;
  }

  function decide({
    projection,
    transition_id,
    command_id,
    actor,
    reason = null,
    permissions = [],
    facts = {},
    evidence = [],
    approvals = [],
    expected_revision,
    idempotency_key = null,
    request_id = null,
    history = [],
    override = null,
  }) {
    need(projection && typeof projection === 'object', 'PROJECTION_REQUIRED');
    need(Number.isInteger(projection.revision) && projection.revision >= 0, 'PROJECTION_REVISION_INVALID');
    need(expected_revision === projection.revision, 'VERSION_MISMATCH', {
      expected_revision,
      current_revision: projection.revision,
    });

    const transition = idx.transitions.get(transition_id);
    need(transition, 'TRANSITION_UNKNOWN', { transition_id });
    need(transition.command_id === command_id, 'COMMAND_TRANSITION_MISMATCH', { command_id, transition_id });

    const command = idx.commands.get(command_id);
    need(command, 'COMMAND_UNKNOWN', { command_id });
    if (command.idempotency_required) need(typeof idempotency_key === 'string' && idempotency_key.length > 0, 'IDEMPOTENCY_KEY_REQUIRED');

    if (idempotency_key) {
      const previous = history.find(item => item.idempotency_key === idempotency_key);
      if (previous) {
        const sameIntent = previous.transition_id === transition_id
          && previous.command_id === command_id
          && previous.entity_id === projection.entity_id;
        need(sameIntent, 'IDEMPOTENCY_CONFLICT', { idempotency_key });
        return { ...previous.result, replayed: true };
      }
    }

    const baseContext = { actor, permissions, facts, evidence, approvals };
    let inspected = inspectTransition(projection, transition, baseContext);

    if (!inspected.eligible && override) {
      const policy = transition.manual_override;
      need(policy.allowed, 'MANUAL_OVERRIDE_NOT_ALLOWED');
      const overridePermissions = permissionSet(permissions);
      for (const required of policy.permissions) need(overridePermissions.has(required), 'MANUAL_OVERRIDE_PERMISSION_MISSING', { permission: required });
      if (policy.requires_reason) need(typeof reason === 'string' && reason.trim().length > 0, 'MANUAL_OVERRIDE_REASON_REQUIRED');

      const bypass = new Set(policy.can_bypass);
      const remaining = inspected.reasons.filter(code => {
        if (bypass.has('GUARDS') && code.startsWith('GUARD_')) return false;
        if (bypass.has('EVIDENCE') && code.startsWith('EVIDENCE_')) return false;
        return true;
      });
      need(remaining.length === 0, 'TRANSITION_GUARD_REJECTED', { reasons: remaining });
      inspected = { ...inspected, eligible: true, reasons: [] };
    }

    need(inspected.eligible, 'TRANSITION_GUARD_REJECTED', { reasons: inspected.reasons });

    if (transition.audit.reason_required) need(typeof reason === 'string' && reason.trim().length > 0, 'AUDIT_REASON_REQUIRED');

    const timestamp = now();
    const event_id = idFactory();
    const nextProjection = {
      ...projection,
      revision: projection.revision + 1,
      states: { ...(projection.states ?? {}), [transition.axis_id]: transition.to },
      updated_at: timestamp,
    };

    const event = {
      event_id,
      event_type: transition.event_type,
      workflow_id: workflow.workflow_id,
      workflow_version: workflow.version,
      transition_id,
      command_id,
      axis_id: transition.axis_id,
      entity_id: projection.entity_id ?? null,
      from_state: inspected.from_state,
      to_state: transition.to,
      request_id,
      idempotency_key,
      actor: actor ?? null,
      reason,
      occurred_at: timestamp,
      recorded_at: timestamp,
      expected_revision,
      resulting_revision: nextProjection.revision,
      manual_override: override ? {
        requested: true,
        bypassed: transition.manual_override.can_bypass,
      } : { requested: false, bypassed: [] },
    };

    const audit = {
      audit_id: idFactory(),
      workflow_id: workflow.workflow_id,
      transition_id,
      entity_id: projection.entity_id ?? null,
      actor: actor ?? null,
      changed_at: timestamp,
      reason,
      from_state: inspected.from_state,
      to_state: transition.to,
      expected_revision,
      resulting_revision: nextProjection.revision,
      request_id,
      idempotency_key,
      evidence_refs: [...evidenceMap(evidence).values()].map(item => item.ref).filter(Boolean),
      approval_actors: (approvals ?? []).map(item => ({ role: item.role, actor_id: item.actor_id })),
      manual_override: event.manual_override,
    };

    return {
      status: 'TRANSITION_ACCEPTED',
      replayed: false,
      next_projection: nextProjection,
      event,
      audit,
      effects: structuredClone(transition.effects),
      recovery: {
        reversible: transition.reversible,
        compensation_transition_id: transition.compensation_transition_id ?? transition.failure.compensation_transition_id ?? null,
        retry: structuredClone(transition.retry),
        failure: structuredClone(transition.failure),
        timeout: transition.timeout ? structuredClone(transition.timeout) : null,
        sla: transition.sla ? structuredClone(transition.sla) : null,
      },
    };
  }

  function resolveFailure({ transition_id, attempt, error_code, occurred_at = now() }) {
    const transition = idx.transitions.get(transition_id);
    need(transition, 'TRANSITION_UNKNOWN', { transition_id });
    need(Number.isInteger(attempt) && attempt >= 1, 'ATTEMPT_INVALID');
    const retry = transition.retry;
    const retryable = retry.retryable_error_codes.length === 0 || retry.retryable_error_codes.includes(error_code);
    if (retry.strategy !== 'NONE' && retryable && attempt < retry.max_attempts) {
      const delay = computeDelay(retry, attempt);
      return {
        action: retry.strategy === 'MANUAL' ? 'WAIT_MANUAL_RETRY' : 'RETRY',
        attempt,
        next_attempt: attempt + 1,
        retry_after_ms: delay,
        error_code,
        occurred_at,
      };
    }
    return {
      action: transition.failure.on_exhausted,
      attempt,
      error_code,
      failure_state: transition.failure.failure_state ?? null,
      compensation_transition_id: transition.failure.compensation_transition_id ?? transition.compensation_transition_id ?? null,
      escalation_event_type: transition.failure.escalation_event_type ?? null,
      occurred_at,
    };
  }

  function dueAutomations(projection, event_type = null) {
    return workflow.transitions
      .filter(transition => transition.automation.mode !== 'MANUAL')
      .filter(transition => !event_type || transition.automation.trigger_event_types.includes(event_type))
      .map(transition => ({
        transition_id: transition.transition_id,
        command_id: transition.command_id,
        mode: transition.automation.mode,
        inspection: inspectTransition(projection, transition, {}),
      }));
  }

  return Object.freeze({
    workflow_id: workflow.workflow_id,
    version: workflow.version,
    availableActions,
    decide,
    resolveFailure,
    dueAutomations,
    inspectTransition: (projection, transition_id, context = {}) => {
      const transition = idx.transitions.get(transition_id);
      need(transition, 'TRANSITION_UNKNOWN', { transition_id });
      return inspectTransition(projection, transition, context);
    },
  });
}

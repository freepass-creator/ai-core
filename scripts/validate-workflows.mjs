import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../contracts/workflow.schema.json', import.meta.url), 'utf8'));

function duplicates(values) {
  const seen = new Set();
  const dup = new Set();
  for (const value of values) {
    if (seen.has(value)) dup.add(value);
    seen.add(value);
  }
  return [...dup];
}

function error(code, path, details = {}) {
  return { code, path, ...details };
}

export function validateWorkflowRegistry(registry) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const errors = [];
  const warnings = [];

  if (!validate(registry)) {
    for (const item of validate.errors ?? []) {
      errors.push(error('WORKFLOW_SCHEMA_INVALID', item.instancePath || '/', {
        keyword: item.keyword,
        message: item.message,
      }));
    }
    return { status: 'INVALID', errors, warnings };
  }

  for (const id of duplicates(registry.primitives.map(item => item.primitive_id))) {
    errors.push(error('PRIMITIVE_ID_DUPLICATE', '/primitives', { primitive_id: id }));
  }
  for (const id of duplicates(registry.workflows.map(item => item.workflow_id))) {
    errors.push(error('WORKFLOW_ID_DUPLICATE', '/workflows', { workflow_id: id }));
  }

  registry.workflows.forEach((workflow, wi) => {
    const base = `/workflows/${wi}`;
    if (workflow.adoption_status === 'SHADOW' && !workflow.source_authority) {
      errors.push(error('SHADOW_SOURCE_AUTHORITY_REQUIRED', base));
    }
    if (workflow.source_authority) {
      const paths = workflow.source_authority.files.map(item => item.path);
      for (const pathValue of duplicates(paths)) {
        errors.push(error('SHADOW_SOURCE_PATH_DUPLICATE', `${base}/source_authority/files`, { path: pathValue }));
      }
    }
    const axisIds = workflow.state_axes.map(axis => axis.axis_id);
    for (const id of duplicates(axisIds)) errors.push(error('AXIS_ID_DUPLICATE', `${base}/state_axes`, { axis_id: id }));

    const axes = new Map();
    for (const [ai, axis] of workflow.state_axes.entries()) {
      const states = new Map(axis.states.map(state => [state.state_id, state]));
      axes.set(axis.axis_id, { axis, states });
      if (!states.has(axis.initial_state)) errors.push(error('INITIAL_STATE_UNKNOWN', `${base}/state_axes/${ai}/initial_state`, { state: axis.initial_state }));
      for (const id of duplicates(axis.states.map(state => state.state_id))) {
        errors.push(error('STATE_ID_DUPLICATE', `${base}/state_axes/${ai}/states`, { state_id: id }));
      }
      for (const [si, state] of axis.states.entries()) {
        if (state.terminal && !['FINAL', 'FAILURE', 'CANCELLED'].includes(state.kind)) {
          errors.push(error('TERMINAL_KIND_INVALID', `${base}/state_axes/${ai}/states/${si}`, { state_id: state.state_id }));
        }
        if (!state.terminal && ['FINAL', 'FAILURE', 'CANCELLED'].includes(state.kind)) {
          errors.push(error('TERMINAL_FLAG_REQUIRED', `${base}/state_axes/${ai}/states/${si}`, { state_id: state.state_id }));
        }
      }
    }

    const facts = new Set(workflow.facts.map(item => item.fact_id));
    const guards = new Map(workflow.guards.map(item => [item.guard_id, item]));
    const evidence = new Set(workflow.evidence_requirements.map(item => item.evidence_id));
    const commands = new Set(workflow.commands.map(item => item.command_id));
    const events = new Set(workflow.events.map(item => item.event_type));
    const transitions = new Map(workflow.transitions.map(item => [item.transition_id, item]));

    for (const [kind, values] of [
      ['FACT_ID_DUPLICATE', workflow.facts.map(item => item.fact_id)],
      ['GUARD_ID_DUPLICATE', workflow.guards.map(item => item.guard_id)],
      ['EVIDENCE_ID_DUPLICATE', workflow.evidence_requirements.map(item => item.evidence_id)],
      ['COMMAND_ID_DUPLICATE', workflow.commands.map(item => item.command_id)],
      ['EVENT_TYPE_DUPLICATE', workflow.events.map(item => item.event_type)],
      ['TRANSITION_ID_DUPLICATE', workflow.transitions.map(item => item.transition_id)],
      ['OBLIGATION_ID_DUPLICATE', workflow.obligations.map(item => item.obligation_id)],
    ]) {
      for (const id of duplicates(values)) errors.push(error(kind, base, { id }));
    }

    for (const [gi, guard] of workflow.guards.entries()) {
      if (['FACT_PRESENT', 'FACT_EQUALS'].includes(guard.kind) && (!guard.fact_id || !facts.has(guard.fact_id))) {
        errors.push(error('GUARD_FACT_UNKNOWN', `${base}/guards/${gi}`, { guard_id: guard.guard_id, fact_id: guard.fact_id ?? null }));
      }
    }

    workflow.transitions.forEach((transition, ti) => {
      const path = `${base}/transitions/${ti}`;
      const axis = axes.get(transition.axis_id);
      if (!axis) {
        errors.push(error('TRANSITION_AXIS_UNKNOWN', path, { axis_id: transition.axis_id }));
        return;
      }
      for (const stateId of transition.from) if (!axis.states.has(stateId)) {
        errors.push(error('TRANSITION_FROM_UNKNOWN', path, { state_id: stateId }));
      }
      if (!axis.states.has(transition.to)) errors.push(error('TRANSITION_TO_UNKNOWN', path, { state_id: transition.to }));
      if (!commands.has(transition.command_id)) errors.push(error('TRANSITION_COMMAND_UNKNOWN', path, { command_id: transition.command_id }));
      if (!events.has(transition.event_type)) errors.push(error('TRANSITION_EVENT_UNKNOWN', path, { event_type: transition.event_type }));
      for (const guardId of transition.guards) if (!guards.has(guardId)) errors.push(error('TRANSITION_GUARD_UNKNOWN', path, { guard_id: guardId }));
      for (const evidenceId of transition.required_evidence) if (!evidence.has(evidenceId)) errors.push(error('TRANSITION_EVIDENCE_UNKNOWN', path, { evidence_id: evidenceId }));

      if (transition.approval.policy === 'NONE' && transition.approval.required_roles.length > 0) {
        errors.push(error('APPROVAL_NONE_WITH_ROLES', path));
      }
      if (transition.approval.policy !== 'NONE' && transition.approval.required_roles.length === 0) {
        errors.push(error('APPROVAL_ROLES_REQUIRED', path));
      }
      if (!transition.manual_override.allowed
        && (transition.manual_override.permissions.length > 0 || transition.manual_override.can_bypass.length > 0)) {
        errors.push(error('DISABLED_OVERRIDE_HAS_BYPASS', path));
      }

      const target = axis.states.get(transition.to);
      if (transition.purpose === 'HOLD' && target?.kind !== 'HOLD') errors.push(error('HOLD_TARGET_REQUIRED', path, { to: transition.to }));
      if (transition.purpose === 'CANCEL' && target?.kind !== 'CANCELLED') errors.push(error('CANCEL_TARGET_REQUIRED', path, { to: transition.to }));
      if (transition.purpose === 'FAIL' && target?.kind !== 'FAILURE') errors.push(error('FAIL_TARGET_REQUIRED', path, { to: transition.to }));
      if (transition.purpose === 'RESUME') {
        const sources = transition.from.map(id => axis.states.get(id)?.kind);
        if (!sources.every(kind => kind === 'HOLD')) errors.push(error('RESUME_SOURCE_MUST_BE_HOLD', path));
      }
      if (transition.purpose === 'REOBSERVE') {
        if (transition.from.length !== 1 || transition.from[0] !== transition.to) {
          errors.push(error('REOBSERVE_MUST_PRESERVE_STATE', path));
        }
      }

      for (const stateId of transition.from) {
        const source = axis.states.get(stateId);
        if (source?.terminal && !['RESTORE', 'CORRECTION'].includes(transition.purpose)) {
          errors.push(error('TERMINAL_OUTBOUND_REQUIRES_RESTORE_OR_CORRECTION', path, { state_id: stateId }));
        }
      }

      if (transition.reversible && !transition.compensation_transition_id) {
        warnings.push(error('REVERSIBLE_WITHOUT_COMPENSATION', path, { transition_id: transition.transition_id }));
      }
      if (transition.compensation_transition_id && !transitions.has(transition.compensation_transition_id)) {
        errors.push(error('COMPENSATION_TRANSITION_UNKNOWN', path, { transition_id: transition.compensation_transition_id }));
      }
      if (transition.retry.strategy === 'NONE' && transition.retry.max_attempts !== 0) {
        errors.push(error('NO_RETRY_REQUIRES_ZERO_ATTEMPTS', path));
      }
      if (transition.retry.strategy !== 'NONE' && transition.retry.max_attempts < 2) {
        errors.push(error('RETRY_REQUIRES_MULTIPLE_ATTEMPTS', path));
      }
      if (transition.failure.on_exhausted === 'COMPENSATE'
        && !(transition.failure.compensation_transition_id || transition.compensation_transition_id)) {
        errors.push(error('COMPENSATION_REQUIRED_ON_EXHAUSTED', path));
      }
      if (transition.failure.failure_state && !axis.states.has(transition.failure.failure_state)) {
        errors.push(error('FAILURE_STATE_UNKNOWN', path, { state_id: transition.failure.failure_state }));
      }
      if (transition.failure.on_exhausted === 'HOLD' && transition.failure.failure_state
        && axis.states.get(transition.failure.failure_state)?.kind !== 'HOLD') {
        errors.push(error('HOLD_FAILURE_STATE_REQUIRED', path, { state_id: transition.failure.failure_state }));
      }
      if (transition.failure.on_exhausted === 'FAIL' && transition.failure.failure_state
        && axis.states.get(transition.failure.failure_state)?.kind !== 'FAILURE') {
        errors.push(error('FAIL_FAILURE_STATE_REQUIRED', path, { state_id: transition.failure.failure_state }));
      }
      if (transition.failure.escalation_event_type && !events.has(transition.failure.escalation_event_type)) {
        errors.push(error('FAILURE_ESCALATION_EVENT_UNKNOWN', path, { event_type: transition.failure.escalation_event_type }));
      }
      if (transition.timeout?.action === 'TRANSITION') {
        if (!transition.timeout.transition_id || !transitions.has(transition.timeout.transition_id)) {
          errors.push(error('TIMEOUT_TRANSITION_UNKNOWN', path, { transition_id: transition.timeout?.transition_id ?? null }));
        }
      }
      if (transition.sla?.breach_event_type && !events.has(transition.sla.breach_event_type)) {
        errors.push(error('SLA_BREACH_EVENT_UNKNOWN', path, { event_type: transition.sla.breach_event_type }));
      }
      if (transition.sla?.escalation_transition_id && !transitions.has(transition.sla.escalation_transition_id)) {
        errors.push(error('SLA_ESCALATION_TRANSITION_UNKNOWN', path, { transition_id: transition.sla.escalation_transition_id }));
      }
    });

    for (const [ai, axis] of workflow.state_axes.entries()) {
      const outbound = new Set(workflow.transitions.filter(t => t.axis_id === axis.axis_id).flatMap(t => t.from));
      for (const [si, state] of axis.states.entries()) {
        if (!state.terminal && state.kind !== 'HOLD' && !outbound.has(state.state_id)) {
          warnings.push(error('NON_TERMINAL_WITHOUT_OUTBOUND', `${base}/state_axes/${ai}/states/${si}`, { state_id: state.state_id }));
        }
      }
    }

    for (const [oi, obligation] of workflow.obligations.entries()) {
      const path = `${base}/obligations/${oi}`;
      if (!events.has(obligation.opening_event_type)) errors.push(error('OBLIGATION_OPEN_EVENT_UNKNOWN', path));
      for (const eventType of obligation.closing_event_types) if (!events.has(eventType)) errors.push(error('OBLIGATION_CLOSE_EVENT_UNKNOWN', path, { event_type: eventType }));
    }
  });

  return { status: errors.length ? 'INVALID' : 'VALID', errors, warnings };
}

if (process.argv[1]?.endsWith('validate-workflows.mjs')) {
  const path = process.argv[2] ?? new URL('../registry/workflows.json', import.meta.url);
  const text = await readFile(path, 'utf8');
  const result = validateWorkflowRegistry(JSON.parse(text));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}

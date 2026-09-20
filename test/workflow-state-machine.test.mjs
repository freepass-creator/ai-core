import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowEngine, WorkflowError } from '../src/workflow/engine.mjs';
import { validateWorkflowRegistry } from '../scripts/validate-workflows.mjs';

function machine() {
  const workflow = {
    workflow_id: 'test.contract-lifecycle',
    version: '1.0.0',
    adoption_status: 'PILOT',
    owner: 'test',
    description: 'Test fixture',
    state_axes: [{
      axis_id: 'lifecycle',
      initial_state: 'RECEIVED',
      states: [
        { state_id: 'RECEIVED', kind: 'NORMAL', terminal: false },
        { state_id: 'READY', kind: 'NORMAL', terminal: false },
        { state_id: 'ON_HOLD', kind: 'HOLD', terminal: false },
        { state_id: 'COMPLETED', kind: 'FINAL', terminal: true },
        { state_id: 'CANCELLED', kind: 'CANCELLED', terminal: true }
      ]
    }],
    facts: [{ fact_id: 'contract.exists', type: 'boolean' }],
    guards: [
      { guard_id: 'contract-present', kind: 'FACT_EQUALS', fact_id: 'contract.exists', expected: true }
    ],
    evidence_requirements: [
      { evidence_id: 'delivery-proof', verification: 'SYSTEM_VERIFIED' }
    ],
    commands: [
      { command_id: 'prepare', intent: 'Prepare the work', idempotency_required: true },
      { command_id: 'complete', intent: 'Complete the work', idempotency_required: true },
      { command_id: 'hold', intent: 'Hold the work', idempotency_required: true },
      { command_id: 'resume', intent: 'Resume the work', idempotency_required: true },
      { command_id: 'cancel', intent: 'Cancel the work', idempotency_required: true }
    ],
    events: [
      { event_type: 'test.contract.prepared', meaning: 'Preparation accepted' },
      { event_type: 'test.contract.completed', meaning: 'Completion verified' },
      { event_type: 'test.contract.held', meaning: 'Work held' },
      { event_type: 'test.contract.resumed', meaning: 'Work resumed' },
      { event_type: 'test.contract.cancelled', meaning: 'Work cancelled' },
      { event_type: 'test.contract.failed', meaning: 'Completion failure escalated' }
    ],
    transitions: [
      {
        transition_id: 'prepare',
        purpose: 'NORMAL',
        axis_id: 'lifecycle',
        from: ['RECEIVED'],
        to: 'READY',
        command_id: 'prepare',
        event_type: 'test.contract.prepared',
        guards: ['contract-present'],
        required_evidence: [],
        permissions: ['contract.prepare'],
        approval: { policy: 'NONE', required_roles: [], separation_of_duties: false },
        effects: [],
        failure: { on_exhausted: 'HOLD', failure_state: 'ON_HOLD' },
        retry: { strategy: 'FIXED', max_attempts: 3, base_delay_ms: 1000, retryable_error_codes: ['TEMPORARY'] },
        automation: { mode: 'MANUAL', trigger_event_types: [] },
        manual_override: { allowed: false, permissions: [], can_bypass: [], requires_reason: true },
        audit: { required: true, reason_required: true },
        reversible: false
      },
      {
        transition_id: 'complete',
        purpose: 'NORMAL',
        axis_id: 'lifecycle',
        from: ['READY'],
        to: 'COMPLETED',
        command_id: 'complete',
        event_type: 'test.contract.completed',
        guards: [],
        required_evidence: ['delivery-proof'],
        permissions: ['contract.complete'],
        approval: { policy: 'ALL', required_roles: ['approver'], separation_of_duties: true },
        effects: [{ effect_id: 'notify-completion', kind: 'OUTBOX', compensatable: false }],
        failure: { on_exhausted: 'ESCALATE', escalation_event_type: 'test.contract.failed' },
        retry: { strategy: 'NONE', max_attempts: 0, base_delay_ms: 0, retryable_error_codes: [] },
        automation: { mode: 'MANUAL', trigger_event_types: [] },
        manual_override: { allowed: false, permissions: [], can_bypass: [], requires_reason: true },
        audit: { required: true, reason_required: true },
        reversible: false
      },
      {
        transition_id: 'hold',
        purpose: 'HOLD',
        axis_id: 'lifecycle',
        from: ['READY'],
        to: 'ON_HOLD',
        command_id: 'hold',
        event_type: 'test.contract.held',
        guards: [],
        required_evidence: [],
        permissions: ['contract.hold'],
        approval: { policy: 'NONE', required_roles: [], separation_of_duties: false },
        effects: [],
        failure: { on_exhausted: 'HOLD', failure_state: 'ON_HOLD' },
        retry: { strategy: 'NONE', max_attempts: 0, base_delay_ms: 0, retryable_error_codes: [] },
        automation: { mode: 'MANUAL', trigger_event_types: [] },
        manual_override: { allowed: false, permissions: [], can_bypass: [], requires_reason: true },
        audit: { required: true, reason_required: true },
        reversible: false
      },
      {
        transition_id: 'resume',
        purpose: 'RESUME',
        axis_id: 'lifecycle',
        from: ['ON_HOLD'],
        to: 'READY',
        command_id: 'resume',
        event_type: 'test.contract.resumed',
        guards: [],
        required_evidence: [],
        permissions: ['contract.resume'],
        approval: { policy: 'NONE', required_roles: [], separation_of_duties: false },
        effects: [],
        failure: { on_exhausted: 'HOLD', failure_state: 'ON_HOLD' },
        retry: { strategy: 'NONE', max_attempts: 0, base_delay_ms: 0, retryable_error_codes: [] },
        automation: { mode: 'HYBRID', trigger_event_types: ['test.contract.held'] },
        manual_override: { allowed: false, permissions: [], can_bypass: [], requires_reason: true },
        audit: { required: true, reason_required: true },
        reversible: false
      },
      {
        transition_id: 'cancel',
        purpose: 'CANCEL',
        axis_id: 'lifecycle',
        from: ['RECEIVED', 'READY', 'ON_HOLD'],
        to: 'CANCELLED',
        command_id: 'cancel',
        event_type: 'test.contract.cancelled',
        guards: [],
        required_evidence: [],
        permissions: ['contract.cancel'],
        approval: { policy: 'NONE', required_roles: [], separation_of_duties: false },
        effects: [],
        failure: { on_exhausted: 'HOLD', failure_state: 'ON_HOLD' },
        retry: { strategy: 'NONE', max_attempts: 0, base_delay_ms: 0, retryable_error_codes: [] },
        automation: { mode: 'MANUAL', trigger_event_types: [] },
        manual_override: { allowed: false, permissions: [], can_bypass: [], requires_reason: true },
        audit: { required: true, reason_required: true },
        reversible: false
      }
    ],
    obligations: []
  };
  return workflow;
}

test('registry schema and semantic validator accept the reference fixture', () => {
  const registry = {
    schema_version: '1.0.0',
    registry_version: '1.0.0',
    primitives: [],
    workflows: [machine()]
  };
  const result = validateWorkflowRegistry(registry);
  assert.equal(result.status, 'VALID', JSON.stringify(result.errors));
});

test('transition requires current revision, guard, permission, reason and idempotency', () => {
  const engine = createWorkflowEngine(machine(), {
    now: () => '2026-09-19T12:00:00.000Z',
    idFactory: (() => { let n = 0; return () => `id-${++n}`; })()
  });
  const projection = { entity_id: 'contract-1', revision: 2, states: { lifecycle: 'RECEIVED' } };

  assert.throws(() => engine.decide({
    projection,
    transition_id: 'prepare',
    command_id: 'prepare',
    actor: { actor_id: 'user-1' },
    reason: 'ready',
    permissions: ['contract.prepare'],
    facts: { 'contract.exists': true },
    expected_revision: 1,
    idempotency_key: 'k-1'
  }), error => error instanceof WorkflowError && error.code === 'VERSION_MISMATCH');

  const accepted = engine.decide({
    projection,
    transition_id: 'prepare',
    command_id: 'prepare',
    actor: { actor_id: 'user-1' },
    reason: 'contract verified',
    permissions: ['contract.prepare'],
    facts: { 'contract.exists': true },
    expected_revision: 2,
    idempotency_key: 'k-1'
  });

  assert.equal(accepted.status, 'TRANSITION_ACCEPTED');
  assert.equal(accepted.next_projection.states.lifecycle, 'READY');
  assert.equal(accepted.next_projection.revision, 3);
  assert.equal(accepted.event.from_state, 'RECEIVED');
  assert.equal(accepted.event.to_state, 'READY');
  assert.equal(accepted.audit.actor.actor_id, 'user-1');
});

test('generic decide forwards domain guard_context without weakening core decision fields', () => {
  const workflow = machine();
  workflow.guards = [{ guard_id: 'contract-present', kind: 'CUSTOM' }];

  const engine = createWorkflowEngine(workflow, {
    now: () => '2026-09-20T00:00:00.000Z',
    idFactory: (() => { let n = 0; return () => `guard-id-${++n}`; })(),
    evaluateGuard: (guard, context) => guard.guard_id === 'contract-present' && context.domain_ticket === 'bound',
  });
  const projection = { entity_id: 'contract-1', revision: 2, states: { lifecycle: 'RECEIVED' } };

  const accepted = engine.decide({
    projection,
    transition_id: 'prepare',
    command_id: 'prepare',
    actor: { actor_id: 'user-1' },
    reason: 'domain guard verified',
    permissions: ['contract.prepare'],
    expected_revision: 2,
    idempotency_key: 'guard-context-key',
    guard_context: { domain_ticket: 'bound' },
  });

  assert.equal(accepted.status, 'TRANSITION_ACCEPTED');
  assert.equal(accepted.next_projection.states.lifecycle, 'READY');
  assert.equal(accepted.event.expected_revision, 2);
  assert.equal(accepted.event.resulting_revision, 3);
});

test('same idempotency key with same intent replays, different intent conflicts', () => {
  const engine = createWorkflowEngine(machine());
  const projection = { entity_id: 'contract-1', revision: 0, states: { lifecycle: 'RECEIVED' } };
  const first = engine.decide({
    projection,
    transition_id: 'prepare',
    command_id: 'prepare',
    actor: { actor_id: 'user-1' },
    reason: 'prepare',
    permissions: ['contract.prepare'],
    facts: { 'contract.exists': true },
    expected_revision: 0,
    idempotency_key: 'same-key'
  });
  const history = [{
    idempotency_key: 'same-key',
    transition_id: 'prepare',
    command_id: 'prepare',
    entity_id: 'contract-1',
    intent_fingerprint: first.intent_fingerprint,
    result: first
  }];
  const replay = engine.decide({
    projection: { entity_id: 'contract-1', revision: 1, states: { lifecycle: 'READY' } },
    transition_id: 'prepare',
    command_id: 'prepare',
    actor: { actor_id: 'user-1' },
    reason: 'prepare',
    permissions: ['contract.prepare'],
    facts: { 'contract.exists': true },
    expected_revision: 0,
    idempotency_key: 'same-key',
    history
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.intent_fingerprint, first.intent_fingerprint);

  assert.throws(() => engine.decide({
    projection,
    transition_id: 'cancel',
    command_id: 'cancel',
    actor: { actor_id: 'user-1' },
    reason: 'cancel',
    permissions: ['contract.cancel'],
    expected_revision: 0,
    idempotency_key: 'same-key',
    command_payload: { reason_code: 'CUSTOMER_REQUEST' },
    history
  }), error => error.code === 'IDEMPOTENCY_CONFLICT');
});

test('completion distinguishes evidence and approval and enforces separation of duties', () => {
  const engine = createWorkflowEngine(machine());
  const projection = { entity_id: 'contract-1', revision: 3, states: { lifecycle: 'READY' } };

  assert.throws(() => engine.decide({
    projection,
    transition_id: 'complete',
    command_id: 'complete',
    actor: { actor_id: 'executor-1' },
    reason: 'done',
    permissions: ['contract.complete'],
    evidence: [{ evidence_id: 'delivery-proof', verification: 'HUMAN_REPORTED', ref: 'claim:1' }],
    approvals: [{ role: 'approver', actor_id: 'approver-1' }],
    expected_revision: 3,
    idempotency_key: 'complete-1'
  }), error => error.code === 'TRANSITION_GUARD_REJECTED'
    && error.details.reasons.includes('EVIDENCE_VERIFICATION_MISMATCH:delivery-proof'));

  const accepted = engine.decide({
    projection,
    transition_id: 'complete',
    command_id: 'complete',
    actor: { actor_id: 'executor-1' },
    reason: 'system proof verified',
    permissions: ['contract.complete'],
    evidence: [{ evidence_id: 'delivery-proof', verification: 'SYSTEM_VERIFIED', ref: 'provider:delivery-7' }],
    approvals: [{ role: 'approver', actor_id: 'approver-1' }],
    expected_revision: 3,
    idempotency_key: 'complete-2'
  });
  assert.equal(accepted.next_projection.states.lifecycle, 'COMPLETED');

  assert.throws(() => engine.decide({
    projection,
    transition_id: 'complete',
    command_id: 'complete',
    actor: { actor_id: 'same-person' },
    reason: 'done',
    permissions: ['contract.complete'],
    evidence: [{ evidence_id: 'delivery-proof', verification: 'SYSTEM_VERIFIED', ref: 'provider:delivery-8' }],
    approvals: [{ role: 'approver', actor_id: 'same-person' }],
    expected_revision: 3,
    idempotency_key: 'complete-3'
  }), error => error.code === 'TRANSITION_GUARD_REJECTED'
    && error.details.reasons.includes('SEPARATION_OF_DUTIES_VIOLATION'));
});

test('hold and resume are first-class transitions and failure policy returns bounded retry', () => {
  const engine = createWorkflowEngine(machine());
  const projection = { entity_id: 'contract-1', revision: 1, states: { lifecycle: 'READY' } };
  const held = engine.decide({
    projection,
    transition_id: 'hold',
    command_id: 'hold',
    actor: { actor_id: 'user-1' },
    reason: 'waiting for customer',
    permissions: ['contract.hold'],
    expected_revision: 1,
    idempotency_key: 'hold-1'
  });
  assert.equal(held.next_projection.states.lifecycle, 'ON_HOLD');

  const resumed = engine.decide({
    projection: held.next_projection,
    transition_id: 'resume',
    command_id: 'resume',
    actor: { actor_id: 'user-1' },
    reason: 'customer replied',
    permissions: ['contract.resume'],
    expected_revision: 2,
    idempotency_key: 'resume-1'
  });
  assert.equal(resumed.next_projection.states.lifecycle, 'READY');

  assert.deepEqual(engine.resolveFailure({ transition_id: 'prepare', attempt: 1, error_code: 'TEMPORARY', occurred_at: 't' }), {
    action: 'RETRY',
    attempt: 1,
    next_attempt: 2,
    retry_after_ms: 1000,
    error_code: 'TEMPORARY',
    occurred_at: 't'
  });
  assert.equal(engine.resolveFailure({ transition_id: 'prepare', attempt: 3, error_code: 'TEMPORARY' }).action, 'HOLD');
});


test('available actions expose stable eligibility reasons for UI without duplicating workflow rules', () => {
  const engine = createWorkflowEngine(machine());
  const projection = { entity_id: 'contract-1', revision: 0, states: { lifecycle: 'RECEIVED' } };

  const blocked = engine.availableActions(projection, { facts: { 'contract.exists': false } });
  const prepare = blocked.find(item => item.transition_id === 'prepare');
  assert.equal(prepare.eligible, false);
  assert.ok(prepare.reasons.includes('PERMISSION_MISSING:contract.prepare'));
  assert.ok(prepare.reasons.includes('GUARD_FAILED:contract-present'));

  const allowed = engine.availableActions(projection, {
    permissions: ['contract.prepare'],
    facts: { 'contract.exists': true }
  }).find(item => item.transition_id === 'prepare');
  assert.equal(allowed.eligible, true);
  assert.deepEqual(allowed.reasons, []);
});

test('automation inspects the same transition contract and does not create a second state machine', () => {
  const engine = createWorkflowEngine(machine());
  const projection = { entity_id: 'contract-1', revision: 2, states: { lifecycle: 'ON_HOLD' } };
  const due = engine.dueAutomations(projection, 'test.contract.held', {
    permissions: ['contract.resume']
  });
  assert.equal(due.length, 1);
  assert.equal(due[0].transition_id, 'resume');
  assert.equal(due[0].inspection.eligible, true);
});

test('validator rejects invalid hold targets and non-explicit approval roles', () => {
  const broken = structuredClone(machine());
  broken.transitions[0].approval = { policy: 'ALL', required_roles: [], separation_of_duties: false };
  broken.transitions[2].to = 'READY';
  const result = validateWorkflowRegistry({
    schema_version: '1.0.0',
    registry_version: '1.0.0',
    primitives: [],
    workflows: [broken]
  });
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'APPROVAL_ROLES_REQUIRED'));
  assert.ok(result.errors.some(item => item.code === 'HOLD_TARGET_REQUIRED'));
});


test('validator requires provenance for SHADOW workflows and same-state REOBSERVE', () => {
  const shadowWorkflow = structuredClone(machine());
  shadowWorkflow.adoption_status = 'SHADOW';
  shadowWorkflow.transitions[0].purpose = 'REOBSERVE';
  const result = validateWorkflowRegistry({
    schema_version: '1.0.0',
    registry_version: '1.0.0',
    primitives: [],
    workflows: [shadowWorkflow]
  });
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'SHADOW_SOURCE_AUTHORITY_REQUIRED'));
  assert.ok(result.errors.some(item => item.code === 'REOBSERVE_MUST_PRESERVE_STATE'));
});

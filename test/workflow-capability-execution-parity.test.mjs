import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { OrderStore } from '../src/orders/store.mjs';
import { BINDING_SCHEMA } from '../src/integration/order-work-binder.mjs';
import { createCapabilityExecutionCoordinator } from '../src/engine/capability-execution-coordinator.mjs';
import { createCapabilityExecutionShadow } from '../src/workflow/capability-execution-shadow.mjs';

const sha = 'a'.repeat(40);
const capability = {
  id: 'operations.penalty.prepare',
  status: 'ACTIVE',
  projects: ['aiops'],
  mode: 'EXTERNAL_MUTATION',
  walls: ['관청발송', '문서24업로드'],
  receipt: {
    kind: 'NEW_JSON_TERMINAL_RECEIPT',
    directory: 'tmp/과태료',
    prefix: '실행기록-',
    suffix: '.json',
    schema_field: 'schema',
    schema_value: 'gwataeryo-run-manifest/v1',
    state_field: 'state',
    success_states: ['COMPLETED'],
    hold_states: ['COMPLETED_WITH_HOLD'],
    failure_states: ['FAILED'],
  },
};

const projectRegistry = {
  schema_version: '1.0',
  projects: [{ project_id: 'aiops', local_path: '/project' }],
};

const registry = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const workflow = registry.workflows.find(item => item.workflow_id === 'ai-core.capability-execution');
const shadow = createCapabilityExecutionShadow(workflow);

function fixture({ reconcileResult = null, withBinding = true, capabilityOverride = capability } = {}) {
  const store = new OrderStore(':memory:', { now: () => Date.parse('2026-09-19T03:30:00Z') });
  const order = store.create({
    requestId: 'create-1',
    title: '과태료',
    intent: '과태료 처리해',
    project: 'aiops',
    kind: 'general',
    criteria: ['실행 결과가 receipt로 남는다.'],
    routing: {
      status: 'ROUTED',
      work_type_id: 'penalty-processing',
      capability_id: capabilityOverride.id,
      target_project_id: 'aiops',
      target_revision: sha,
      project_status: 'ACTIVE',
      capability_status: 'ACTIVE',
      capability_mode: capabilityOverride.mode,
      matched_alias: '과태료',
      blockers: [],
      requirement_revision: 1,
    },
  });

  if (withBinding) {
    store.db.exec(BINDING_SCHEMA);
    store.db.prepare(`INSERT INTO coordination_bindings
      (order_id,requirement_revision,work_id,project_id,subject_revision,requirement_digest,created_record_version,command_id,event_id)
      VALUES (?,?,?,?,?,?,?,NULL,NULL)`)
      .run(order.id, 1, 'WORK-001', 'aiops', sha, 'digest', order.version);
  }

  const receiptReader = {
    snapshot: async () => new Map(),
    reconcile: async () => reconcileResult ?? { status: 'HOLD', reason: 'EXECUTION_RECEIPT_MISSING' },
  };

  const coordinator = createCapabilityExecutionCoordinator({
    store,
    projectRegistry,
    receiptReader,
    clock: () => Date.parse('2026-09-19T03:31:00Z'),
  });

  return { store, order, coordinator, capability: capabilityOverride };
}

function resultFor(order, extra = {}) {
  return {
    schema: 'ai-core-work-result/v1',
    order_id: order.id,
    work_id: 'WORK-001',
    project_id: 'aiops',
    capability_id: capability.id,
    subject_revision: sha,
    mode: 'EXTERNAL_MUTATION',
    status: 'SUCCEEDED',
    summary: '완료',
    artifact_refs: ['tmp/과태료/실행기록-x.json'],
    evidence_refs: ['MEASURED:receipt'],
    checks: [{ name: 'penalty.manifest', status: 'PASS', detail: 'COMPLETED' }],
    execution: {
      performed: true,
      external_effect: true,
      started_at: '2026-09-19T03:30:00.000Z',
      ended_at: '2026-09-19T03:31:00.000Z',
      authorization_source: 'control-tower',
    },
    outcome: { observed: true, data: { secret: 'drop-me' } },
    blockers: [],
    next_action: null,
    walls: capability.walls,
    ...extra,
  };
}

test('Capability Execution SHADOW is pinned to coordinator and receipt-reader source blobs', () => {
  assert.equal(workflow.adoption_status, 'SHADOW');
  for (const source of workflow.source_authority.files) {
    const actual = execFileSync('git', ['hash-object', source.path], {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
    }).trim();
    assert.equal(actual, source.blob_sha, source.path);
  }
});

test('reserve creates durable RESERVED state and replays same request identity', async t => {
  const f = fixture();
  t.after(() => f.store.close());

  const first = await f.coordinator.reserve({
    requestId: 'exec-1',
    orderId: f.order.id,
    workId: 'WORK-001',
    capability: f.capability,
    input: { a: 1 },
    perform: true,
  });

  assert.equal(first.status, 'RESERVED');
  assert.equal(first.replay, false);
  assert.equal(shadow.projection(first.row).states.lifecycle, 'RESERVED');

  const second = await f.coordinator.reserve({
    requestId: 'exec-1',
    orderId: f.order.id,
    workId: 'WORK-001',
    capability: f.capability,
    input: { a: 1 },
    perform: true,
  });

  assert.equal(second.status, 'RESERVED');
  assert.equal(second.replay, true);

  await assert.rejects(
    f.coordinator.reserve({
      requestId: 'exec-1',
      orderId: f.order.id,
      workId: 'WORK-001',
      capability: f.capability,
      input: { a: 2 },
      perform: true,
    }),
    /CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT/,
  );
});

test('complete parity preserves stable validation error codes', async t => {
  const cases = [
    {
      label: 'schema',
      patch: { schema: 'wrong/v1' },
      code: 'WORK_RESULT_SCHEMA_INVALID',
    },
    {
      label: 'context',
      patch: { work_id: 'WORK-999' },
      code: 'WORK_RESULT_CONTEXT_MISMATCH',
    },
    {
      label: 'capability',
      patch: { capability_id: 'other.capability' },
      code: 'WORK_RESULT_CAPABILITY_MISMATCH',
    },
    {
      label: 'revision',
      patch: { subject_revision: 'b'.repeat(40) },
      code: 'WORK_RESULT_REVISION_STALE',
    },
  ];

  for (const sample of cases) {
    const f = fixture();
    t.after(() => f.store.close());
    await f.coordinator.reserve({
      requestId: `exec-${sample.label}`,
      orderId: f.order.id,
      workId: 'WORK-001',
      capability: f.capability,
      input: {},
      perform: true,
    });
    const row = f.coordinator.get(`exec-${sample.label}`);
    const result = resultFor(f.order, sample.patch);

    const decision = shadow.decideComplete(row, result, { requestId: `exec-${sample.label}` });
    assert.equal(decision.eligible, false, sample.label);
    assert.equal(decision.code, sample.code, sample.label);

    assert.throws(
      () => f.coordinator.complete(`exec-${sample.label}`, result),
      error => error.message === sample.code,
      sample.label,
    );
  }
});

test('complete parity reaches RESULT and safe receipt drops outcome.data', async t => {
  const f = fixture();
  t.after(() => f.store.close());

  await f.coordinator.reserve({
    requestId: 'exec-ok',
    orderId: f.order.id,
    workId: 'WORK-001',
    capability: f.capability,
    input: {},
    perform: true,
  });

  const before = f.coordinator.get('exec-ok');
  const raw = resultFor(f.order);
  const decision = shadow.decideComplete(before, raw, { requestId: 'exec-ok' });
  assert.equal(decision.eligible, true);
  assert.equal(decision.persistent_state, 'RESULT');
  assert.deepEqual(decision.receipt.outcome, { observed: true });
  assert.equal(Object.hasOwn(decision.receipt.outcome, 'data'), false);

  const saved = f.coordinator.complete('exec-ok', raw);
  assert.deepEqual(saved, decision.receipt);

  const after = f.coordinator.get('exec-ok');
  assert.equal(after.state, 'RESULT');
  assert.equal(shadow.projection(after).states.lifecycle, 'RESULT');

  const replay = shadow.decideComplete(after, raw, { requestId: 'exec-ok' });
  assert.equal(replay.eligible, true);
  assert.equal(replay.replay, true);

  const changed = resultFor(f.order, { status: 'FAILED' });
  const conflict = shadow.decideComplete(after, changed, { requestId: 'exec-ok' });
  assert.equal(conflict.eligible, false);
  assert.equal(conflict.code, 'CAPABILITY_EXECUTION_RESULT_CONFLICT');
  assert.throws(
    () => f.coordinator.complete('exec-ok', changed),
    /CAPABILITY_EXECUTION_RESULT_CONFLICT/,
  );
});

test('missing terminal receipt is HOLD projection and keeps persistent state RESERVED', async t => {
  const f = fixture();
  t.after(() => f.store.close());

  await f.coordinator.reserve({
    requestId: 'exec-missing',
    orderId: f.order.id,
    workId: 'WORK-001',
    capability: f.capability,
    input: {},
    perform: true,
  });

  const row = f.coordinator.get('exec-missing');
  const classified = shadow.classifyReconciliation(
    row,
    f.capability,
    { status: 'HOLD', reason: 'EXECUTION_RECEIPT_MISSING' },
  );
  assert.equal(classified.action, 'HOLD_NO_TRANSITION');
  assert.equal(classified.persistent_state, 'RESERVED');
  assert.equal(classified.reason, 'EXECUTION_OUTCOME_UNKNOWN');

  const actual = await f.coordinator.reconcile('exec-missing', f.capability);
  assert.deepEqual(actual, {
    status: 'HOLD',
    reason: 'EXECUTION_OUTCOME_UNKNOWN',
    reconciled: false,
  });
  assert.equal(f.coordinator.get('exec-missing').state, 'RESERVED');
});

test('terminal receipt reconciliation maps success failure and hold into durable RESULT', async t => {
  const samples = [
    {
      observed: {
        status: 'SUCCEEDED',
        path: '/project/tmp/과태료/실행기록-success.json',
        state: 'COMPLETED',
        receipt: { schema: 'gwataeryo-run-manifest/v1', state: 'COMPLETED' },
      },
      expected: 'SUCCEEDED',
    },
    {
      observed: {
        status: 'FAILED',
        reason: 'EXECUTION_RECEIPT_FAILED',
        path: '/project/tmp/과태료/실행기록-failed.json',
        state: 'FAILED',
        receipt: { schema: 'gwataeryo-run-manifest/v1', state: 'FAILED' },
      },
      expected: 'FAILED',
    },
    {
      observed: {
        status: 'HOLD',
        reason: 'EXECUTION_RECEIPT_HOLD',
        path: '/project/tmp/과태료/실행기록-hold.json',
        state: 'COMPLETED_WITH_HOLD',
        receipt: { schema: 'gwataeryo-run-manifest/v1', state: 'COMPLETED_WITH_HOLD' },
      },
      expected: 'HOLD',
    },
  ];

  for (const [index, sample] of samples.entries()) {
    const f = fixture({ reconcileResult: sample.observed });
    t.after(() => f.store.close());

    const requestId = `exec-reconcile-${index}`;
    await f.coordinator.reserve({
      requestId,
      orderId: f.order.id,
      workId: 'WORK-001',
      capability: f.capability,
      input: {},
      perform: true,
    });

    const row = f.coordinator.get(requestId);
    const classified = shadow.classifyReconciliation(row, f.capability, sample.observed, {
      clock: () => Date.parse('2026-09-19T03:31:00Z'),
      projectRoot: '/project',
    });

    assert.equal(classified.action, 'PERSIST_TERMINAL_RESULT');
    assert.equal(classified.persistent_state, 'RESULT');
    assert.equal(classified.mapped_status, sample.expected);

    const decision = shadow.decideComplete(row, classified.result, {
      requestId,
      reconciliation: true,
    });
    assert.equal(decision.eligible, true);
    assert.equal(decision.persistent_state, 'RESULT');

    const actual = await f.coordinator.reconcile(requestId, f.capability);
    assert.equal(actual.status, 'RESULT');
    assert.equal(actual.reconciled, true);
    assert.equal(actual.result.status, sample.expected);
    assert.deepEqual(actual.result, decision.receipt);
    assert.equal(f.coordinator.get(requestId).state, 'RESULT');
  }
});

test('reconcile without a configured receipt never invents a retry or persistent HOLD state', async t => {
  const noReceiptCapability = { ...capability };
  delete noReceiptCapability.receipt;
  const f = fixture({ capabilityOverride: noReceiptCapability });
  t.after(() => f.store.close());

  await f.coordinator.reserve({
    requestId: 'exec-no-receipt',
    orderId: f.order.id,
    workId: 'WORK-001',
    capability: f.capability,
    input: {},
    perform: true,
  });

  const row = f.coordinator.get('exec-no-receipt');
  const classified = shadow.classifyReconciliation(row, f.capability, null);
  assert.equal(classified.action, 'HOLD_NO_TRANSITION');
  assert.equal(classified.persistent_state, 'RESERVED');
  assert.equal(classified.reason, 'EXECUTION_OUTCOME_UNKNOWN');

  const actual = await f.coordinator.reconcile('exec-no-receipt', f.capability);
  assert.deepEqual(actual, {
    status: 'HOLD',
    reason: 'EXECUTION_OUTCOME_UNKNOWN',
    reconciled: false,
  });
  assert.equal(f.coordinator.get('exec-no-receipt').state, 'RESERVED');
});

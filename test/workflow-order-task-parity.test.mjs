import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { OrderStore, actors } from '../src/orders/store.mjs';
import { createOrderTaskRuntime, deriveOrderAggregateStatus } from '../src/workflow/order-task-runtime.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const workflow = registry.workflows.find(item => item.workflow_id === 'ai-core.order-task-lifecycle');

const input = (extra = {}) => ({
  requestId: randomUUID(),
  title: 'Workflow parity order',
  intent: 'OrderStore task workflow parity',
  project: 'ai-core',
  kind: 'general',
  criteria: ['parity'],
  ...extra,
});

const command = (order, action, extra = {}) => ({
  requestId: randomUUID(),
  version: order.version,
  action,
  ...extra,
});

function actual(store, order, cmd) {
  try {
    return { eligible: true, value: store.mutate(order.id, cmd), code: null };
  } catch (error) {
    return { eligible: false, value: null, code: error.code ?? error.message };
  }
}

function parity(store, shadow, order, cmd, label) {
  const expected = shadow.decide(order, cmd);
  const observed = actual(store, order, cmd);
  assert.equal(
    expected.eligible,
    observed.eligible,
    `${label}: shadow=${JSON.stringify(expected)} actual=${observed.code}`,
  );
  return { expected, observed };
}

test('Canonical Order Task workflow is pinned to the exact OrderStore integration blob', () => {
  assert.equal(workflow.adoption_status, 'CANONICAL');
  assert.equal(workflow.source_authority.files.length, 1);
  const source = workflow.source_authority.files[0];
  const actualBlob = execFileSync('git', ['hash-object', source.path], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
  }).trim();
  assert.equal(actualBlob, source.blob_sha);
});

test('claim parity covers assigned actor, active lease, expiry retry and blocked resume', t => {
  let now = Date.parse('2026-09-19T12:00:00.000Z');
  const store = new OrderStore(':memory:', { now: () => now, leaseMs: 1000 });
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
    now: () => now,
  });

  let order = store.create(input());
  assert.equal(deriveOrderAggregateStatus(order), order.status);

  let cmd = command(order, 'claim', { taskId: 'T1', actor: 'claude' });
  let result = parity(store, shadow, order, cmd, 'wrong actor');
  assert.equal(result.observed.code, 'WRONG_ACTOR');

  cmd = command(order, 'claim', { taskId: 'T1', actor: 'codex' });
  result = parity(store, shadow, order, cmd, 'initial claim');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'RUNNING');
  assert.equal(deriveOrderAggregateStatus(order), order.status);

  cmd = command(order, 'claim', { taskId: 'T1', actor: 'codex' });
  result = parity(store, shadow, order, cmd, 'concurrent claim');
  assert.equal(result.observed.code, 'ACTIVE_LEASE');

  now += 1001;
  cmd = command(order, 'claim', { taskId: 'T1', actor: 'codex' });
  result = parity(store, shadow, order, cmd, 'expired lease reclaim');
  order = result.observed.value;
  assert.equal(order.tasks[0].attempt, 2);

  const token = order.tasks[0].lease.token;
  cmd = command(order, 'block', { taskId: 'T1', actor: 'codex', token, reason: 'dependency unavailable' });
  result = parity(store, shadow, order, cmd, 'block running task');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'BLOCKED');
  assert.equal(deriveOrderAggregateStatus(order), 'BLOCKED');

  cmd = command(order, 'claim', { taskId: 'T1', actor: 'codex' });
  result = parity(store, shadow, order, cmd, 'claim from blocked');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'RUNNING');
});

test('heartbeat is classified as an audited lease fact update, not a business state transition', t => {
  let now = Date.parse('2026-09-19T12:00:00.000Z');
  const store = new OrderStore(':memory:', { now: () => now, leaseMs: 1000 });
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
    now: () => now,
  });

  let order = store.create(input());
  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'codex' }));
  const token = order.tasks[0].lease.token;
  now += 500;
  const cmd = command(order, 'heartbeat', { taskId: 'T1', actor: 'codex', token });

  const decision = shadow.decide(order, cmd);
  assert.equal(decision.kind, 'FACT_UPDATE');
  assert.equal(decision.state_changed, false);
  assert.equal(decision.eligible, true);

  const updated = store.mutate(order.id, cmd);
  assert.equal(updated.tasks[0].status, 'RUNNING');
  assert.notEqual(updated.tasks[0].lease.expiresAt, order.tasks[0].lease.expiresAt);
});

test('report parity covers lease ownership, requirement revision and evidence content', t => {
  let now = Date.parse('2026-09-19T12:00:00.000Z');
  const store = new OrderStore(':memory:', { now: () => now, leaseMs: 1000 });
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
    now: () => now,
  });

  let order = store.create(input());
  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'codex' }));
  const token = order.tasks[0].lease.token;

  let cmd = command(order, 'report', {
    taskId: 'T1', actor: 'codex', token,
    revision: order.revision - 1,
    summary: 'stale', evidence: ['old'],
  });
  let result = parity(store, shadow, order, cmd, 'stale report revision');
  assert.equal(result.observed.code, 'STALE_EVIDENCE');

  cmd = command(order, 'report', {
    taskId: 'T1', actor: 'codex', token: 'wrong-token',
    revision: order.revision,
    summary: 'wrong lease', evidence: ['proof'],
  });
  result = parity(store, shadow, order, cmd, 'wrong lease token');
  assert.equal(result.observed.code, 'STALE_LEASE');

  cmd = command(order, 'report', {
    taskId: 'T1', actor: 'codex', token,
    revision: order.revision,
    summary: 'empty evidence', evidence: [],
  });
  result = parity(store, shadow, order, cmd, 'empty evidence');
  assert.equal(result.observed.code, 'INVALID_INPUT');

  cmd = command(order, 'report', {
    taskId: 'T1', actor: 'codex', token,
    revision: order.revision,
    summary: 'verified report', evidence: ['test:pass'],
  });
  result = parity(store, shadow, order, cmd, 'valid report');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'REPORTED');
  assert.equal(order.tasks[0].report.status, 'REPORTED_NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(deriveOrderAggregateStatus(order), 'REVIEW');
  assert.equal(order.status, 'REVIEW');
});

test('assignment parity covers blocked handoff, missing reason and active-vs-expired running lease', t => {
  let now = Date.parse('2026-09-19T12:00:00.000Z');
  const store = new OrderStore(':memory:', { now: () => now, leaseMs: 1000 });
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
    now: () => now,
  });

  let order = store.create(input());
  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'codex' }));

  let cmd = command(order, 'assign', { taskId: 'T1', actor: 'claude', reason: 'handoff' });
  let result = parity(store, shadow, order, cmd, 'active running lease assignment');
  assert.equal(result.observed.code, 'ACTIVE_LEASE');

  now += 1001;
  cmd = command(order, 'assign', { taskId: 'T1', actor: 'claude', reason: 'expired lease handoff' });
  result = parity(store, shadow, order, cmd, 'expired running assignment');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'PENDING');
  assert.equal(order.tasks[0].assigned, 'claude');

  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'claude' }));
  const token = order.tasks[0].lease.token;
  order = store.mutate(order.id, command(order, 'block', { taskId: 'T1', actor: 'claude', token, reason: 'tool unavailable' }));

  cmd = command(order, 'assign', { taskId: 'T1', actor: 'codex', reason: '' });
  result = parity(store, shadow, order, cmd, 'blocked assign missing reason');
  assert.equal(result.observed.code, 'INVALID_INPUT');

  cmd = command(order, 'assign', { taskId: 'T1', actor: 'codex', reason: 'resume with codex' });
  result = parity(store, shadow, order, cmd, 'blocked handoff');
  order = result.observed.value;
  assert.equal(order.tasks[0].status, 'PENDING');
  assert.equal(order.tasks[0].assigned, 'codex');
});

test('dependency guard parity prevents later development tasks from claiming early', t => {
  const store = new OrderStore(':memory:');
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
  });

  let order = store.create(input({ kind: 'development' }));
  let cmd = command(order, 'claim', { taskId: 'T2', actor: order.tasks[1].assigned });
  let result = parity(store, shadow, order, cmd, 'T2 before T1 report');
  assert.equal(result.observed.code, 'DEPENDENCY_PENDING');

  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: order.tasks[0].assigned }));
  const t1 = order.tasks[0];
  order = store.mutate(order.id, command(order, 'report', {
    taskId: 'T1', actor: t1.assigned, token: t1.lease.token,
    revision: order.revision, summary: 'T1 done', evidence: ['T1 proof'],
  }));

  cmd = command(order, 'claim', { taskId: 'T2', actor: order.tasks[1].assigned });
  result = parity(store, shadow, order, cmd, 'T2 after T1 report');
  assert.equal(result.observed.eligible, true);
});

test('parent revision explicitly invalidates reported child task state and evidence', t => {
  const store = new OrderStore(':memory:');
  t.after(() => store.close());
  const shadow = createOrderTaskRuntime(workflow, {
    actorIds: actors.map(item => item.id),
  });

  let order = store.create(input());
  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'codex' }));
  const token = order.tasks[0].lease.token;
  order = store.mutate(order.id, command(order, 'report', {
    taskId: 'T1', actor: 'codex', token,
    revision: order.revision, summary: 'old result', evidence: ['old proof'],
  }));
  assert.equal(order.tasks[0].status, 'REPORTED');

  const invalidation = shadow.decideInvalidation(order, order.tasks[0], {
    requestId: randomUUID(),
    version: order.version,
    reason: 'requirement changed',
  });
  assert.equal(invalidation.eligible, true);
  assert.equal(invalidation.result.next_projection.states.lifecycle, 'PENDING');

  order = store.mutate(order.id, command(order, 'revise', {
    intent: 'new requirement',
    criteria: ['new criterion'],
    reason: 'requirement changed',
  }));
  assert.equal(order.revision, 2);
  assert.equal(order.tasks[0].status, 'PENDING');
  assert.equal(order.tasks[0].report, null);
  assert.equal(order.tasks[0].lease, null);
  assert.equal(deriveOrderAggregateStatus(order), 'NEW');
  assert.equal(order.status, 'NEW');
});

test('Order aggregate projection remains derived; close acceptance is not canonical completion', t => {
  const store = new OrderStore(':memory:');
  t.after(() => store.close());

  let order = store.create(input());
  assert.equal(deriveOrderAggregateStatus(order), 'NEW');

  order = store.mutate(order.id, command(order, 'claim', { taskId: 'T1', actor: 'codex' }));
  assert.equal(deriveOrderAggregateStatus(order), 'ACTIVE');
  assert.equal(order.status, 'ACTIVE');

  const token = order.tasks[0].lease.token;
  order = store.mutate(order.id, command(order, 'report', {
    taskId: 'T1', actor: 'codex', token,
    revision: order.revision, summary: 'done', evidence: ['proof'],
  }));
  assert.equal(deriveOrderAggregateStatus(order), 'REVIEW');

  order = store.mutate(order.id, command(order, 'close', {
    confirmed: true,
    revision: order.revision,
    note: 'user accepted evidence',
    checks: [{ criterion: 0, taskId: 'T1', evidenceIndex: 0 }],
  }));
  assert.equal(order.status, 'REVIEW');
  assert.equal(deriveOrderAggregateStatus(order), 'REVIEW');
  assert.equal(order.closure.kind, 'USER_ACCEPTED_NOT_CANONICAL');

  order = store.mutate(order.id, command(order, 'cancel', { reason: 'cancel after review' }));
  assert.equal(order.status, 'CANCELLED');
  assert.equal(deriveOrderAggregateStatus(order), 'CANCELLED');
});

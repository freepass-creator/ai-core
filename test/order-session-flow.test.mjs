import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../src/orders/store.mjs';
import { availableTasks, claimNextTask, inspectNextTask, sessionPackMarkdown } from '../src/orders/session-flow.mjs';

const input = (requestId, kind = 'development') => ({
  requestId, title: `order ${requestId}`, intent: 'implement and verify', project: 'ai-core',
  criteria: ['tests pass'], kind, source: 'test',
});

test('next task selection is deterministic and respects dependency and lease gates', () => {
  const store = new OrderStore(':memory:', { now: () => Date.parse('2026-09-20T00:00:00Z') });
  try {
    const newer = store.create(input('newer'));
    const older = store.create(input('older'));
    const rows = store.list().map(order => order.id === older.id ? { ...order, createdAt: '2026-09-19T00:00:00Z' } : order);
    const tasks = availableTasks(rows, 'claude', { now: Date.parse('2026-09-20T00:00:00Z') });
    assert.equal(tasks[0].order.id, older.id);
    assert.equal(tasks[0].task.id, 'T1');
    assert.equal(availableTasks(rows, 'codex').length, 0);
  } finally { store.close(); }
});

test('claim-next uses the existing optimistic version and lease token while packet omits token', async () => {
  const store = new OrderStore(':memory:');
  try {
    const order = store.create(input('claim-one', 'general'));
    const inspected = await inspectNextTask(store, 'codex');
    assert.equal(inspected.orderId, order.id);
    const claimed = await claimNextTask(store, 'codex', { requestId: 'claim-request' });
    assert.equal(claimed.status, 'CLAIMED');
    assert.ok(claimed.lease.token);
    assert.equal(JSON.stringify(claimed.packet).includes(claimed.lease.token), false);
    const replay = await claimNextTask(store, 'codex');
    assert.equal(replay.status, 'ALREADY_CLAIMED');
    assert.equal(replay.taskId, claimed.taskId);
  } finally { store.close(); }
});

test('claim-next refreshes stale selection instead of skipping the oldest task', async () => {
  let time = Date.parse('2026-09-20T00:00:00Z');
  const store = new OrderStore(':memory:', { now: () => time++ });
  try {
    const oldest = store.create(input('stale-oldest', 'general'));
    store.create(input('newer-order', 'general'));
    let first = true;
    const client = {
      list: () => store.list(), packet: (...args) => store.packet(...args),
      mutate: (id, command) => {
        if (first) {
          first = false;
          store.mutate(id, { requestId: 'concurrent-note', version: command.version, action: 'note', note: 'unrelated update' });
        }
        return store.mutate(id, command);
      },
    };
    const claimed = await claimNextTask(client, 'codex', { requestId: 'refresh-claim' });
    assert.equal(claimed.status, 'CLAIMED');
    assert.equal(claimed.orderId, oldest.id);
  } finally { store.close(); }
});

test('a committed claim with packet read failure cannot lead to a second live lease', async () => {
  const store = new OrderStore(':memory:');
  try {
    store.create(input('packet-fail-one', 'general'));
    store.create(input('packet-fail-two', 'general'));
    const failing = { list: () => store.list(), mutate: (...args) => store.mutate(...args), packet: async () => { throw new Error('read failed'); } };
    await assert.rejects(claimNextTask(failing, 'codex', { requestId: 'packet-fail' }), error => error.code === 'CLAIMED_PACKET_UNAVAILABLE');
    const running = store.list().find(order => order.tasks.some(task => task.status === 'RUNNING'));
    const recovered = await claimNextTask(store, 'codex');
    assert.equal(recovered.status, 'ALREADY_CLAIMED');
    assert.equal(recovered.orderId, running.id);
    assert.equal(store.list().flatMap(order => order.tasks).filter(task => task.status === 'RUNNING').length, 1);
  } finally { store.close(); }
});

test('next-task helpers reject a missing or unknown actor', async () => {
  const store = new OrderStore(':memory:');
  try {
    await assert.rejects(inspectNextTask(store, undefined), error => error.code === 'INVALID_ACTOR');
    await assert.rejects(claimNextTask(store, 'cursor'), error => error.code === 'INVALID_ACTOR');
  } finally { store.close(); }
});

test('session pack is proposal-safe and carries immutable routing coordinates without lease secrets', () => {
  const packet = { schema: 'ai-core-handoff/v1', orderId: 'ORD-example', requirementRevision: 2, taskId: 'T1', execution_authorized: false, completion_authorized: false };
  const markdown = sessionPackMarkdown(packet);
  assert.match(markdown, /ORD-example/);
  assert.match(markdown, /requirement revision/);
  assert.match(markdown, /does not authorize execution/);
  assert.doesNotMatch(markdown, /lease token:/i);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readAiWorkPacket } from '../scripts/read-ai-work-packet.mjs';
import { startServer } from '../src/orders/server.mjs';
import { RemoteOrderClient } from '../src/orders/client.mjs';
const orderId = 'ORD-11111111-1111-1111-1111-111111111111', taskId = 'T1';
function fixture() {
  const packet = { schema: 'ai-core-handoff/v1', orderId, taskId, orderVersion: 2, requirementRevision: 1,
    assigned: 'claude', leaseState: 'NONE', status: 'NEW', taskStatus: 'PENDING' };
  const current = { orderId, version: 2, requirementRevision: 1, orderStatus: 'NEW', task: { id: taskId, assigned: 'claude', status: 'PENDING' } };
  const calls = [];
  const client = { packet: async (...args) => { calls.push(['packet', ...args]); return packet; },
    checkContext: async (...args) => { calls.push(['checkContext', ...args]); return current; },
    mutate: () => assert.fail('write attempted'), create: () => assert.fail('write attempted') };
  return { packet, current, calls, client };
}
test('existing read methods only; matching context still cannot authorize unlinked work', async () => {
  const f = fixture(); const r = await readAiWorkPacket({ client: f.client, orderId, taskId });
  assert.deepEqual(f.calls, [['packet', orderId, taskId], ['checkContext', orderId, taskId]]);
  assert.equal(r.status, 'HOLD'); assert.equal(r.work_id, null);
  assert.equal(r.execution_authorized, false); assert.equal(r.claim_acquired, false);
  assert.equal(r.valid_until, null); assert.ok(r.reasons.includes('UNLINKED_WORK'));
});
test('changed requirement/version/assignee/status is detected between reads', async () => {
  for (const mutate of [(c) => c.version++, (c) => c.requirementRevision++, (c) => { c.task.assigned = 'cursor'; },
    (c) => { c.task.status = 'RUNNING'; }, (c) => { c.orderStatus = 'CANCELLED'; }]) {
    const f = fixture(); mutate(f.current);
    assert.ok((await readAiWorkPacket({ client: f.client, orderId, taskId })).reasons.includes('CONTEXT_CHANGED'));
  }
});
test('raw instructions, secrets, errors and forged binding fields do not enter projection', async () => {
  const f = fixture(); Object.assign(f.packet, { title: 'SECRET', intent: 'SECRET', instructions: ['SECRET'],
    events: ['SECRET'], previousResults: ['SECRET'], blockedReason: 'SECRET', token: 'SECRET', work_id: 'SECRET', owned_files: ['SECRET'] });
  assert.equal(JSON.stringify(await readAiWorkPacket({ client: f.client, orderId, taskId })).includes('SECRET'), false);
  f.client.packet = async () => { throw new Error('SECRET'); };
  const r = await readAiWorkPacket({ client: f.client, orderId, taskId });
  assert.deepEqual(r.reasons, ['READ_FAILED']); assert.equal(JSON.stringify(r).includes('SECRET'), false);
});
test('active/expired lease never transfers a claim; reported work is not new execution', async () => {
  for (const state of ['ACTIVE', 'EXPIRED']) {
    const f = fixture(); f.packet.leaseState = state;
    const r = await readAiWorkPacket({ client: f.client, orderId, taskId });
    assert.equal(r.claim_acquired, false); assert.equal(r.execution_authorized, false);
    assert.ok(r.reasons.includes(state === 'ACTIVE' ? 'EXISTING_CLAIM_NOT_TRANSFERABLE' : 'LEASE_EXPIRED'));
  }
  const f = fixture(); f.packet.taskStatus = f.current.task.status = 'REPORTED';
  assert.ok((await readAiWorkPacket({ client: f.client, orderId, taskId })).reasons.includes('NOT_AN_EXECUTION_ASSIGNMENT'));
});
test('missing client, invalid identity and malformed packet fail without fallback', async () => {
  assert.deepEqual((await readAiWorkPacket({ orderId, taskId })).reasons, ['CLIENT_NOT_CONNECTED']);
  assert.deepEqual((await readAiWorkPacket({ orderId: 'SECRET', taskId })).reasons, ['INVALID_SELECTION']);
  const f = fixture(); f.packet.orderId = 'another-order';
  assert.deepEqual((await readAiWorkPacket({ client: f.client, orderId, taskId })).reasons, ['INVALID_PACKET']);
});

test('original pinned HTTP client/server preserves read-only HOLD and does not claim', async t => {
  const { server, store, url } = await startServer({ dbPath: ':memory:', standalone: true, port: 0 });
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const order = store.create({ requestId: 'synthetic-packet', title: 'Synthetic packet', intent: 'Read existing assignment', project: 'ai-core', criteria: ['HOLD only'] });
  const client = new RemoteOrderClient({ endpoint: url, ledgerId: store.ledgerId() });
  const before = store.events(order.id);
  const packet = await readAiWorkPacket({ client, orderId: order.id, taskId: 'T1' });
  assert.equal(packet.status, 'HOLD'); assert.equal(packet.order_id, order.id);
  assert.equal(packet.order_version, order.version); assert.equal(packet.claim_acquired, false);
  assert.equal(packet.execution_authorized, false); assert.deepEqual(store.events(order.id), before);
  assert.equal(store.get(order.id).tasks[0].lease, null);
  const wrong = new RemoteOrderClient({ endpoint: url, ledgerId: 'ledger-11111111-1111-1111-1111-111111111111' });
  assert.deepEqual((await readAiWorkPacket({ client: wrong, orderId: order.id, taskId: 'T1' })).reasons, ['READ_FAILED']);
});

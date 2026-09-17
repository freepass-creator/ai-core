import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { OrderStore } from '../src/orders/store.mjs';
import { RemoteOrderClient, connectionOptions, validateEndpoint, readConnectionPolicy } from '../src/orders/client.mjs';
import { startServer } from '../src/orders/server.mjs';
import { recordRun } from '../scripts/order-run-receipt.mjs';

const fail = code => e => e.code === code;
const input = () => ({ requestId: randomUUID(), title: '공유 오더 검증', intent: '로컬과 서버가 같은 오더를 이어간다.', project: 'ai-core', criteria: ['중복 실행 없음'], kind: 'general' });
async function central(t) {
  const dir = mkdtempSync(join(tmpdir(), 'shared-orders-')), path = join(dir, 'ledger.sqlite');
  const seed = new OrderStore(path), ledgerId = seed.ledgerId(); seed.close();
  const { server, store, url } = await startServer({ dbPath: path, port: 0, expectedLedgerId: ledgerId });
  t.after(async () => { server.closeAllConnections(); await new Promise(r => server.close(r)); rmSync(dir, { recursive: true, force: true }); });
  return { dir, path, store, url, ledgerId, client: new RemoteOrderClient({ endpoint: url, ledgerId }) };
}
function clonedClient(dir, name, ledgerId) {
  const root = join(dir, name); mkdirSync(root);
  for (const path of ['scripts/orders.mjs', 'src/orders/client.mjs', 'src/orders/store.mjs']) {
    const to = join(root, path); mkdirSync(dirname(to), { recursive: true }); copyFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), to);
  }
  writeFileSync(join(root, 'orders.connection.json'), JSON.stringify({ schema: 'ai-core-connection/v1', mode: 'shared-required', transport: 'ssh-loopback', ledgerId }));
  return root;
}
function cli(root, args, endpoint) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }; delete env.AI_CORE_ORDERS_URL; if (endpoint) env.AI_CORE_ORDERS_URL = endpoint;
    const processChild = spawn(process.execPath, ['scripts/orders.mjs', ...args], { cwd: root, env }); let out = '', err = '';
    processChild.stdout.on('data', c => out += c); processChild.stderr.on('data', c => err += c); processChild.on('error', reject);
    processChild.on('close', code => resolve({ code, out, err }));
  });
}
test('ledger identity is durable and a different database cannot start as the pinned server', async t => {
  const c = await central(t), opened = new OrderStore(c.path); assert.equal(opened.ledgerId(), c.ledgerId); opened.close();
  assert.throws(() => startServer({ dbPath: join(c.dir, 'wrong.sqlite'), port: 0, expectedLedgerId: c.ledgerId }), fail('LEDGER_MISMATCH'));
  assert.equal((await c.client.meta()).ledgerId, c.ledgerId);
});
test('wrong or missing ledger pin is rejected before any shared mutation', async t => {
  const c = await central(t), wrong = new RemoteOrderClient({ endpoint: c.url, ledgerId: `ledger-${randomUUID()}` });
  await assert.rejects(wrong.create(input()), fail('LEDGER_MISMATCH'));
  const noPin = await fetch(`${c.url}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input()) });
  assert.equal(noPin.status, 409); assert.equal(c.store.list().length, 0);
});
test('two independent cloned clients share orders and cannot claim the same work', async t => {
  const c = await central(t), local = clonedClient(c.dir, 'local-checkout', c.ledgerId), remote = clonedClient(c.dir, 'server-checkout', c.ledgerId);
  const req = input(); writeFileSync(join(local, 'create.json'), JSON.stringify(req));
  const created = await cli(local, ['create', 'create.json'], c.url); assert.equal(created.code, 0, created.err); const order = JSON.parse(created.out);
  const seen = await cli(remote, ['show', order.id], c.url); assert.equal(seen.code, 0, seen.err); assert.equal(JSON.parse(seen.out).order.id, order.id);
  for (const root of [local, remote]) writeFileSync(join(root, 'claim.json'), JSON.stringify({ action: 'claim', requestId: randomUUID(), version: order.version, taskId: 'T1', actor: 'codex' }));
  const results = await Promise.all([cli(local, ['act', order.id, 'claim.json'], c.url), cli(remote, ['act', order.id, 'claim.json'], c.url)]);
  assert.deepEqual(results.map(r => r.code).sort(), [0, 1]); assert.equal(c.store.get(order.id).tasks[0].attempt, 1);
  assert.equal(existsSync(join(local, '.local', 'orders.sqlite')), false); assert.equal(existsSync(join(remote, '.local', 'orders.sqlite')), false);
});
test('a lost successful reply can be retried without a second event', async t => {
  const c = await central(t), o = await c.client.create(input()); let dropped = false;
  const lossy = new RemoteOrderClient({ endpoint: c.url, ledgerId: c.ledgerId, fetchImpl: async (...args) => { const response = await fetch(...args); if (!dropped && args[1].method === 'POST') { dropped = true; await response.arrayBuffer(); throw new Error('lost acknowledgement'); } return response; } });
  const command = { requestId: randomUUID(), version: o.version, action: 'note', note: '한 번만 남겨야 한다.' };
  await assert.rejects(lossy.mutate(o.id, command), fail('CENTRAL_UNAVAILABLE'));
  const result = await lossy.mutate(o.id, command); assert.equal(result.version, 2); assert.equal(c.store.events(o.id).length, 2);
});
test('missing endpoint and unreachable server never create a local fallback database', async t => {
  const c = await central(t), clone = clonedClient(c.dir, 'offline-checkout', c.ledgerId);
  const missing = await cli(clone, ['list']); assert.equal(missing.code, 1); assert.match(missing.err, /SHARED_ENDPOINT_REQUIRED/);
  const unreachable = new RemoteOrderClient({ endpoint: 'http://127.0.0.1:1', ledgerId: c.ledgerId, timeoutMs: 100 });
  await assert.rejects(unreachable.list(), fail('CENTRAL_UNAVAILABLE'));
  assert.equal(existsSync(join(clone, '.local')), false);
});
test('connection policy refuses public endpoints, redirects and malformed responses', async t => {
  const c = await central(t);
  for (const endpoint of ['http://example.com:4318', 'https://example.com', 'http://user:password@127.0.0.1:4318', 'http://127.0.0.1:4318/path', 'http://127.0.0.1:4318?secret=x']) assert.throws(() => validateEndpoint(endpoint), fail('PRIVATE_TRANSPORT_REQUIRED'));
  const client = new RemoteOrderClient({ endpoint: c.url, ledgerId: c.ledgerId, fetchImpl: async (_url, options) => { assert.equal(options.redirect, 'error'); return new Response('not-json', { headers: { 'X-AI-Core-Ledger-Id': c.ledgerId } }); } });
  await assert.rejects(client.meta(), fail('INVALID_RESPONSE'));
  const clone = clonedClient(c.dir, 'policy-checkout', c.ledgerId);
  assert.throws(() => connectionOptions({ policyFile: join(clone, 'orders.connection.json'), localFile: join(clone, 'absent'), env: {} }), fail('SHARED_ENDPOINT_REQUIRED'));
  writeFileSync(join(clone, 'orders.connection.json'), JSON.stringify({ mode: 'local-fallback', ledgerId: c.ledgerId }));
  assert.throws(() => connectionOptions({ endpoint: c.url, policyFile: join(clone, 'orders.connection.json'), localFile: join(clone, 'absent'), env: {} }), fail('INVALID_CONNECTION_POLICY'));
});
test('remote report made after local claim is visible with same task token and version', async t => {
  const c = await central(t), serverWorker = new RemoteOrderClient({ endpoint: c.url, ledgerId: c.ledgerId }); let o = await c.client.create(input());
  o = await c.client.mutate(o.id, { requestId: randomUUID(), version: o.version, action: 'claim', taskId: 'T1', actor: 'codex' });
  const packet = await serverWorker.packet(o.id, 'T1'); assert.equal(packet.orderId, o.id); assert.equal(JSON.stringify(packet).includes(o.tasks[0].lease.token), false);
  o = await serverWorker.mutate(o.id, { requestId: randomUUID(), version: o.version, action: 'report', taskId: 'T1', actor: 'codex', token: o.tasks[0].lease.token, revision: o.revision, summary: '서버 작업 결과', evidence: ['github:repo/commit/test'] });
  const readback = await c.client.show(o.id); assert.equal(readback.order.status, 'REVIEW'); assert.equal(readback.events.at(-1).type, 'REPORT');
});

test('GitHub reference recording is explicit, minimal and never marks the order complete', async t => {
  const c = await central(t), o = await c.client.create(input());
  const args = { client: c.client, orderId: o.id, taskId: 'T1', repository: 'freepass-creator/ai-core', commit: 'a'.repeat(40), runId: '1234', attempt: '1', checkStatus: 'success', commandFile: join(c.dir, 'retry.json') };
  const inspected = await recordRun(args); assert.equal(inspected.recorded, false); assert.equal(c.store.events(o.id).length, 1);
  const recorded = await recordRun({ ...args, recordResult: true });
  assert.equal(recorded.recorded, true); assert.equal(recorded.orderCompleted, false); assert.equal(recorded.checkedRequirementRevision, null);
  assert.equal(c.store.get(o.id).status, 'NEW'); assert.equal(c.store.events(o.id).length, 2);
  assert.equal(JSON.stringify(recorded).includes(o.intent), false);
  await recordRun({ ...args, recordResult: true }); assert.equal(c.store.events(o.id).length, 2);
  await assert.rejects(recordRun({ ...args, repository: 'someone/other-project' }), /project does not match/);
  await assert.rejects(recordRun({ ...args, repository: 'someone/ai-core' }), /project does not match/);
  const context = await c.client.checkContext(o.id, 'T1'); assert.equal('intent' in context, false); assert.equal('criteria' in context, false);
});

test('GitHub recording fails safely if the order changed after context lookup', async t => {
  const c = await central(t), o = await c.client.create(input());
  const raced = { ledgerId: c.ledgerId, checkContext: async (...args) => { const context = await c.client.checkContext(...args); await c.client.mutate(o.id, { requestId: randomUUID(), version: o.version, action: 'note', note: 'concurrent user update' }); return context; }, mutate: (...args) => c.client.mutate(...args) };
  await assert.rejects(recordRun({ client: raced, orderId: o.id, taskId: 'T1', repository: 'freepass-creator/ai-core', commit: 'b'.repeat(40), runId: '1235', attempt: '1', checkStatus: 'failure', recordResult: true, commandFile: join(c.dir, 'raced.json') }), fail('STALE_VERSION'));
  assert.equal(c.store.events(o.id).length, 2); assert.ok(existsSync(join(c.dir, 'raced.json')));
});

test('server mode, saved device pin and response identity fail closed', async t => {
  const c = await central(t);
  assert.throws(() => startServer({ dbPath: join(c.dir, 'implicit.sqlite'), port: 0 }), fail('SERVER_MODE_REQUIRED'));
  assert.equal(existsSync(join(c.dir, 'implicit.sqlite')), false);
  const localFile=join(c.dir,'connection.json'), policyFile=join(c.dir,'policy.json');
  writeFileSync(localFile, JSON.stringify({endpoint:c.url,ledgerId:`ledger-${randomUUID()}`}));
  writeFileSync(policyFile, JSON.stringify({schema:'ai-core-connection/v1',mode:'shared-required',transport:'ssh-loopback',ledgerId:c.ledgerId}));
  assert.throws(() => connectionOptions({env:{},localFile,policyFile}),fail('LEDGER_MISMATCH'));
  assert.equal(connectionOptions({endpoint:c.url,env:{},localFile,policyFile}).ledgerId,c.ledgerId);
  writeFileSync(policyFile,JSON.stringify({ledgerId:c.ledgerId}));
  assert.throws(() => readConnectionPolicy(policyFile),fail('INVALID_CONNECTION_POLICY'));
  const missing=new RemoteOrderClient({endpoint:c.url,ledgerId:c.ledgerId,fetchImpl:async()=>new Response('{}')});
  await assert.rejects(missing.meta(),fail('LEDGER_MISMATCH'));
});

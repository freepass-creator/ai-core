import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { OrderStore } from '../src/orders/store.mjs';
import { startServer } from '../src/orders/server.mjs';

const input = (extra = {}) => ({ requestId: randomUUID(), title: '공통 오더', intent: '같은 업무를 다른 AI와 이어서 처리한다.', project: 'ai-core', kind: 'general', criteria: ['재시작 뒤 같은 기록을 복구한다.'], ...extra });
const command = (order, action, extra = {}) => ({ requestId: randomUUID(), version: order.version, action, ...extra });
function fixture(t, options) { const s = new OrderStore(':memory:', options); t.after(() => s.close()); return s; }
function claim(s, o, taskId = 'T1', assigned = 'codex') { return s.mutate(o.id, command(o, 'claim', { taskId, actor: assigned })); }
function report(s, o, taskId = 'T1') { const t = o.tasks.find(t => t.id === taskId); return s.mutate(o.id, command(o, 'report', { taskId, actor: t.assigned, token: t.lease.token, revision: o.revision, summary: '검증 결과 기록', evidence: ['test:recovery PASS'] })); }
function fails(code) { return e => e.code === code; }

test('retry is durable across reopen; altered payload cannot reuse intake key', t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-test-'));
  const path = join(dir, 'orders.sqlite'), req = input(); let s = new OrderStore(path); const first = s.create(req); s.close();
  s = new OrderStore(path); t.after(() => { s.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.deepEqual(s.create(req), first); assert.equal(s.list().length, 1); assert.equal(s.events(first.id).length, 1);
  assert.throws(() => s.create({ ...req, title: '다른 오더' }), fails('IDEMPOTENCY_CONFLICT'));
});
test('same order serializes writers; stale command and failed transaction preserve records', t => {
  const s = fixture(t); const o = s.create(input()); const c = command(o, 'claim', { taskId: 'T1', actor: 'codex' }); const current = s.mutate(o.id, c);
  assert.deepEqual(s.mutate(o.id, c), current);
  assert.throws(() => s.mutate(o.id, command(o, 'note', { note: '늦은 쓰기' })), fails('STALE_VERSION'));
  assert.throws(() => s.mutate(o.id, command(current, 'note', { note: '' })), fails('INVALID_INPUT'));
  assert.equal(s.events(o.id).length, 2); assert.equal(s.get(o.id).version, 2);
});
test('expired worker cannot overwrite replacement and a second claim cannot run concurrently', t => {
  let now = Date.now(); const s = fixture(t, { now: () => now, leaseMs: 1000 }); let o = claim(s, s.create(input())); const old = o.tasks[0].lease.token;
  assert.throws(() => claim(s, o), fails('ACTIVE_LEASE'));
  now += 1001; o = claim(s, o);
  assert.throws(() => s.mutate(o.id, command(o, 'report', { taskId: 'T1', actor: 'codex', token: old, revision: 1, summary: '늦은 결과', evidence: ['old'] })), fails('STALE_LEASE'));
  assert.equal(s.get(o.id).tasks[0].attempt, 2);
});
test('heartbeat extends owned lease, blocked work can be reassigned, actor mismatch fails', t => {
  let now = Date.now(); const s = fixture(t, { now: () => now, leaseMs: 1000 }); let o = claim(s, s.create(input())); const token = o.tasks[0].lease.token;
  now += 900; o = s.mutate(o.id, command(o, 'heartbeat', { taskId: 'T1', actor: 'codex', token }));
  now += 200; o = s.mutate(o.id, command(o, 'block', { taskId: 'T1', actor: 'codex', token, reason: '도구 한도' })); assert.equal(o.status, 'BLOCKED');
  // codex -> claude 인계. 둘 다 MAIN 이고 실제로 서로 이어받는 갈래다.
  o = s.mutate(o.id, command(o, 'assign', { taskId: 'T1', actor: 'claude', reason: '코드 검토 인계' }));
  assert.throws(() => claim(s, o), fails('WRONG_ACTOR'));
  o = claim(s, o, 'T1', 'claude'); assert.equal(o.tasks[0].assigned, 'claude');
});
test('revision invalidates reports and claims; historical results survive in events', t => {
  const s = fixture(t); let o = report(s, claim(s, s.create(input()))); assert.equal(o.status, 'REVIEW');
  o = s.mutate(o.id, command(o, 'revise', { intent: '모바일도 검증', criteria: ['모바일 확인'], reason: '사용자 추가 요청' }));
  assert.equal(o.revision, 2); assert.equal(o.status, 'NEW'); assert.equal(o.tasks[0].report, null); assert.ok(s.events(o.id).some(e => e.type === 'REPORT' && e.detail.report.summary));
  assert.throws(() => s.mutate(o.id, command(o, 'close', { confirmed: true, revision: 2, note: 'old proof' })), fails('EVIDENCE_REQUIRED'));
  o = claim(s, o); assert.throws(() => s.mutate(o.id, command(o, 'report', { taskId: 'T1', actor: 'codex', token: o.tasks[0].lease.token, revision: 1, summary: 'old', evidence: ['old'] })), fails('STALE_EVIDENCE'));
});
test('dependency order and completion gate distinguish result claim from user acceptance', t => {
  const s = fixture(t); let o = s.create(input({ kind: 'development' }));
  assert.throws(() => claim(s, o, 'T2'), fails('DEPENDENCY_PENDING'));
  for (const task of o.tasks) o = report(s, claim(s, o, task.id, task.assigned), task.id);
  assert.equal(o.status, 'REVIEW'); assert.equal(o.closure, null);
  assert.throws(() => s.mutate(o.id, command(o, 'close', { confirmed: false, revision: o.revision, note: 'unconfirmed' })), fails('CONFIRMATION_REQUIRED'));
  assert.throws(() => s.mutate(o.id, command(o, 'close', { confirmed: true, revision: o.revision, note: 'missing coverage' })), fails('CRITERIA_COVERAGE_REQUIRED'));
  o = s.mutate(o.id, command(o, 'close', { confirmed: true, revision: o.revision, note: '사용자가 근거와 완료 조건 대조', checks: [{ criterion: 0, taskId: 'T2', evidenceIndex: 0 }] }));
  assert.equal(o.status, 'REVIEW'); assert.equal(o.closure.kind, 'USER_ACCEPTED_NOT_CANONICAL');
  o = s.mutate(o.id, command(o, 'revise', { intent: '새 요청', criteria: ['새 조건'], reason: '요구 변경' }));
  assert.equal(o.closure, null);
  assert.ok(s.events(o.id).some(e => e.type === 'CLOSE'));
});
test('empty evidence rejected and cancelled order cannot accept late worker', t => {
  const s = fixture(t); let o = claim(s, s.create(input())); const token = o.tasks[0].lease.token;
  assert.throws(() => s.mutate(o.id, command(o, 'report', { taskId: 'T1', actor: 'codex', token, revision: 1, summary: 'claim', evidence: [] })), fails('INVALID_INPUT'));
  o = s.mutate(o.id, command(o, 'cancel', { reason: '사용자 취소' })); assert.equal(o.tasks[0].lease, null);
  assert.throws(() => s.mutate(o.id, command(o, 'heartbeat', { taskId: 'T1', actor: 'codex', token })), fails('TERMINAL_ORDER'));
});
test('common handoff has no execution token or false auto-execution claim', t => {
  const s = fixture(t); const o = claim(s, s.create(input())); const packet = s.packet(o.id, 'T1');
  assert.equal(packet.orderId, o.id); assert.equal(packet.automaticExecution, false);
  assert.equal(JSON.stringify(packet).includes(o.tasks[0].lease.token), false);
  s.name('테스트 이름'); assert.equal(s.settings().name, '테스트 이름'); assert.equal(s.settings().provisional, false);
});

test('handoff preserves old revision results beyond recent event window and exposes expiry', t => {
  let now = Date.now(); const s = fixture(t, { now: () => now, leaseMs: 1000 }); let o = report(s, claim(s, s.create(input())));
  o = s.mutate(o.id, command(o, 'revise', { intent: '새 요구', criteria: ['새 조건'], reason: '사용자 변경' }));
  for (let i = 0; i < 15; i++) o = s.mutate(o.id, command(o, 'note', { note: `메모 ${i}` }));
  o = claim(s, o); now += 1001; const p = s.packet(o.id, 'T1');
  assert.equal(p.events.length, 12); assert.equal(p.recentEventsTruncated, true);
  assert.equal(p.previousResults.length, 0); assert.equal(p.historicalResults[0].requirementRevision, 1); assert.equal(p.historicalResults[0].current, false);
  assert.equal(p.leaseState, 'EXPIRED'); assert.equal(p.nextAction, 'RECLAIM_OR_REASSIGN');
});

test('completion rejects non-existing or mismatched criterion evidence references', t => {
  const s = fixture(t); const o = report(s, claim(s, s.create(input())));
  for (const checks of [[{ criterion: 0, taskId: 'T9', evidenceIndex: 0 }], [{ criterion: 1, taskId: 'T1', evidenceIndex: 0 }], [{ criterion: 0, taskId: 'T1', evidenceIndex: 9 }]]) {
    assert.throws(() => s.mutate(o.id, command(o, 'close', { confirmed: true, revision: 1, note: 'invalid', checks })), fails('CRITERIA_COVERAGE_REQUIRED'));
  }
});
test('two processes sharing SQLite deduplicate simultaneous intake', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-process-')); const path = join(dir, 'orders.sqlite');
  const req = input(); const s = new OrderStore(path); t.after(() => { s.close(); rmSync(dir, { recursive: true, force: true }); });
  const run = () => new Promise((resolve, reject) => {
    const script = `import {OrderStore} from ${JSON.stringify(new URL('../src/orders/store.mjs', import.meta.url).href)}; const s=new OrderStore(${JSON.stringify(path)}); console.log(s.create(${JSON.stringify(req)}).id); s.close();`;
    const child = spawn(process.execPath, ['--input-type=module', '-e', script]); let out = '', error = ''; child.stdout.on('data', c => out += c); child.stderr.on('data', c => error += c); child.on('error', reject); child.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(error)));
  });
  const ids = await Promise.all([run(), run()]); assert.equal(ids[0], ids[1]); assert.equal(s.list().length, 1);
});
test('HTTP and direct CLI store share truth; cross-origin, bad host and malformed writes fail', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-http-'));
  const { server, store, url } = await startServer({ dbPath: join(dir, 'orders.sqlite'), port: 0, standalone: true }); t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  const req = input(); const post = (body, headers = {}) => fetch(`${url}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const first = await (await post(req)).json(); assert.equal(store.get(first.id).intent, req.intent);
  const projection = await (await fetch(`${url}/api/orders/${first.id}/work`)).json();
  assert.equal(projection.status, 'HOLD'); assert.equal(projection.reason, 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE');
  assert.equal(projection.execution_authorized, false);
  assert.equal((await (await fetch(`${url}/api/orders`)).json()).length, 1);
  const routed = await (await fetch(`${url}/api/route?q=${encodeURIComponent('과태료 처리해')}`)).json();
  assert.equal(routed.status, 'RESOLVED'); assert.equal(routed.work_type_id, 'penalty-processing'); assert.equal(routed.target_project_id, 'aiops');
  const heldRoute = await (await fetch(`${url}/api/route?q=${encodeURIComponent('보고서 만들어')}`)).json();
  assert.equal(heldRoute.status, 'HOLD_PROJECT_HOLD'); assert.equal(heldRoute.target_project_id, 'docshub');
  const unknownRoute = await (await fetch(`${url}/api/route?q=${encodeURIComponent('달에서 감자 키우기')}`)).json();
  assert.equal(unknownRoute.status, 'UNKNOWN');

  const routedIntake = input({ requestId: randomUUID(), title: '과태료 처리', intent: '과태료 처리해', project: '' });
  const routedOrderResponse = await post(routedIntake);
  assert.equal(routedOrderResponse.status, 200);
  const routedOrder = await routedOrderResponse.json();
  assert.equal(routedOrder.project, 'aiops');

  const heldIntake = input({ requestId: randomUUID(), title: '보고서 제작', intent: '보고서 만들어', project: '' });
  const heldOrderResponse = await post(heldIntake);
  assert.equal(heldOrderResponse.status, 409);
  assert.equal((await heldOrderResponse.json()).error, 'PROJECT_ROUTE_HOLD');

  const explicitProject = input({ requestId: randomUUID(), title: '과태료 참고', intent: '과태료 처리해', project: 'manual-project' });
  const explicitOrder = await (await post(explicitProject)).json();
  assert.equal(explicitOrder.project, 'manual-project');

  assert.equal((await post(req, { Origin: 'https://untrusted.example' })).status, 403);
  const badHostStatus = await new Promise((resolve, reject) => { const r = request(`${url}/api/meta`, { headers: { Host: 'untrusted.example' } }, res => { res.resume(); resolve(res.statusCode); }); r.on('error', reject); r.end(); });
  assert.equal(badHostStatus, 403);
  assert.equal((await post(req, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(null)).status, 400);
  assert.equal((await fetch(`${url}/.local/orders.sqlite`)).status, 404);
  const unicode = input({ title: '한국어 경계 보존' }), bytes = Buffer.from(JSON.stringify(unicode));
  const boundary = bytes.indexOf(Buffer.from('한')) + 1;
  const received = await new Promise((resolve, reject) => {
    const r = request(`${url}/api/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => { let out = ''; res.setEncoding('utf8'); res.on('data', c => out += c); res.on('end', () => resolve(JSON.parse(out))); });
    r.on('error', reject); r.write(bytes.subarray(0, boundary)); setImmediate(() => r.end(bytes.subarray(boundary)));
  });
  assert.equal(received.title, unicode.title);
  const page = await fetch(url); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.match(await page.text(), /오더 등록/);
});

test('projection read failure and concurrent intake changes never return stale work state', async t => {
  let serverFixture;
  const readWorkProjection = async id => {
    if (serverFixture.store.get(id).version === 1) throw new Error('read failed');
    const before = serverFixture.store.get(id);
    serverFixture.store.mutate(id, command(before, 'note', { note: 'concurrent update' }));
    return { status: 'LINKED', mapping: { order_id: id, requirement_revision: before.revision, record_version: before.version } };
  };
  serverFixture = await startServer({ dbPath: ':memory:', port: 0, standalone: true, readWorkProjection });
  const { server, store, url } = serverFixture;
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  const order = store.create(input());
  const read = async () => (await fetch(`${url}/api/orders/${order.id}/work`)).json();
  assert.equal((await read()).reason, 'CANONICAL_READ_FAILED');
  store.mutate(order.id, command(order, 'note', { note: 'next read' }));
  const changed = await read();
  assert.equal(changed.reason, 'PROJECTION_VERSION_CHANGED'); assert.equal(changed.mapping, undefined);
});

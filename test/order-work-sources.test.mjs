// Proves the server's `readWorkProjection` socket is actually filled, and that
// what comes out is HONEST: a missing source must never be reported as an
// absence of linkage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';
import { createWorkProjectionProvider, resolveWorkSourcePaths, defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';

const SUBJECT = createHash('sha1').update('order-work-sources-fixture').digest('hex');
const PROJECT = 'demo-project';
const WORK = 'DEMO-001';

const orderInput = () => ({
  requestId: randomUUID(), title: '원천 배선 확인', intent: '실제 오더 한 건으로 투영을 읽는다.',
  project: 'ai-core', kind: 'general', criteria: ['정직한 상태를 돌려준다.'],
});

const registry = () => ({
  schema_version: '1.1', observed_at: '2026-09-16T00:00:00Z',
  projects: [{
    project_id: PROJECT, name: 'Demo', organization: 'HEADQUARTERS', repository_lifecycle_status: 'ACTIVE', execution_readiness_status: 'ACTIVE',
    mission: 'fixture', repository: 'demo-org/demo-project', default_branch: 'main',
    work_branches: [], local_path: null, head_revision: SUBJECT,
    authoritative_sources: [{ kind: 'GIT', ref: 'demo-org/demo-project', revision: SUBJECT, observed_at: '2026-09-15T23:00:00Z' }],
    commands: { install: 'npm ci', test: 'npm test', build: 'npm run build' },
    deploy_targets: [], required_approvals: [], known_blockers: [],
  }],
});

const snapshot = () => ({
  schema_version: '1.0', as_of: '2026-09-16T00:00:00Z', capacities: [],
  items: [{
    id: WORK, project_id: PROJECT, title: 'fixture work',
    intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
    sources: [{
      ref: 'demo-org/demo-project', revision: SUBJECT, observed_at: '2026-09-15T23:00:00Z',
      valid_until: '2026-09-20T00:00:00Z', status: 'CURRENT', severity: 'ADVISORY',
    }],
    commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
    allocations: [], authorization: { required: true, status: 'PENDING' },
    subject_revision: SUBJECT, evidence_receipts: [],
    verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED',
  }],
});

async function fixtureRoot(t, { omit = [], mappingsFor = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-core-sources-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = {
    registry: join(root, 'registry.json'), snapshot: join(root, 'snapshot.json'),
    mappings: join(root, 'mappings.json'), ledger: join(root, 'work.jsonl'),
  };
  if (!omit.includes('registry')) writeFileSync(paths.registry, JSON.stringify(registry()));
  if (!omit.includes('snapshot')) writeFileSync(paths.snapshot, JSON.stringify(snapshot()));
  if (!omit.includes('mappings')) writeFileSync(paths.mappings, JSON.stringify(mappingsFor ?? []));
  if (!omit.includes('ledger')) {
    await appendLedgerEvent(paths.ledger, {
      event_id: 'SRCEVENT-001', work_id: WORK, project_id: PROJECT, type: 'CREATED',
      from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: SUBJECT,
      observed_at: '2026-09-15T23:30:00Z', evidence_refs: [],
    }, null);
  }
  return { root, paths, workSources: paths };
}

async function serve(t, workSources) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-srv-'));
  const fixture = await startServer({ dbPath: join(dir, 'orders.sqlite'), port: 0, standalone: true, workSources });
  t.after(async () => {
    fixture.server.closeAllConnections();
    await new Promise(done => fixture.server.close(done));
    rmSync(dir, { recursive: true, force: true });
  });
  return fixture;
}

const readWork = (url, id) => fetch(`${url}/api/orders/${id}/work`).then(r => r.json());

test('an unconfigured server keeps answering exactly as before', async (t) => {
  const { url, store } = await serve(t, null);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE');
});

test('★a missing mapping inventory is HOLD, never UNLINKED', async (t) => {
  // The whole point. The adapter answers UNLINKED when the inventory it is given
  // has no row for the order. If an absent file were read as [], every order would
  // be reported UNLINKED — a confident answer manufactured by missing data.
  const { workSources } = await fixtureRoot(t, { omit: ['mappings'] });
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.reason, 'WORK_SOURCE_MISSING_MAPPINGS');
  assert.equal(result.status, 'HOLD');
  assert.equal(result.execution_authorized, false);
});

test('each absent source names itself instead of one blanket reason', async (t) => {
  for (const key of ['registry', 'snapshot', 'ledger']) {
    const { workSources } = await fixtureRoot(t, { omit: [key] });
    const { url, store } = await serve(t, workSources);
    const order = store.create(orderInput());
    assert.equal((await readWork(url, order.id)).reason, `WORK_SOURCE_MISSING_${key.toUpperCase()}`);
  }
});

test('an unreadable source is distinguished from an absent one', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  writeFileSync(paths.mappings, '{ not json');
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNREADABLE_MAPPINGS');
});

test('a mapping inventory that is present but not a list is refused, not coerced', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  writeFileSync(paths.mappings, JSON.stringify({ rows: [] }));
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNREADABLE_MAPPINGS');
});

test('a partially configured policy names the unconfigured key', async (t) => {
  // Not `ledger`: that one has a settled convention and is filled from the order
  // DB's directory. The sources with no canonical home must still be named.
  const { workSources } = await fixtureRoot(t);
  const partial = { ...workSources };
  delete partial.snapshot;
  const { url, store } = await serve(t, partial);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNCONFIGURED_SNAPSHOT');
});

test('a complete inventory with no row for this order is honestly UNLINKED', async (t) => {
  const { workSources } = await fixtureRoot(t, { mappingsFor: [] });
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'UNLINKED');
  assert.equal(result.execution_authorized, false);
});

test('★a real order with a real mapping reads LINKED through the real server', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  writeFileSync(paths.mappings, JSON.stringify([{
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  }]));
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'LINKED');
  assert.equal(result.canonical_state, 'RECEIVED');
  assert.equal(result.mapping.work_id, WORK);
  // Read-only means read-only: reading never grants anything.
  assert.equal(result.execution_authorized, false);
  assert.equal(result.completion_authorized, false);
  assert.equal(result.sent, false);
});

test('resolveWorkSourcePaths reports the first unconfigured key and never invents one', () => {
  assert.equal(resolveWorkSourcePaths(null), null);
  assert.equal(resolveWorkSourcePaths({ registry: 'a.json' }).missing, 'snapshot');
  assert.equal(createWorkProjectionProvider({ store: {}, workSources: null }), null);
});

test('★the operating ledger defaults to the order store’s own directory', async (t) => {
  const { workSources, paths, root } = await fixtureRoot(t);
  const withoutLedger = { ...workSources };
  delete withoutLedger.ledger;

  // Configured without a ledger, but told where the order DB is: the convention
  // fills it in, and the resolved path sits beside that DB — never somewhere else.
  const dbPath = join(root, 'nested', 'orders.sqlite');
  const resolved = resolveWorkSourcePaths(withoutLedger, { ordersDbPath: dbPath });
  assert.equal(resolved.paths.ledger, join(root, 'nested', 'work-ledger.jsonl'));
  assert.equal(defaultWorkLedgerPath(dbPath), resolved.paths.ledger);

  // With no order DB to anchor to, it stays unconfigured rather than guessing.
  assert.equal(resolveWorkSourcePaths(withoutLedger).missing, 'ledger');

  // An explicitly configured ledger still wins over the convention.
  assert.equal(resolveWorkSourcePaths(workSources, { ordersDbPath: dbPath }).paths.ledger, paths.ledger);
});

test('a server given no ledger path reads the one beside its own database', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-srv-'));
  const { workSources, paths } = await fixtureRoot(t);
  const withoutLedger = { ...workSources };
  delete withoutLedger.ledger;

  const dbPath = join(dir, 'orders.sqlite');
  copyFileSync(paths.ledger, join(dir, 'work-ledger.jsonl'));
  const boot = await startServer({ dbPath, port: 0, standalone: true, workSources: withoutLedger });
  t.after(async () => {
    boot.server.closeAllConnections();
    await new Promise(done => boot.server.close(done));
    rmSync(dir, { recursive: true, force: true });
  });

  const order = boot.store.create(orderInput());
  writeFileSync(paths.mappings, JSON.stringify([{
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  }]));
  const result = await readWork(boot.url, order.id);
  assert.equal(result.status, 'LINKED');
  assert.equal(result.canonical_state, 'RECEIVED');
});

const BINDING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS coordination_bindings (
    order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL, work_id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL, subject_revision TEXT NOT NULL, requirement_digest TEXT NOT NULL,
    created_record_version INTEGER NOT NULL, command_id TEXT UNIQUE NOT NULL, event_id TEXT UNIQUE NOT NULL,
    PRIMARY KEY(order_id,requirement_revision));`;

test('★with no mapping table at all the server says MISSING, not UNLINKED', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  // Nothing has ever produced a binding in this deployment. "I do not know" is
  // the only honest answer; UNLINKED would be a conclusion drawn from no data.
  assert.equal(result.reason, 'WORK_SOURCE_MISSING_MAPPINGS');
  assert.equal(result.status, 'HOLD');
});

test('★a binding in the order database reaches LINKED with no mappings path configured', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());

  store.db.exec(BINDING_SCHEMA);
  store.db.prepare('INSERT INTO coordination_bindings VALUES (?,?,?,?,?,?,?,?,?)')
    .run(order.id, order.revision, WORK, PROJECT, SUBJECT, 'digest', order.version, 'CMD-1', 'EVENT-001');

  const result = await readWork(url, order.id);
  assert.equal(result.status, 'LINKED', JSON.stringify(result));
  assert.equal(result.mapping.work_id, WORK);
  assert.equal(result.execution_authorized, false);
});

test('an empty binding table is honestly UNLINKED, unlike an absent one', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());
  store.db.exec(BINDING_SCHEMA);
  assert.equal((await readWork(url, order.id)).status, 'UNLINKED');
});

// ★방향이 배선에 «실제로» 걸려 있는가 — 걸어만 두고 안 불리면 창고에 쌓은 것이다.
// 2026-09-17 에 내가 만든 모듈 셋이 부르는 곳 0개였다. 그 병을 여기서 닫는다.
import { writeFileSync as 쓰기, mkdirSync as 폴더만들기 } from 'node:fs';
import { 방향적용 } from '../src/integration/direction.mjs';

test('★서명 안 된 방향은 아무것도 바꾸지 않는다 — 초안은 죽어 있다', async (t) => {
  const 초안 = { id: 'DIR-T', 적용: { project_id: PROJECT }, 주인: '대표',
    허가: { action: 'a', target: 't', scope: ['read'], 유효시간: 24 },
    세운이: '', 세운때: '', 만료: '' };
  const r = 방향적용({ 항목: snapshot().items[0], 방향들: [초안], asOf: '2026-09-16T00:00:00Z' });
  assert.equal(r.막힘, 'DIRECTION_AUTHOR_REQUIRED');
  assert.equal(r.항목.intent.status, 'INFERRED');
});

test('★서명하면 같은 배선으로 흐른다 — /work 가 LINKED 로 바뀐다', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  쓰기(paths.mappings, JSON.stringify([{
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  }]));
  const 전 = await readWork(url, order.id);
  assert.equal(전.status, 'LINKED');
  // 방향이 없을 때는 컨트롤타워가 HOLD 다 — 선언이 하나도 없으니 당연하다.
  assert.equal(전.control_status, 'HOLD');
  assert.equal(전.execution_authorized, false);
});

// ★★GPT_REVIEW(2026-09-17 22:03 KST)가 잡은 구멍을 닫는다.
//
//   「테스트 이름은 «서명하면 같은 배선으로 흐른다»인데, 실제 본문은 방향을 서명하거나
//     directions 파일을 쓰지 않는다. 기존 fixture로 /work를 한 번 읽고 HOLD만 확인하고 끝난다」
//
//   정확한 지적이다. 이름이 약속한 것을 검사가 안 했다 — 내가 하루 종일 남의 코드에서
//   잡던 바로 그 병이다. 아래는 «서명된 실제 방향 → production provider → 서버 /work →
//   컨트롤타워 READY» 한 줄 전체를 지난다. direction 을 직접 부르지 않는다.
//
//   ★쓰는 것은 «저장소의 실제 registry/directions.json» 이다. 고정물이 아니다.
//     그래서 대표가 서명을 거두면 이 검사가 빨개진다 — 그것이 옳다.

const AIOPS = 'aiops';

/** 실제 registry 의 aiops head_revision 을 쓴다 — 지어내면 SUBJECT_REVISION_STALE 로 막힌다. */
async function aiops레비전() {
  const { readFile } = await import('node:fs/promises');
  const r = JSON.parse(await readFile(new URL('../registry/projects.json', import.meta.url)));
  return r.projects.find((p) => p.project_id === AIOPS).head_revision;
}

const 과태료항목 = (id, rev, asOf) => ({
  id, project_id: AIOPS, title: '과태료 한 판',
  intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
  sources: [{ ref: 'freepass-creator/aiops', revision: rev,
    observed_at: new Date(Date.parse(asOf) - 3600_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    valid_until: new Date(Date.parse(asOf) - 3600_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    status: 'CURRENT', severity: 'MATERIAL' }],
  commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
  allocations: [], authorization: { required: true, status: 'PENDING' },
  subject_revision: rev, evidence_receipts: [],
  verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED',
});

async function 과태료판(t, workId, { 승인적기 = true } = {}) {
  const rev = await aiops레비전();
  const asOf = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const { readFile } = await import('node:fs/promises');
  const root = mkdtempSync(join(tmpdir(), 'ai-core-dir-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = { registry: join(root, 'registry.json'), snapshot: join(root, 'snapshot.json'),
    mappings: join(root, 'mappings.json'), ledger: join(root, 'work.jsonl') };
  // ★registry 는 저장소의 «진짜» 것을 쓴다.
  쓰기(paths.registry, await readFile(new URL('../registry/projects.json', import.meta.url), 'utf8'));
  // ★방향은 registry «옆» 에서 읽는다 — 저장소의 진짜 방향 파일을 그 자리에 둔다.
  쓰기(join(root, 'directions.json'), await readFile(new URL('../registry/directions.json', import.meta.url), 'utf8'));
  쓰기(paths.snapshot, JSON.stringify({ schema_version: '1.0', as_of: asOf, capacities: [],
    items: [과태료항목(workId, rev, asOf)] }));
  const 첫머리 = await appendLedgerEvent(paths.ledger, {
    event_id: 'DIREVENT-001', work_id: workId, project_id: AIOPS, type: 'CREATED',
    from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: rev,
    observed_at: new Date(Date.parse(asOf) - 3600_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    evidence_refs: [] }, null);

  /** ★★방향의 «승인근거» 를 원장에 적는다 — 이것이 없으면 방향은 정책 후보일 뿐이다.
   *
   *  GPT 검토: 「direction 파일의 내용만으로 사람 승인으로 승격하면 안 된다」.
   *  registry/directions.json 의 DIR-과태료 가 가리키는 사건이 바로 이 줄이고,
   *  운영에서도 같은 id 로 .local/work-ledger.jsonl 에 적혀 있다.
   *  ★RECEIVED 증거가 승인의 꼴이다 — 「사람이 말해 준 것」. */
  if (승인적기) {
    await appendLedgerEvent(paths.ledger, {
      event_id: 'DIRAPPROVAL-001', work_id: 'DIRECTION-001', project_id: AIOPS, type: 'CREATED',
      from_state: null, to_state: 'RECEIVED', actor: 'CLAUDE', subject_revision: rev,
      observed_at: new Date(Date.parse(asOf) - 1800_000).toISOString().replace(/\.\d+Z$/, 'Z'),
      evidence_refs: ['RECEIVED:「과태료만 켜라 만료 1년」 @대표 2026-09-17 대화'],
    }, 첫머리.head);
  }
  const { url, store } = await serve(t, paths);
  const order = store.create(orderInput());
  쓰기(paths.mappings, JSON.stringify([{ order_id: order.id, requirement_revision: order.revision,
    record_version: order.version, work_id: workId, project_id: AIOPS, subject_revision: rev }]));
  return readWork(url, order.id);
}

test('★★서명된 과태료 방향이 «운영 경로»에서 사람 선언을 모두 푼다', async (t) => {
  const r = await 과태료판(t, 'GWATAERYO-001');
  assert.equal(r.status, 'LINKED', JSON.stringify(r));

  /** ★여기가 GPT 가 「비었다」고 지적한 자리다. 이름이 약속한 것을 실제로 검사한다.
   *
   *  방향이 운영 경로에서 «푸는» 것은 사람이 선언해야 했던 넷이다. 그 넷이 전부
   *  사라졌는지를 본다 — 하나라도 남으면 방향이 안 걸린 것이다. */
  const 막는이유 = r.control_result.execute.reasons;
  for (const 선언 of ['CONTROLLING_INTENT_UNCONFIRMED', 'COMMITMENT_NOT_ACTIVE',
    'COMMITMENT_CONTROL_INCOMPLETE', 'AUTHORIZATION_REQUIRED', 'MATERIAL_OBSERVATION_EXPIRED']) {
    assert.ok(!막는이유.includes(선언), `방향이 ${선언} 을 못 풀었다: ${막는이유.join(', ')}`);
  }

  /** ★★그런데 READY 는 «아니다». 남는 것은 WORK_STATE_RECEIVED 하나다.
   *
   *  이것은 결함이 아니라 «방향이 넘지 못하는 경계» 다. 「이 일이 어디까지 갔나」는
   *  원장이 말하는 사실이지 대표가 미리 정할 수 있는 방향이 아니다. 방향이 그것까지
   *  열면 «일을 안 했는데 다 한 것으로» 만들 수 있다.
   *  ★그래서 여기서 READY 를 기대하지 않는다. 기대하면 그 경계를 허무는 검사가 된다. */
  assert.deepEqual(막는이유, ['WORK_STATE_RECEIVED']);
  assert.equal(r.control_status, 'HOLD');

  // ★위쪽 투영은 여전히 권한을 주지 않는다 — adapter 경계는 그대로다.
  assert.equal(r.execution_authorized, false);
  assert.equal(r.completion_authorized, false);
});

test('★★같은 프로젝트라도 방향 밖이면 «그대로 막힌다»', async (t) => {
  const r = await 과태료판(t, 'MISU-001');
  assert.equal(r.status, 'LINKED');
  // 「과태료만 켜라」 가 지켜지는지를 «운영 경로에서» 본다.
  assert.equal(r.control_status, 'HOLD');
  assert.equal(r.control_result.execute.enabled, false);
  assert.ok(r.control_result.execute.reasons.includes('CONTROLLING_INTENT_UNCONFIRMED'));
});

test('★★승인근거가 원장에 «없으면» 서명된 방향도 안 선다 — 파일만 고쳐서는 권한이 안 생긴다', async (t) => {
  /** GPT 검토(2026-09-17)가 가리킨 빈 자리: 세운이:'대표' 는 문자열일 뿐이라
   *  directions.json 을 고칠 수 있는 자는 누구나 자기에게 권한을 써 줄 수 있었다.
   *  ★위 판과 «똑같은 서명된 방향» 인데 원장의 승인 사건 한 줄만 뺀다.
   *    그것만으로 사람 선언이 전부 되살아나야 한다. */
  const r = await 과태료판(t, 'GWATAERYO-001', { 승인적기: false });
  assert.equal(r.status, 'LINKED');
  assert.equal(r.control_status, 'HOLD');
  const 막는이유 = r.control_result.execute.reasons;
  for (const 선언 of ['CONTROLLING_INTENT_UNCONFIRMED', 'COMMITMENT_NOT_ACTIVE', 'AUTHORIZATION_REQUIRED']) {
    assert.ok(막는이유.includes(선언), `승인근거 없이 ${선언} 이 풀렸다: ${막는이유.join(', ')}`);
  }
});

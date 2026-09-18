// REOBSERVED — 프로젝트가 앞서 나가도 일감이 «증거와 함께» 따라갈 수 있게 한다.
//
// ★2026-09-18 벽: 묶음은 수정·삭제 불가(트리거)이고 한 일감은 한 번만 묶인다. 판정은
//   「등록부 head = 스냅샷 = 원장 = 묶음」 넷이 같아야 했다. 그래서 aiops 에 커밋이 하나
//   들어오면 그 묶음은 «영원히» SUBJECT_REVISION_STALE 였다 — 다시 묶을 길이 없었다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendLedgerEvent, verifyLedgerText, REOBSERVABLE } from '../scripts/work-ledger.mjs';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { startServer } from '../src/orders/server.mjs';

const rev = (s) => createHash('sha1').update(s).digest('hex');
const A = rev('A'); const B = rev('B'); const C = rev('C');
const PROJECT = 'demo-project';
const WORK = 'DEMO-001';

const 원장만들기 = async (dir, 사건들) => {
  const 길 = join(dir, 'work.jsonl');
  let head = null;
  for (const [i, e] of 사건들.entries()) {
    head = (await appendLedgerEvent(길, { event_id: `EV-${String(i + 1).padStart(3, '0')}`, work_id: WORK, project_id: PROJECT,
      actor: 'TEST', observed_at: `2026-09-18T0${i}:00:00Z`, evidence_refs: [], ...e }, head)).head;
  }
  return { 길, 글: readFileSync(길, 'utf8'), head };
};
const 만들 = { type: 'CREATED', from_state: null, to_state: 'RECEIVED', subject_revision: A };
const 재관측 = (s, r, ev = ['MEASURED:compare A...B ahead 3 @gh api']) => ({ type: 'REOBSERVED', from_state: s, to_state: s, subject_revision: r, evidence_refs: ev });
const 옮김 = (f, t, r = A) => ({ type: 'TRANSITIONED', from_state: f, to_state: t, subject_revision: r });

/** append 는 검증을 통과한 줄만 쓴다 — 거절 코드를 받는다. */
const 거절코드 = async (t, 사건들) => {
  const dir = mkdtempSync(join(tmpdir(), 'reobs-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  try { await 원장만들기(dir, 사건들); return null; } catch (e) { return e.message; }
};

test('REOBSERVED — 상태는 그대로, 리비전만 증거와 함께 옮기고 이력이 남는다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'reobs-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { 글 } = await 원장만들기(dir, [만들, 재관측('RECEIVED', B), 옮김('RECEIVED', 'PLANNED', B), 재관측('PLANNED', C)]);
  const r = verifyLedgerText(글);
  assert.equal(r.status, 'VALID');
  assert.deepEqual(r.work[WORK], { state: 'PLANNED', project_id: PROJECT, subject_revision: C, revisions: [A, B, C] });
});

test('★REOBSERVED 반례 — 상태를 못 옮기고, 증거 없이·같은 리비전·검증 뒤에는 못 쓴다', async (t) => {
  assert.equal(await 거절코드(t, [만들, { ...재관측('RECEIVED', B), to_state: 'PLANNED' }]), 'FROM_STATE_MISMATCH', '재관측으로 걸음을 건너뛰면 안 된다');
  assert.equal(await 거절코드(t, [만들, 재관측('RECEIVED', B, [])]), 'REOBSERVE_EVIDENCE_REQUIRED');
  assert.equal(await 거절코드(t, [만들, 재관측('RECEIVED', A)]), 'REOBSERVE_REVISION_UNCHANGED');
  assert.equal(await 거절코드(t, [만들, 재관측('RECEIVED', null)]), 'REOBSERVE_REVISION_UNCHANGED');
  assert.equal(await 거절코드(t, [{ ...재관측('RECEIVED', B), from_state: null }]), 'FROM_STATE_MISMATCH', '없는 일감을 재관측으로 만들 수 없다');
  assert.equal(await 거절코드(t, [만들, { ...재관측('RECEIVED', B), project_id: 'other-project' }]), 'PROJECT_CHANGED');
  /** ★검증한 코드와 다른 코드로 READY 가 옮겨 타면 안 된다 — 그 길은 BLOCKED→VERIFYING 이다. */
  const 검증까지 = [만들, 옮김('RECEIVED', 'PLANNED'), 옮김('PLANNED', 'IN_PROGRESS'), 옮김('IN_PROGRESS', 'VERIFYING')];
  assert.equal(await 거절코드(t, [...검증까지, 재관측('VERIFYING', B)]), 'REOBSERVE_STATE_NOT_ALLOWED');
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'READY'), 재관측('READY', B)]), 'REOBSERVE_STATE_NOT_ALLOWED');
  assert.deepEqual(REOBSERVABLE, ['RECEIVED', 'PLANNED', 'IN_PROGRESS']);
});

/** 실제 원장 검증기로 판정만 따로 본다. 컨트롤타워는 대역 — 이 규칙은 타워보다 앞에 있다.
 *  (실제 타워까지 도는 한 바퀴는 아래 서버 검사가 본다.) */
const 판정 = (ledgerText, { head, item, mappingRev, mappings = null }) => {
  const mapping = { order_id: 'ORD-1', requirement_revision: 1, record_version: 1, work_id: WORK, project_id: PROJECT, subject_revision: mappingRev };
  const context = { order: { id: 'ORD-1', revision: 1, version: 1 }, mappings: mappings ?? [mapping],
    registry: { projects: [{ project_id: PROJECT, status: 'ACTIVE', head_revision: head }] },
    snapshot: { items: [{ id: WORK, project_id: PROJECT, subject_revision: item }] }, ledgerText };
  const 막힘 = { enabled: false, reasons: ['WORK_STATE_RECEIVED'] };
  const adapter = createOrderWorkAdapter({ readContext: async () => context, verifyLedgerText,
    runControlTower: () => ({ status: 'HOLD', execution_authorized: false, ledger_head: verifyLedgerText(ledgerText).head,
      items: [{ id: WORK, project_id: PROJECT, ledger_state: 'RECEIVED', execute: 막힘, close: 막힘 }] }) });
  return { adapter, mapping };
};

test('★판정 — 묶음은 신원만 고정한다. 리비전은 원장 이력 안에 있어야 하고 셋이 지금 값에 맞아야 한다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'reobs-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const 전 = (await 원장만들기(dir, [만들])).글;
  const 후 = (await 원장만들기(mkdtempSync(join(tmpdir(), 'reobs-')), [만들, 재관측('RECEIVED', B)])).글;
  const 읽기 = async (글, o) => (await 판정(글, o).adapter.readWorkProjection('ORD-1'));

  { const r = await 읽기(전, { head: A, item: A, mappingRev: A }); assert.equal(r.status, 'LINKED', `옛날과 같다 ${r.reason}`); }
  assert.equal((await 읽기(전, { head: B, item: A, mappingRev: A })).reason, 'SUBJECT_REVISION_STALE', '프로젝트가 움직이면 선다 — 옛날과 같다');
  assert.equal((await 읽기(후, { head: B, item: A, mappingRev: A })).reason, 'SUBJECT_REVISION_STALE', '재관측했어도 스냅샷이 옛것이면 선다');
  assert.equal((await 읽기(후, { head: A, item: B, mappingRev: A })).reason, 'SUBJECT_REVISION_STALE', '등록부가 옛것이면 선다');
  assert.equal((await 읽기(후, { head: C, item: C, mappingRev: A })).reason, 'SUBJECT_REVISION_STALE', '원장이 거기까지 안 갔으면 선다');
  const 됨 = await 읽기(후, { head: B, item: B, mappingRev: A });
  assert.equal(됨.status, 'LINKED', '★셋이 B 로 맞고 A 가 원장 이력에 있으면 다시 흐른다');
  assert.equal(됨.mapping.subject_revision, A, '묶음은 바뀌지 않는다 — 불변 그대로');
  assert.equal(됨.execution_authorized, false);
  assert.equal((await 읽기(후, { head: B, item: B, mappingRev: C })).reason, 'SUBJECT_REVISION_STALE', '원장이 한 번도 안 본 리비전의 묶음은 인정 안 한다');

  /** 새로 묶을 때는 «지금» 리비전이어야 한다 — 옛 리비전으로 새 묶음을 만들 수 없다. */
  const 새로 = (r) => { const f = 판정(후, { head: B, item: B, mappingRev: r, mappings: [] }); return f.adapter.linkOrder(f.mapping); };
  assert.equal((await 새로(A)).reason, 'SUBJECT_REVISION_STALE');
  assert.equal((await 새로(B)).status, 'LINK_PREPARED');
});

test('★실제 서버 한 바퀴 — 프로젝트 이동 → 멈춤 → 재관측 → 스냅샷 갱신 → 다시 LINKED', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'reobs-srv-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = { registry: join(root, 'registry.json'), snapshot: join(root, 'snapshot.json'), mappings: join(root, 'mappings.json'), ledger: join(root, 'work.jsonl') };
  const 등록부 = (head) => JSON.stringify({ schema_version: '1.0', observed_at: '2026-09-18T00:00:00Z', projects: [{
    project_id: PROJECT, name: 'Demo', organization: 'HEADQUARTERS', status: 'ACTIVE', mission: 'fixture',
    repository: 'demo-org/demo-project', default_branch: 'main', work_branches: [], local_path: null, head_revision: head,
    authoritative_sources: [{ kind: 'GIT', ref: 'demo-org/demo-project', revision: head, observed_at: '2026-09-18T00:00:00Z' }],
    commands: { install: 'npm ci', test: 'npm test', build: 'npm run build' }, deploy_targets: [], required_approvals: [], known_blockers: [] }] });
  const 스냅샷 = (r) => JSON.stringify({ schema_version: '1.0', as_of: '2026-09-18T00:00:00Z', capacities: [], items: [{
    id: WORK, project_id: PROJECT, title: 'fixture', intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
    sources: [{ ref: 'demo-org/demo-project', revision: r, observed_at: '2026-09-18T00:00:00Z', valid_until: '2026-09-20T00:00:00Z', status: 'CURRENT', severity: 'ADVISORY' }],
    commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] }, allocations: [],
    authorization: { required: true, status: 'PENDING' }, subject_revision: r, evidence_receipts: [],
    verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED' }] });
  writeFileSync(paths.registry, 등록부(A));
  writeFileSync(paths.snapshot, 스냅샷(A));
  let head = (await appendLedgerEvent(paths.ledger, { event_id: 'EV-001', work_id: WORK, project_id: PROJECT, actor: 'TEST',
    observed_at: '2026-09-18T00:00:00Z', evidence_refs: [], ...만들 }, null)).head;

  const dir = mkdtempSync(join(tmpdir(), 'reobs-db-'));
  const srv = await startServer({ dbPath: join(dir, 'orders.sqlite'), port: 0, standalone: true, workSources: paths });
  t.after(async () => { srv.server.closeAllConnections(); await new Promise((d) => srv.server.close(d)); rmSync(dir, { recursive: true, force: true }); });
  const order = srv.store.create({ requestId: randomUUID(), title: '재관측', intent: '프로젝트가 움직여도 따라간다.', project: 'ai-core', kind: 'general', criteria: ['다시 흐른다.'] });
  writeFileSync(paths.mappings, JSON.stringify([{ order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: A }]));
  const 읽기 = () => fetch(`${srv.url}/api/orders/${order.id}/work`).then((r) => r.json());

  assert.equal((await 읽기()).status, 'LINKED');
  writeFileSync(paths.registry, 등록부(B));
  assert.equal((await 읽기()).reason, 'SUBJECT_REVISION_STALE', '프로젝트가 움직였다');
  head = (await appendLedgerEvent(paths.ledger, { event_id: 'EV-002', work_id: WORK, project_id: PROJECT, actor: 'TEST',
    observed_at: '2026-09-18T01:00:00Z', ...재관측('RECEIVED', B) }, head)).head;
  assert.equal((await 읽기()).reason, 'SUBJECT_REVISION_STALE', '스냅샷을 다시 뽑기 전에는 선다');
  writeFileSync(paths.snapshot, 스냅샷(B));
  const 됨 = await 읽기();
  assert.equal(됨.status, 'LINKED');
  assert.equal(됨.canonical_state, 'RECEIVED', '재관측은 걸음이 아니다');
  assert.equal(됨.execution_authorized, false);
});

// ── 공급자: work:reobserve 가 «무엇을» 적자고 하나
import { 재관측안 } from '../scripts/work-reobserve.mjs';
import { createWorkRecorder } from '../src/integration/work-recorder.mjs';

const 관측 = (o = {}) => ({ as_of: '2026-09-18T03:00:00Z',
  projects: { [PROJECT]: { status: 'OBSERVED', repository: 'demo-org/demo-project', branch: 'main', head: B, ...o.project } },
  works: [{ work_id: WORK, project_id: PROJECT, bound: A, head: B, status: 'BEHIND_HEAD', ahead_by: 3, files_total: 4, files: ['a.mjs', 'b.mjs', 'c.mjs', 'd.mjs'], ...o.work }] });
const 지금 = new Date('2026-09-18T04:00:00Z');

test('★공급자 — 낡은 관측·못 본 프로젝트·검증 뒤·다른 때의 비교로는 적자고 하지 않는다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'reobs-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { 글 } = await 원장만들기(dir, [만들]);
  const 한 = (관, o = {}) => 재관측안(관, 글, { now: 지금, ...o })[0];
  assert.equal(한(관측(), { now: new Date('2026-09-18T07:00:01Z') }).reason, 'OBSERVATION_STALE');
  assert.equal(한({ ...관측(), as_of: undefined }).reason, 'OBSERVATION_STALE');
  assert.equal(한(관측({ project: { status: 'UNKNOWN' } })).reason, 'PROJECT_UNOBSERVED');
  assert.equal(한(관측({ project: { head: A } })).reason, 'ALREADY_CURRENT');
  assert.equal(한(관측({ work: { head: C } })).reason, 'COMPARISON_MISSING', '다른 head 를 잰 비교는 증거가 아니다');
  assert.equal(한({ ...관측(), works: [] }).reason, 'COMPARISON_MISSING');
  assert.equal(한(관측({ work: { status: 'UNKNOWN', reason: 'REMOTE_UNOBSERVED' } })).reason, 'COMPARISON_UNKNOWN_REMOTE_UNOBSERVED');
  assert.equal(한(관측({ work: { status: 'UNKNOWN', reason: 'REVISION_NOT_IN_PROJECT' } })).reason, 'REVISION_NOT_IN_PROJECT_REQUIRES_REBIND');
  assert.equal(재관측안(관측(), 글, { now: 지금, work: 'NOPE-001' })[0].reason, 'WORK_NOT_IN_LEDGER');
  const 검증 = (await 원장만들기(mkdtempSync(join(tmpdir(), 'reobs-')), [만들, 옮김('RECEIVED', 'PLANNED'), 옮김('PLANNED', 'IN_PROGRESS'), 옮김('IN_PROGRESS', 'VERIFYING')])).글;
  assert.equal(재관측안(관측(), 검증, { now: 지금 })[0].reason, 'STATE_NOT_REOBSERVABLE');
});

test('공급자 — 제안은 잰 것을 그대로 증거로 싣고, 기록기로 적으면 원장이 받는다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'reobs-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const { 길, 글 } = await 원장만들기(dir, [만들]);
  const [안] = 재관측안(관측(), 글, { now: 지금 });
  assert.equal(안.status, 'PROPOSE');
  assert.deepEqual([안.from, 안.to], [A, B]);
  assert.equal(안.증거[0].갈래, 'MEASURED');
  assert.match(안.증거[0].무엇, /BEHIND_HEAD 커밋 3 · 파일 4 \(a\.mjs, b\.mjs, c\.mjs 외 1\)/);
  const [없음] = 재관측안(관측({ work: { status: 'UNKNOWN', reason: 'REVISION_NOT_IN_PROJECT' } }), 글, { now: 지금 });
  assert.deepEqual({ status: 없음.status, reason: 없음.reason },
    { status: 'SKIP', reason: 'REVISION_NOT_IN_PROJECT_REQUIRES_REBIND' });

  await createWorkRecorder({ ledgerPath: 길, actor: 'AI_CORE_REOBSERVER' }).적는다({ work_id: WORK, project_id: PROJECT,
    type: 'REOBSERVED', subject_revision: 안.to, 무엇: '다시 본다', 증거: 안.증거 });
  const r = verifyLedgerText(readFileSync(길, 'utf8'));
  assert.equal(r.status, 'VALID');
  assert.deepEqual([r.work[WORK].state, r.work[WORK].revisions], ['RECEIVED', [A, B]]);
  assert.equal(재관측안(관측(), readFileSync(길, 'utf8'), { now: 지금 })[0].reason, 'ALREADY_CURRENT', '두 번 적지 않는다');
});

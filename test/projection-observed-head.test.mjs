// 운영 투영은 프로젝트 head 를 «더 새로 본» 관측에서 읽는다.
// ★2026-09-18: 커밋된 등록부의 head 는 늘 낡았고, 낡은 값이 «프로젝트가 안 움직였다» 로 읽혔다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { 새head입히기 } from '../src/integration/landed-observer.mjs';
import { validateProjectRegistry } from '../scripts/validate-project-registry.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';
import { startServer } from '../src/orders/server.mjs';

const rev = (s) => createHash('sha1').update(s).digest('hex');
const A = rev('A'); const B = rev('B');
const PROJECT = 'demo-project';
const REPO = 'demo-org/demo-project';
const WORK = 'DEMO-001';

const 등록부 = (head = A, observed = '2026-09-18T00:00:00Z') => ({ schema_version: '1.0', observed_at: observed, projects: [{
  project_id: PROJECT, name: 'Demo', organization: 'HEADQUARTERS', status: 'ACTIVE', mission: 'fixture',
  repository: REPO, default_branch: 'main', work_branches: [], local_path: null, head_revision: head,
  authoritative_sources: [{ kind: 'GIT', ref: REPO, revision: head, observed_at: observed }],
  commands: { install: 'npm ci', test: 'npm test', build: 'npm run build' }, deploy_targets: [], required_approvals: [], known_blockers: [] }] });
const 관측 = (o = {}) => ({ as_of: '2026-09-18T05:00:00Z', projects: { [PROJECT]: {
  status: 'OBSERVED', repository: REPO, branch: 'main', head: B, until: '2026-09-18T05:00:00Z', ...o } }, works: [], commits: [] });

test('★더 새로 본 쪽을 쓴다 — 원천까지 같이 바꿔 등록부 검증이 그대로 선다', () => {
  const r = 새head입히기(등록부(), 관측());
  assert.equal(r.registry.projects[0].head_revision, B);
  assert.deepEqual(r.입힘, [{ project_id: PROJECT, from: A, to: B, observed_at: '2026-09-18T05:00:00Z' }]);
  assert.deepEqual(r.registry.projects[0].authoritative_sources[0], { kind: 'GIT', ref: REPO, revision: B, observed_at: '2026-09-18T05:00:00Z' });
  assert.equal(validateProjectRegistry(r.registry).status, 'VALID');
  assert.equal(등록부().projects[0].head_revision, A, '받은 등록부는 건드리지 않는다');
});

test('★섞지 않는다 — 옛 관측 · 다른 저장소 · 다른 갈래 · 못 본 것 · 이상한 SHA 는 입히지 않는다', () => {
  for (const [이름, o] of [
    ['등록부보다 옛 관측', { until: '2026-09-17T23:00:00Z' }],
    ['같은 시각', { until: '2026-09-18T00:00:00Z' }],
    ['다른 저장소', { repository: 'other/repo' }],
    ['다른 갈래', { branch: 'feature' }],
    ['못 봄', { status: 'UNKNOWN' }],
    ['SHA 아님', { head: 'not-a-sha' }],
    ['시각 없음', { until: undefined }],
  ]) {
    const r = 새head입히기(등록부(), 관측(o));
    assert.equal(r.registry.projects[0].head_revision, A, 이름);
    assert.deepEqual(r.입힘, [], 이름);
  }
  assert.equal(새head입히기(등록부(), null).registry.projects[0].head_revision, A, '관측이 없으면 예전과 같다');
});

test('★실제 서버 — 등록부만 보면 LINKED 지만, 더 새 관측이 프로젝트가 움직였다고 하면 선다', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'obs-head-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = { registry: join(root, 'registry.json'), snapshot: join(root, 'snapshot.json'), mappings: join(root, 'mappings.json'), ledger: join(root, 'work.jsonl') };
  writeFileSync(paths.registry, JSON.stringify(등록부()));
  writeFileSync(paths.snapshot, JSON.stringify({ schema_version: '1.0', as_of: '2026-09-18T00:00:00Z', capacities: [], items: [{
    id: WORK, project_id: PROJECT, title: 'fixture', intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
    sources: [{ ref: REPO, revision: A, observed_at: '2026-09-18T00:00:00Z', valid_until: '2026-09-20T00:00:00Z', status: 'CURRENT', severity: 'ADVISORY' }],
    commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] }, allocations: [],
    authorization: { required: true, status: 'PENDING' }, subject_revision: A, evidence_receipts: [],
    verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED' }] }));
  await appendLedgerEvent(paths.ledger, { event_id: 'EV-001', work_id: WORK, project_id: PROJECT, type: 'CREATED', from_state: null,
    to_state: 'RECEIVED', actor: 'TEST', subject_revision: A, observed_at: '2026-09-18T00:00:00Z', evidence_refs: [] }, null);

  const dir = mkdtempSync(join(tmpdir(), 'obs-head-db-'));
  const srv = await startServer({ dbPath: join(dir, 'orders.sqlite'), port: 0, standalone: true, workSources: paths });
  t.after(async () => { srv.server.closeAllConnections(); await new Promise((d) => srv.server.close(d)); rmSync(dir, { recursive: true, force: true }); });
  const order = srv.store.create({ requestId: randomUUID(), title: 'head', intent: '관측을 읽는다.', project: 'ai-core', kind: 'general', criteria: ['정직하다.'] });
  writeFileSync(paths.mappings, JSON.stringify([{ order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: A }]));
  const 읽기 = () => fetch(`${srv.url}/api/orders/${order.id}/work`).then((r) => r.json());
  const 관측자리 = join(root, 'landed-observations.json');

  assert.equal((await 읽기()).status, 'LINKED', '관측이 없으면 예전과 같다');
  writeFileSync(관측자리, JSON.stringify(관측({ until: '2026-09-17T12:00:00Z' })));
  assert.equal((await 읽기()).status, 'LINKED', '등록부보다 옛 관측은 쓰지 않는다');
  writeFileSync(관측자리, JSON.stringify(관측()));
  const 선다 = await 읽기();
  assert.equal(선다.reason, 'SUBJECT_REVISION_STALE', '★더 새 관측이 프로젝트가 움직였다고 하면 선다');
  assert.equal(선다.execution_authorized, false);
  writeFileSync(관측자리, '{ broken');
  assert.equal((await 읽기()).reason, 'WORK_SOURCE_UNREADABLE_LANDED', '깨진 관측을 없는 척 넘기지 않는다');
});

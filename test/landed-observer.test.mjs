import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { 관측한다, 최근, 커밋정리 } from '../src/integration/landed-observer.mjs';
import { 글로 } from '../scripts/work-recent.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';

const H = 3600_000;
const NOW = new Date('2026-09-18T03:00:00Z');
const sha = (c) => c.repeat(40);
const 등록부 = { projects: [
  { project_id: 'aiops', repository: 'o/aiops', default_branch: 'main' },
  { project_id: 'fp4', repository: 'o/fp4', default_branch: 'main' },
] };
const 커밋 = (s, 시간전, message = `일 ${s}`) => ({ sha: sha(s), message, author: 'a', committed_at: new Date(NOW.getTime() - 시간전 * H).toISOString() });

/** 가짜 GitHub — 무엇을 물었는지 적어 둔다. */
const 가짜 = ({ heads = {}, commits = {}, compare = {} } = {}) => {
  const 물음 = [];
  return { 물음, gh: {
    head: async (repo, branch) => { 물음.push(['head', repo, branch]); const h = heads[repo]; if (h instanceof Error) throw h; return h; },
    commits: async (repo, branch, since) => { 물음.push(['commits', repo, branch, since]); const c = commits[repo]; if (c instanceof Error) throw c; return c ?? []; },
    compare: async (repo, base, head) => { 물음.push(['compare', repo, base, head]); const c = compare[`${base}...${head}`]; if (c instanceof Error) throw c; return c; },
  } };
};

test('커밋 제목에서 PR 번호를 읽는다 — 없으면 null', () => {
  assert.equal(커밋정리({ sha: sha('a'), message: '고친다 (#407)\n\n본문', committed_at: 'x' }, 'p').pr, 407);
  assert.equal(커밋정리({ sha: sha('a'), message: 'Merge pull request #12 from x/y', committed_at: 'x' }, 'p').pr, 12);
  assert.equal(커밋정리({ sha: sha('a'), message: '#3 이 아니라 그냥 글', committed_at: 'x' }, 'p').pr, null);
  assert.equal(커밋정리({ sha: sha('a'), message: '첫 줄\n(#9)', committed_at: 'x' }, 'p').subject, '첫 줄');
});

test('처음 읽기 — 기본 갈래를 7일 치 읽고, 등록부의 repository·default_branch 로만 묻는다', async () => {
  const f = 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') }, commits: { 'o/aiops': [커밋('a', 2), 커밋('b', 30)], 'o/fp4': [커밋('c', 1)] } });
  const 관 = await 관측한다({ registry: 등록부, gh: f.gh, now: NOW });
  assert.equal(관.projects.aiops.status, 'OBSERVED');
  assert.equal(관.projects.aiops.since, '2026-09-11T03:00:00Z');
  assert.equal(관.projects.aiops.covered_from, '2026-09-11T03:00:00Z');
  assert.deepEqual(관.commits.map((c) => c.sha[0]), ['c', 'a', 'b'], '새것부터');
  assert.ok(f.물음.every(([, repo, branch]) => ['o/aiops', 'o/fp4'].includes(repo) && branch === 'main'));
});

test('이어 읽기 — 본 데서 겹쳐 읽고, 겹친 커밋은 한 번만, 빈틈 없는 시작을 물려받는다', async () => {
  const f1 = 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') }, commits: { 'o/aiops': [커밋('a', 2)] } });
  const 첫 = await 관측한다({ registry: 등록부, gh: f1.gh, now: NOW });
  const 뒤 = new Date(NOW.getTime() + 5 * H);
  const f2 = 가짜({ heads: { 'o/aiops': sha('3'), 'o/fp4': sha('2') }, commits: { 'o/aiops': [커밋('d', -4), 커밋('a', 2)] } });
  const 둘 = await 관측한다({ registry: 등록부, prior: 첫, gh: f2.gh, now: 뒤 });
  assert.equal(f2.물음.find((q) => q[0] === 'commits' && q[1] === 'o/aiops')[3], '2026-09-18T02:00:00Z', '1시간 겹쳐 읽는다');
  assert.equal(둘.commits.filter((c) => c.sha === sha('a')).length, 1);
  assert.equal(둘.projects.aiops.covered_from, 첫.projects.aiops.covered_from);
  assert.equal(최근(둘, { hours: 24, now: 뒤 }).projects[0].complete, true);
});

test('★못 본 프로젝트는 UNKNOWN — 이전 기록을 지우지 않고 어디까지 봤는지도 안 당긴다', async () => {
  const 첫 = await 관측한다({ registry: 등록부, now: NOW,
    gh: 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') }, commits: { 'o/aiops': [커밋('a', 2)], 'o/fp4': [커밋('c', 1)] } }).gh });
  const 뒤 = new Date(NOW.getTime() + 10 * H);
  for (const 실패 of [new Error('HTTP 401 auth'), undefined, 'not-a-sha']) {
    const 둘 = await 관측한다({ registry: 등록부, prior: 첫, now: 뒤,
      gh: 가짜({ heads: { 'o/aiops': 실패, 'o/fp4': sha('2') }, commits: { 'o/fp4': [] } }).gh });
    const p = 둘.projects.aiops;
    assert.equal(p.status, 'UNKNOWN');
    assert.equal(p.reason, 'REMOTE_UNOBSERVED');
    assert.equal(p.until, 첫.projects.aiops.until, 'until 이 앞당겨지면 그 사이가 «본 것» 으로 둔갑한다');
    assert.equal(p.head, sha('1'));
    assert.ok(둘.commits.some((c) => c.sha === sha('a')), '못 봤다고 지우면 「없다」 가 된다');
    assert.equal(둘.projects.fp4.status, 'OBSERVED', '한 곳 실패가 다른 곳을 막지 않는다');
    const 보기 = 최근(둘, { hours: 24, now: 뒤 }).projects.find((x) => x.project_id === 'aiops');
    assert.equal(보기.complete, false);
    assert.match(글로(최근(둘, { hours: 24, now: 뒤 }), { now: 뒤 }), /aiops {2}★UNKNOWN REMOTE_UNOBSERVED — 「없다」 가 아니라 「모른다」/);
  }
});

test('빈틈 — 한 번 못 읽고 보관 기간 밖에서 다시 시작하면 전부라고 말하지 않는다', async () => {
  const 관 = await 관측한다({ registry: 등록부, now: NOW, 처음며칠: 0.5,
    gh: 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') } }).gh });
  const 보기 = 최근(관, { hours: 24, now: NOW });
  assert.ok(보기.projects.every((p) => p.complete === false), '12시간만 읽고 24시간을 다 봤다고 하면 안 된다');
  assert.match(글로(보기, { now: NOW }), /이 수가 전부가 아니다/);
});

test('보관일보다 오래된 커밋은 버리고, 저장소에 등록 안 된 정보는 지어내지 않는다', async () => {
  const 관 = await 관측한다({ registry: { projects: [...등록부.projects, { project_id: 'x' }] }, now: NOW,
    gh: 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') }, commits: { 'o/aiops': [커밋('a', 2), 커밋('b', 24 * 40)] } }).gh });
  assert.deepEqual(관.commits.map((c) => c.sha[0]), ['a']);
  assert.equal(관.projects.x.status, 'UNKNOWN');
  assert.equal(관.projects.x.reason, 'CANONICAL_REF_UNDECLARED');
});

test('원장 일감 — 묶인 리비전 뒤에 들어온 것, 그리고 ★원격에 없는 리비전을 잡는다', async (t) => {
  const 곳 = await mkdtemp(join(tmpdir(), 'landed-')); t.after(() => rm(곳, { recursive: true, force: true }));
  const 원장 = join(곳, 'ledger.jsonl');
  let head = null;
  const 적기 = async (work_id, rev, project_id = 'aiops') => { head = (await appendLedgerEvent(원장, { event_id: `E-${work_id}`, work_id, project_id, type: 'CREATED', from_state: null,
    to_state: 'RECEIVED', actor: 'T', subject_revision: rev, observed_at: '2026-09-18T00:00:00Z', evidence_refs: [] }, head)).head; };
  await 적기('W-001', sha('1'));
  await 적기('W-002', sha('9'));
  await 적기('W-003', sha('8'));
  await 적기('W-004', null);
  await 적기('W-005', sha('2'), 'fp4');
  const f = 가짜({ heads: { 'o/aiops': sha('3'), 'o/fp4': new Error('down') },
    compare: { [`${sha('1')}...${sha('3')}`]: { status: 'ahead', ahead_by: 7, behind_by: 0, files: ['a.mjs', 'b.mjs'] },
      [`${sha('9')}...${sha('3')}`]: new Error('gh: No commit found for SHA: 999 (HTTP 422)'),
      [`${sha('8')}...${sha('3')}`]: { status: 'diverged', ahead_by: 2, behind_by: 1, files: [] } } });
  const 관 = await 관측한다({ registry: 등록부, ledgerText: await readFile(원장, 'utf8'), gh: f.gh, now: NOW });
  const w = Object.fromEntries(관.works.map((x) => [x.work_id, x]));
  assert.deepEqual([w['W-001'].status, w['W-001'].ahead_by, w['W-001'].files], ['BEHIND_HEAD', 7, ['a.mjs', 'b.mjs']]);
  assert.deepEqual([w['W-002'].status, w['W-002'].reason], ['UNKNOWN', 'REVISION_NOT_IN_PROJECT']);
  assert.equal(w['W-003'].status, 'DIVERGED');
  assert.equal(w['W-004'].status, 'UNBOUND');
  assert.deepEqual([w['W-005'].status, w['W-005'].reason], ['UNKNOWN', 'PROJECT_UNOBSERVED']);
  const 글 = 글로(최근(관, { now: NOW }), { now: NOW });
  assert.match(글, /W-001 \(aiops, RECEIVED\) {2}11111111 → 33333333 {2}커밋 7개 뒤 · 파일 2개/);
  assert.match(글, /W-002 .*★UNKNOWN REVISION_NOT_IN_PROJECT \(묶음 99999999\)/);

  const 같음 = await 관측한다({ registry: 등록부, ledgerText: await readFile(원장, 'utf8'), now: NOW,
    gh: 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') } }).gh });
  assert.equal(같음.works.find((x) => x.work_id === 'W-001').status, 'CURRENT');
  assert.equal(같음.works.find((x) => x.work_id === 'W-005').status, 'CURRENT');
});

test('깨진 원장은 읽지 않는다 — 일감을 지어내지 않고 LEDGER_INVALID', async () => {
  const 관 = await 관측한다({ registry: 등록부, ledgerText: '{"not":"a ledger"}\n', now: NOW,
    gh: 가짜({ heads: { 'o/aiops': sha('1'), 'o/fp4': sha('2') } }).gh });
  assert.deepEqual(관.works, [{ status: 'UNKNOWN', reason: 'LEDGER_INVALID' }]);
});

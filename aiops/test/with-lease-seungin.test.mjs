/** ★with-lease 승인 문턱 통합 시험 — OPS-20260831-110
 *
 *  ★모듈 단위가 아니라 «실제로 명령을 돌려» 본다.
 *    문턱이 실제 실행을 막는가 · 대체 검토자로 열리는가 · 긴급으로 열리는가.
 *
 *  ★진짜 `.coordination` 을 안 건드린다 — 자식에게 임시 자리를 물려준다.
 *  ★Drive lease 만 잡고 «아무것도 안 쓰는» 명령을 돌린다. 라이브 변경 0건.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const 돌린다 = promisify(execFile);
const 자리 = await mkdtemp(join(tmpdir(), 'withlease-'));
const 환경 = { ...process.env, AIOPS_COORDINATION_DIR: 자리 };

const 계획길 = join(자리, '계획.json');
const 대상길 = join(자리, '대상.json');
const 양식길 = join(자리, '양식.html');
await writeFile(계획길, JSON.stringify({ 관청: '평택시', 건수: 2 }), 'utf8');
await writeFile(대상길, JSON.stringify(['file-1', 'file-2']), 'utf8');
await writeFile(양식길, '<td>계약상태</td>', 'utf8');

/** 시험이 쓰는 «아무 일도 안 하는» 명령 */
const 아무일 = ['node', '-e', 'process.exit(0)'];

const 깃발 = (행위) => [
  'scripts/with-lease.mjs', '--resource', 'drive', '--agent', 'codex',
  '--행위', 행위, '--계획', 계획길, '--양식', 양식길, '--대상', 대상길,
  '--', ...아무일,
];

async function 실행(행위) {
  try {
    const { stdout } = await 돌린다('node', 깃발(행위), { env: 환경, cwd: process.cwd() });
    return { 코드: 0, 글: stdout };
  } catch (e) {
    return { 코드: e.code ?? 1, 글: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** 승인·검토를 «자식과 같은 자리에» 남긴다 */
async function 승인모듈() {
  const 앞 = process.env.AIOPS_COORDINATION_DIR;
  process.env.AIOPS_COORDINATION_DIR = 자리;
  const m = await import(`../lib/seungin.mjs?t=${Date.now()}`);
  return { m, 되돌리기: () => { if (앞) process.env.AIOPS_COORDINATION_DIR = 앞; else delete process.env.AIOPS_COORDINATION_DIR; } };
}

async function 밑() {
  const { m } = await 승인모듈();
  const { readFile } = await import('node:fs/promises');
  const 대 = m.대상해시(JSON.parse(await readFile(대상길, 'utf8')));
  return {
    m,
    값: {
      계획SHA: m.계획해시(JSON.parse(await readFile(계획길, 'utf8'))),
      양식SHA: await m.양식해시([양식길]),
      대상SHA: 대.해시,
      건수: 대.건수,
    },
  };
}

test.after(async () => { await rm(자리, { recursive: true, force: true }); });

test('★local 은 문턱을 그냥 지나간다 — Codex 단독', async () => {
  const r = await 실행('local');
  assert.equal(r.코드, 0, r.글);
  assert.match(r.글, /codex단독/);
});

test('★★drive-add 는 승인이 없으면 «실행 자체가» 막힌다', async () => {
  const r = await 실행('drive-add');
  assert.equal(r.코드, 2, '문턱에서 exit 2 로 멈춰야 한다');
  assert.match(r.글, /막혔다/);
  assert.match(r.글, /독립 검토자 1명/);
});

test('★★Claude 없이 Cursor 검토 + 대표 승인으로 열린다', async () => {
  const { m, 값 } = await 밑();
  await m.검토기록({ ...값, 등급: 'drive-add', 검토자: 'cursor', 판정: 'APPROVE', 근거: 'PDF 짝 확인' });
  await m.대표승인({ ...값, 등급: 'drive-add', 문구: '평택시 2건 올려라' });
  const r = await 실행('drive-add');
  assert.equal(r.코드, 0, r.글);
  assert.match(r.글, /검토\+대표/);
});

test('★★긴급 우회 — 검토 없이 대표 승인만으로 열린다', async () => {
  const { m } = await 승인모듈();
  const { readFile } = await import('node:fs/promises');
  /** 계획을 바꿔 «새 묶음» 으로 만든다 — 앞의 검토가 안 따라오게 */
  await writeFile(계획길, JSON.stringify({ 관청: '긴급건', 건수: 2 }), 'utf8');
  const 대 = m.대상해시(JSON.parse(await readFile(대상길, 'utf8')));
  const 값 = {
    계획SHA: m.계획해시(JSON.parse(await readFile(계획길, 'utf8'))),
    양식SHA: await m.양식해시([양식길]),
    대상SHA: 대.해시, 건수: 대.건수,
  };
  const 막힘 = await 실행('drive-add');
  assert.equal(막힘.코드, 2, '계획이 바뀌었으니 앞 승인은 안 따라온다');

  await m.대표승인({ ...값, 등급: 'drive-add', 문구: '긴급 실행 승인', 명령: 깃발('drive-add').slice(-3), 긴급: true });
  const r = await 실행('drive-add');
  assert.equal(r.코드, 0, r.글);
  assert.match(r.글, /긴급/);
});

test('★★protected 는 긴급으로도 못 연다', async () => {
  const { m } = await 승인모듈();
  const { readFile } = await import('node:fs/promises');
  const 대 = m.대상해시(JSON.parse(await readFile(대상길, 'utf8')));
  const 값 = {
    계획SHA: m.계획해시(JSON.parse(await readFile(계획길, 'utf8'))),
    양식SHA: await m.양식해시([양식길]),
    대상SHA: 대.해시, 건수: 대.건수,
  };
  await assert.rejects(
    () => m.대표승인({ ...값, 등급: 'protected', 문구: '긴급 실행 승인', 긴급: true }),
    /긴급 우회로 열 수 없다/,
  );
  const r = await 실행('protected');
  assert.equal(r.코드, 2);
});

test('★--행위 를 주면 --계획·--양식·--대상 이 다 있어야 한다', async () => {
  try {
    await 돌린다('node', ['scripts/with-lease.mjs', '--resource', 'drive', '--행위', 'drive-add', '--', ...아무일],
      { env: 환경, cwd: process.cwd() });
    assert.fail('막혔어야 한다');
  } catch (e) {
    assert.match(`${e.stdout ?? ''}${e.stderr ?? ''}`, /--계획 · --양식 · --대상 이 모두 있어야 한다/);
  }
});

test('★실행 전후가 이력에 남는다', async () => {
  const { m } = await 승인모듈();
  const { readFile } = await import('node:fs/promises');
  const 줄 = (await readFile(join(자리, 'seungin.ndjson'), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(줄.some((r) => r.type === '실행전'), '실행 전 기록이 있어야 한다');
  assert.ok(줄.some((r) => r.type === '실행후' && r.결과 === '됐다'), '실행 후 결과가 있어야 한다');
  const 사슬 = await m.사슬검사();
  assert.equal(사슬.성하다, true, 사슬.왜);
});

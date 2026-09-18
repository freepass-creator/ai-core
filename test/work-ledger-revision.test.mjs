// 검증한 리비전이 걸음마다 몰래 바뀌지 못하게 한다.
//
// ★2026-09-18: 사건마다 subject_revision 을 따로 싣는데 검증기가 앞 리비전과 비교하지
//   않았다. 그래서 VERIFYING(A) → READY(B) → EXECUTED(C) 가 VALID 였다 — 검증한 코드와
//   실행한 코드가 달라도 원장은 몰랐다. 이제 VERIFYING 에 들어간 리비전이 그 뒤를 묶는다.
//   바꾸는 길은 둘뿐이다: 다시 VERIFYING 에 들어가거나(BLOCKED→VERIFYING), 검증을
//   버리고 IN_PROGRESS 로 돌아가 REOBSERVED 로 증거와 함께 옮기거나.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { createWorkRecorder } from '../src/integration/work-recorder.mjs';

const rev = (s) => createHash('sha1').update(s).digest('hex');
const A = rev('A'); const B = rev('B');
const WORK = 'DEMO-001';

const 원장만들기 = async (dir, 사건들) => {
  const 길 = join(dir, 'work.jsonl');
  let head = null;
  for (const [i, e] of 사건들.entries()) {
    head = (await appendLedgerEvent(길, { event_id: `EV-${String(i + 1).padStart(3, '0')}`, work_id: WORK, project_id: 'demo-project',
      actor: 'TEST', observed_at: '2026-09-18T00:00:00Z', evidence_refs: [], ...e }, head)).head;
  }
  return { 길, 글: readFileSync(길, 'utf8') };
};
const 임시 = (t) => { const dir = mkdtempSync(join(tmpdir(), 'ledger-rev-')); t.after(() => rmSync(dir, { recursive: true, force: true })); return dir; };
/** append 는 검증을 통과한 줄만 쓴다 — 앞줄은 모두 맞으니 거절 코드는 마지막 줄의 것이다. */
const 거절코드 = async (t, 사건들) => { try { await 원장만들기(임시(t), 사건들); return null; } catch (e) { return e.message; } };

const 옮김 = (f, to, r = A, 덧 = {}) => ({ type: 'TRANSITIONED', from_state: f, to_state: to, subject_revision: r, ...덧 });
const 닫음 = (r = A) => 옮김('OBSERVING', 'CLOSED', r, { evidence_refs: ['MEASURED:closed @test'] });
const 검증까지 = [{ type: 'CREATED', from_state: null, to_state: 'RECEIVED', subject_revision: A },
  옮김('RECEIVED', 'PLANNED'), 옮김('PLANNED', 'IN_PROGRESS'), 옮김('IN_PROGRESS', 'VERIFYING')];
const 준비까지 = [...검증까지, 옮김('VERIFYING', 'READY')];

test('검증한 리비전 그대로면 끝까지 간다 — 승인 경유도, 닫기까지도', async (t) => {
  const { 글 } = await 원장만들기(임시(t), [...검증까지, 옮김('VERIFYING', 'AWAITING_AUTHORIZATION'), 옮김('AWAITING_AUTHORIZATION', 'READY'),
    옮김('READY', 'EXECUTED'), 옮김('EXECUTED', 'OBSERVING'), 닫음()]);
  const r = verifyLedgerText(글);
  assert.equal(r.status, 'VALID', JSON.stringify(r.errors));
  assert.deepEqual([r.work[WORK].state, r.work[WORK].revisions], ['CLOSED', [A]]);
});

test('리비전을 바꾸는 정당한 길 둘 — 다시 검증하거나, 검증을 버리고 재관측한다', async (t) => {
  const 재검증 = await 원장만들기(임시(t), [...준비까지, 옮김('READY', 'BLOCKED'), 옮김('BLOCKED', 'VERIFYING', B), 옮김('VERIFYING', 'READY', B), 옮김('READY', 'EXECUTED', B)]);
  assert.deepEqual(verifyLedgerText(재검증.글).work[WORK].revisions, [A, B]);
  const 재작업 = await 원장만들기(임시(t), [...검증까지, 옮김('VERIFYING', 'IN_PROGRESS'),
    { type: 'REOBSERVED', from_state: 'IN_PROGRESS', to_state: 'IN_PROGRESS', subject_revision: B, evidence_refs: ['MEASURED:compare A...B @gh api'] },
    옮김('IN_PROGRESS', 'VERIFYING', B), 옮김('VERIFYING', 'READY', B)]);
  assert.equal(verifyLedgerText(재작업.글).status, 'VALID');
  /** 검증 전 걸음은 이 규칙 밖이다 — 운영 원장의 DIRECTION-001 이 RECEIVED(null) → PLANNED(c72e…) 로 이렇게 왔다. */
  const 검증전 = await 원장만들기(임시(t), [{ type: 'CREATED', from_state: null, to_state: 'RECEIVED', subject_revision: null }, 옮김('RECEIVED', 'PLANNED', A)]);
  assert.equal(verifyLedgerText(검증전.글).status, 'VALID');
});

test('★반례 — 검증 뒤 어느 걸음에서도 리비전을 몰래 바꿀 수 없다', async (t) => {
  const 바뀜 = 'REVISION_CHANGED_AFTER_VERIFICATION';
  const 승인까지 = [...검증까지, 옮김('VERIFYING', 'AWAITING_AUTHORIZATION')];
  const 실행까지 = [...준비까지, 옮김('READY', 'EXECUTED')];
  const 관측까지 = [...실행까지, 옮김('EXECUTED', 'OBSERVING')];
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'READY', B)]), 바뀜, '검증한 것과 다른 코드로 READY');
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'AWAITING_AUTHORIZATION', B)]), 바뀜);
  assert.equal(await 거절코드(t, [...승인까지, 옮김('AWAITING_AUTHORIZATION', 'READY', B)]), 바뀜, '승인받은 것과 다른 코드로 READY');
  assert.equal(await 거절코드(t, [...준비까지, 옮김('READY', 'EXECUTED', B)]), 바뀜, '준비된 것과 다른 코드를 실행');
  assert.equal(await 거절코드(t, [...실행까지, 옮김('EXECUTED', 'OBSERVING', B)]), 바뀜);
  assert.equal(await 거절코드(t, [...관측까지, 닫음(B)]), 바뀜, '다른 코드로 닫기');
  assert.equal(await 거절코드(t, [...준비까지, 옮김('READY', 'EXECUTED', null)]), 바뀜, '리비전을 지워도 바뀐 것이다');
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'IN_PROGRESS', A), 옮김('IN_PROGRESS', 'VERIFYING', A), 옮김('VERIFYING', 'READY', B)]), 바뀜, '다시 검증했으면 그 리비전에 묶인다');
});

test('★반례 — BLOCKED 로 돌아가도, 이름표를 바꿔도 못 바꾼다', async (t) => {
  const 바뀜 = 'REVISION_CHANGED_AFTER_VERIFICATION';
  assert.equal(await 거절코드(t, [...준비까지, 옮김('READY', 'BLOCKED', B)]), 바뀜, 'READY(A) → BLOCKED(B) → READY(B) 우회의 첫 걸음');
  assert.equal(await 거절코드(t, [...준비까지, 옮김('READY', 'BLOCKED'), 옮김('BLOCKED', 'READY', B)]), 바뀜, 'BLOCKED 에서 다른 코드로 복귀');
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'BLOCKED'), 옮김('BLOCKED', 'AWAITING_AUTHORIZATION', B)]), 바뀜);
  assert.equal(await 거절코드(t, [...준비까지, 옮김('READY', 'CANCELLED', B)]), 바뀜);
  /** 검증기는 type 을 상태 이동에 묶지 않는다. TRANSITIONED 에만 걸면 RESUMED 라고 적어서 빠져나간다. */
  for (const type of ['RESUMED', 'BLOCKED', 'CANCELLED']) {
    assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'READY', B, { type })]), 바뀜, `type ${type}`);
  }
});

test('★반례 — 검증 없이 BLOCKED 를 거쳐 READY 로 뛰어들 수 없다', async (t) => {
  const 건넘 = 'VERIFICATION_SKIPPED';
  const 작업중 = 검증까지.slice(0, 3);
  assert.equal(await 거절코드(t, [...작업중, 옮김('IN_PROGRESS', 'BLOCKED', B), 옮김('BLOCKED', 'READY', B)]), 건넘, 'IN_PROGRESS(A) → BLOCKED(B) → READY(B): B 는 아무도 검증 안 했다');
  assert.equal(await 거절코드(t, [검증까지[0], 옮김('RECEIVED', 'BLOCKED'), 옮김('BLOCKED', 'AWAITING_AUTHORIZATION')]), 건넘);
  assert.equal(await 거절코드(t, [검증까지[0], 옮김('RECEIVED', 'BLOCKED'), 옮김('BLOCKED', 'OBSERVING')]), 건넘);
  assert.equal(await 거절코드(t, [...검증까지, 옮김('VERIFYING', 'IN_PROGRESS'), 옮김('IN_PROGRESS', 'BLOCKED'), 옮김('BLOCKED', 'READY')]), 건넘,
    'IN_PROGRESS 로 돌아가면 앞의 검증은 버려진다 — 같은 리비전이어도');
});

test('기존 예시 원장은 그대로 VALID 다', () => {
  const r = verifyLedgerText(readFileSync(new URL('../examples/work-ledger.jsonl', import.meta.url), 'utf8'));
  assert.equal(r.status, 'VALID', JSON.stringify(r.errors));
});

test('기록기 — 검증 뒤 걸음에 리비전을 빠뜨리면 쓰기 «전에» 거절된다', async (t) => {
  const { 길 } = await 원장만들기(임시(t), 검증까지);
  const 전 = readFileSync(길, 'utf8');
  const 기록기 = createWorkRecorder({ ledgerPath: 길, actor: 'CLAUDE' });
  const 걸음 = (덧) => ({ work_id: WORK, project_id: 'demo-project', to_state: 'READY', 무엇: '검증 통과',
    증거: [{ 갈래: 'MEASURED', 무엇: 'npm test 436 pass', 어디서: 'npm test' }], ...덧 });
  await assert.rejects(() => 기록기.적는다(걸음({})), /REVISION_CHANGED_AFTER_VERIFICATION/);
  await assert.rejects(() => 기록기.적는다(걸음({ subject_revision: B })), /REVISION_CHANGED_AFTER_VERIFICATION/);
  assert.equal(readFileSync(길, 'utf8'), 전, '한 줄도 남지 않는다');
  await 기록기.적는다(걸음({ subject_revision: A }));
  assert.equal((await 기록기.지금상태(WORK)).상태, 'READY');
});

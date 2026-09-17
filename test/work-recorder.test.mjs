import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkRecorder, 증거인가 } from '../src/integration/work-recorder.mjs';
import { verifyLedgerText } from '../scripts/work-ledger.mjs';

const REV = 'a'.repeat(40);
const 증 = (덧 = {}) => ({ 갈래: 'MEASURED', 무엇: '읽기가 429 로 막혔다', 어디서: 'node -e 모두(fine_unpaid)', ...덧 });
const 걸음 = (덧 = {}) => ({
  work_id: 'GWATAERYO-001', project_id: 'aiops', subject_revision: REV,
  무엇: '조사 시작', 증거: [증()], ...덧,
});

function 원장(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-rec-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'work.jsonl');
  return { path, 적기: createWorkRecorder({ ledgerPath: path, actor: 'CLAUDE' }) };
}

test('★증거 없이는 못 적는다 — 이 모듈의 존재 이유다', async (t) => {
  const { 적기, path } = 원장(t);
  await assert.rejects(() => 적기.적는다(걸음({ 증거: [] })), /EVIDENCE_REQUIRED/);
  await assert.rejects(() => 적기.적는다(걸음({ 증거: undefined })), /EVIDENCE_REQUIRED/);
  // 한 줄도 남으면 안 된다 — 거절은 «쓰기 전» 이어야 한다.
  assert.throws(() => readFileSync(path, 'utf8'));
});

test('★「어디서」가 없으면 증거가 아니라 주장이다', async (t) => {
  const { 적기 } = 원장(t);
  assert.equal(증거인가(증({ 어디서: '' })), 'EVIDENCE_SOURCE_REQUIRED');
  await assert.rejects(() => 적기.적는다(걸음({ 증거: [증({ 어디서: undefined })] })), /EVIDENCE_SOURCE_REQUIRED/);
});

test('★갈래는 셋뿐이다 — 「그냥 안다」는 증거가 될 수 없다', async (t) => {
  const { 적기 } = 원장(t);
  assert.equal(증거인가(증({ 갈래: 'ASSUMED' })), 'EVIDENCE_KIND_INVALID');
  assert.equal(증거인가(증({ 갈래: 'PROBABLY' })), 'EVIDENCE_KIND_INVALID');
  await assert.rejects(() => 적기.적는다(걸음({ 증거: [증({ 갈래: '느낌' })] })), /EVIDENCE_KIND_INVALID/);
  for (const 갈 of ['MEASURED', 'READ', 'RECEIVED']) assert.equal(증거인가(증({ 갈래: 갈 })), null);
});

test('★무슨 일이 있었는지 없으면 못 적는다', async (t) => {
  const { 적기 } = 원장(t);
  await assert.rejects(() => 적기.적는다(걸음({ 무엇: '' })), /WHAT_HAPPENED_REQUIRED/);
});

test('★호출자가 「어디서 왔는지」를 말하지 못한다 — 원장에서 읽는다', async (t) => {
  const { 적기 } = 원장(t);
  await 적기.적는다(걸음({ to_state: 'RECEIVED' }));
  // from_state 를 넣어 봐도 무시된다. 넣을 수 있으면 있지도 않은 자리에서 옮겨 적을 수 있다.
  const r = await 적기.적는다(걸음({ to_state: 'PLANNED', from_state: 'READY' }));
  assert.equal(r.from_state, 'RECEIVED');
  assert.equal(r.to_state, 'PLANNED');
});

test('★원장이 막는 전이는 그대로 막힌다 — 판정은 원장 몫이다', async (t) => {
  const { 적기 } = 원장(t);
  await 적기.적는다(걸음({ to_state: 'RECEIVED' }));
  // RECEIVED 에서 EXECUTED 로 건너뛸 수 없다(work-ledger.mjs 의 transitions).
  await assert.rejects(() => 적기.적는다(걸음({ to_state: 'EXECUTED' })), /TRANSITION_NOT_ALLOWED/);
});

test('★적은 것은 해시체인으로 이어지고 검증을 통과한다', async (t) => {
  const { 적기, path } = 원장(t);
  await 적기.적는다(걸음({ to_state: 'RECEIVED' }));
  await 적기.적는다(걸음({ to_state: 'PLANNED', 무엇: '가설을 세웠다' }));
  await 적기.적는다(걸음({ to_state: 'IN_PROGRESS', 무엇: '원인을 찾았다' }));
  const 결과 = verifyLedgerText(readFileSync(path, 'utf8'));
  assert.equal(결과.status, 'VALID');
  assert.equal(결과.event_count, 3);
  assert.equal((await 적기.지금상태('GWATAERYO-001')).상태, 'IN_PROGRESS');
});

test('★증거가 «관측»으로 남는다 — 다음 세션이 결론이 아니라 근거를 읽는다', async (t) => {
  const { 적기, path } = 원장(t);
  await 적기.적는다(걸음({
    무엇: '문서의 「무료 한도 소진」은 틀렸다',
    증거: [증({ 무엇: 'billingEnabled=true 인데 open:false', 어디서: 'gcloud billing accounts describe' }),
      { 갈래: 'READ', 무엇: '문서는 Spark 한도로 결론냈다', 어디서: 'docs/과태료-작업지도.md' }],
  }));
  const 줄 = JSON.parse(readFileSync(path, 'utf8').trim().split(/\r?\n/)[0]);
  assert.equal(줄.evidence_refs.length, 2);
  // 갈래·무엇·어디서가 한 줄에 다 남아야 한다.
  assert.match(줄.evidence_refs[0], /^MEASURED:.+@.+/);
  assert.match(줄.evidence_refs[1], /^READ:.+@docs\//);
});

test('★남의 이름으로 못 적는다 — actor 는 만들 때 한 번 못 박는다', async (t) => {
  const { 적기, path } = 원장(t);
  await 적기.적는다(걸음({ actor: '대표' }));
  const 줄 = JSON.parse(readFileSync(path, 'utf8').trim().split(/\r?\n/)[0]);
  assert.equal(줄.actor, 'CLAUDE');
});

test('★id 꼴은 여기서 먼저 잡는다 — 깊은 데서 스키마 오류로 터지지 않게', async (t) => {
  const { 적기 } = 원장(t);
  await assert.rejects(() => 적기.적는다(걸음({ work_id: 'GWATAERYO-STOP' })), /WORK_ID_SHAPE_INVALID/);
  await assert.rejects(() => 적기.적는다(걸음({ work_id: 'gwataeryo-001' })), /WORK_ID_SHAPE_INVALID/);
  await assert.rejects(() => 적기.적는다(걸음({ event_id: 'bad-id' })), /EVENT_ID_SHAPE_INVALID/);
});

test('만드는 데 필요한 것이 없으면 만들어지지 않는다', () => {
  assert.throws(() => createWorkRecorder({ ledgerPath: '', actor: 'CLAUDE' }), /LEDGER_PATH_REQUIRED/);
  assert.throws(() => createWorkRecorder({ ledgerPath: 'x.jsonl', actor: '' }), /ACTOR_REQUIRED/);
});

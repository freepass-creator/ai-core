// 운영 관측이 원장에 «제대로» 남는지 지킨다 — AI Core 가 실제 업무를 보기 시작한 자리.
//
// ★대표 2026-09-27: 「AI 코어가 동상처럼 서 있다. 실전 투입을 못 한다」
//   Codex 와 상의해 (나) 실제 업무 하나 완주를 골랐고, 대상은 이미 매시간 도는 freepasserp5 상품 갱신이다.
//   이 검사는 1단계(관측 → 원장)를 고정한다. 아무것도 «시키지» 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 읽어내다, 이벤트로 } from '../scripts/ops-to-ledger.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 계약 = JSON.parse(readFileSync(resolve(root, 'contracts/work-ledger-event.schema.json'), 'utf8'));

/** 실제 ops-watch 출력(2026-09-27 실측)을 그대로 쓴다. 지어낸 문자열로 파서를 시험하지 않는다. */
const 실측출력 = [
  '■ OPS-erp5-catalog-refresh  FAILED  (창 밖)  담당 코어 고도화',
  '   발행   09-27 17:42 KST · 312분 전 · 20260927084256896-acbcc3470016',
  '   회차   마지막 09-27 17:31 repository_dispatch completed/failure',
  '   오늘   예약 0회 옴 / 지금까지 0회 와야 함',
  '   ★FAILED LAST_RUN_FAILED — 자료는 반영됨, 회차 뒤 검사만 실패 https://github.com/freepass-creator/freepasserp4/actions/runs/36306484005'
].join('\n');

test('ops-watch 출력에서 «원장에 남길 사실»을 읽어낸다', () => {
  const 사실 = 읽어내다(실측출력);
  assert.equal(사실.운영id, 'OPS-erp5-catalog-refresh');
  assert.equal(사실.상태, 'FAILED');
  assert.equal(사실.나이분, 312);
  assert.equal(사실.발행판, '20260927084256896-acbcc3470016');
  assert.equal(사실.자료반영, true, '「자료는 반영됨」을 놓치면 멀쩡한 회차를 고장으로 읽는다');
  assert.equal(사실.자료안바뀜, false);
  assert.match(사실.주소, /actions\/runs\/36306484005/);
});

test('★「자료도 안 바뀜」은 진짜 고장이라 증거에 별표로 남는다', () => {
  const 사실 = 읽어내다(실측출력.replace('자료는 반영됨, 회차 뒤 검사만 실패', '자료도 안 바뀜'));
  assert.equal(사실.자료안바뀜, true);
  const 이벤트 = 이벤트로(사실, { subject_revision: 'a'.repeat(40) });
  assert.ok(이벤트.evidence_refs.some((r) => r.includes('★자료도 안 바뀜')), '진짜 고장이 증거에 안 남는다');
});

test('만든 이벤트가 원장 계약을 지킨다 — 식별자 규격까지', () => {
  const 이벤트 = 이벤트로(읽어내다(실측출력), { subject_revision: 'b'.repeat(40) });
  for (const 칸 of 계약.required) assert.ok(칸 in 이벤트, `필수 칸이 없다: ${칸}`);
  for (const 칸 of Object.keys(이벤트)) assert.ok(계약.properties[칸], `계약에 없는 칸을 넣었다: ${칸}`);
  assert.match(이벤트.event_id, new RegExp(계약.properties.event_id.pattern));
  assert.match(이벤트.work_id, new RegExp(계약.properties.work_id.pattern));
  assert.match(이벤트.subject_revision, new RegExp(계약.properties.subject_revision.pattern));
  /** 증거는 객체가 아니라 «한 줄 문자열»이다 — 객체를 넣었다가 EVENT_SCHEMA_INVALID 로 막혔다(실측). */
  for (const 줄 of 이벤트.evidence_refs) assert.equal(typeof 줄, 'string');
});

test('첫 관측은 CREATED, 이후는 REOBSERVED — 일을 «옮기지» 않는다', () => {
  const 사실 = 읽어내다(실측출력);
  const 처음것 = 이벤트로(사실, { subject_revision: 'c'.repeat(40), 처음: true });
  assert.equal(처음것.type, 'CREATED');
  assert.equal(처음것.from_state, null);
  assert.equal(처음것.to_state, 'RECEIVED');

  const 다음것 = 이벤트로(사실, { subject_revision: 'd'.repeat(40) });
  assert.equal(다음것.type, 'REOBSERVED');
  assert.equal(다음것.from_state, 다음것.to_state, '관측은 상태를 바꾸지 않는다');
});

test('★대상 revision 은 저장소 head 가 아니라 «그 회차가 발행한 것»이다', () => {
  /** 저장소 head 는 하루 종일 그대로일 수 있다. 그러면 매 회차가 같은 revision 이 되어
   *  REOBSERVED 가 막힌다(REOBSERVE_REVISION_UNCHANGED). 발행판이 이 일의 subject 다. */
  const 본문 = readFileSync(resolve(root, 'scripts/ops-to-ledger.mjs'), 'utf8');
  assert.match(본문, /사실\.발행판 \? createHash\('sha1'\)/, '발행판을 revision 으로 접어 쓰지 않는다');
  assert.match(본문, /변화 없음/, '같은 발행판을 또 적지 않는 길이 없다');
});

const 실제원장경로 = resolve(root, '.local/work-ledger.jsonl');

test('원장에 실제 관측이 이미 한 건 들어가 있다 — 이 일이 «동상»이 아니라는 증거', {
  skip: existsSync(실제원장경로) ? false : '로컬 운영 원장은 Git/CI 정본이 아니므로 실제 파일이 있는 환경에서만 검사한다'
}, () => {
  const 원장 = readFileSync(실제원장경로, 'utf8');
  const 줄 = 원장.trim().split('\n').map((l) => JSON.parse(l));
  const 우리것 = 줄.filter((e) => e.work_id === 'OPS-ERP5-CATALOG-001');
  assert.ok(우리것.length >= 1, '실제 운영 관측이 원장에 없다');
  assert.equal(우리것[0].type, 'CREATED');
  assert.ok(
    우리것[0].evidence_refs.some((r) => r.startsWith('MEASURED:발행')),
    '발행 증거 없이 기록되면 관측이라 할 수 없다'
  );
});

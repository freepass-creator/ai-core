// 미수 읽는 계약 — «답»과 «검산»이 섞이지 않고, 쓰는 곳이 하나이게.
//
// ★2026-09-29 실측: arrears 모음을 두 코드가 다른 열쇠로 쓰고(fb/put.mjs 3칸 · misu/put-galrae.mjs 2칸),
//   put.mjs 는 매번 다른 쪽 문서를 지운다. 모음의 모양이 «마지막에 누가 돌았나»에 달려 있었다.
//   Codex 와 필드를 맞췄다. 이 계약은 설계다 — aiops 코드는 아직 이 모양으로 바뀌지 않았다.
import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
import { 키검사 } from '../src/contracts/arrears-read.mjs';

const 읽기 = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const 계약 = 읽기('contracts/arrears-read.schema.json');
const 주인표 = 읽기('registry/data-owners.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const 맞나 = ajv.compile(계약);

/** 지어낸 예시 — 실제 차번·금액이 아니다. */
const 좋은문서 = () => ({
  계약판: 1,
  키: 'SW-00가0000-live',
  법인: 'SW',
  차량번호: '00가0000',
  계약ID: null,
  계약상태: 'live',
  미수: 100000,
  출처: '수납탭',
  기준월: '2026-08',
  원본행: { 시트: '예시', 탭: '수납', 행: 2 },
  수집시각: '2026-09-29T00:00:00Z',
  검산: { 계좌도출: 90000, 차이: 10000 },
  갈래: { 자동: null, 수동판정: null },
  확인상태: '미확인',
  기록: { 쓴곳: 'fb/put.mjs', 쓴시각: '2026-09-29T00:00:00Z' },
});

test('좋은 문서는 통과한다 — 계약이 스스로 모순이 아니다', () => {
  assert.ok(맞나(좋은문서()), JSON.stringify(맞나.errors));
});

test('★답의 출처는 수납 탭뿐이다 — 계좌 도출값을 답 자리에 넣으면 막힌다', () => {
  /** 대표: 「계좌 도출은 검산값 — 답으로 쓰지 않는다」. 이 칸이 풀리면 세션마다 다른 미수가 나온다. */
  assert.equal(맞나({ ...좋은문서(), 출처: '계좌도출' }), false);
});

test('★쓰는 곳은 하나다 — put-galrae 가 쓴 문서는 계약 위반이다', () => {
  assert.equal(맞나({ ...좋은문서(), 기록: { 쓴곳: 'misu/put-galrae.mjs', 쓴시각: '2026-09-29T00:00:00Z' } }), false);
});

test('★열쇠 규칙은 하나다 — 옛 2칸 열쇠(SW-차번)는 막힌다', () => {
  /** 2칸 문서는 put-galrae 가 넣고 아무도 치우지 않아 쌓였고, 갈래는 진짜 문서에 닿지 못했다. */
  assert.equal(맞나({ ...좋은문서(), 키: 'SW-00가0000' }), false);
});

test('★끝난 계약은 계약ID 로 가른다 — 같은 차에 끝난 계약이 여럿일 수 있다(Codex)', () => {
  const 종료 = { ...좋은문서(), 계약상태: 'end', 키: 'SW-00가0000-end-C1', 계약ID: 'C1' };
  assert.ok(맞나(종료), JSON.stringify(맞나.errors));
  assert.equal(맞나({ ...종료, 계약ID: null }), false, '계약ID 없는 종료 문서가 통과하면 두 계약이 한 문서에 덮인다');
  assert.equal(맞나({ ...종료, 키: 'SW-00가0000-end' }), false, '옛 3칸 종료 열쇠가 통과했다');
});

test('★모르는 법인은 PR 로 넣지 않는다 — 계약이 SW·PR 밖을 받지 않는다', () => {
  assert.equal(맞나({ ...좋은문서(), 법인: '기타' }), false);
  assert.match(계약.properties.법인.description, /PR 로 바꿔 넣지 않는다/);
});

test('답의 자리(원본행·기준월·수집시각)를 빼면 막힌다 — 의심스러울 때 돌아갈 곳이 있어야 한다', () => {
  for (const 칸 of ['원본행', '기준월', '수집시각', '계약판']) {
    const d = 좋은문서();
    delete d[칸];
    assert.equal(맞나(d), false, `${칸} 없이 통과했다`);
  }
});

test('모르는 칸을 붙이면 막힌다 — 계약 밖 값이 조용히 섞이지 않게', () => {
  assert.equal(맞나({ ...좋은문서(), 계좌미수: 1 }), false);
});

test('검산 차이는 HOLD 로 표시할 수 있다 — 답을 자동으로 바꾸는 대신', () => {
  assert.ok(맞나({ ...좋은문서(), 확인상태: 'HOLD' }));
  assert.match(계약.properties.확인상태.description, /자동으로 바꾸지 않는다/);
});

test('★주인 표가 계약을 가리키고, «설계일 뿐»이라고 적혀 있다 — 끝난 것처럼 보이지 않게', () => {
  const m = 주인표.kinds.미수;
  assert.equal(m.read_contract.schema, 'contracts/arrears-read.schema.json');
  assert.match(m.read_contract.status, /^DESIGN/);
  assert.match(m.read_contract.tolerance, /HOLD/);
  assert.match(m.read_contract.manual_kept, /덮지 않는다/);
});

test('★두 쓰는 곳의 충돌이 근거와 함께 적혀 있고, 실물은 «모른다»로 남아 있다', () => {
  const 싸움 = 주인표.kinds.미수.writer_fight;
  assert.match(싸움.correction_2026_09_29, /틀렸다/, '「서로 지운다」는 첫 판독이 틀렸다는 기록을 지우면 같은 오독을 다시 한다');
  const 근거 = 싸움.evidence.join(' ');
  for (const 꼭 of ['fb/put.mjs', '맞춘다', 'put-galrae.mjs:27', 'bogi.mjs']) assert.match(근거, new RegExp(꼭.replace('.', '\\.')));
  const 실측 = 싸움.measured_2026_09_30;
  assert.ok(실측, 'Firestore 를 읽은 기록이 없으면 겹친 수를 적지 않는다(«세지 말고 읽는다»)');
  assert.match(실측.by, /Codex/); assert.match(실측.by, /Claude/, '한 쪽만 읽은 값은 정본에 박지 않는다');
  assert.equal(실측.arrears.세칸열쇠 + 실측.arrears.두칸열쇠 + 실측.arrears.그밖, 실측.arrears.전체, '열쇠 모양 분류에 공백이 있다');
  assert.match(주인표.kinds.미수.read_contract.gap_2026_09_30, /계약ID/, '계약ID 가 비어 있다는 사실이 빠지면 열쇠를 바로 바꾸려 든다');
});

test('★시트 적재는 결함이 아니라 설계다 — 답=수납 탭, 계좌=검산', () => {
  assert.match(주인표.kinds.미수.answer_vs_check, /수납/);
  assert.match(주인표.kinds.미수.answer_vs_check, /검산/);
});

test('★키가 다른 칸과 어긋나면 막힌다 — 스키마만으로는 통과하던 것(Codex 검토)', () => {
  const 좋은 = 좋은문서();
  assert.deepEqual(키검사(좋은), []);
  const 어긋남 = {
    법인: { ...좋은, 법인: 'PR' },
    차번: { ...좋은, 차량번호: '11나1111' },
    상태: { ...좋은, 계약상태: 'end', 계약ID: 'C1' },
    계약ID: { ...좋은, 계약상태: 'end', 키: 'SW-00가0000-end-C1', 계약ID: 'C2' },
  };
  for (const [무엇, d] of Object.entries(어긋남)) {
    assert.ok(맞나(d), `${무엇}: 스키마는 통과한다 — 그래서 키검사가 따로 필요하다`);
    assert.notDeepEqual(키검사(d), [], `${무엇} 이 어긋났는데 키검사가 통과시켰다`);
  }
  assert.equal(계약['x-also-required'], 'src/contracts/arrears-read.mjs#키검사');
});

test('★실측 숫자는 서로 맞아야 하고, 계약ID 공백이 있으면 열쇠 전환은 보류다(Codex 검토)', () => {
  /** 처음 판은 칸이 «있는지»만 봤다 — Codex 가 숫자를 바꿔 넣어도 전부 통과했다. */
  const 미수 = 주인표.kinds.미수, a = 미수.writer_fight.measured_2026_09_30.arrears, 순서 = 미수.read_contract.migration_order.join('\n');
  assert.equal(a.끝난계약 + a.유지계약, a.세칸열쇠, '끝난+유지 가 3칸 열쇠 수와 다르다');
  assert.ok(a.출처_aiops <= a.전체 && a.계약ID_있음 <= a.전체, '부분이 전체보다 크다');
  assert.doesNotMatch(미수.writer_fight.measured_2026_09_30.meaning, /하나가 쓴/, '모양이 같다고 쓴 곳이 하나라고 확정하지 않는다');
  if (a.계약ID_있음 < a.끝난계약) {
    assert.match(순서, /계약ID[^\n]*정하기 전엔 열쇠를 바꾸지 않는다/, '계약ID 가 빈 종료 문서가 있는데 열쇠 전환 보류가 없다');
    const 계약ID단계 = 미수.read_contract.migration_order.findIndex((s) => /계약ID 출처/.test(s));
    const 흡수단계 = 미수.read_contract.migration_order.findIndex((s) => /흡수/.test(s));
    assert.ok(계약ID단계 >= 0 && 흡수단계 >= 0, '계약ID·흡수 단계가 빠졌다');
  }
  if (a.두칸열쇠 > 0) assert.doesNotMatch(순서, /할 일 없음/, '2칸 문서가 있는데 정리할 일이 없다고 적었다');
  assert.match(순서, /put-galrae --쓴다 금지/, '위험한 쓰기를 막는 말이 빠졌다');
});

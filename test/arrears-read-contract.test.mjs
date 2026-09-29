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
  assert.match(싸움.measured, /모른다/, 'Firestore 를 읽지 않고 겹친 수를 적으면 «세지 말고 읽는다»를 어긴다');
});

test('★시트 적재는 결함이 아니라 설계다 — 답=수납 탭, 계좌=검산', () => {
  assert.match(주인표.kinds.미수.answer_vs_check, /수납/);
  assert.match(주인표.kinds.미수.answer_vs_check, /검산/);
});

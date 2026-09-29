// 구분값에 «공백»이 생기면 빨개진다. 그것이 이 검사의 전부다.
//
// ★대표 2026-09-28: 「어떤 구분값을 다 이렇게 공백이 없게끔 처리할 수 있는 방법으로 가야 될 것 같아」
//
//   초안을 재 보니 추적 파일 1,182개 중 931개(78.8%)가 어느 lane 에도 안 걸렸다.
//   지도를 «잘 그리는» 것으로는 안 된다 — 새 폴더가 생길 때마다 다시 벌어지고, 공백은 눈에 안 보인다.
//   그래서 공백을 금지하는 대신 «고장»으로 만든다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { laneOf, 덮임검사, 사문검사, codeowners, 대상이름, 문서표, 문서에끼우다 } from '../src/governance/lane-map.mjs';
import { 지도읽기, 추적파일 } from '../scripts/check-lane-coverage.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 지도 = 지도읽기();
const 파일 = 추적파일();

test('★공백이 없다 — 추적 파일 전부가 어느 lane 에 속한다', () => {
  const { 공백, 전체, 덮인수 } = 덮임검사(파일, 지도);
  assert.deepEqual(
    공백.slice(0, 10), [],
    `lane 없는 파일 ${공백.length}개. registry/lanes.json 에 규칙을 더해라 (덮임 ${덮인수}/${전체})`
  );
});

test('★죽은 규칙이 없다 — 한 번도 이기지 못하는 줄은 «있는 척하는 분류»다', () => {
  /** 실측: 처음 썼을 때 `^src/work/`·`^src/control-tower/` 가 걸렸다. 그 폴더는 아예 없었다.
   *  지도에 있지도 않은 것을 적어 두면 읽는 사람이 그 분류가 산다고 믿는다. */
  assert.deepEqual(사문검사(파일, 지도), [], '이기지 못하는 규칙이 있다 — 지우거나 위로 올려라');
});

test('규칙 A — 검사와 계약은 «대상»의 lane 을 따른다', () => {
  assert.equal(대상이름('test/erp5-keeper.test.mjs'), 'erp5-keeper');
  assert.equal(laneOf('test/erp5-keeper.test.mjs', 지도).lane, laneOf('scripts/erp5-keeper.mjs', 지도).lane);
  assert.equal(laneOf('test/erp5-keeper.test.mjs', 지도).lane, 'I');
});

test('★「기타」 통이 없다 — 검사에는 fallback 이 있으면 안 된다', () => {
  /** fallback 이 있으면 덮임은 언제나 100% 라 위 검사가 아무것도 증명하지 못한다.
   *  CODEOWNERS 의 포괄 줄은 목적이 다르다(리뷰어 없는 파일 방지). 둘을 섞지 않는다. */
  assert.equal(지도.unmatched.checker, 'FAIL');
  assert.equal(laneOf('한번도없던폴더/무엇.txt', 지도).lane, null, '모르는 경로를 조용히 삼킨다');
});

test('U 는 잠겨 있다 — 일 없는 lane 은 «없는 일»을 만든다', () => {
  assert.equal(지도.lanes.U.dormant, true);
  assert.ok(지도.lanes.U.dormant_reason?.length > 10, '잠근 까닭이 없으면 다음 사람이 그냥 연다');
});

test('CODEOWNERS 는 손으로 쓰지 않고 이 지도에서 나온다 — 어긋나면 그게 새 공백이다', () => {
  const 만든것 = codeowners(지도, Object.fromEntries(Object.keys(지도.lanes).map((k) => [k, '@freepass-creator'])));
  const 있는것 = readFileSync(resolve(root, '.github/CODEOWNERS'), 'utf8');
  assert.equal(있는것, 만든것, '.github/CODEOWNERS 가 지도와 다르다 — node scripts/check-lane-coverage.mjs --write-codeowners');
  assert.match(만든것, /^\* @/m, '포괄 줄이 없으면 리뷰어 없는 파일이 생긴다');
});

test('운영 모델 문서의 lane 표도 지도에서 나온다 — 문서와 지도가 따로 놀면 그게 새 공백이다', () => {
  const 본문 = readFileSync(resolve(root, 'docs/UFEI-OPERATING-MODEL.md'), 'utf8');
  const { lane별 } = 덮임검사(파일, 지도);
  const 세기 = Object.fromEntries(Object.keys(지도.lanes).map((k) => [k, (lane별[k] ?? []).length]));
  assert.equal(
    본문, 문서에끼우다(본문, 문서표(지도, 세기)),
    'docs/UFEI-OPERATING-MODEL.md 의 표가 지도와 다르다 — node scripts/check-lane-coverage.mjs --write-codeowners'
  );
});

test('★이 모델이 «안» 고치는 것을 문서가 말한다 — 깔끔함을 안전함으로 착각하지 않게', () => {
  /** 2026-09-28 에 실제로 아팠던 넷(6일 침묵·틀린 방아쇠·틀린 정본·하루 전패)은 lane 으로 안 막힌다.
   *  그 한계를 문서에서 지우면 다음 사람이 UFEI 를 만능으로 읽는다. */
  const 본문 = readFileSync(resolve(root, 'docs/UFEI-OPERATING-MODEL.md'), 'utf8');
  assert.match(본문, /쓰기 규율.*읽기 규율이 아니다/s);
  assert.match(본문, /정본 대조/);
});

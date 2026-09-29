// 데이터 종류마다 «주인 하나» — 공백 없이, 그리고 모르는 것을 «끝났다»고 하지 않게.
//
// ★대표 2026-09-29: 「데이터 관리는 참 제일 중요한 것 같아」
//   실측: 미수 정본이 문서 다섯 곳에 다르게 적혀 있었고, 주인 없는 데이터가 일곱 가지였고,
//   전역 지침이 가리키던 정본 파일 8개가 디스크에 없었다. Codex 와 초안을 두 번 주고받아 정했다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 표 = JSON.parse(readFileSync(resolve(root, 'registry/data-owners.json'), 'utf8'));
const 주인들 = new Set(Object.keys(표.owners));

test('★모든 데이터 종류에 주인이 적혀 있다 — 정해진 주인 중 하나로', () => {
  for (const [이름, k] of Object.entries(표.kinds)) {
    assert.ok(k.owner, `${이름} 에 주인이 없다`);
    assert.ok(주인들.has(k.owner), `${이름} 의 주인 «${k.owner}» 는 정해진 주인이 아니다`);
  }
});

test('★파생값도 책임자가 있다 — 「계산값이라 주인 없음」은 고칠 사람이 없다는 뜻이다', () => {
  /** Codex 정정(2026-09-29). 판매시트·미수가 틀려도 책임자가 없으면 아무도 안 고친다. */
  for (const [이름, k] of Object.entries(표.kinds)) {
    if (!String(k.kind ?? '').startsWith('DERIVED')) continue;
    assert.ok(k.derived_from, `${이름} 은 파생인데 무엇에서 나오는지 없다`);
    assert.notEqual(k.owner, 'UNKNOWN', `${이름} 은 파생인데 책임자가 없다`);
  }
});

test('★미수는 «계산값»이 아니다 — 시트값도 들어가고, 쓰는 곳이 여럿이다', () => {
  /** 처음 초안의 가장 큰 오류였다. 이 사실을 지우면 「미수는 계산하면 나온다」가 되살아나고,
   *  그러면 시트에서 들어온 값과 계산값이 섞인 채로 «정본»이라 부르게 된다. */
  const m = 표.kinds.미수;
  assert.equal(m.owner, 'BUSINESS');
  assert.match(m.derived_from, /시트값/);
  assert.match(m.one_writer_violation, /최소 둘/, '쓰는 곳이 하나가 아니라는 사실이 빠지면 「쓰는 곳 하나」 원칙이 지켜지는 줄 안다');
  assert.match(m.correction_2026_09_29, /틀렸다/);
});

test('입력 자리와 정본을 같은 칸에 적지 않는다 — 섞으면 「시트를 세라」가 되살아난다', () => {
  for (const [이름, k] of Object.entries(표.kinds)) {
    if (k.input && k.canon) assert.notEqual(k.input, k.canon, `${이름} 의 입력과 정본이 같은 글이다`);
  }
});

test('★UNKNOWN 은 기록은 되지만 «완료»는 막는다', () => {
  /** Codex: 「UNKNOWN 은 기록 허용·완료 불가」. 모르는 것을 숨기지도, 모르는 채로 끝났다고 하지도 않는다. */
  const 남은 = Object.entries(표.kinds).filter(([, k]) => k.owner === 'UNKNOWN').map(([n]) => n);
  if (남은.length) {
    assert.doesNotMatch(표.status, /^COMPLETE/, `UNKNOWN 이 ${남은.length}개(${남은.join(', ')}) 남았는데 완료로 적혀 있다`);
    for (const n of 남은) assert.ok(표.kinds[n].proposal, `${n} 은 UNKNOWN 인데 제안조차 없다 — 모르는 것도 다음 한 걸음은 적는다`);
  }
});

test('차량 경계에 «잇는 열쇠»가 적혀 있다 — 공급사 차가 우리 차가 되는 순간', () => {
  const 열쇠 = 표.boundary.차량.required_keys.join(' ');
  for (const 꼭 of ['VIN', '매입 회차', '취소']) assert.match(열쇠, new RegExp(꼭), `차량 경계에 ${꼭} 이 빠졌다(Codex)`);
});

test('정본 저장소는 Firestore 이고 RTDB 는 폐기다 — 전역 지침과 어긋나지 않는다', () => {
  assert.match(표.principles.canon_store, /Firestore/);
  assert.match(표.principles.canon_store, /RTDB.*폐기/);
});

test('★서로 어긋나는 출처는 «확정»이 아니라 HOLD 로 적는다 — 정산(Codex 검토)', () => {
  /** 「ERP 만 쓴다」와 「입력 기본은 아직 F04」가 한 칸에 확정처럼 같이 있었다. */
  assert.match(표.kinds.정산.canon, /HOLD/);
  assert.match(표.kinds.정산.hold, /대표 확인/);
});

test('★읽는 길은 코드가 실제로 읽는 것만 적는다 — bogi 요약은 문서 수뿐(Codex 검토)', () => {
  /** 「bogi 요약 = 대수 정본」「bogi 는 bank_deposit 도 읽는다」라고 적었다가 둘 다 틀렸다.
   *  없는 읽는 길을 적으면 세션이 그 길로 «답»을 만든다. */
  assert.match(표.kinds.대수가동률.read, /읽는 도구 없음/);
  assert.doesNotMatch(표.kinds.수납입금.read, /bank_deposit 도|둘 다 읽는다/);
  assert.match(표.read_tool_defect, /catch/);
});

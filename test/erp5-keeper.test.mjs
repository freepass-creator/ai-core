// 지킴이의 «판단»을 고정한다 — 여기가 틀리면 상품이 안 갱신되거나 이중으로 걸린다.
//
// ★대표 2026-09-28: 「뭘 또 내 손이 필요해. 너는 왜 못 하냐」
//   지킴이가 Claude 예약작업이라 권한 승인 대기에서 멈췄고, 멈춘 회차가 이후 44회를 막았다.
//   판단에 판단이랄 게 없으므로(다섯 조건) 순수 스크립트로 옮겼다. 그 판단을 여기서 지킨다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { 걸까, 깨우는인자, 자료나이분, 자료시각, 창안인가, 한국시각 } from '../scripts/erp5-keeper.mjs';

/** KST 로 원하는 시각을 만든다 — 검사가 이 PC 의 시간대에 휘둘리면 안 된다. */
const kst = (날짜, 시, 분 = 0) => new Date(`${날짜}T${String(시).padStart(2, '0')}:${String(분).padStart(2, '0')}:00+09:00`);
const 회차 = (분전, 덮을것 = {}) => ({
  databaseId: 1, event: 'schedule', status: 'completed', conclusion: 'success',
  createdAt: new Date(kst('2026-09-30', 14).getTime() - 분전 * 60000).toISOString(), ...덮을것
});
const 정상사실 = { 상태: 'LATE', 나이분: 95, 자료안바뀜: false };

test('★업무 시작 «전»이 창 안이다 — 영업자가 틀린 값을 보기 전에 고친다', () => {
  /** 대표 2026-09-28: 「업무 시간에 하지 말고 업무 시간 좀 전에 해서 … 문제 있는 걸 알려주는 게 낫지 않나」
   *  09:35 에 알아채면 복구가 09:50 이라 이미 늦다. 08:00 에 걸면 08:15 에 최신이 된다. */
  assert.equal(창안인가(kst('2026-09-28', 8, 0)), true, '08:00 은 창 안이어야 한다 — 여기가 업무 전 복구 자리다');
  assert.equal(창안인가(kst('2026-09-28', 7, 59)), false, '07:59 는 아직 밖이다');
  assert.equal(창안인가(kst('2026-09-28', 9, 0)), true, '옛 규칙(09:30 이전 제외)이 되살아나면 안 된다');
});

test('창은 월~토 08:00~19:59 KST 다 — 일요일과 이른 아침은 밖이다', () => {
  /** ★2026-09-26 이 토, 09-27 이 일이다. 나(Claude)는 이걸 09-27 토 / 09-28 일 로 잘못 알고
   *  대표에게 「오늘은 일요일이라 안 돈다」고 틀리게 보고했다. 이 검사가 그 자리에서 잡았다 —
   *  요일은 세지 말고 «계산»한다. */
  assert.equal(창안인가(kst('2026-09-26', 14)), true, '토요일 오후는 안이다');
  assert.equal(창안인가(kst('2026-09-27', 14)), false, '일요일은 밖이다');
  assert.equal(창안인가(kst('2026-09-28', 14)), true, '월요일 오후는 안이다');
  assert.equal(창안인가(kst('2026-09-30', 7, 59)), false, '07:59 는 아직 밖이다');
  assert.equal(창안인가(kst('2026-09-30', 8, 0)), true, '08:00 부터 안이다');
  assert.equal(창안인가(kst('2026-09-30', 19, 59)), true, '19:59 까지 안이다');
  assert.equal(창안인가(kst('2026-09-30', 20)), false, '20:00 은 밖이다');
});

test('★시간대를 UTC 로 세지 않는다 — KST 로 날이 바뀌는 자정 언저리', () => {
  /** UTC 로 세면 KST 오전 8시가 «전날»이 된다. 그러면 하루 11회 제한이 이틀에 걸쳐 흐트러진다. */
  assert.equal(한국시각(kst('2026-09-30', 8)).날짜, '2026-09-30');
  assert.equal(한국시각(kst('2026-09-30', 0, 30)).날짜, '2026-09-30');
});

test('조건이 다 맞으면 건다', () => {
  const 판단 = 걸까(정상사실, [회차(95)], kst('2026-09-30', 14));
  assert.equal(판단.건다, true, 판단.까닭);
});

test('★이미 도는 회차가 있으면 걸지 않는다 — 이중 발행이 제일 나쁘다', () => {
  for (const 상태 of ['queued', 'in_progress', 'pending', 'waiting', 'requested']) {
    const 판단 = 걸까(정상사실, [회차(95, { status: 상태 })], kst('2026-09-30', 14));
    assert.equal(판단.건다, false, `${상태} 인데 걸려 한다`);
  }
});

test('최근 회차가 50분이 안 됐으면 걸지 않는다', () => {
  assert.equal(걸까(정상사실, [회차(49)], kst('2026-09-30', 14)).건다, false);
  assert.equal(걸까(정상사실, [회차(51)], kst('2026-09-30', 14)).건다, true);
});

test('★「자료도 안 바뀜」이면 걸지 않는다 — 다시 걸어도 같은 자리에서 죽는다', () => {
  const 판단 = 걸까({ ...정상사실, 자료안바뀜: true }, [회차(95)], kst('2026-09-30', 14));
  assert.equal(판단.건다, false);
  assert.match(판단.까닭, /진짜 고장/);
});

test('하루 11번을 넘기지 않는다 — 그리고 «어제 것»은 오늘로 세지 않는다', () => {
  const 오늘열하나 = Array.from({ length: 11 }, () => 회차(95, { event: 'workflow_dispatch' }));
  assert.equal(걸까(정상사실, 오늘열하나, kst('2026-09-30', 14)).건다, false, '11회를 넘겨 건다');

  const 어제것 = Array.from({ length: 11 }, () => 회차(95 + 24 * 60, { event: 'workflow_dispatch' }));
  assert.equal(걸까(정상사실, 어제것, kst('2026-09-30', 14)).건다, true, '어제 회차를 오늘로 세고 있다');
});

test('★회차 목록이 비면 «모르는» 것이다 — 모르면 걸지 않는다', () => {
  const 판단 = 걸까(정상사실, [], kst('2026-09-30', 14));
  assert.equal(판단.건다, false);
  assert.match(판단.까닭, /못 읽었다/);
});

test('★거는 판단은 부작용이 없다 — 검사가 실제 판단을 그대로 시험할 수 있어야 한다', () => {
  const 회차들 = [회차(95)];
  const 사본 = JSON.parse(JSON.stringify(회차들));
  걸까(정상사실, 회차들, kst('2026-09-30', 14));
  assert.deepEqual(회차들, 사본, '판단하면서 입력을 바꾼다');
});

// ★2026-09-28 — 지킴이가 «틀린 방아쇠»를 당기고 있었다.
//   erp5-ssot-refresh.yml 은 이벤트마다 도는 단계가 다르다. workflow_dispatch apply=true 는
//   「재수집 없이」 옛 스냅샷을 시트에만 다시 쓴다(입력 설명 그대로). 빠진 회차를 «채우는» 이벤트는
//   repository_dispatch 뿐이고 저장소 자체 워치독도 그걸 쓴다. 성공 84건 중 38건이 틀린 쪽이었다.
test('★기본 방아쇠는 repository_dispatch 다 — apply=true 는 자료를 복구하지 않는다', () => {
  const 인자 = 깨우는인자();
  assert.deepEqual(인자, [
    'api', 'repos/freepass-creator/freepasserp4/dispatches',
    '-f', 'event_type=erp5_refresh_watchdog'
  ]);
  assert.ok(!인자.includes('apply=true'), 'apply=true 로 되돌아가면 시트만 새로 쓰고 자료는 낡은 채로 남는다');
});

test('옛 길은 남겨 두되 «명시»해야 쓰인다 — 그리고 모르는 방식은 던진다', () => {
  assert.ok(깨우는인자('workflow_dispatch').includes('apply=true'));
  assert.throws(() => 깨우는인자('아무거나'), /KEEPER_UNKNOWN_TRIGGER/);
});

// ★2026-09-28 — 신선도를 「발행 시각」으로 보던 것을 고친다.
//   발행 시각은 «시트에 마지막으로 쓴 때»지 «자료를 언제 떴나»가 아니다. 옛 스냅샷을 다시 쓰면
//   발행만 새로워지고 자료는 낡은 채로 남는데, 그 상태를 우리 감시는 「정상」으로 읽었다.
test('★자료 나이는 발행판 id 에서 읽는다 — 발행 시각과 «따로» 봐야 한다', () => {
  const 판 = '20260927163804258-464407be62f2';
  assert.equal(자료시각(판).toISOString(), '2026-09-27T16:38:04.258Z');
  assert.equal(자료나이분(판, new Date('2026-09-27T17:38:04.258Z')), 60);
});

test('★못 읽으면 null 이다 — 「모른다」를 0분으로 세지 않는다', () => {
  /** 0 으로 세면 읽지 못한 것이 「방금 뜬 자료」로 둔갑한다. 그게 이 사건의 병이었다. */
  for (const 나쁜것 of [null, undefined, '', '이상한값', 'abcdefghijklmnopq-1234']) {
    assert.equal(자료시각(나쁜것), null);
    assert.equal(자료나이분(나쁜것), null);
  }
});

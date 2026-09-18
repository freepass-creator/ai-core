import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { 판정, 오늘회차, 발행시각, 알릴까 } from '../src/integration/ops-watch.mjs';

const op = JSON.parse(readFileSync(new URL('../registry/operations.json', import.meta.url), 'utf8')).operations[0];
/** KST 시각 → Date. 2026-09-18 은 금요일, 09-20 은 일요일. */
const K = (s) => new Date(`${s}+09:00`);
const 회 = (id, s, o = {}) => ({ id, event: 'schedule', status: 'completed', conclusion: 'success', created_at: K(s).toISOString(), ...o });
const 발 = (s) => ({ snapshotId: `${K(s).toISOString().replace(/[-:TZ.]/g, '')}-abc` });
const 코드 = (판) => 판.이유.map((이) => 이.code);

test('창 — 등록부의 창(월~토 09:05~19:05 매시)을 그대로 편다', () => {
  const 금 = 오늘회차(op.창, K('2026-09-18T12:00'));
  assert.equal(금.length, 11);
  assert.equal(new Date(금[0]).toISOString(), '2026-09-18T00:05:00.000Z');
  assert.equal(new Date(금.at(-1)).toISOString(), '2026-09-18T10:05:00.000Z');
  assert.deepEqual(오늘회차(op.창, K('2026-09-20T12:00')), [], '일요일은 없다');
  assert.equal(오늘회차(op.창, K('2026-09-19T00:30')).length, 11, 'KST 날짜로 센다 — UTC 로는 아직 금요일');
});

test('발행 시각은 snapshotId 앞자리(UTC)에서 읽는다', () => {
  assert.equal(new Date(발행시각({ snapshotId: '20260917145848487-344b1c66e52f' })).toISOString(), '2026-09-17T14:58:48.487Z');
  assert.equal(발행시각({ snapshotId: 'x', verifiedAt: '2026-09-18T04:00:00Z' }), Date.parse('2026-09-18T04:00:00Z'));
  assert.equal(발행시각({ snapshotId: 'garbage' }), null);
});

test('★밤·일요일·창 열리기 전에는 묵은 발행을 울리지 않는다 — 설계대로 안 돈 것이다', () => {
  const 어제 = 발('2026-09-17T18:58');
  for (const 때 of ['2026-09-18T07:00', '2026-09-18T22:00', '2026-09-20T12:00']) {
    const 판 = 판정({ op, runs: [회(1, '2026-09-17T18:05')], publication: 어제, now: K(때) });
    assert.equal(판.status, 'OFF_HOURS', 때);
    assert.equal(알릴까(판), false);
  }
  const 아침 = 판정({ op, runs: [회(2, '2026-09-18T09:06')], publication: 어제, now: K('2026-09-18T10:00') });
  assert.equal(아침.status, 'OK', '창이 열리고 허용나이(120분) 전에는 밤새 묵은 발행을 탓하지 않는다');
});

test('★예약이 안 오면 LATE — 오늘 09-18 처럼 09:05 회차가 12:53 에야 온 경우', () => {
  const 판 = 판정({ op, runs: [회(1, '2026-09-17T23:47', { conclusion: 'success' })], publication: 발('2026-09-17T23:58'), now: K('2026-09-18T12:40') });
  assert.ok(코드(판).includes('SCHEDULED_RUN_MISSING'));
  assert.ok(코드(판).includes('PUBLICATION_OLDER_THAN_ALLOWED'));
  assert.equal(판.회차.기대_지금까지, 3, '12:05 회차는 12:50 까지 기다린다');
  assert.equal(판.회차.온_오늘, 0);
  assert.equal(알릴까(판), true);
  const 손 = 판정({ op, runs: [{ ...회(9, '2026-09-18T12:10'), event: 'workflow_dispatch' }], publication: 발('2026-09-18T12:20'), now: K('2026-09-18T12:40') });
  assert.equal(손.status, 'OK', '손으로 건 회차도 «돌았다» 에는 친다');
});

test('★실패 — 자료가 들어갔는지 안 들어갔는지를 가른다', () => {
  const 실패회 = 회(5, '2026-09-18T12:53', { conclusion: 'failure' });
  const 들어감 = 판정({ op, runs: [실패회], publication: 발('2026-09-18T13:03'), now: K('2026-09-18T13:10') });
  assert.equal(들어감.status, 'FAILED');
  assert.equal(들어감.이유.find((이) => 이.code === 'LAST_RUN_FAILED').자료반영, true);
  const 안들어감 = 판정({ op, runs: [실패회], publication: 발('2026-09-17T23:58'), now: K('2026-09-18T13:10') });
  assert.equal(안들어감.이유.find((이) => 이.code === 'LAST_RUN_FAILED').자료반영, false);
  const 회복 = 판정({ op, runs: [회(6, '2026-09-18T13:05'), 실패회], publication: 발('2026-09-18T13:15'), now: K('2026-09-18T13:20') });
  assert.equal(회복.status, 'OK', '실패 뒤에 성공이 끝났으면 지금은 괜찮다');
  const 도는중 = 판정({ op, runs: [{ ...회(7, '2026-09-18T13:05'), status: 'in_progress', conclusion: null }, 실패회], publication: 발('2026-09-18T13:03'), now: K('2026-09-18T13:10') });
  assert.equal(도는중.status, 'FAILED', '돌고 있는 회차는 아직 아무것도 증명하지 않는다');
  const 성공뒤도는중 = 판정({ op, runs: [{ ...회(8, '2026-09-18T13:05'), status: 'in_progress', conclusion: null }, 회(4, '2026-09-18T12:05')], publication: 발('2026-09-18T12:15'), now: K('2026-09-18T13:10') });
  assert.equal(성공뒤도는중.status, 'OK', '돌고 있다는 것만으로 실패라 하지 않는다');
});

test('★못 읽으면 UNKNOWN — 괜찮다고 하지 않는다. 창 밖이어도 알린다', () => {
  const 회차모름 = 판정({ op, runs: null, publication: 발('2026-09-18T13:03'), now: K('2026-09-18T13:10') });
  assert.equal(회차모름.status, 'UNKNOWN');
  assert.deepEqual(코드(회차모름), ['RUNS_UNOBSERVED']);
  const 발행모름 = 판정({ op, runs: [회(1, '2026-09-18T12:53')], publication: null, now: K('2026-09-18T22:00') });
  assert.equal(발행모름.status, 'UNKNOWN');
  assert.equal(알릴까(발행모름), true);
  assert.deepEqual(코드(판정({ op, runs: [], publication: { snapshotId: '??' }, now: K('2026-09-18T22:00') })), ['PUBLICATION_TIME_UNREADABLE']);
});

test('가장 무거운 것이 상태가 된다 — FAILED > LATE > UNKNOWN', () => {
  const 판 = 판정({ op, runs: [회(1, '2026-09-18T09:06', { conclusion: 'failure' })], publication: null, now: K('2026-09-18T12:40') });
  assert.deepEqual(new Set(코드(판)), new Set(['SCHEDULED_RUN_MISSING', 'LAST_RUN_FAILED', 'PUBLICATION_UNOBSERVED']));
  assert.equal(판.status, 'FAILED');
});

#!/usr/bin/env node
// 상품 갱신 지킴이 — «사람도 AI도 없이» 도는 판. 빠진 회차만 한 번 걸어 준다.
//
// ★대표 2026-09-28: 「뭘 또 내 손이 필요해. 너는 왜 못 하냐」
//
//   맞는 지적이었다. 지킴이를 Claude 예약작업으로 둔 탓에 내 권한이 필요했고, 그래서 멈췄다.
//   2026-09-22~28 실측 고장:
//     · 회차 하나가 시작 7초 뒤 «권한 승인 대기»로 멈췄다. 무인 실행이라 눌러 줄 사람이 없다.
//     · 그런데 «끝나지도» 않아서(status: running) 스케줄러가 이후 44회를 아예 안 걸었다.
//     · 그 전 3회는 «주간 사용량 한도»로 실패했다.
//     · 게다가 앱이 닫혀 있으면 아예 돌지 않는다.
//   네 가지 다 «Claude 세션이라서» 생긴다. 이 판단에는 판단이랄 게 없다 — 다섯 조건을 보고 걸거나 만다.
//   그래서 순수 스크립트로 옮긴다. 권한을 넓히는 대신 권한이 필요 없게 만든다.
//
// ★바꾸지 않은 것 (대표 2026-09-18 「아무것도 바뀌지 않고 네가 담당해」):
//   실행은 여전히 `freepasserp4` 의 `erp5-ssot-refresh.yml` 하나뿐이고, 조건도 SKILL.md 의 다섯 개 그대로다.
//   옮긴 것은 «누가 그 판단을 돌리나» 뿐이다.
//
//   node scripts/erp5-keeper.mjs --env-file <경로>        본다. 조건이 맞으면 한 번 건다
//   node scripts/erp5-keeper.mjs --env-file <경로> --dry  «걸지 않고» 무엇을 할지만 말한다
import { execFile } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 관측하다, 읽어내다 } from './ops-to-ledger.mjs';

const run = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 저장소 = 'freepass-creator/freepasserp4';
const 워크플로 = 'erp5-ssot-refresh.yml';
const 값 = (이름) => {
  const i = process.argv.indexOf(이름);
  return i > 0 ? process.argv[i + 1] : null;
};

/** 지금이 KST 로 언제인가. 서버 시간대에 기대지 않는다 — 이 판단이 하루에 11번 갈린다. */
export function 한국시각(지금 = new Date()) {
  const kst = new Date(지금.getTime() + 9 * 60 * 60 * 1000);
  return { 요일: kst.getUTCDay(), 시: kst.getUTCHours(), 분: kst.getUTCMinutes(), 날짜: kst.toISOString().slice(0, 10) };
}

/** 창 안인가 — 월~토 09:30~19:59 KST. SKILL.md 의 조건 그대로다. */
export function 창안인가(지금 = new Date()) {
  const { 요일, 시, 분 } = 한국시각(지금);
  if (요일 === 0) return false;
  if (시 < 9 || 시 > 19) return false;
  if (시 === 9 && 분 < 30) return false;
  return true;
}

/**
 * 걸어야 하나 — 다섯 조건을 «전부» 만족할 때만 true. 하나라도 아니면 까닭을 돌려준다.
 *
 * ★이 함수는 부작용이 없다. 그래서 검사가 실제 판단을 그대로 시험할 수 있다.
 */
export function 걸까(사실, 회차들, 지금 = new Date()) {
  if (!창안인가(지금)) return { 건다: false, 까닭: '창 밖 (월~토 09:30~19:59 KST 아님)' };
  if (사실.자료안바뀜) return { 건다: false, 까닭: '★자료도 안 바뀜 — 진짜 고장이라 다시 걸어도 같은 자리에서 죽는다' };

  const 도는중 = 회차들.filter((r) => ['queued', 'in_progress', 'pending', 'waiting', 'requested'].includes(r.status));
  if (도는중.length) return { 건다: false, 까닭: `이미 도는 회차가 있다 (${도는중[0].status})` };

  const 최근 = 회차들[0];
  if (!최근) return { 건다: false, 까닭: '회차 목록을 못 읽었다 — 모르면 걸지 않는다' };
  const 나이분 = (지금 - new Date(최근.createdAt)) / 60000;
  if (나이분 < 50) return { 건다: false, 까닭: `최근 회차가 ${Math.round(나이분)}분 전 — 50분이 안 됐다` };

  const 오늘 = 한국시각(지금).날짜;
  const 오늘손수 = 회차들.filter(
    (r) => r.event === 'workflow_dispatch' && 한국시각(new Date(r.createdAt)).날짜 === 오늘
  );
  if (오늘손수.length >= 11) return { 건다: false, 까닭: `오늘 이미 ${오늘손수.length}번 걸었다 (11회 제한)` };

  return { 건다: true, 까닭: `발행 ${사실.나이분 ?? '?'}분 전 · 최근 회차 ${Math.round(나이분)}분 전 · 오늘 ${오늘손수.length}번째` };
}

/** 무슨 판단을 했는지 한 줄 남긴다. 조용히 지나간 회차와 «안 돈» 회차를 구별하려면 이게 있어야 한다. */
async function 적는다(줄) {
  const 때 = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await appendFile(resolve(root, '.local/erp5-keeper.log'), `${때}Z  ${줄}\n`).catch(() => {});
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const envFile = 값('--env-file');
  const 시늉 = process.argv.includes('--dry');

  const 사실 = 읽어내다(await 관측하다({ envFile }));
  if (!사실.운영id) {
    const 줄 = 'HOLD: ops-watch 출력을 못 읽었다 — 걸지 않는다';
    console.log(줄);
    await 적는다(줄);
    process.exit(1);
  }

  let 회차들 = [];
  try {
    const { stdout } = await run(
      'gh',
      ['run', 'list', '-R', 저장소, '--workflow', 워크플로, '--limit', '10', '--json', 'databaseId,event,status,conclusion,createdAt'],
      { cwd: root, timeout: 120_000, windowsHide: true }
    );
    회차들 = JSON.parse(stdout);
  } catch (오류) {
    /** ★gh 가 실패하면 «모른다». 모르면 걸지 않는다 — 두 번 거는 것보다 한 번 빠지는 게 낫다. */
    const 줄 = `HOLD: gh run list 실패 — ${String(오류.message).split('\n')[0]}`;
    console.log(줄);
    await 적는다(줄);
    process.exit(1);
  }

  const 판단 = 걸까(사실, 회차들);
  const 머리 = `${사실.상태} · 발행 ${사실.나이분 ?? '?'}분 전`;

  if (!판단.건다) {
    console.log(`${머리} · 안 걸었음: ${판단.까닭}`);
    await 적는다(`안 걸었음 (${머리}) — ${판단.까닭}`);
    process.exit(0);
  }

  if (시늉) {
    console.log(`${머리} · [시늉] 걸었을 것: ${판단.까닭}`);
    process.exit(0);
  }

  try {
    await run('gh', ['workflow', 'run', 워크플로, '-R', 저장소, '--ref', 'main', '-f', 'apply=true'], {
      cwd: root, timeout: 120_000, windowsHide: true
    });
    console.log(`${머리} · 걸었음: ${판단.까닭}`);
    await 적는다(`★걸었음 (${머리}) — ${판단.까닭}`);
  } catch (오류) {
    const 줄 = `HOLD: 거는 데 실패 — ${String(오류.message).split('\n')[0]}`;
    console.log(줄);
    await 적는다(줄);
    process.exit(1);
  }
}

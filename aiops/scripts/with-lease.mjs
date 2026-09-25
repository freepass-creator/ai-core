/**
 * 라이브 실행 wrapper — 명령 하나를 lease 안에서 돌린다.
 *
 * ★2026-08-30 — 대표: 「쓰기 이런 거 이제 다 권한 풀어」
 *   전에는 **--task 와 --approval 이 «반드시»** 있어야 했고, 작업대장에
 *   D등급 APPROVAL_PENDING 이 미리 서 있어야 했다. 그 넷 중 하나만 빠져도 멈췄다.
 *   이제 **--resource 와 명령만 있으면 돈다.** 작업번호는 스스로 짓는다.
 *
 * ── 그냥 돌린다 (거의 이것만 쓴다)
 *   node scripts/with-lease.mjs --resource sheet:<id> -- node wonja/무엇.mjs
 *
 * ── 작업대장에 남기며 돌린다 (증적이 필요한 큰 변경일 때만)
 *   node scripts/with-lease.mjs --task OPS-20260820-001 --approval chat-1 --resource sheet:<id> -- node …
 *   이때는 전처럼 D등급 APPROVAL_PENDING 이어야 하고, 끝나도 APPLIED 다 —
 *   원본을 재조회한 뒤 VERIFIED 로 옮긴다.
 *
 * ★스크립트 «안에서» 쓸 때는 이걸 부르지 말고 `lib/쓴다.mjs` 를 쓴다. 한 줄이면 된다.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { childLeaseEnv, normalizeTarget, withLease } from '../lib/lease.mjs';
import { 작업번호 } from '../lib/쓴다.mjs';
import { beginLiveExecution, failLiveExecution, getTask, recordLiveExecutionResult } from '../lib/task-board.mjs';
import { 지나가도되나, 실행기록, 계획해시, 양식해시, 대상해시, 행위등급 } from '../lib/seungin.mjs';

const raw = process.argv.slice(2);
const divider = raw.indexOf('--');
if (divider < 0) throw new Error('실행할 명령 앞에 -- 가 필요합니다.');
const flagArgs = raw.slice(0, divider);
const command = raw.slice(divider + 1);
const flag = (name) => {
  const index = flagArgs.indexOf(`--${name}`);
  return index >= 0 ? flagArgs[index + 1] : undefined;
};
const taskId = flag('task');
const approval = flag('approval');
const purpose = flag('purpose') || '라이브 변경 실행';
const resources = [];
for (let i = 0; i < flagArgs.length; i += 1) {
  if (flagArgs[i] === '--resource' && flagArgs[i + 1]) resources.push(normalizeTarget(flagArgs[i + 1]));
}
const uniqueResources = [...new Set(resources)].sort();
const 누가 = flag('agent') || 'claude';
if (!uniqueResources.length || !command.length) {
  throw new Error('--resource 와 실행 명령이 필요하다.\n  예: node scripts/with-lease.mjs --resource sheet:<id> -- node wonja/무엇.mjs');
}

/** ★★행위 문턱 — OPS-20260831-110 (대표 2026-08-31)
 *
 *  「승인 구조를 Claude 단일 필수에서 «다중 검증 대체» 로 바꿔 주세요」
 *
 *  ★안 주면 «전과 똑같이» 돈다 — 기존 사용법을 깨지 않는다(호환).
 *    `--행위` 를 준 때만 승인 문턱이 선다.
 *
 *    --행위 local        로컬 PDF 생성·형식 검증        → Codex 단독
 *    --행위 drive-add    발송전 폴더에 «새 파일만»       → 대표 승인 + 독립 검토자 1
 *    --행위 protected    삭제·이동·권한·발송·정본삭제    → ★긴급 우회 불가
 *
 *    --계획 <json경로>    무엇을 하겠다        (계획SHA)
 *    --양식 <경로,경로>    어느 양식으로        (양식SHA)
 *    --대상 <json경로>    무엇을 건드리나       (대상해시·건수)
 *
 *  ★셋이 하나라도 바뀌면 앞의 검토는 «없는 것» 이 된다 — 계획을 고치고 옛 승인을 못 쓴다.
 */
const 행위 = flag('행위') || flag('action');
const 계획길 = flag('계획') || flag('plan');
const 양식길 = flag('양식') || flag('template');
const 대상길 = flag('대상') || flag('targets');

let 문턱 = null;
if (행위) {
  if (!행위등급[행위]) {
    throw new Error(`--행위 는 ${Object.keys(행위등급).join(' · ')} 중 하나여야 한다: ${행위}`);
  }
  if (!계획길 || !양식길 || !대상길) {
    throw new Error('--행위 를 줬으면 --계획 · --양식 · --대상 이 모두 있어야 한다.'
      + ' ★검토는 «무엇을 봤는지» 에 묶인다. 그 셋이 없으면 승인을 지어낼 수 있다.');
  }
  const { readFile } = await import('node:fs/promises');
  const 계획 = JSON.parse(await readFile(계획길, 'utf8'));
  const 대상목록 = JSON.parse(await readFile(대상길, 'utf8'));
  const 대 = 대상해시(Array.isArray(대상목록) ? 대상목록 : (대상목록.대상 ?? []));
  문턱 = {
    등급: 행위,
    계획SHA: 계획해시(계획),
    양식SHA: await 양식해시(String(양식길).split(',').map((x) => x.trim())),
    대상SHA: 대.해시,
    건수: 대.건수,
    실행자: 누가,
    명령: command,
  };
  const 판 = await 지나가도되나(문턱);
  console.log(`
── 승인 문턱  「${행위}」 ${행위등급[행위].무엇}`);
  console.log(`   계획 ${문턱.계획SHA.slice(0, 12)} · 양식 ${문턱.양식SHA.slice(0, 12)} · 대상 ${문턱.대상SHA.slice(0, 12)} (${문턱.건수}건)`);
  if (!판.된다) {
    console.log(`   ★막혔다 — ${판.왜}
`);
    process.exit(2);
  }
  console.log(`   ✔ ${판.길} — ${판.왜}
`);
  문턱.길 = 판.길;
  await 실행기록({ ...문턱, 언제: '전', 전: { 대상건수: 문턱.건수 } });
}

/**
 * ★대장에 남기나 — `--task` 를 준 때만이다.
 *
 *  안 주면 lease 만 잡고 그대로 돌린다. 잠금은 그대로 걸리고 감사기록(.coordination/audit.ndjson)도
 *  그대로 남는다. 다만 작업대장 APPLIED/VERIFIED 를 거치지 않는다 — 그 절차가 사람을 막던 것이었다.
 */
const 대장에남긴다 = Boolean(taskId);

if (대장에남긴다) {
  if (!approval) throw new Error('--task 를 줬으면 --approval 도 있어야 한다. 대장에 안 남기려면 --task 를 빼라.');
  const task = await getTask(taskId);
  if (task.riskTier !== 'D' || task.status !== 'APPROVAL_PENDING') {
    throw new Error(`D등급 APPROVAL_PENDING 작업만 대장에 남길 수 있습니다: ${task.status}`);
  }
}

/** 대장에 안 남기더라도 lease 는 이름이 있어야 한다 — 누가 쥐고 있는지 보이게 */
const 잠글때쓸번호 = taskId || 작업번호(command[1] ? command[1].split(/[\\/]/).pop() : '');

if (!대장에남긴다) {
  /** ── 그냥 돌린다. 잠금만 걸고 명령을 실행한다 */
  const exitCode = await withLease(uniqueResources, { agent: 누가, taskId: 잠글때쓸번호, purpose }, async (leases) => {
    const tmp = join('tmp', 누가, 잠글때쓸번호, randomUUID());
    await mkdir(tmp, { recursive: true });
    return new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: process.cwd(), stdio: 'inherit', shell: false,
        env: { ...process.env, ...childLeaseEnv(leases), AIOPS_TMP_DIR: tmp },
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
  });
  if (문턱) await 실행기록({ ...문턱, 언제: '후', 후: { exitCode }, 결과: exitCode === 0 ? '됐다' : '엎어졌다' });
  process.exitCode = exitCode;
  process.exit(exitCode);
}

let attemptId = null;
let failureRecorded = false;
try {
  await withLease(uniqueResources, { agent: 누가, taskId, purpose }, async (leases) => {
    // APPLIED를 기록하기 전에 임시 경로를 확보한다. 준비 실패가 실행으로 보이면 안 된다.
    const tmp = join('tmp', 'codex', taskId, randomUUID());
    await mkdir(tmp, { recursive: true });
    const started = await beginLiveExecution(taskId, { resources: uniqueResources, command, approvalRef: approval });
    attemptId = started.execution.attemptId;
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command[0], command.slice(1), {
        cwd: process.cwd(), stdio: 'inherit', shell: false,
        env: { ...process.env, ...childLeaseEnv(leases), AIOPS_TMP_DIR: tmp },
      });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    if (exitCode !== 0) {
      await failLiveExecution(taskId, { attemptId, reason: `실행 실패(exit ${exitCode})` });
      failureRecorded = true;
      process.exitCode = exitCode;
      return;
    }
    await recordLiveExecutionResult(taskId, { attemptId, exitCode });
  });
} catch (error) {
  if (attemptId && !failureRecorded) {
    try {
      await failLiveExecution(taskId, { attemptId, reason: `실행 예외: ${String(error?.message || error).slice(0, 240)}` });
      failureRecorded = true;
    } catch {
      // 원래 예외를 보존한다. 후속 실행 전에 작업대장 APPLIED 상태를 사람이 확인해야 한다.
    }
  }
  throw error;
}

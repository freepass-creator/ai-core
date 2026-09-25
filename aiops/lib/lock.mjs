/**
 * 호환용 잠금 API.
 *
 * 예전의 Google Sheet 「AI 작업판」 read → write 잠금은 동시에 두 세션이
 * 성공할 수 있어 mutex가 아니었다. 이제 lib/lease.mjs의 로컬 원자적 lease를 쓴다.
 * 라이브 변경은 scripts/with-lease.mjs로 실행하는 방식을 우선한다.
 */
import { acquireLease, appendAudit, listLeases, normalizeTarget, releaseLease, withLease } from './lease.mjs';
import { SHEET } from './ids.mjs';

function taskId() {
  const value = process.env.AIOPS_TASK_ID;
  if (!value) throw new Error('AIOPS_TASK_ID가 없습니다. OPS-YYYYMMDD-001 작업을 먼저 만들고 lease wrapper로 실행하세요.');
  return value;
}

function resource(target) {
  const value = String(target ?? '').trim();
  if (value === '데이터센터' || value === 'drive') return 'drive';
  if (/^[a-z][a-z0-9_-]*:/i.test(value)) return normalizeTarget(value);
  const match = Object.entries(SHEET).find(([name]) => name === value);
  if (match) return `sheet:${match[1]}`;
  throw new Error(`잠금 대상은 sheet:<spreadsheetId> 또는 drive처럼 명시해야 합니다: ${target}`);
}

/** 현재 같은 제어 디렉터리를 공유하는 AI의 lease 목록 (읽기 전용). */
export async function locks() { return listLeases(); }

/** @deprecated scripts/with-lease.mjs 또는 withLease()를 사용한다. */
export async function acquire(target, who, what) {
  return acquireLease(resource(target), { agent: who, taskId: taskId(), purpose: what });
}

/** 다른 lease로 교체된 경우 release는 false를 돌려주고 새 lease를 지우지 않는다. */
export async function release(lease, result = '완료') {
  await appendAudit({ type: 'legacy-release', agent: lease?.agent, taskId: lease?.taskId, resource: lease?.target, result: String(result).slice(0, 160) });
  return releaseLease(lease);
}

/** 기존 호출부 호환. 새 코드에서는 withLease([resource], info, fn)를 사용한다. */
export async function withLock(target, who, what, fn) {
  return withLease([resource(target)], { agent: who, taskId: taskId(), purpose: what }, async () => fn());
}

/** 원격 Sheet에 쓰지 않는 로컬 감사 인계. 원문·개인정보를 넣지 않는다. */
export async function handover(who, text) {
  return appendAudit({ type: 'handover', agent: String(who).toLowerCase(), taskId: process.env.AIOPS_TASK_ID || null, note: String(text).replace(/[\r\n]/g, ' ').slice(0, 300) });
}

export async function log(who, target, what, result) {
  return appendAudit({ type: 'work-log', agent: String(who).toLowerCase(), taskId: process.env.AIOPS_TASK_ID || null, resource: resource(target), purpose: String(what).replace(/[\r\n]/g, ' ').slice(0, 160), result: String(result).replace(/[\r\n]/g, ' ').slice(0, 300) });
}

/** 원격 AI 작업판 자동 생성은 금지한다. 상태는 .coordination/에만 둔다. */
export async function ensureBoard() {
  throw new Error('원격 AI 작업판은 mutex로 사용하지 않습니다. scripts/task-board.mjs와 .coordination/을 사용하세요.');
}

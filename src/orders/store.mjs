import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultDb = fileURLToPath(new URL('../../.local/orders.sqlite', import.meta.url));
/** 누가 일하나 — ★정본
 *
 *  ★2026-09-17 대표: 「맡은이 이런 거 이제 없어」 「제미나이 참고역, 클로드·코덱스(GPT)가 메인」
 *
 *  그래서 이 표는 «누구에게 일을 나눠 주나» 가 아니라 «누가 어떤 자리에 있나» 다.
 *  - MAIN     클로드·코덱스. 둘이 같은 오더를 이어서 한다. 일을 «쪼개서 맡기지» 않는다.
 *  - ADVISORY 제미나이. 물어보는 자리다. 맡기지 않는다.
 *  ★cursor 는 뺐다 — 지금 갈래에 없다. 남겨 두면 다음 세션이 없는 사람에게 일을 맡긴다.
 *    (과거 오더의 cursor 기록은 «그때의 사실»이라 지우지 않는다. 아래 keptActors 참고.)
 */
export const actors = [
  { id: 'claude', name: 'Claude', strength: '설계·논리·구현·중요 문안 검토', role: 'MAIN', mode: 'MANUAL_HANDOFF' },
  { id: 'codex', name: 'Codex (GPT)', strength: '실행·통합·검토·결과 확인', role: 'MAIN', mode: 'MANUAL_HANDOFF' },
  { id: 'gemini', name: 'Gemini', strength: '긴 문맥·표·자료 분석 — 물어보는 자리', role: 'ADVISORY', mode: 'MANUAL_HANDOFF' },
];

/** ★이미 원장에 적힌 행위자는 계속 «읽혀야» 한다.
 *  cursor 가 맡아 보고한 과거 오더가 실재한다. 그 기록을 못 읽게 만들면
 *  「그때 누가 했나」가 사라진다. 새 배정에는 못 쓰고, 옛 기록은 그대로 읽힌다. */
export const keptActors = ['cursor'];
/** 기본 작업계획 — ★지금 «실제로» 도는 갈래를 적는다
 *
 *  ★2026-09-17 정정. 전에는 development 의 검토를 cursor 에게 보냈다. cursor 는 이제
 *  이 갈래에 없어서, 그대로 두면 오더를 만드는 순간 «없는 사람»에게 검토가 배정된다.
 *  실제로 검사가 그것을 잡았다(INVALID_ACTOR).
 *
 *  검토는 코덱스(GPT)가 받는다 — docs/AI-SSOT-AUDIT-LOG.md 가 그 채널이고 실제로 그렇게 돈다.
 *  ★여기서 고친 것은 «없는 사람에게 가던 한 자리»뿐이다. document·analysis 의 제미나이
 *    자리는 그대로 뒀다 — 「참고역」이라는 대표 말과 「자료 분석을 묻는다」는 이 배정은
 *    어긋나지 않는다. 안 깨진 것을 같이 바꾸지 않는다.
 */
const plans = {
  development: [['design', '설계와 완료 조건', 'claude'], ['execute', '구현과 검증', 'codex'], ['review', '코드 독립 검토', 'codex']],
  document: [['analyze', '자료 분석', 'gemini'], ['design', '논리와 문안 검토', 'claude'], ['execute', '결과물 제작과 확인', 'codex']],
  analysis: [['analyze', '자료 분석', 'gemini'], ['review', '논리와 반례 검토', 'claude'], ['execute', '근거 대조와 결과 정리', 'codex']],
  general: [['execute', '처리와 결과 확인', 'codex']],
};
export class OrderError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status; }
}
function need(condition, code, message, status = 400) { if (!condition) throw new OrderError(code, message, status); }
function text(value, label, max = 10000) {
  need(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'INVALID_INPUT', `${label}을(를) 확인하세요.`);
  return value.trim();
}
function lines(value, label) {
  need(Array.isArray(value) && value.length > 0 && value.length <= 30, 'INVALID_INPUT', `${label}은(는) 1~30개여야 합니다.`);
  return value.map(v => text(v, label, 2000));
}
function digest(value) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
// 새로 맡기는 것은 현재 표에 있는 행위자만. 물러난 행위자(keptActors)는 옛 기록을
// 읽을 때만 유효하고 새 배정에는 쓰이지 않는다.
function actor(id) { need(actors.some(a => a.id === id), 'INVALID_ACTOR', '지원하는 AI를 선택하세요.'); return id; }

function routing(value, project) {
  if (value == null) return null;
  need(value && typeof value === 'object' && !Array.isArray(value), 'INVALID_ROUTING', '업무 라우팅 정보를 확인하세요.');
  const allowed = new Set(['status','work_type_id','capability_id','target_project_id','target_revision','project_status','capability_status','capability_mode','matched_alias','blockers','requirement_revision']);
  need(Object.keys(value).every((key) => allowed.has(key)), 'INVALID_ROUTING', '업무 라우팅 정보에 허용되지 않은 필드가 있습니다.');
  need(typeof value.status === 'string' && value.status.length > 0, 'INVALID_ROUTING', '라우팅 상태가 필요합니다.');
  need(typeof value.work_type_id === 'string' && /^[a-z][a-z0-9-]{1,62}$/.test(value.work_type_id), 'INVALID_ROUTING', '업무 유형을 확인하세요.');
  need(typeof value.capability_id === 'string' && /^[a-z][a-z0-9.-]{2,80}$/.test(value.capability_id), 'INVALID_ROUTING', 'capability를 확인하세요.');
  need(value.target_project_id === project, 'INVALID_ROUTING', '라우팅 프로젝트와 오더 프로젝트가 다릅니다.');
  need(typeof value.target_revision === 'string' && /^[0-9a-f]{40}$/.test(value.target_revision), 'INVALID_ROUTING', '라우팅 revision을 확인하세요.');
  need(Number.isSafeInteger(value.requirement_revision) && value.requirement_revision > 0, 'INVALID_ROUTING', '라우팅 요구 revision을 확인하세요.');
  need(Array.isArray(value.blockers) && value.blockers.every((x) => typeof x === 'string' && x.trim()), 'INVALID_ROUTING', '라우팅 blocker를 확인하세요.');
  return structuredClone(value);
}

export class OrderStore {
  #onRequirementSaved;
  constructor(path = defaultDb, { now = () => Date.now(), leaseMs = 30 * 60 * 1000, onRequirementSaved = null } = {}) {
    need(onRequirementSaved === null || typeof onRequirementSaved === 'function', 'INVALID_REQUIREMENT_HOOK', '호스트 연결 훅을 확인하세요.');
    this.#onRequirementSaved = onRequirementSaved;
    this.now = now; this.leaseMs = leaseMs;
    if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, document TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, order_id TEXT NOT NULL, document TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS events_order ON events(order_id, sequence);
      CREATE TABLE IF NOT EXISTS receipts (key TEXT PRIMARY KEY, digest TEXT NOT NULL, response TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    this.db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)').run('ledger-id', `ledger-${randomUUID()}`);
  }
  close() { this.db.close(); }
  stamp() { return new Date(this.now()).toISOString(); }
  ledgerId() { return this.db.prepare('SELECT value FROM settings WHERE key=?').get('ledger-id').value; }
  settings() { return { name: this.db.prepare('SELECT value FROM settings WHERE key=?').get('name')?.value ?? '이음', provisional: !this.db.prepare('SELECT value FROM settings WHERE key=?').get('name') }; }
  name(value) { value = text(value, '이름', 30); this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run('name', value); return this.settings(); }
  list() { return this.db.prepare('SELECT document FROM orders').all().map(r => JSON.parse(r.document)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  get(id) { const row = this.db.prepare('SELECT document FROM orders WHERE id=?').get(id); need(row, 'NOT_FOUND', '오더를 찾을 수 없습니다.', 404); return JSON.parse(row.document); }
  events(id) { this.get(id); return this.db.prepare('SELECT sequence,document FROM events WHERE order_id=? ORDER BY sequence').all(id).map(r => ({ sequence: r.sequence, ...JSON.parse(r.document) })); }
  transact(key, input, fn) {
    text(key, '중복 방지 ID', 200);
    const hash = digest(input);
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const previous = this.db.prepare('SELECT * FROM receipts WHERE key=?').get(key);
      if (previous) {
        need(previous.digest === hash, 'IDEMPOTENCY_CONFLICT', '같은 요청 ID에 다른 내용이 들어왔습니다.', 409);
        this.db.exec('COMMIT'); return JSON.parse(previous.response);
      }
      const result = fn();
      this.db.prepare('INSERT INTO receipts VALUES (?,?,?)').run(key, hash, JSON.stringify(result));
      this.db.exec('COMMIT'); return result;
    } catch (e) { if (this.db.isTransaction) this.db.exec('ROLLBACK'); throw e; }
  }
  save(order, type, by, detail) {
    if (this.#onRequirementSaved && ['CREATED', 'REVISE'].includes(type)) {
      need(this.db.isTransaction, 'REQUIREMENT_TRANSACTION_REQUIRED', '요구 연결은 접수 트랜잭션 안에서만 기록합니다.');
    }
    order.updatedAt = this.stamp();
    this.db.prepare('INSERT OR REPLACE INTO orders VALUES (?,?)').run(order.id, JSON.stringify(order));
    this.db.prepare('INSERT INTO events(order_id,document) VALUES (?,?)').run(order.id, JSON.stringify({ id: randomUUID(), at: order.updatedAt, type, by, version: order.version, revision: order.revision, detail }));
    if (this.#onRequirementSaved && ['CREATED', 'REVISE'].includes(type)) {
      const result = this.#onRequirementSaved(structuredClone(order));
      need(!result?.then, 'ASYNC_REQUIREMENT_HOOK_DENIED', '요구 연결 훅은 동기식이어야 합니다.');
    }
    return order;
  }
  create(input) {
    const { requestId, title, intent, project, kind = 'general', criteria, source = 'local', routing: routingInput = null } = input;
    return this.transact(requestId, { action: 'create', ...input }, () => {
      need(Object.hasOwn(plans, kind), 'INVALID_KIND', '작업 종류를 선택하세요.');
      const cleanProject = text(project, '프로젝트', 300);
      const route = routing(routingInput, cleanProject);
      const order = { id: `ORD-${randomUUID()}`, title: text(title, '제목', 200), intent: text(intent, '요청'), project: cleanProject, kind,
        criteria: lines(criteria, '완료 조건'), source: text(source, '출처', 1000), routing: route,
        revision: 1, version: 1, status: 'NEW', createdAt: this.stamp(), updatedAt: this.stamp(),
        tasks: plans[kind].map(([role, title, assigned], i) => ({ id: `T${i + 1}`, role, title, assigned, status: 'PENDING', attempt: 0, lease: null, report: null, blockedReason: null })),
        closure: null };
      return this.save(order, 'CREATED', 'user', { intent: order.intent, criteria: order.criteria, source: order.source, routing: order.routing, plan: order.tasks });
    });
  }
  mutate(id, command) {
    return this.transact(command.requestId, { id, ...command }, () => {
      const order = this.get(id);
      need(Number.isInteger(command.version) && order.version === command.version, 'STALE_VERSION', '다른 곳에서 변경됐습니다. 새로고침 후 다시 확인하세요.', 409);
      need(!['CLOSED', 'CANCELLED'].includes(order.status), 'TERMINAL_ORDER', '종료된 오더는 변경할 수 없습니다.', 409);
      const action = command.action;
      let by = 'user'; let detail = {};
      const task = order.tasks.find(t => t.id === command.taskId);
      if (['assign', 'claim', 'heartbeat', 'report', 'block'].includes(action)) need(task, 'TASK_NOT_FOUND', '세부 작업을 찾을 수 없습니다.', 404);
      const activeLease = t => t.lease && Date.parse(t.lease.expiresAt) > this.now();
      const verifyLease = () => {
        need(task.status === 'RUNNING' && activeLease(task) && task.lease.token === command.token && task.assigned === command.actor,
          'STALE_LEASE', '작업 확보가 만료됐거나 담당이 바뀌었습니다. 다시 확보하세요.', 409);
        by = actor(command.actor);
      };
      if (action === 'assign') {
        need(task.status !== 'REPORTED', 'ALREADY_REPORTED', '결과가 접수된 작업은 재배정할 수 없습니다. 요구 수정으로 새 검증을 시작하세요.', 409);
        need(!activeLease(task), 'ACTIVE_LEASE', '진행 중인 담당 작업을 먼저 인계 대기로 전환하세요.', 409);
        detail = { taskId: task.id, from: task.assigned, to: actor(command.actor), reason: text(command.reason, '변경 이유', 2000) };
        task.assigned = command.actor; task.status = 'PENDING'; task.lease = null; task.blockedReason = null;
      } else if (action === 'claim') {
        need(task.assigned === actor(command.actor), 'WRONG_ACTOR', '배정된 AI만 이 작업을 확보할 수 있습니다.', 409);
        need(task.status !== 'REPORTED' && !activeLease(task), 'ACTIVE_LEASE', '이미 결과가 있거나 다른 실행이 작업을 확보했습니다.', 409);
        const index = order.tasks.indexOf(task);
        need(order.tasks.slice(0, index).every(t => t.status === 'REPORTED'), 'DEPENDENCY_PENDING', '앞선 작업의 결과를 먼저 접수하세요.', 409);
        task.attempt++; task.status = 'RUNNING'; task.blockedReason = null;
        task.lease = { token: randomUUID(), expiresAt: new Date(this.now() + this.leaseMs).toISOString(), revision: order.revision };
        by = command.actor; detail = { taskId: task.id, attempt: task.attempt, expiresAt: task.lease.expiresAt };
      } else if (action === 'heartbeat') {
        verifyLease(); task.lease.expiresAt = new Date(this.now() + this.leaseMs).toISOString(); detail = { taskId: task.id, expiresAt: task.lease.expiresAt };
      } else if (action === 'report') {
        verifyLease();
        need(command.revision === order.revision && task.lease.revision === order.revision, 'STALE_EVIDENCE', '현재 요구 버전의 결과만 접수할 수 있습니다.', 409);
        task.report = { summary: text(command.summary, '결과 요약'), evidence: lines(command.evidence, '근거'), revision: order.revision, actor: command.actor, at: this.stamp(), status: 'REPORTED_NOT_INDEPENDENTLY_VERIFIED' };
        task.status = 'REPORTED'; task.lease = null; detail = { taskId: task.id, attempt: task.attempt, report: task.report };
      } else if (action === 'block') {
        verifyLease(); task.status = 'BLOCKED'; task.lease = null; task.blockedReason = text(command.reason, '대기 이유', 2000); detail = { taskId: task.id, reason: task.blockedReason };
      } else if (action === 'revise') {
        order.intent = text(command.intent, '수정 요청'); order.criteria = lines(command.criteria, '완료 조건'); order.revision++; order.closure = null;
        detail = { reason: text(command.reason, '수정 이유', 2000), intent: order.intent, criteria: order.criteria };
        for (const t of order.tasks) { t.status = 'PENDING'; t.lease = null; t.report = null; t.blockedReason = null; }
      } else if (action === 'reroute') {
        need(order.tasks.every(t => t.status === 'PENDING' && !t.lease && !t.report),
          'ROUTING_REQUIRES_IDLE_ORDER', '진행 중이거나 결과가 있는 오더는 업무 경로를 바꿀 수 없습니다.', 409);
        const bindingTable = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='coordination_bindings'").get();
        const bound = bindingTable ? this.db.prepare(
          'SELECT work_id FROM coordination_bindings WHERE order_id=? AND requirement_revision=?'
        ).get(order.id, order.revision) : null;
        need(!bound, 'ROUTING_REQUIRES_UNBOUND_REQUIREMENT',
          '이미 Work에 묶인 요구는 같은 revision에서 경로를 바꿀 수 없습니다. 요구를 revise한 뒤 다시 라우팅하세요.', 409);
        const targetProject = text(command.routing?.target_project_id, '라우팅 프로젝트', 300);
        const nextRouting = routing(command.routing, targetProject);
        need(nextRouting.requirement_revision === order.revision, 'ROUTING_REQUIREMENT_STALE', '현재 요구 revision 기준 라우팅이 필요합니다.', 409);
        const previous = order.routing ? structuredClone(order.routing) : null;
        const previousProject = order.project;
        order.project = targetProject;
        order.routing = nextRouting;
        by = 'ai-core-router';
        detail = { fromProject: previousProject, toProject: targetProject, previous, routing: nextRouting };
      } else if (action === 'note') {
        detail = { note: text(command.note, '메모') };
      } else if (action === 'close') {
        need(order.tasks.every(t => t.status === 'REPORTED' && t.report?.revision === order.revision && t.report.evidence.length > 0), 'EVIDENCE_REQUIRED', '모든 작업의 현재 요구 버전 결과와 근거가 필요합니다.', 409);
        need(command.confirmed === true && command.revision === order.revision, 'CONFIRMATION_REQUIRED', '현재 완료 조건과 결과를 확인해야 합니다.');
        need(Array.isArray(command.checks) && command.checks.length === order.criteria.length, 'CRITERIA_COVERAGE_REQUIRED', '완료 조건마다 근거를 연결하세요.');
        const checks = order.criteria.map((criterion, index) => {
          const check = command.checks[index];
          const sourceTask = order.tasks.find(t => t.id === check?.taskId);
          need(check?.criterion === index && Number.isInteger(check.evidenceIndex) && check.evidenceIndex >= 0 && sourceTask?.report?.evidence[check.evidenceIndex], 'CRITERIA_COVERAGE_REQUIRED', '완료 조건마다 현재 결과의 근거를 연결하세요.');
          return { criterion: index, text: criterion, taskId: check.taskId, evidenceIndex: check.evidenceIndex, evidence: sourceTask.report.evidence[check.evidenceIndex] };
        });
        order.closure = { at: this.stamp(), kind: 'USER_ACCEPTED_NOT_CANONICAL', note: text(command.note, '완료 확인 메모'), revision: order.revision, checks };
        order.status = 'REVIEW'; detail = order.closure;
      } else if (action === 'cancel') {
        order.status = 'CANCELLED'; for (const t of order.tasks) t.lease = null;
        detail = { reason: text(command.reason, '취소 이유', 2000) };
      } else throw new OrderError('UNKNOWN_ACTION', '지원하지 않는 처리입니다.');
      if (!['CLOSED', 'CANCELLED'].includes(order.status)) {
        order.status = order.tasks.every(t => t.status === 'REPORTED') ? 'REVIEW' : order.tasks.some(t => t.status === 'BLOCKED') ? 'BLOCKED' : order.tasks.some(t => ['RUNNING', 'REPORTED'].includes(t.status)) ? 'ACTIVE' : 'NEW';
      }
      order.version++;
      return this.save(order, action.toUpperCase(), by, detail);
    });
  }
  packet(id, taskId) {
    const order = this.get(id); const task = order.tasks.find(t => t.id === taskId);
    need(task, 'TASK_NOT_FOUND', '세부 작업을 찾을 수 없습니다.', 404);
    const history = this.events(id);
    const leaseState = !task.lease ? 'NONE' : Date.parse(task.lease.expiresAt) <= this.now() ? 'EXPIRED' : 'ACTIVE';
    const packet = { schema: 'ai-core-handoff/v1', orderId: id, orderVersion: order.version, requirementRevision: order.revision, taskId, assigned: task.assigned, role: task.role,
      title: order.title, intent: order.intent, project: order.project, routing: order.routing ?? null, criteria: order.criteria, status: order.status, taskStatus: task.status,
      previousResults: order.tasks.filter(t => t.report).map(t => ({ taskId: t.id, ...t.report })),
      historicalResults: history.filter(e => e.type === 'REPORT').map(e => ({ eventId: e.id, taskId: e.detail.taskId, requirementRevision: e.revision, current: e.revision === order.revision, ...e.detail.report })),
      blockedReason: task.blockedReason, leaseState, nextAction: leaseState === 'EXPIRED' ? 'RECLAIM_OR_REASSIGN' : task.status === 'REPORTED' ? 'READ_RESULT' : 'CHECK_LATEST_AND_CLAIM',
      events: history.slice(-12), historyCount: history.length, recentEventsTruncated: history.length > 12,
      instructions: ['중앙 원장에서 최신 오더를 다시 읽고 배정·요구 버전을 확인한다.', '작업 확보(claim)는 접수 담당권만 확보하며 실행 권한이 아니다. 별도 정본 업무 gate와 승인을 확인하고, 기존 확보 토큰을 인계 자료로 복제하지 않는다.', '기존 승인과 프로젝트 규칙을 따른다. 이 패킷 자체는 외부 발송·운영 변경의 승인이 아니다.', '원문·민감정보 전달 범위를 확인한다. 전체 저장소나 문서를 자동으로 외부 AI에 전달하지 않는다.', '결과 요약과 현재 버전의 근거를 report로 접수한다. 불가능하면 block으로 대기 이유를 남긴다.', '같은 작업의 재전송은 같은 requestId와 정확히 같은 명령을 사용한다. 변경할 때는 새 requestId를 쓴다.'],
      stateScope: 'INTAKE_ONLY', execution_authorized: false, completion_authorized: false,
      executionMode: 'MANUAL_HANDOFF', automaticExecution: false };
    return packet;
  }
  checkContext(id, taskId) {
    const order = this.get(id), task = order.tasks.find(t => t.id === taskId);
    need(task, 'TASK_NOT_FOUND', '세부 작업을 찾을 수 없습니다.', 404);
    return { orderId: order.id, version: order.version, requirementRevision: order.revision, project: order.project, routing: order.routing ?? null, orderStatus: order.status, task: { id: task.id, role: task.role, assigned: task.assigned, status: task.status } };
  }
}

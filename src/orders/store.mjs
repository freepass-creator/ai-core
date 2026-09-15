import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultDb = fileURLToPath(new URL('../../.local/orders.sqlite', import.meta.url));
export const actors = [
  { id: 'claude', name: 'Claude', strength: '설계·논리·중요 문안 검토', mode: 'MANUAL_HANDOFF' },
  { id: 'codex', name: 'Codex', strength: '실행·통합·테스트·결과 확인', mode: 'MANUAL_HANDOFF' },
  { id: 'cursor', name: 'Cursor', strength: '코드 탐색·구현 검토', mode: 'MANUAL_HANDOFF' },
  { id: 'gemini', name: 'Gemini', strength: '긴 문맥·표·자료 분석', mode: 'MANUAL_HANDOFF' },
];
const plans = {
  development: [['design', '설계와 완료 조건', 'claude'], ['execute', '구현과 검증', 'codex'], ['review', '코드 독립 검토', 'cursor']],
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
function actor(id) { need(actors.some(a => a.id === id), 'INVALID_ACTOR', '지원하는 AI를 선택하세요.'); return id; }

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
    const { requestId, title, intent, project, kind = 'general', criteria, source = 'local' } = input;
    return this.transact(requestId, { action: 'create', ...input }, () => {
      need(Object.hasOwn(plans, kind), 'INVALID_KIND', '작업 종류를 선택하세요.');
      const order = { id: `ORD-${randomUUID()}`, title: text(title, '제목', 200), intent: text(intent, '요청'), project: text(project, '프로젝트', 300), kind,
        criteria: lines(criteria, '완료 조건'), source: text(source, '출처', 1000), revision: 1, version: 1, status: 'NEW', createdAt: this.stamp(), updatedAt: this.stamp(),
        tasks: plans[kind].map(([role, title, assigned], i) => ({ id: `T${i + 1}`, role, title, assigned, status: 'PENDING', attempt: 0, lease: null, report: null, blockedReason: null })),
        closure: null };
      return this.save(order, 'CREATED', 'user', { intent: order.intent, criteria: order.criteria, source: order.source, plan: order.tasks });
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
      title: order.title, intent: order.intent, project: order.project, criteria: order.criteria, status: order.status, taskStatus: task.status,
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
    return { orderId: order.id, version: order.version, requirementRevision: order.revision, project: order.project, orderStatus: order.status, task: { id: task.id, role: task.role, assigned: task.assigned, status: task.status } };
  }
}

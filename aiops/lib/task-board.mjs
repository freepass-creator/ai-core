/** Codex가 관리하는 로컬 작업대장. .coordination/은 Git에 올리지 않는다. */
import { createHash, randomUUID } from 'node:crypto';
import { readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, posix, relative, resolve } from 'node:path';
import { appendAudit, coordinationDir, normalizeAgent, normalizeTarget, normalizeTaskId, withLease } from './lease.mjs';

const TRANSITIONS = {
  DRAFT: ['QUEUED', 'CANCELLED'],
  QUEUED: ['RESERVED', 'CANCELLED'],
  RESERVED: ['ANALYZING', 'BLOCKED', 'STALE', 'CANCELLED'],
  ANALYZING: ['REVIEW', 'BLOCKED', 'FAILED', 'STALE'],
  REVIEW: ['APPROVAL_PENDING', 'VERIFIED', 'QUEUED', 'REJECTED', 'BLOCKED'],
  APPROVAL_PENDING: ['QUEUED', 'REJECTED', 'BLOCKED'],
  APPLIED: ['VERIFIED', 'FAILED', 'STALE'],
  VERIFIED: ['CLOSED'],
  FAILED: ['QUEUED', 'CANCELLED'],
  STALE: ['QUEUED', 'CANCELLED'],
  BLOCKED: ['QUEUED', 'CANCELLED'],
  REJECTED: ['QUEUED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

const DATA_CLASSES = new Set(['internal', 'employee-operational', 'restricted']);
const RISK_TIERS = new Set(['A', 'B', 'C', 'D']);
const ACTIVE_RESERVATION_STATUSES = new Set(['RESERVED', 'ANALYZING', 'REVIEW', 'APPROVAL_PENDING', 'APPLIED', 'BLOCKED', 'FAILED', 'STALE']);
const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

function oneLine(value, label, max = 220) {
  const text = String(value ?? '').trim();
  if (!text || text.length > max || /[\r\n\0]/.test(text)) throw new Error(`${label}은 한 줄 ${max}자 이하여야 합니다.`);
  return text;
}

function now() { return new Date().toISOString(); }
function hash(value) { return `sha256:${createHash('sha256').update(value).digest('hex')}`; }
function taskPath(id) { return join(coordinationDir(), 'tasks', `${normalizeTaskId(id)}.json`); }

/** ★2026-08-30 — 대표: 「쓰기 이런 거 이제 다 권한 풀어」
 *
 *  전에는 Codex 만 상태를 옮길 수 있었다. 그런데 실제로 시트를 만들고 채우는 것은 Claude 라,
 *  Claude 가 다 해 놓고 «상태만» 못 옮겨 일이 멈추는 일이 잦았다.
 *  ★막는 게 아니라 «누가 했는지» 를 남기는 것이 목적이므로, 옮길 수 있게 열고 actor 는 그대로 기록한다.
 */
function 옮길수있나(actor) {
  normalizeAgent(actor);   // 아는 이름인지만 본다 — codex · claude · cursor · gemini
}

function normalizeTier(value = 'D') {
  const tier = oneLine(value, 'riskTier', 1).toUpperCase();
  if (!RISK_TIERS.has(tier)) throw new Error('riskTier는 A, B, C, D 중 하나여야 합니다.');
  return tier;
}

function normalizePath(value) {
  const source = oneLine(value, 'path', 240).replaceAll('\\', '/');
  if (source.startsWith('/') || /^[a-z]:/i.test(source)) throw new Error(`path는 저장소 상대 경로여야 합니다: ${source}`);
  const normalized = posix.normalize(source);
  if (!normalized || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
    throw new Error(`path가 저장소 밖을 가리킵니다: ${source}`);
  }
  return normalized;
}

function normalizedList(values, mapper, label, max = 30) {
  const list = [...new Set((values || []).map((value) => mapper(value)))].sort();
  if (list.length > max) throw new Error(`${label}은 ${max}개 이하여야 합니다.`);
  return list;
}

function isLiveResource(resource) {
  return resource === 'drive' || /^(?:sheet|drive|dc|datacenter|external):/i.test(resource);
}

function canonicalCommand(command) {
  if (!Array.isArray(command) || command.length < 2) throw new Error('허용 명령은 `node <저장소 상대 .mjs>` 형식이어야 합니다.');
  const raw = command.map((part, index) => oneLine(part, `command[${index}]`, 500));
  const executable = basename(raw[0]).toLowerCase();
  if (executable !== 'node' && executable !== 'node.exe') throw new Error('라이브 명령은 node로만 실행할 수 있습니다.');
  const script = normalizePath(raw[1]);
  if (!script.endsWith('.mjs')) throw new Error('라이브 명령의 스크립트는 .mjs여야 합니다.');
  return ['node', script, ...raw.slice(2)];
}

function commandInfo(command) {
  const canonical = canonicalCommand(command);
  return { commandHash: hash(JSON.stringify(canonical)), scriptPath: canonical[1] };
}

function planHashFor({ title, riskTier, dataClass, paths, resources, commandHash, commandLabel }) {
  return hash(JSON.stringify({ title, riskTier, dataClass, paths, resources, commandHash, commandLabel }));
}

function artifactHashFor(planHash, codeHash) { return hash(`${planHash}\0${codeHash}`); }

function approvalExpiry() { return new Date(Date.now() + APPROVAL_TTL_MS).toISOString(); }
function isExpired(at) { return !at || Number.isNaN(Date.parse(at)) || Date.parse(at) <= Date.now(); }

function derivePlan(task) {
  const paths = normalizedList(task.paths || task.scope?.paths || [], normalizePath, 'paths');
  const resources = normalizedList(task.resources || task.scope?.resources || [], normalizeTarget, 'resources');
  const riskTier = normalizeTier(task.riskTier || 'D'); // legacy tasks fail closed as D
  const dataClass = oneLine(task.dataClass || 'employee-operational', 'dataClass', 40);
  if (!DATA_CLASSES.has(dataClass)) throw new Error(`dataClass가 잘못되었습니다: ${dataClass}`);
  const commandHash = task.commandHash || task.scope?.commandHash || null;
  const commandLabel = task.commandLabel || task.scope?.commandLabel || null;
  const title = oneLine(task.title, 'title');
  return {
    title, riskTier, dataClass, paths, resources, commandHash, commandLabel,
    planHash: planHashFor({ title, riskTier, dataClass, paths, resources, commandHash, commandLabel }),
  };
}

function hydrate(raw) {
  const plan = derivePlan(raw);
  return {
    ...raw,
    schemaVersion: Number(raw.schemaVersion) || 1,
    revision: Number.isInteger(raw.revision) && raw.revision > 0 ? raw.revision : 1,
    ...plan,
    scope: { title: plan.title, dataClass: plan.dataClass, paths: plan.paths, resources: plan.resources, commandHash: plan.commandHash, commandLabel: plan.commandLabel },
    userApproval: raw.userApproval || null,
    execution: raw.execution || null,
    reservation: raw.reservation || null,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

async function load(id) {
  const path = taskPath(id);
  try { return hydrate(JSON.parse(await readFile(path, 'utf8'))); }
  catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`작업을 찾을 수 없습니다: ${id}`);
    throw error;
  }
}

async function save(task) {
  const path = taskPath(task.id);
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(task, null, 2), 'utf8');
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true }).catch(() => {});
  }
  return task;
}

async function allTasks() {
  const dir = join(coordinationDir(), 'tasks');
  try {
    const files = (await readdir(dir)).filter((name) => name.endsWith('.json'));
    return Promise.all(files.map((name) => load(name.slice(0, -5))));
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function latestCurrentReview(task, phase) {
  const artifactHash = phase === 'FINAL' ? task.execution?.artifactHash : null;
  const matching = task.reviews.filter((review) => review.reviewer === 'claude'
    && review.phase === phase
    && review.revision === task.revision
    && review.planHash === task.planHash
    && (phase !== 'FINAL' || review.artifactHash === artifactHash));
  return matching.at(-1) || null;
}

function hasClaudeApproval(task, phase) {
  const review = latestCurrentReview(task, phase);
  return Boolean(review && review.decision === 'APPROVE' && !isExpired(review.expiresAt));
}

function assertDPlanReady(task) {
  if (!task.paths.length || !task.commandHash) throw new Error('D등급 작업은 실행 스크립트 경로와 허용 명령 hash를 먼저 선언해야 합니다.');
}

function pathOverlap(left, right) {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

async function assertReservationAvailable(task) {
  const others = await allTasks();
  for (const other of others) {
    if (other.id === task.id || !ACTIVE_RESERVATION_STATUSES.has(other.status)) continue;
    const reservedPaths = other.reservation?.paths || other.paths;
    const reservedResources = other.reservation?.resources || other.resources;
    const hitPath = task.paths.find((path) => reservedPaths.some((claimed) => pathOverlap(path, claimed)));
    if (hitPath) throw new Error(`경로 ${hitPath}는 활성 작업 ${other.id}가 예약 중입니다.`);
    const hitResource = task.resources.find((resource) => reservedResources.includes(resource));
    if (hitResource) throw new Error(`리소스 ${hitResource}는 활성 작업 ${other.id}가 예약 중입니다.`);
  }
}

function resolveProjectFile(taskPathValue) {
  const root = resolve(process.cwd());
  const absolute = resolve(root, taskPathValue);
  const rel = relative(root, absolute).replaceAll('\\', '/');
  if (rel === '..' || rel.startsWith('../') || rel === '') throw new Error(`선언 경로가 저장소 밖을 가리킵니다: ${taskPathValue}`);
  return absolute;
}

async function codeHashFor(task) {
  const parts = [];
  for (const declaredPath of task.paths) {
    const contents = await readFile(resolveProjectFile(declaredPath));
    parts.push(`${declaredPath}\0${hash(contents)}\0`);
  }
  return hash(parts.join(''));
}

function newRevision(task, reason) {
  task.revision += 1;
  task.execution = null;
  task.userApproval = null;
  task.reservation = null;
  task.events.push({ at: now(), actor: 'codex', type: 'revision', revision: task.revision, note: reason });
}

function releaseReservationIfTerminal(task, next) {
  if (['CANCELLED', 'CLOSED'].includes(next)) task.reservation = null;
}

async function withBoardLease(agent, taskId, purpose, fn) {
  return withLease(['control:task-board'], { agent, taskId, purpose }, fn);
}

/** 새 작업은 Codex만 발행한다. title/note에는 직원·고객 원문을 넣지 않는다. */
export async function createTask({
  id, title, owner = 'codex', reviewer = 'claude', contributors = [], dataClass = 'employee-operational',
  riskTier = 'D', paths = [], resources = [], command = null, commandLabel = null,
} = {}) {
  const taskId = normalizeTaskId(id);
  const tier = normalizeTier(riskTier);
  const safePaths = normalizedList(paths, normalizePath, 'paths');
  const safeResources = normalizedList(resources, normalizeTarget, 'resources');
  if (safeResources.some(isLiveResource) && tier !== 'D') throw new Error('Sheet·Drive·데이터센터 리소스는 반드시 D등급으로 등록해야 합니다.');
  const commandDetails = command?.length ? commandInfo(command) : null;
  if (commandDetails && !safePaths.includes(commandDetails.scriptPath)) throw new Error('허용 명령의 스크립트는 paths에 선언되어야 합니다.');
  const task = {
    schemaVersion: 2, id: taskId, title: oneLine(title, 'title'), status: 'DRAFT',
    owner: normalizeAgent(owner), reviewer: normalizeAgent(reviewer),
    contributors: normalizedList(contributors, normalizeAgent, 'contributors'),
    dataClass: oneLine(dataClass, 'dataClass', 40), riskTier: tier, revision: 1,
    paths: safePaths, resources: safeResources, commandHash: commandDetails?.commandHash || null,
    commandLabel: commandLabel ? oneLine(commandLabel, 'commandLabel', 180) : null,
    createdAt: now(), updatedAt: now(), userApproval: null, execution: null, reservation: null, reviews: [], events: [],
  };
  if (!DATA_CLASSES.has(task.dataClass)) throw new Error(`dataClass가 잘못되었습니다: ${task.dataClass}`);
  task.planHash = planHashFor(task);
  task.scope = { title: task.title, dataClass: task.dataClass, paths: task.paths, resources: task.resources, commandHash: task.commandHash, commandLabel: task.commandLabel };

  return withBoardLease('codex', taskId, '작업대장 생성', async () => {
    try {
      await readFile(taskPath(taskId), 'utf8');
      throw new Error(`이미 있는 작업입니다: ${taskId}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    task.events.push({ at: now(), actor: 'codex', type: 'created', note: '작업 발행', revision: task.revision, riskTier: task.riskTier });
    await save(task);
    await appendAudit({ type: 'task-created', taskId, riskTier: task.riskTier, dataClass: task.dataClass, resources: task.resources });
    return task;
  });
}

/** 범위·경로·리소스·명령이 바뀌면 현재 승인을 무효화한다. 활성 실행 중에는 고칠 수 없다. */
export async function amendTask(id, patch = {}) {
  const taskId = normalizeTaskId(id);
  return withBoardLease('codex', taskId, '작업 범위 수정', async () => {
    const task = await load(taskId);
    if (!['DRAFT', 'QUEUED'].includes(task.status)) throw new Error('범위 수정은 DRAFT 또는 QUEUED 상태에서만 할 수 있습니다. 재작업은 먼저 QUEUED로 돌리세요.');
    const nextTier = patch.riskTier === undefined ? task.riskTier : normalizeTier(patch.riskTier);
    const nextPaths = patch.paths === undefined ? task.paths : normalizedList(patch.paths, normalizePath, 'paths');
    const nextResources = patch.resources === undefined ? task.resources : normalizedList(patch.resources, normalizeTarget, 'resources');
    if (nextResources.some(isLiveResource) && nextTier !== 'D') throw new Error('Sheet·Drive·데이터센터 리소스는 반드시 D등급으로 등록해야 합니다.');
    const commandDetails = patch.command === undefined
      ? (task.commandHash ? { commandHash: task.commandHash } : null)
      : (patch.command?.length ? commandInfo(patch.command) : null);
    if (commandDetails && patch.command?.length && !nextPaths.includes(commandDetails.scriptPath)) throw new Error('허용 명령의 스크립트는 paths에 선언되어야 합니다.');
    task.title = patch.title === undefined ? task.title : oneLine(patch.title, 'title');
    task.dataClass = patch.dataClass === undefined ? task.dataClass : oneLine(patch.dataClass, 'dataClass', 40);
    if (!DATA_CLASSES.has(task.dataClass)) throw new Error(`dataClass가 잘못되었습니다: ${task.dataClass}`);
    task.riskTier = nextTier;
    task.paths = nextPaths;
    task.resources = nextResources;
    task.commandHash = commandDetails?.commandHash || null;
    task.commandLabel = patch.commandLabel === undefined ? task.commandLabel : (patch.commandLabel ? oneLine(patch.commandLabel, 'commandLabel', 180) : null);
    task.planHash = planHashFor(task);
    task.scope = { title: task.title, dataClass: task.dataClass, paths: task.paths, resources: task.resources, commandHash: task.commandHash, commandLabel: task.commandLabel };
    newRevision(task, '범위·리소스·명령 변경으로 재승인 필요');
    task.updatedAt = now();
    await save(task);
    await appendAudit({ type: 'task-amended', taskId, revision: task.revision, riskTier: task.riskTier, resources: task.resources });
    return task;
  });
}

/** Codex만 상태를 전이한다. D등급 APPLIED는 wrapper의 beginLiveExecution만 사용한다. */
export async function transitionTask(id, nextStatus, { actor = 'codex', note } = {}) {
  const taskId = normalizeTaskId(id);
  옮길수있나(actor);
  const next = oneLine(nextStatus, 'nextStatus', 40).toUpperCase();
  const cleanNote = oneLine(note, 'note', 300);
  return withBoardLease('codex', taskId, '작업 상태 전이', async () => {
    const task = await load(taskId);
    const previous = task.status;
    if (!TRANSITIONS[previous]?.includes(next)) throw new Error(`${previous} → ${next} 전이는 허용되지 않습니다.`);
    if (next === 'APPLIED') throw new Error('D등급 라이브 실행 시작은 scripts/with-lease.mjs만 사용할 수 있습니다.');
    if (previous === 'QUEUED' && next === 'RESERVED') {
      if (['C', 'D'].includes(task.riskTier) && !hasClaudeApproval(task, 'DESIGN')) throw new Error('현재 revision의 Claude DESIGN APPROVE 검토가 있어야 실행 예약할 수 있습니다.');
      if (task.riskTier === 'D') assertDPlanReady(task);
      await assertReservationAvailable(task);
      task.reservation = { revision: task.revision, planHash: task.planHash, paths: task.paths, resources: task.resources, reservedAt: now() };
    }
    if (previous === 'ANALYZING' && next === 'REVIEW' && task.riskTier === 'D') {
      const codeHash = await codeHashFor(task);
      task.execution = { codeHash, artifactHash: artifactHashFor(task.planHash, codeHash), preparedAt: now(), status: 'prepared' };
    }
    if (previous === 'REVIEW' && next === 'VERIFIED' && task.riskTier === 'D') {
      throw new Error('D등급 라이브 작업은 REVIEW → APPROVAL_PENDING → APPLIED → VERIFIED 경로만 허용됩니다.');
    }
    if (previous === 'REVIEW' && next === 'APPROVAL_PENDING') {
      if (task.riskTier !== 'D') throw new Error('APPROVAL_PENDING은 D등급 라이브 작업에만 사용합니다.');
      if (!hasClaudeApproval(task, 'FINAL')) throw new Error('현재 artifact의 Claude FINAL APPROVE 검토가 있어야 사용자 승인 대기로 갈 수 있습니다.');
    }
    if (previous === 'APPLIED' && next === 'VERIFIED') {
      if (task.riskTier !== 'D' || task.execution?.status !== 'succeeded') throw new Error('성공한 D등급 실행 결과와 재조회 검증이 있어야 VERIFIED로 갈 수 있습니다.');
      const currentCodeHash = await codeHashFor(task);
      if (artifactHashFor(task.planHash, currentCodeHash) !== task.execution.artifactHash) throw new Error('실행 뒤 코드가 바뀌었습니다. 원본 재조회와 새 revision이 필요합니다.');
    }
    if (next === 'QUEUED' && previous !== 'DRAFT') newRevision(task, `${previous}에서 재작업 큐로 이동`);
    releaseReservationIfTerminal(task, next);
    task.status = next;
    task.updatedAt = now();
    task.events.push({ at: task.updatedAt, actor: 'codex', type: 'transition', from: previous, to: next, note: cleanNote, revision: task.revision });
    await save(task);
    await appendAudit({ type: 'task-transition', taskId, status: next, riskTier: task.riskTier, revision: task.revision });
    return task;
  });
}

/** Claude의 독립 검토를 현재 plan/artifact와 24시간 만료로 기록한다. */
export async function addReview(id, { reviewer = 'claude', phase, decision, summary } = {}) {
  const taskId = normalizeTaskId(id);
  const agent = normalizeAgent(reviewer);
  if (agent !== 'claude') throw new Error('구조·최종 독립 검토자는 Claude만 기록합니다.');
  const reviewPhase = oneLine(phase, 'phase', 20).toUpperCase();
  if (!['DESIGN', 'FINAL'].includes(reviewPhase)) throw new Error('phase는 DESIGN 또는 FINAL이어야 합니다.');
  const verdict = oneLine(decision, 'decision', 40).toUpperCase();
  if (!['APPROVE', 'CHANGES_REQUESTED', 'BLOCK'].includes(verdict)) throw new Error('decision은 APPROVE, CHANGES_REQUESTED, BLOCK 중 하나여야 합니다.');
  const note = oneLine(summary, 'summary', 300);
  return withBoardLease(agent, taskId, '독립 검토 기록', async () => {
    const task = await load(taskId);
    if (reviewPhase === 'DESIGN') {
      if (!['C', 'D'].includes(task.riskTier)) throw new Error('DESIGN 검토는 C/D등급 작업에만 기록합니다.');
      if (!['DRAFT', 'QUEUED'].includes(task.status)) throw new Error('DESIGN 검토는 구현 예약 전에 기록해야 합니다.');
    }
    if (reviewPhase === 'FINAL') {
      if (task.riskTier !== 'D' || task.status !== 'REVIEW' || !task.execution?.artifactHash) {
        throw new Error('FINAL 검토는 D등급 작업이 REVIEW에서 현재 artifact를 준비한 뒤에만 기록합니다.');
      }
    }
    const review = {
      at: now(), reviewer: agent, phase: reviewPhase, decision: verdict, summary: note,
      revision: task.revision, planHash: task.planHash,
      artifactHash: reviewPhase === 'FINAL' ? task.execution.artifactHash : null,
      expiresAt: approvalExpiry(),
    };
    task.reviews.push(review);
    task.updatedAt = review.at;
    task.events.push({ at: review.at, actor: agent, type: 'review', phase: reviewPhase, decision: verdict, revision: task.revision });
    await save(task);
    await appendAudit({ type: 'task-review', taskId, phase: reviewPhase, decision: verdict, revision: task.revision, expiresAt: review.expiresAt });
    return task;
  });
}

/** D등급 wrapper만 호출한다. 현재 승인·명령·코드 artifact가 모두 맞을 때 APPLIED를 기록한다. */
export async function beginLiveExecution(id, { resources, command, approvalRef } = {}) {
  const taskId = normalizeTaskId(id);
  const declaredResources = normalizedList(resources, normalizeTarget, 'resources');
  const details = commandInfo(command);
  const approval = oneLine(approvalRef, 'approvalRef', 180);
  return withBoardLease('codex', taskId, '승인된 라이브 실행 시작', async () => {
    const task = await load(taskId);
    if (task.riskTier !== 'D' || task.status !== 'APPROVAL_PENDING') throw new Error(`D등급 APPROVAL_PENDING 작업만 실행할 수 있습니다: ${task.status}`);
    if (JSON.stringify(declaredResources) !== JSON.stringify(task.resources)) throw new Error('실행 resource는 작업대장에 선언한 resource와 정확히 일치해야 합니다.');
    if (details.commandHash !== task.commandHash || !task.paths.includes(details.scriptPath)) throw new Error('실행 명령이 Claude가 검토한 허용 명령과 일치하지 않습니다.');
    if (!hasClaudeApproval(task, 'DESIGN') || !hasClaudeApproval(task, 'FINAL')) throw new Error('현재 revision/artifact의 Claude DESIGN·FINAL 승인이 모두 필요합니다.');
    const currentCodeHash = await codeHashFor(task);
    const currentArtifactHash = artifactHashFor(task.planHash, currentCodeHash);
    if (currentArtifactHash !== task.execution?.artifactHash) throw new Error('Claude FINAL 뒤 코드가 바뀌었습니다. 새 revision과 재검토가 필요합니다.');
    const userApproval = {
      ref: approval, revision: task.revision, planHash: task.planHash, artifactHash: currentArtifactHash,
      at: now(), expiresAt: approvalExpiry(),
    };
    task.userApproval = userApproval;
    task.status = 'APPLIED';
    task.execution = { ...task.execution, attemptId: randomUUID(), status: 'running', startedAt: now(), userApproval };
    task.updatedAt = now();
    task.events.push({ at: task.updatedAt, actor: 'codex', type: 'live-execution-started', revision: task.revision, artifactHash: currentArtifactHash });
    await save(task);
    await appendAudit({ type: 'live-execution-started', taskId, revision: task.revision, resources: task.resources, artifactHash: currentArtifactHash });
    return task;
  });
}

export async function recordLiveExecutionResult(id, { attemptId, exitCode = 0 } = {}) {
  const taskId = normalizeTaskId(id);
  return withBoardLease('codex', taskId, '라이브 실행 결과 기록', async () => {
    const task = await load(taskId);
    if (task.status !== 'APPLIED' || task.execution?.attemptId !== attemptId) throw new Error('현재 실행 attempt와 일치하지 않습니다.');
    if (Number(exitCode) !== 0) throw new Error('성공 결과에는 exitCode 0만 기록할 수 있습니다.');
    task.execution = { ...task.execution, status: 'succeeded', exitCode: 0, completedAt: now() };
    task.updatedAt = now();
    task.events.push({ at: task.updatedAt, actor: 'codex', type: 'live-execution-succeeded', revision: task.revision });
    await save(task);
    await appendAudit({ type: 'live-execution-succeeded', taskId, revision: task.revision });
    return task;
  });
}

export async function failLiveExecution(id, { attemptId = null, reason } = {}) {
  const taskId = normalizeTaskId(id);
  const safeReason = oneLine(reason, 'reason', 300);
  return withBoardLease('codex', taskId, '라이브 실행 실패 기록', async () => {
    const task = await load(taskId);
    if (task.status !== 'APPLIED') return task;
    if (attemptId && task.execution?.attemptId !== attemptId) throw new Error('현재 실행 attempt와 일치하지 않습니다.');
    task.status = 'FAILED';
    task.execution = { ...task.execution, status: 'failed', failedAt: now(), reason: safeReason };
    task.updatedAt = now();
    task.events.push({ at: task.updatedAt, actor: 'codex', type: 'live-execution-failed', note: safeReason, revision: task.revision });
    await save(task);
    await appendAudit({ type: 'live-execution-failed', taskId, revision: task.revision });
    return task;
  });
}

export async function getTask(id) { return load(id); }

export async function listTasks() {
  const tasks = await allTasks();
  return tasks.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export { APPROVAL_TTL_MS, RISK_TIERS, TRANSITIONS, artifactHashFor, codeHashFor, commandInfo, hasClaudeApproval };

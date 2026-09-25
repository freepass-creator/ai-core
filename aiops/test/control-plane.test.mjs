import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LeaseBusyError, acquireLease, assertInheritedCodexLease, assertWriteAllowedForUrl, childLeaseEnv, releaseLease, withLease,
} from '../lib/lease.mjs';
import {
  addReview, amendTask, beginLiveExecution, createTask, getTask, transitionTask,
} from '../lib/task-board.mjs';

async function isolated(run) {
  const old = process.env.AIOPS_COORDINATION_DIR;
  const root = await mkdtemp(join(tmpdir(), 'aiops-control-test-'));
  process.env.AIOPS_COORDINATION_DIR = root;
  try { await run(root); }
  finally {
    if (old === undefined) delete process.env.AIOPS_COORDINATION_DIR;
    else process.env.AIOPS_COORDINATION_DIR = old;
    await rm(root, { recursive: true, force: true });
  }
}

async function advanceToReview(id) {
  await transitionTask(id, 'QUEUED', { note: '접수 완료' });
  await addReview(id, { phase: 'DESIGN', decision: 'APPROVE', summary: '범위와 안전 조건 승인' });
  await transitionTask(id, 'RESERVED', { note: '실행 예약' });
  await transitionTask(id, 'ANALYZING', { note: '구현 시작' });
  return transitionTask(id, 'REVIEW', { note: '통합 검토 요청' });
}

function runWrapper(id, script, resource = 'sheet:sheet-alpha') {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      'scripts/with-lease.mjs', '--task', id, '--resource', resource, '--approval', 'test-approval', '--', process.execPath, script,
    ], { cwd: process.cwd(), env: process.env, stdio: 'ignore' });
    child.once('error', reject);
    child.once('exit', (code) => resolve(code));
  });
}

test('같은 Sheet 리소스는 한 lease만 확보한다', async () => isolated(async () => {
  const first = await acquireLease('sheet:sheet-alpha', { agent: 'codex', taskId: 'TEST-20260820-001', purpose: '동시성 검사' });
  await assert.rejects(
    acquireLease('sheet:sheet-alpha', { agent: 'codex', taskId: 'TEST-20260820-002', purpose: '동시성 검사' }),
    LeaseBusyError,
  );
  assert.equal(await releaseLease(first), true);
}));

test('Google 쓰기는 Codex lease 문맥에서만 허용된다', async () => isolated(async () => {
  const url = 'https://sheets.googleapis.com/v4/spreadsheets/sheet-alpha/values/A1?valueInputOption=USER_ENTERED';
  await assert.rejects(assertWriteAllowedForUrl(url, 'PUT'), /Codex의 sheet:sheet-alpha lease/);
  await withLease(['sheet:sheet-alpha'], { agent: 'codex', taskId: 'TEST-20260820-003', purpose: '쓰기 게이트 검사' }, async () => {
    assert.equal(await assertWriteAllowedForUrl(url, 'PUT'), 'sheet:sheet-alpha');
  });
}));

test('writer는 wrapper가 넘긴 inherited Codex lease가 있어야 한다', async () => isolated(async () => {
  await assert.rejects(assertInheritedCodexLease(['sheet:sheet-alpha']), /inherited lease/);
  await withLease(['sheet:sheet-alpha'], { agent: 'codex', taskId: 'TEST-20260820-013', purpose: '자식 lease 검사' }, async (leases) => {
    const before = process.env.AIOPS_LEASES;
    process.env.AIOPS_LEASES = childLeaseEnv(leases).AIOPS_LEASES;
    try { assert.deepEqual(await assertInheritedCodexLease(['sheet:sheet-alpha']), ['sheet:sheet-alpha']); }
    finally {
      if (before === undefined) delete process.env.AIOPS_LEASES;
      else process.env.AIOPS_LEASES = before;
    }
  });
}));

test('A/B는 Claude 검토 없이 비라이브 lifecycle을 완료한다', async () => isolated(async () => {
  for (const [id, tier] of [['TEST-20260820-004', 'A'], ['TEST-20260820-005', 'B']]) {
    await createTask({ id, title: `비라이브 ${tier} 검사`, riskTier: tier, paths: [`test/${tier}.mjs`] });
    await transitionTask(id, 'QUEUED', { note: '접수' });
    await transitionTask(id, 'RESERVED', { note: '예약' });
    await transitionTask(id, 'ANALYZING', { note: '분석' });
    await transitionTask(id, 'REVIEW', { note: '검토' });
    await transitionTask(id, 'VERIFIED', { note: '검증' });
    const closed = await transitionTask(id, 'CLOSED', { note: '종료' });
    assert.equal(closed.status, 'CLOSED');
  }
}));

test('C는 현재 revision의 Claude DESIGN 없이는 예약할 수 없고 재작업 시 승인이 무효다', async () => isolated(async () => {
  const id = 'TEST-20260820-006';
  await createTask({ id, title: '구조 변경 검사', riskTier: 'C', paths: ['lib/example.mjs'] });
  await transitionTask(id, 'QUEUED', { note: '접수' });
  await assert.rejects(transitionTask(id, 'RESERVED', { note: '무승인 예약' }), /DESIGN APPROVE/);
  await addReview(id, { phase: 'DESIGN', decision: 'APPROVE', summary: '설계 승인' });
  await transitionTask(id, 'RESERVED', { note: '예약' });
  await transitionTask(id, 'BLOCKED', { note: '재설계 필요' });
  const queued = await transitionTask(id, 'QUEUED', { note: '재작업' });
  assert.equal(queued.revision, 2);
  await assert.rejects(transitionTask(id, 'RESERVED', { note: '옛 승인 재사용' }), /DESIGN APPROVE/);
}));

test('D는 FINAL·사용자 승인 wrapper 없이는 VERIFIED로 갈 수 없고, 성공 후 재조회 단계에 남는다', async () => isolated(async () => {
  const id = 'TEST-20260820-007';
  const script = 'test/fixtures/approved-child.mjs';
  await createTask({ id, title: '라이브 제어 흐름 검사', riskTier: 'D', paths: [script], resources: ['sheet:sheet-alpha'], command: [process.execPath, script] });
  await advanceToReview(id);
  await assert.rejects(transitionTask(id, 'VERIFIED', { note: '무단 완료' }), /APPROVAL_PENDING/);
  await assert.rejects(transitionTask(id, 'APPROVAL_PENDING', { note: '최종 검토 없음' }), /FINAL APPROVE/);
  await addReview(id, { phase: 'FINAL', decision: 'APPROVE', summary: '현재 artifact 승인' });
  await transitionTask(id, 'APPROVAL_PENDING', { note: '사용자 승인 대기' });
  assert.equal(await runWrapper(id, script), 0);
  const applied = await getTask(id);
  assert.equal(applied.status, 'APPLIED');
  assert.equal(applied.execution.status, 'succeeded');
  await transitionTask(id, 'VERIFIED', { note: '원본 재조회와 검증 완료' });
  const closed = await transitionTask(id, 'CLOSED', { note: '종료' });
  assert.equal(closed.status, 'CLOSED');
}));

test('D wrapper는 승인한 명령·리소스와 다르면 실행 전 거부한다', async () => isolated(async () => {
  const id = 'TEST-20260820-008';
  const script = 'test/fixtures/approved-child.mjs';
  await createTask({ id, title: '명령 고정 검사', riskTier: 'D', paths: [script], resources: ['sheet:sheet-alpha'], command: [process.execPath, script] });
  await advanceToReview(id);
  await addReview(id, { phase: 'FINAL', decision: 'APPROVE', summary: '최종 승인' });
  await transitionTask(id, 'APPROVAL_PENDING', { note: '승인 대기' });
  await assert.rejects(
    beginLiveExecution(id, { resources: ['sheet:sheet-alpha'], command: [process.execPath, 'test/fixtures/exit-nonzero.mjs'], approvalRef: 'test' }),
    /허용 명령/,
  );
  assert.equal((await getTask(id)).status, 'APPROVAL_PENDING');
}));

test('활성 작업은 같은 코드 경로를 중복 예약할 수 없다', async () => isolated(async () => {
  const first = 'TEST-20260820-009';
  const second = 'TEST-20260820-010';
  const path = 'lib/shared-control.mjs';
  for (const id of [first, second]) {
    await createTask({ id, title: '경로 예약 검사', riskTier: 'C', paths: [path] });
    await transitionTask(id, 'QUEUED', { note: '접수' });
    await addReview(id, { phase: 'DESIGN', decision: 'APPROVE', summary: '설계 승인' });
  }
  await transitionTask(first, 'RESERVED', { note: '첫 예약' });
  await assert.rejects(transitionTask(second, 'RESERVED', { note: '겹침 예약' }), /예약 중/);
}));

test('D wrapper 자식 오류는 APPLIED에 남지 않고 FAILED로 기록한다', async () => isolated(async () => {
  const id = 'TEST-20260820-011';
  const script = 'test/fixtures/exit-nonzero.mjs';
  await createTask({ id, title: '실패 기록 검사', riskTier: 'D', paths: [script], resources: ['sheet:sheet-alpha'], command: [process.execPath, script] });
  await advanceToReview(id);
  await addReview(id, { phase: 'FINAL', decision: 'APPROVE', summary: '최종 승인' });
  await transitionTask(id, 'APPROVAL_PENDING', { note: '승인 대기' });
  assert.equal(await runWrapper(id, script), 7);
  const failed = await getTask(id);
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.execution.status, 'failed');
}));

test('범위를 고치면 revision과 plan hash가 바뀌어 기존 Claude 승인이 재사용되지 않는다', async () => isolated(async () => {
  const id = 'TEST-20260820-012';
  await createTask({ id, title: '범위 수정 검사', riskTier: 'C', paths: ['lib/one.mjs'] });
  await transitionTask(id, 'QUEUED', { note: '접수' });
  const before = await getTask(id);
  await addReview(id, { phase: 'DESIGN', decision: 'APPROVE', summary: '설계 승인' });
  const amended = await amendTask(id, { paths: ['lib/two.mjs'] });
  assert.equal(amended.revision, 2);
  assert.notEqual(amended.planHash, before.planHash);
  await assert.rejects(transitionTask(id, 'RESERVED', { note: '옛 승인 재사용' }), /DESIGN APPROVE/);
}));

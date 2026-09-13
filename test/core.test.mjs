import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrate, executionRoute, normalizeTask } from '../src/core.mjs';

test('small bounded development routes GPT_DIRECT', () => {
  const out = orchestrate({ goal:'상품 카드 UI 문구 수정', project:'freepasserp4', done_when:['문구가 요구사항과 일치'], changed_files_estimate:2 });
  assert.equal(out.execution.route, 'GPT_DIRECT');
  assert.equal(out.status, 'READY');
  assert.equal(out.execution_authorized, false);
});

test('build loop routes WORK_CODEX', () => {
  const task = normalizeTask({ goal:'ERP 검색 기능 개발', project:'freepasserp4', done_when:['build pass'], needs_build:true });
  assert.equal(executionRoute(task).route, 'WORK_CODEX');
});

test('external effect always gates human approval', () => {
  const out = orchestrate({ goal:'운영 데이터 변경', project:'aiops', done_when:['verified'], risk:'D', external_effect:'sheet_write' });
  assert.equal(out.execution.route, 'HUMAN_GATE');
  assert.equal(out.status, 'APPROVAL_REQUIRED');
  assert.equal(out.execution_authorized, false);
});

test('unresolved development project is HOLD', () => {
  const out = orchestrate({ goal:'웹 UI 개발', done_when:['done'] });
  assert.equal(out.status, 'HOLD');
  assert.ok(out.holds.includes('PROJECT_UNRESOLVED'));
});

test('missing done_when is HOLD', () => {
  const out = orchestrate({ goal:'ERP 기능 개발', project:'freepasserp4' });
  assert.equal(out.status, 'HOLD');
  assert.ok(out.holds.includes('DONE_WHEN_UNSPECIFIED'));
});

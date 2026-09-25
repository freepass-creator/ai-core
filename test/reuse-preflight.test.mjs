import test from 'node:test';
import assert from 'node:assert/strict';
import { queryTokens, rankReuseCandidates, validateReuseDecision } from '../src/reuse/reuse-preflight.mjs';

test('ranks existing assets using intent terms', () => {
  const candidates = rankReuseCandidates('Claude usage reset gate', [
    { kind: 'FILE', path: 'scripts/claude-usage-gate.mjs' },
    { kind: 'FILE', path: 'scripts/orders.mjs' },
  ]);
  assert.equal(candidates[0].path, 'scripts/claude-usage-gate.mjs');
  assert.ok(candidates[0].score >= 2);
  assert.ok(queryTokens('새 기능 만들기 existing module').includes('module'));
});

test('creation decision is recorded without granting write authority', () => {
  assert.equal(validateReuseDecision({}).reason, 'REUSE_DECISION_REQUIRED');
  assert.equal(validateReuseDecision({ decision: 'REUSE_EXACT', selected: [] }).reason, 'REUSE_SELECTION_REQUIRED');
  assert.equal(validateReuseDecision({ decision: 'CREATE_NEW_JUSTIFIED', reason: '없음' }).reason, 'NEW_ASSET_REASON_TOO_SHORT');

  const creation = validateReuseDecision({
    decision: 'CREATE_NEW_JUSTIFIED',
    reason: '검색 후보는 입력과 상태 계약이 달라 기존 자산을 확장할 수 없다.',
    candidateCount: 4,
  });
  assert.equal(creation.status, 'PASS');
  assert.equal(creation.decision_scope, 'REUSE_PREFLIGHT_ONLY');
  assert.equal(creation.write_authorized, false);
  assert.equal(creation.write_boundary, 'EXISTING_PROJECT_OR_WORK_OWNERSHIP_REQUIRED');
  assert.equal(creation.creation_requires_ownership, true);
});

test('reuse decisions never grant project write authority', () => {
  const reuse = validateReuseDecision({
    decision: 'REUSE_EXACT',
    selected: ['src/existing.mjs'],
  });
  assert.equal(reuse.status, 'PASS');
  assert.equal(reuse.decision_scope, 'REUSE_PREFLIGHT_ONLY');
  assert.equal(reuse.write_authorized, false);
  assert.equal(reuse.write_boundary, 'EXISTING_PROJECT_OR_WORK_OWNERSHIP_REQUIRED');
});

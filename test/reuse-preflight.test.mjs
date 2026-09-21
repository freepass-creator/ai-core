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

test('creation stays blocked until reuse decision is evidenced', () => {
  assert.equal(validateReuseDecision({}).reason, 'REUSE_DECISION_REQUIRED');
  assert.equal(validateReuseDecision({ decision: 'REUSE_EXACT', selected: [] }).reason, 'REUSE_SELECTION_REQUIRED');
  assert.equal(validateReuseDecision({ decision: 'CREATE_NEW_JUSTIFIED', reason: '없음' }).reason, 'NEW_ASSET_REASON_TOO_SHORT');
  assert.equal(validateReuseDecision({
    decision: 'CREATE_NEW_JUSTIFIED',
    reason: '검색 후보는 입력과 상태 계약이 달라 기존 자산을 확장할 수 없다.',
    candidateCount: 4,
  }).status, 'PASS');
});

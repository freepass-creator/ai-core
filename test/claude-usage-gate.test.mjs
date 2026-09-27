import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claudeReviewArgs,
  claudeRunOutcome,
  gateStatus,
  isClaudeUsageLimit,
  parseClaudeResetAt,
} from '../src/collaboration/claude-usage-gate.mjs';

test('normalizes every Claude consultation into non-interactive read-only review', () => {
  assert.deepEqual(claudeReviewArgs(['검토해 줘']), [
    '-p', '검토해 줘', '--permission-mode', 'plan', '--output-format', 'text',
  ]);
  assert.deepEqual(claudeReviewArgs(['-p', '반례를 찾아']), [
    '-p', '반례를 찾아', '--permission-mode', 'plan', '--output-format', 'text',
  ]);
  assert.throws(() => claudeReviewArgs([]), /CLAUDE_REVIEW_PROMPT_REQUIRED/);
});

test('never treats an empty or failed Claude process as an answer', () => {
  assert.equal(claudeRunOutcome({ status: 0, stdout: '', stderr: '' }).status, 'EMPTY_RESPONSE');
  assert.equal(claudeRunOutcome({ status: 1, stdout: '', stderr: 'boom' }).status, 'FAILED');
  assert.equal(claudeRunOutcome({ status: 0, stdout: '검토 답변', stderr: '' }).status, 'ANSWERED');
});

test('detects Claude usage-limit output', () => {
  assert.equal(isClaudeUsageLimit("You've hit your weekly usage limit. Resets 1pm (Asia/Seoul)."), true);
  assert.equal(isClaudeUsageLimit("\u001b[31mYou've hit your weekly limit\u001b[0m · resets 1pm (Asia/Seoul)"), true);
  assert.equal(isClaudeUsageLimit('ordinary command failure'), false);
});

test('parses the next local reset and rolls time-only resets to tomorrow', () => {
  assert.equal(
    parseClaudeResetAt('Resets 1pm (Asia/Seoul)', { now: new Date('2026-09-21T02:00:00Z') }),
    '2026-09-21T04:00:00.000Z',
  );
  assert.equal(
    parseClaudeResetAt('Resets 1pm (Asia/Seoul)', { now: new Date('2026-09-21T05:00:00Z') }),
    '2026-09-22T04:00:00.000Z',
  );
});

test('blocks without prompting until reset and releases at reset', () => {
  const state = { reason: 'CLAUDE_USAGE_LIMIT', blocked_until: '2026-09-22T04:00:00.000Z' };
  assert.deepEqual(gateStatus(state, new Date('2026-09-21T05:00:00Z')), {
    available: false,
    status: 'UNAVAILABLE_UNTIL_RESET',
    blocked_until: '2026-09-22T04:00:00.000Z',
    reason: 'CLAUDE_USAGE_LIMIT',
  });
  assert.equal(gateStatus(state, new Date('2026-09-22T04:00:00.000Z')).available, true);
});

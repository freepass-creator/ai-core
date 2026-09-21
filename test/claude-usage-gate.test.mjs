import test from 'node:test';
import assert from 'node:assert/strict';
import { gateStatus, isClaudeUsageLimit, parseClaudeResetAt } from '../src/collaboration/claude-usage-gate.mjs';

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

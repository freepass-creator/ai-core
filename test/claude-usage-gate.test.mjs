import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claudeReviewArgs,
  claudeReviewInvocation,
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

test('공식 --root/--prompt 형식은 실제 Claude cwd와 질문으로 분리된다', () => {
  assert.deepEqual(
    claudeReviewInvocation(['--root', 'C:\\dev\\freepass-data', '--prompt', '표준을 검토해'], { defaultCwd: 'C:\\dev\\ai-core' }),
    {
      cwd: 'C:\\dev\\freepass-data',
      args: ['-p', '표준을 검토해', '--permission-mode', 'plan', '--output-format', 'text'],
    }
  );
});

test('root 또는 prompt 오타는 질문에 섞이지 않고 즉시 실패한다', () => {
  assert.throws(() => claudeReviewInvocation(['--root']), /CLAUDE_REVIEW_ROOT_REQUIRED/);
  assert.throws(
    () => claudeReviewInvocation(['--root', 'C:\\repo', '--promt', '오타']),
    /CLAUDE_REVIEW_UNSUPPORTED_ARG:--promt/
  );
});

test('never treats an empty or failed Claude process as an answer', () => {
  assert.equal(claudeRunOutcome({ status: 0, stdout: '', stderr: '' }).status, 'EMPTY_RESPONSE');
  assert.equal(claudeRunOutcome({ status: 1, stdout: '', stderr: 'boom' }).status, 'FAILED');
  assert.equal(claudeRunOutcome({ status: 0, stdout: '검토 답변', stderr: '' }).status, 'ANSWERED');
  assert.equal(claudeRunOutcome({ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' }, stdout: '', stderr: '' }).status, 'REVIEW_TIMEOUT');
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

// ★2026-09-28 — Claude 가 Codex 의 PR #332 를 검토하다 찾은 것.
//   옛 판은 모르는 인자의 «값»을 물음에 이어 붙였다: `--model opus "질문"` → 물음이 `"opus 질문"`.
//   부르는 쪽은 `질문` 을 물었다고 믿는데 상대는 다른 것을 받는다. 검토가 조용히 오염된다.
test('모르는 인자는 조용히 삼키지 않고 던진다 — 물음이 오염되면 검토가 거짓이 된다', () => {
  assert.throws(
    () => claudeReviewArgs(['--model', 'opus', '질문입니다']),
    /CLAUDE_REVIEW_UNSUPPORTED_ARG:--model/,
    '플래그 값이 물음에 빨려 들어가면 안 된다'
  );
  assert.throws(
    () => claudeReviewArgs(['-C', 'C:/dev/aiops', '-p', '질문입니다']),
    /CLAUDE_REVIEW_UNSUPPORTED_ARG:-C/
  );
});

test('★권한모드 잠금은 그대로다 — 부르는 쪽이 검토 세션의 권한을 못 올린다', () => {
  /** 이건 «고쳐야 할 것»이 아니라 지켜야 할 설계다. bypassPermissions 를 넘겨도 plan 으로 간다. */
  const 인자 = claudeReviewArgs(['--permission-mode', 'plan', '-p', '질문입니다']);
  assert.deepEqual(인자, ['-p', '질문입니다', '--permission-mode', 'plan', '--output-format', 'text']);
  assert.throws(
    () => claudeReviewArgs(['--permission-mode', 'bypassPermissions', '-p', '질문입니다']),
    /CLAUDE_REVIEW_UNSUPPORTED_ARG:bypassPermissions/,
    '권한을 올리려는 시도는 조용히 무시되는 대신 눈에 보여야 한다'
  );
});

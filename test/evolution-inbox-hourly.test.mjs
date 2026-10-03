import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decide, ownCommentMain, buildPrompt, formatComment, judgeAnswer, isUsageLimit, relativizePaths } from '../scripts/evolution-inbox-hourly.mjs';

test('자기 댓글은 머리줄의 7~40자리 main 해시로만 판별한다', () => {
  const header = '## [GPT 매시 점검 · 2026-10-03';
  for (const hash of ['abcdef0', '12345678', 'A'.repeat(40)]) {
    assert.equal(ownCommentMain(`${header} · main ${hash}]\n\n본문`), hash);
  }
  for (const body of [undefined, null, '일반 댓글', `${header} · 첫 진단 옮김]`,
    `${header} · 첫 진단 옮김]\nmain abcdef01`, `일반 댓글 main abcdef01`,
    `${header} · main abcdef]`, `${header} · main ${'a'.repeat(41)}]`]) {
    assert.equal(ownCommentMain(body), null);
  }
});

test('state가 없거나 force여도 같은 main의 자기 댓글에는 재반응하지 않는다', () => {
  const mainHead = 'abcdef0123456789';
  const lastCommentBody = `## [GPT 매시 점검 · 2026-10-03 · main abcdef01]\n\n본문`;
  for (const prev of [undefined, { main_head: mainHead, last_comment_id: 1 }]) {
    for (const force of [false, true]) {
      assert.deepEqual(decide({ prev, mainHead, lastCommentId: 1, lastCommentBody, force }),
        { run: false, reason: 'OWN_LAST_COMMENT' });
      assert.deepEqual(decide({ prev, mainHead: 'fedcba9876543210', lastCommentId: 1, lastCommentBody, force }),
        { run: true });
    }
  }
  assert.deepEqual(decide({ prev: { main_head: mainHead, last_comment_id: 1 }, mainHead,
    lastCommentId: 1, lastCommentBody: '일반 댓글', force: true }), { run: true });
});

test('rerunOwn은 자기 댓글 판별만 건너뛰고 force와 함께 쓰면 재실행한다', () => {
  const mainHead = 'abcdef0123456789';
  const input = { mainHead, lastCommentId: 1,
    lastCommentBody: '## [GPT 매시 점검 · 2026-10-03 · main abcdef01]\n\n본문', rerunOwn: true };
  assert.deepEqual(decide(input), { run: true });
  const prev = { main_head: mainHead, last_comment_id: 1 };
  assert.deepEqual(decide({ ...input, prev }), { run: false, reason: 'UNCHANGED' });
  assert.deepEqual(decide({ ...input, prev, force: true }), { run: true });
  assert.deepEqual(decide({ ...input, prev, force: true, rerunOwn: false }),
    { run: false, reason: 'OWN_LAST_COMMENT' });
});

test('main catch는 실패를 기록하고 체크포인트를 유지하며 성공 코드로 종료한다', () => {
  const source = readFileSync(new URL('../scripts/evolution-inbox-hourly.mjs', import.meta.url), 'utf8');
  const catchBody = source.match(/\} catch \{([^}]+)\}\s*\}\s*if \(process\.argv/s)?.[1];
  assert.ok(catchBody, 'main catch 경로를 찾는다');
  assert.match(catchBody, /save\('FAILED'\);\s*return 0;/);
  assert.doesNotMatch(catchBody, /return 1\b|checkpoint|main_head|last_comment_id/);
});

test('worktree 링크는 구분자와 대소문자에 관계없이 상대경로로 만든다', () => {
  const root = 'C:/Users/admin/AppData/Local/ai-core-evolution/main';
  for (const separator of ['/', '\\']) {
    for (const trailing of ['', separator]) {
      const worktree = root.replaceAll('/', separator) + trailing;
      const path = `${root}/src/collaboration/duo-reach.mjs:62`.replaceAll('/', separator);
      assert.equal(relativizePaths(`[duo-reach.mjs:62](${path})`, worktree.toUpperCase()),
        `[duo-reach.mjs:62](src${separator}collaboration${separator}duo-reach.mjs:62)`);
      assert.equal(relativizePaths(`[a](${root}/src/x.mjs:62)`, worktree), '[a](src/x.mjs:62)');
    }
  }
  assert.equal(relativizePaths(root, root), '');
  assert.equal(relativizePaths('[a](C:/Users/admin/other/x.mjs)', root), '[a](<local>/other/x.mjs)');
  assert.equal(relativizePaths('C:\\Users\\someone\\other\\x.mjs', root), '<local>\\other\\x.mjs');
  assert.equal(relativizePaths(`${root}-other/x.mjs`, root), '<local>/AppData/Local/ai-core-evolution/main-other/x.mjs');
  assert.equal(relativizePaths('NO_CHANGE\n상대경로 src/x.mjs', root), 'NO_CHANGE\n상대경로 src/x.mjs');
});

test('동일 revision과 댓글만 건너뛴다', () => {
  const prev = { main_head: 'abc', last_comment_id: 1 };
  assert.deepEqual(decide({ prev, mainHead: 'abc', lastCommentId: 1 }), { run: false, reason: 'UNCHANGED' });
  for (const input of [
    { prev, mainHead: 'def', lastCommentId: 1 },
    { prev, mainHead: 'abc', lastCommentId: 2 },
    { mainHead: 'abc', lastCommentId: 1 },
  ]) assert.deepEqual(decide(input), { run: true });
});

test('빈 답과 정확한 NO_CHANGE만 게시에서 제외한다', () => {
  for (const answer of [undefined, null, '', ' \n']) assert.equal(judgeAnswer(answer), 'EMPTY');
  for (const answer of ['NO_CHANGE', ' NO_CHANGE\n']) assert.equal(judgeAnswer(answer), 'NO_CHANGE');
  for (const answer of ['본문', 'NO_CHANGE 추가 설명', 'no_change']) assert.equal(judgeAnswer(answer), 'POST');
});

test('KST 날짜 경계와 main 앞 8자리, 본문 공백을 정리한다', () => {
  assert.equal(formatComment({ answer: ' 본문\n', at: '2026-10-03T16:05:00Z', mainHead: '123456789abc' }),
    '## [GPT 매시 점검 · 2026-10-04 01:05 KST · main 12345678]\n\n본문');
});

test('6000자 초과 본문만 자른다', () => {
  const format = answer => formatComment({ answer, at: '2026-10-03 12:30', mainHead: 'abcdefghijk' }).split('\n\n')[1];
  assert.equal(format('가'.repeat(6000)), '가'.repeat(6000));
  assert.equal(format(' 가'.trim().repeat(6001)), '가'.repeat(6000) + '…(잘림)');
});

test('사용량 제한 응답을 대소문자와 무관하게 식별한다', () => {
  for (const text of ['Usage Limit', 'RATE LIMIT', 'quota exceeded', 'too many requests',
    'You have hit your usage limit', '429 Too Many Requests', 'UNAVAILABLE_UNTIL_RESET']) assert.equal(isUsageLimit(text), true);
  for (const text of ['', undefined, 'ordinary failure', 'HTTP 429', 'tokens used 12,429', 'quota']) assert.equal(isUsageLimit(text), false);
});

test('프롬프트는 정본과 근거, 중복 및 민감정보 금지를 지정한다', () => {
  const prompt = buildPrompt({ mainHead: 'abc123', inboxFile: 'inbox-recent.md', repoDir: 'repo-dir' });
  for (const text of ['repo-dir', 'abc123', 'inbox-recent.md', '#211', 'NO_CHANGE', '중복 금지',
    '민감정보(키·주민번호·고객정보)는 쓰지 않는다', '추측 금지', '파일 경로·근거', 'P0/P1/P2', '■ 지난 제안 반영 여부',
    '파일 경로는 저장소 기준 상대경로(예: scripts/duo.mjs:231)로, 이 PC 의 절대경로를 쓰지 않는다']) assert.ok(prompt.includes(text), text);
});

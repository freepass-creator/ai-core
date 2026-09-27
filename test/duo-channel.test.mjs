// 둘이 주고받는 자리가 «세션에 매이지 않는지» 지킨다.
//
// ★대표 2026-09-27: 「자유롭게 소통할 수 있어야 되고, 어느 세션이든 이용할 수 있어야 돼」
//   그래서 우편함은 저장소 안에 둔다. 세션에 매인 통로는 그 세션이 닫히면 끊긴다.
//   Codex 가 답한 조건도 함께 지킨다: 「작업 시작 지침에 inbox 실행을 필수화하고,
//   미답변 요청 처리·회신 뒤 기록을 완료 조건으로 검사하라」.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

test('우편함은 저장소 안에 있다 — 어느 세션에서든 같은 자리를 본다', () => {
  const 본문 = read('scripts/duo.mjs');
  assert.match(본문, /docs\/coordination\/duo/, '우편함 자리가 저장소 안이어야 한다');
  assert.match(본문, /세션에 매이지 않는다|세션은 상시 대기하지 않는다/, '왜 파일로 두는지가 적혀 있어야 한다');
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.scripts.duo, 'node scripts/duo.mjs', 'npm run duo 로 어디서든 부를 수 있어야 한다');
});

test('★막힘·실패를 조용히 넘기지 않는다 — 상태 넷이 다 있다', () => {
  const 본문 = read('scripts/duo.mjs');
  for (const 값 of ['OPEN', 'ANSWERED', 'BLOCKED', 'FAILED']) {
    assert.ok(본문.includes(`'${값}'`), `상태 ${값} 가 없다`);
  }
  /** Claude 쪽은 사용량 게이트를 먼저 보고, 닫혀 있으면 풀리는 시각을 답에 적는다. */
  assert.match(본문, /claude-usage-gate\.mjs/, 'Claude 게이트를 확인하지 않는다');
  assert.match(본문, /blocked_until/, '막혔을 때 풀리는 시각을 적어야 한다');
});

test('1순위 규칙이 이 우편함을 «세션 시작의 첫 일»로 지정한다', () => {
  for (const 길 of ['AGENTS.md', 'CLAUDE.md']) {
    const 글 = read(길);
    assert.match(글, /npm run duo -- inbox/, `${길}: 세션 시작 때 볼 자리가 없다`);
    assert.match(글, /어느 세션에서든/, `${길}: 세션 독립성이 적혀 있어야 한다`);
    /** inbox 안내가 호출 방법보다 «먼저» 와야 한다 — 묻기 전에 받은 것부터 본다. */
    assert.ok(글.indexOf('duo -- inbox') < 글.indexOf('claude:review'), `${길}: inbox 가 호출 방법 뒤에 있다`);
  }
});

test('★실제로 주고받은 기록이 남아 있다 — 첫 호출의 실패까지', () => {
  const 기록 = read('docs/coordination/CROSS_AI_LOG.md');
  assert.match(기록, /ENOENT/, '첫 호출 실패가 지워졌다 — 실패를 남기는 것이 이 채널의 요점이다');
  assert.match(기록, /duo -- inbox/, 'Codex 가 답한 내용이 없다');
  assert.match(기록, /REVALIDATED/, '그림자 드리프트를 잡은 기록이 없다');
});

test('명령이 실제로 돈다 — 빈 우편함에서 inbox 가 답한다', () => {
  const 집 = mkdtempSync(join(tmpdir(), 'ai-core-duo-'));
  try {
    const 결과 = execFileSync(process.execPath, [resolve(root, 'scripts/duo.mjs'), 'inbox'], {
      cwd: root, encoding: 'utf8'
    });
    assert.match(결과, /열린 것|전체 \d+개/, 'inbox 가 상태를 말하지 않는다');
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

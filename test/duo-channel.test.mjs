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
  assert.match(본문, /claude-usage-gate\.mjs', 'run'/, 'Claude 게이트가 열렸을 때 실제 질문을 보내지 않는다');
  assert.match(본문, /상태\.답함/, 'Claude 답을 ANSWERED 상태로 회수하지 않는다');
  assert.match(본문, /\.find\(Boolean\)/, '빈 stdout이 실제 stderr 실패 사유를 가릴 수 있다');
  assert.match(본문, /UNAVAILABLE_.*상태\.막힘/s, '첫 사용량 한도 응답을 BLOCKED로 기록하지 않는다');
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

// ★2026-09-28 — 답을 받고도 «기록이 유실»된 일이 있었다.
//   Codex 가 워치독 설계에 답을 줬는데 `writeFileSync` 가 EPERM 으로 죽었다(윈도우 인덱서·백신이
//   갓 만든 파일을 순간 잡는다). 답은 화면에만 남고 우편함에는 «묻지도 않은 것»이 됐다.
//   이 채널의 요점은 「막힘을 통과로 세지 않는다」인데, 유실은 반대로 「물은 것을 안 물은 것」으로 센다.
test('쪽지 저장은 EPERM 을 조용히 넘기지 않는다 — 다시 해 보고, 그래도 안 되면 던진다', () => {
  const 본문 = readFileSync(resolve(root, 'scripts/duo.mjs'), 'utf8');
  const 저장부 = 본문.slice(본문.indexOf('const 저장 ='), 본문.indexOf('export function 부른다'));
  assert.match(저장부, /EPERM/, 'EPERM 을 알아보지 못하면 한 번 튕기고 끝난다');
  assert.match(저장부, /for \(let 번/, '다시 해 보는 길이 없다');
  assert.match(저장부, /throw new Error/, '끝내 못 남겼는데 성공처럼 돌아가면 채널이 거짓말을 한다');
});

test('EPERM 으로 유실됐던 쪽지가 복원돼 있다 — 물은 기록이 남아야 물은 것이다', () => {
  const 쪽지 = JSON.parse(readFileSync(resolve(root, 'docs/coordination/duo/c8b7773c.json'), 'utf8'));
  assert.equal(쪽지.state, 'ANSWERED');
  assert.match(쪽지.answer, /발행 나이는 빈·부분·오발행/, 'Codex 답이 그대로 남아 있어야 한다');
});

// ★2026-10-03 — Codex 기본 모델(gpt-6.1-sol)이 ChatGPT 계정에서 400 으로 거부돼 `--now` 상의가 전부 FAILED 였다.
//   사용자 설정(~/.codex/config.toml)을 고치지 않고 호출에 모델을 적는다.
test('Codex 호출은 모델을 명시한다 — 기본 모델이 거부되면 상의가 통째로 막힌다', () => {
  const 본문 = read('scripts/duo.mjs');
  assert.match(본문, /process\.env\.CODEX_MODEL \|\| 'gpt-5\.5'/, 'CODEX_MODEL 로 바꿀 수 있고 기본값이 있어야 한다');
  assert.match(본문, /codex exec -s read-only -m \$\{코덱스모델\}/, 'codex exec 에 -m 이 빠졌다');
  for (const 길 of ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'docs/AI_WORKING_STANDARD.md']) {
    assert.match(read(길), /codex exec -s read-only -m gpt-5\.5 /, `${길}: 진입 문서의 호출법에 모델이 없다`);
  }
});

test('★CODEX_MODEL 은 셸에 들어가기 전에 이름 꼴을 검사한다 — 셸 인젝션을 막는다 (Codex 검토 #368)', () => {
  const 본문 = read('scripts/duo.mjs');
  assert.match(본문, /if \(!모델이름꼴\.test\(코덱스모델\)\)/, '모델 이름 검사 없이 셸 명령을 만든다');
  assert.ok(본문.indexOf('모델이름꼴.test(코덱스모델)') < 본문.indexOf('codex exec -s read-only -m'), '검사가 호출보다 뒤에 있다');
  const 꼴 = /^[A-Za-z0-9._-]+$/;
  for (const 좋은 of ['gpt-5.5', 'gpt-6.1-sol', 'o4_mini']) assert.ok(꼴.test(좋은), 좋은);
  for (const 나쁜 of ['gpt-5.5; rm -rf ~', 'x$(id)', 'a b', '`id`', '']) assert.ok(!꼴.test(나쁜), 나쁜);
});

test('나쁜 CODEX_MODEL 이면 codex 를 부르지 않고 FAILED 로 돌려준다 — 실제 부른다() 로 확인', () => {
  const 모듈 = new URL('../scripts/duo.mjs', import.meta.url).href;
  const 결과 = execFileSync(process.execPath, ['--input-type=module', '-e', `
    process.argv = [process.argv[0], 'duo.mjs', 'inbox'];
    const { 부른다 } = await import(${JSON.stringify(모듈)});
    console.log('RESULT' + JSON.stringify(부른다({ id: 't0000000', to: 'codex', about: 'a', body: 'b' })));
  `], { cwd: root, encoding: 'utf8', env: { ...process.env, CODEX_MODEL: 'gpt-5.5; echo PWNED' } });
  const 답 = JSON.parse(결과.slice(결과.indexOf('RESULT') + 6).trim());
  assert.equal(답.state, 'FAILED');
  assert.match(답.answer, /모델 이름 꼴이 아니다/);
  assert.doesNotMatch(결과, /^PWNED/m);
});

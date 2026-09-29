// 에피소드의 «바뀐 파일 목록»을 손으로 적지 않아도 되게 한 것이, 무엇을 지키고 무엇을 놓는지 고정한다.
//
// ★왜 (2026-09-23 재고 실측 · docs/integration/PR_BACKLOG_TRIAGE.md)
//   열린 PR 78개 중 15개가 `docs/episodes/ORDER-DESK-001.json` 을 건드리고 있었다.
//   내용이 겹쳐서가 아니라, 규칙상 «모든 PR 이 자기 경로를 같은 배열에 적어야» 해서 난 충돌이다.
//   그런데 그 배열은 검사기가 git diff 와 «정확히 같은지»만 본다 — git 이 이미 아는 것을 옮겨 적는 일이다.
//   그래서 목록을 선택으로 바꾸되, 빈 것이 «실수»가 아니라 «작정»임을 밝히게 했다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const 여기 = dirname(fileURLToPath(import.meta.url));
const 검사기 = resolve(여기, '../scripts/verify-main-state.mjs');

const 검사기본문 = readFileSync(검사기, 'utf8');

test('목록을 적었으면 예전처럼 «정확히» 대조한다 — 기존 PR 이 깨지지 않는다', () => {
  assert.match(검사기본문, /JSON\.stringify\(actual\) !== JSON\.stringify\(recorded\)/);
  assert.match(검사기본문, /const recorded = 목록없음 && 유도선언 \? actual :/);
});

test('★목록을 지웠는데 «작정» 표시가 없으면 빨강이다 — 실수로 빠뜨린 것과 구별한다', () => {
  assert.match(검사기본문, /must either list changed_files or set changed_files_derived/);
  assert.match(검사기본문, /const 유도선언 = active\.changed_files_derived === true/);
});

test('유도해도 «파일이 실제로 있는지»는 계속 본다', () => {
  /** 목록을 유도하면 그 목록으로 존재 확인이 돈다 — 삭제된 것은 diff 가 알려 주므로 그대로 통과한다. */
  assert.match(검사기본문, /if \(!fileExists\(path\) && !deletedSince\.has\(path\)\)/);
});

test('★이제 저장소는 «유도하는» 쪽이다 — 손으로 적던 목록으로 돌아가지 않는다', () => {
  /** 2026-09-23 에 이 검사는 「아직은 목록을 적는다(호환)」를 고정하고 있었다. 2026-09-29 에 실제로 넘어갔다.
   *
   *  왜 넘어갔나: 그 목록은 git diff 와 «완전일치»해야 해서 고유 검출력이 0 이었다(Codex 확인).
   *  잡아내는 것은 없으면서 모든 변경이 같은 배열에 append 해야 했고 — 최근 커밋 120개 중 28개가 이 파일을
   *  건드렸다. 내용이 달라서가 아니라 «같은 줄에 적어야 해서» 나는 충돌이라 PR 15개가 서로 깨졌다.
   *
   *  ★남은 위험(Codex 반례): base_revision 이 오래되면 무관한 변경까지 흡수하고도 PASS 한다.
   *    그건 요구사항·receipt 로 막아야 한다 — 목록을 되살려서 막을 수 있는 것이 아니다. */
  const 활성 = JSON.parse(readFileSync(resolve(여기, '../docs/episodes/ORDER-DESK-001.json'), 'utf8'));
  assert.equal(활성.changed_files, undefined, '목록이 되살아났다 — 그러면 다시 모든 PR 이 한 배열에서 만난다');
  assert.equal(활성.changed_files_derived, true, '유도 선언이 없으면 관문이 「둘 다 아님」으로 막는다');
});

test('★유도 경로가 실제로 돈다 — 작은 저장소를 만들어 확인한다', () => {
  const 집 = mkdtempSync(join(tmpdir(), 'ai-core-episode-'));
  try {
    const git = (...인자) => execFileSync('git', 인자, { cwd: 집, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    git('init', '-q');
    git('config', 'user.email', 'test@example.com');
    git('config', 'user.name', 'test');
    writeFileSync(join(집, 'seed.txt'), 'seed\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'seed');
    const 기준 = git('rev-parse', 'HEAD').trim();

    writeFileSync(join(집, 'added.txt'), 'new\n');
    mkdirSync(join(집, 'docs'), { recursive: true });

    /** 검사기의 유도 규칙과 같은 방식으로 «실제 변경»을 구한다. */
    const 변경 = git('-c', 'core.quotepath=false', 'diff', '--name-only', 기준).trim().split(/\r?\n/).filter(Boolean);
    const 새것 = git('-c', 'core.quotepath=false', 'ls-files', '--others', '--exclude-standard').trim().split(/\r?\n/).filter(Boolean);
    const 유도 = [...new Set([...변경, ...새것])].sort();

    assert.deepEqual(유도, ['added.txt'], 'git 만으로 바뀐 파일을 알 수 있다 — 손으로 적을 이유가 없다');
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

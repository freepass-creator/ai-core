// duo 쪽지가 worktree 에 갇히지 않게 한다.
//
// ★2026-10-03 실측: 다른 worktree 에서 한 문답 29건이 main 에 못 올라가고 B3Q 백업 가지에만 남아 있었다.
//   쓰는 자리는 그대로 두되, «GitHub 에 안 닿은 쪽지»를 모든 worktree 에서 찾아내야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { 갇힌기록, 모든쪽지, 우편함자리 } from '../src/collaboration/duo-reach.mjs';

const 깃 = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const 쪽지 = (id, 덮을것 = {}) => JSON.stringify({ id, from: 'claude', to: 'codex', about: 't', body: 'b', asked_at: '2026-10-03T00:00:00Z', state: 'ANSWERED', answer: 'a', answered_at: '2026-10-03T00:01:00Z', ...덮을것 }, null, 2) + '\n';
const 쓴다 = (w, id, 덮을것) => {
  mkdirSync(join(w, 우편함자리), { recursive: true });
  writeFileSync(join(w, 우편함자리, `${id}.json`), 쪽지(id, 덮을것));
};

/** 원격(bare) 하나 + main checkout + worktree 하나를 만든다. */
function 판짜기() {
  const 집 = mkdtempSync(join(tmpdir(), 'ai-core-duo-reach-'));
  const 원격 = join(집, 'remote.git');
  const 본 = join(집, 'main');
  const 곁 = join(집, 'side');
  깃(집, 'init', '-q', '--bare', 원격);
  깃(집, 'init', '-q', '-b', 'main', 본);
  깃(본, 'config', 'user.email', 't@t');
  깃(본, 'config', 'user.name', 't');
  깃(본, 'config', 'core.autocrlf', 'false');
  writeFileSync(join(본, 'README.md'), 'x\n');
  깃(본, 'add', '.');
  깃(본, 'commit', '-q', '-m', 'init');
  깃(본, 'remote', 'add', 'origin', 원격);
  깃(본, 'push', '-q', 'origin', 'main');
  깃(본, 'fetch', '-q', 'origin');
  깃(본, 'worktree', 'add', '-q', '-b', 'work/x', 곁);
  return { 집, 본, 곁 };
}

test('★다른 worktree 의 커밋 안 된 쪽지를 찾는다 — 지우면 사라질 자리', () => {
  const { 집, 본, 곁 } = 판짜기();
  try {
    쓴다(곁, 'aaaa0001');
    const 판 = 갇힌기록(본);
    assert.equal(판.미커밋, 1);
    assert.equal(판.자리.length, 1);
    assert.match(판.자리[0].경로, /side$/);
    assert.equal(갇힌기록(본, { 대상: join(집, 'typo') }).대상없음, true);
    assert.notEqual(갇힌기록(본, { 대상: 본 }).대상없음, true);
    assert.notEqual(갇힌기록(본, { 대상: 곁 }).대상없음, true);
    /** 지우기 전 검사는 그 worktree 하나만 본다 */
    assert.equal(갇힌기록(본, { 대상: 본 }).자리.length, 0);
    assert.equal(갇힌기록(본, { 대상: 곁 }).미커밋, 1);
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

test('커밋만 하고 푸시 안 한 것도 갇힌 것이다 — 푸시하면 풀린다 (기준은 origin/main 이 아니라 원격 전체)', () => {
  const { 집, 본, 곁 } = 판짜기();
  try {
    쓴다(곁, 'aaaa0002');
    깃(곁, 'add', '.');
    깃(곁, 'commit', '-q', '-m', 'duo');
    assert.deepEqual([갇힌기록(본).미커밋, 갇힌기록(본).미푸시], [0, 1]);
    /** PR 을 기다리는 가지에 푸시됐으면 GitHub 에 닿은 것이다 — main 에 병합 전이어도 */
    깃(곁, 'push', '-q', 'origin', 'work/x');
    assert.equal(갇힌기록(본).자리.length, 0);
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

test('같은 내용이 이미 origin/main 에 있으면 커밋 안 됐어도 닿은 것이다 — 복구 PR 뒤에 남은 사본', () => {
  const { 집, 본, 곁 } = 판짜기();
  try {
    쓴다(본, 'aaaa0003');
    깃(본, 'add', '.');
    깃(본, 'commit', '-q', '-m', 'rescue');
    깃(본, 'push', '-q', 'origin', 'main');
    깃(곁, 'fetch', '-q', 'origin');
    쓴다(곁, 'aaaa0003');
    assert.equal(갇힌기록(본).자리.length, 0);
    /** 내용이 다르면 여전히 갇힌 것이다 */
    쓴다(곁, 'aaaa0003', { answer: '다른 답' });
    assert.equal(갇힌기록(본).미커밋, 1);
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

test('★폴더가 사라진 worktree 는 고아로 센다 — 거기 있던 쪽지는 확인할 수 없다', () => {
  const { 집, 본, 곁 } = 판짜기();
  try {
    rmSync(곁, { recursive: true, force: true });
    assert.equal(existsSync(곁), false);
    const 판 = 갇힌기록(본);
    assert.equal(판.고아, 1);
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

test('inbox 는 모든 worktree 의 쪽지를 합친다 — OPEN 과 답한 판은 진행, 답한 판끼리 다르면 충돌', () => {
  const { 집, 본, 곁 } = 판짜기();
  try {
    쓴다(본, 'bbbb0001', { state: 'OPEN', answer: null, answered_at: null });
    쓴다(곁, 'bbbb0001');
    쓴다(곁, 'bbbb0002', { state: 'OPEN', answer: null, answered_at: null });
    let 판 = 모든쪽지(본);
    assert.deepEqual(판.쪽지들.map((x) => [x.id, x.state]), [['bbbb0001', 'ANSWERED'], ['bbbb0002', 'OPEN']]);
    assert.equal(판.충돌.length, 0);

    쓴다(본, 'bbbb0001', { answer: '다른 답' });
    판 = 모든쪽지(본);
    assert.equal(판.충돌.length, 1);
    assert.equal(판.충돌[0].id, 'bbbb0001');
  } finally {
    rmSync(집, { recursive: true, force: true });
  }
});

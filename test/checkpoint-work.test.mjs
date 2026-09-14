import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { checkpointWork } from '../scripts/checkpoint-work.mjs';

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function repository(branch = 'work/codex/example') {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-checkpoint-'));
  git(root, ['init', '-b', 'main']);
  git(root, ['config', 'user.email', 'test@example.invalid']);
  git(root, ['config', 'user.name', 'Checkpoint Test']);
  await writeFile(join(root, 'selected.txt'), 'base\n');
  await writeFile(join(root, 'other.txt'), 'base\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'base']);
  git(root, ['remote', 'add', 'origin', root]);
  if (branch !== 'main') git(root, ['switch', '-c', branch]);
  return root;
}

test('commits a selected clean-lane change after checks', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  const result = await checkpointWork({ root, message: 'checkpoint selected', paths: ['selected.txt'] });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.deepEqual(result.paths, ['selected.txt']);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
  assert.equal(git(root, ['status', '--short']), '');
});

test('preserves but refuses unrelated dirty work', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  await writeFile(join(root, 'other.txt'), 'unrelated\n');
  await assert.rejects(
    checkpointWork({ root, message: 'checkpoint selected', paths: ['selected.txt'], checks: false }),
    error => error.code === 'HOLD_UNRELATED_DIRTY'
  );
  assert.equal(await readFile(join(root, 'other.txt'), 'utf8'), 'unrelated\n');
});

test('refuses main and path traversal', async () => {
  const root = await repository('main');
  await writeFile(join(root, 'selected.txt'), 'changed\n');
  await assert.rejects(
    checkpointWork({ root, message: 'bad', paths: ['selected.txt'], checks: false }),
    error => error.code === 'HOLD_BRANCH_NOT_OWNED'
  );
  await assert.rejects(
    checkpointWork({ root, message: 'bad', paths: ['../outside'], checks: false }),
    error => error.code === 'HOLD_INVALID_PATH'
  );
});

test('refuses to inherit another process staged changes', async () => {
  const root = await repository();
  await writeFile(join(root, 'other.txt'), 'staged by other\n');
  git(root, ['add', 'other.txt']);
  await assert.rejects(
    checkpointWork({ root, message: 'bad', paths: ['selected.txt'], checks: false }),
    error => error.code === 'HOLD_PRESTAGED_CHANGES'
  );
});

test('refuses directories without staging their contents', async () => {
  const root = await repository();
  await mkdir(join(root, 'folder'));
  await writeFile(join(root, 'folder', 'file.txt'), 'new\n');
  await assert.rejects(
    checkpointWork({ root, message: 'bad', paths: ['folder'], checks: false }),
    error => error.code === 'HOLD_PATH_NOT_FILE'
  );
  assert.equal(git(root, ['diff', '--cached', '--name-only']), '');
});

test('refuses a linked path whose real target is outside the worktree', async t => {
  const root = await repository();
  const outside = await mkdtemp(join(tmpdir(), 'ai-core-outside-'));
  await writeFile(join(outside, 'outside.txt'), 'outside\n');
  try { await symlink(outside, join(root, 'linked'), 'junction'); }
  catch (error) { t.skip(`junction unavailable: ${error.code}`); return; }
  await assert.rejects(
    checkpointWork({ root, message: 'bad', paths: ['linked/outside.txt'], checks: false }),
    error => error.code === 'HOLD_PATH_OUTSIDE_WORKTREE'
  );
});

test('commits an exact tracked deletion', async () => {
  const root = await repository();
  await rm(join(root, 'selected.txt'));
  const result = await checkpointWork({ root, message: 'delete selected', paths: ['selected.txt'], checks: false });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.match(git(root, ['show', '--format=', '--name-status', 'HEAD']), /^D\s+selected\.txt$/);
});

test('commit failure restores tool staging and preserves working changes', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'changed\n');
  const hook = join(root, '.git', 'hooks', 'pre-commit');
  await writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  await assert.rejects(checkpointWork({
    root, message: 'hook rejects', paths: ['selected.txt'], checks: false
  }));
  assert.equal(git(root, ['diff', '--cached', '--name-only']), '');
  assert.match(git(root, ['status', '--short']), /selected\.txt/);
});

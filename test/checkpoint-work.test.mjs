import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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

test('commits only selected paths and preserves unrelated dirty work', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  await writeFile(join(root, 'other.txt'), 'unrelated\n');
  const result = await checkpointWork({ root, message: 'checkpoint selected', paths: ['selected.txt'], checks: false });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.deepEqual(result.paths, ['selected.txt']);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
  assert.equal(await readFile(join(root, 'other.txt'), 'utf8'), 'unrelated\n');
  assert.match(git(root, ['status', '--short']), /other\.txt/);
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

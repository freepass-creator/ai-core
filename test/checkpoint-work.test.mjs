import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
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
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'nested', 'tracked.txt'), 'base\n');
  git(root, ['add', '.']);
  git(root, ['commit', '-m', 'base']);
  git(root, ['remote', 'add', 'origin', root]);
  if (branch !== 'main') git(root, ['switch', '-c', branch]);
  return root;
}

async function remotePair() {
  const root = await repository();
  const bare = await mkdtemp(join(tmpdir(), 'ai-core-origin-'));
  git(bare, ['init', '--bare']);
  git(root, ['remote', 'set-url', 'origin', bare]);
  git(root, ['push', 'origin', 'main']);
  git(root, ['push', '--set-upstream', 'origin', 'HEAD']);
  const other = await mkdtemp(join(tmpdir(), 'ai-core-other-'));
  git(other, ['clone', bare, '.']);
  git(other, ['config', 'user.email', 'other@example.invalid']);
  git(other, ['config', 'user.name', 'Other Writer']);
  git(other, ['switch', 'work/codex/example']);
  return { root, bare, other };
}

const checkpointCli = join(process.cwd(), 'scripts', 'checkpoint-work.mjs');

test('CLI rejects a value-less config flag before default checks can run', () => {
  const result = spawnSync(process.execPath, [checkpointCli, '--config'], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HOLD_ARGUMENT_VALUE_REQUIRED/);
});

test('CLI requires checks in an explicitly supplied config', async () => {
  const root = await repository();
  await writeFile(join(root, 'development.json'), '{}\n');
  const result = spawnSync(process.execPath, [checkpointCli,
    '--root', root, '--config', 'development.json', '--message', 'blocked', '--path', 'selected.txt'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /HOLD_CHECKS_REQUIRED/);
});

test('CLI applies an absolute script to the explicit target root', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'CLI target\n');
  await writeFile(join(root, 'development.json'), JSON.stringify({
    checks: [[process.execPath, '-e', 'process.exit(0)']]
  }));
  git(root, ['add', 'development.json']);
  git(root, ['commit', '-m', 'configure development checks']);
  await writeFile(join(root, 'selected.txt'), 'CLI target\n');
  const result = spawnSync(process.execPath, [checkpointCli,
    '--root', root, '--config', 'development.json', '--message', 'CLI target', '--path', 'selected.txt'
  ], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /COMMITTED_LOCAL/);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
});

test('commits a selected clean-lane change after checks', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  const result = await checkpointWork({ root, message: 'checkpoint selected', paths: ['selected.txt'] });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.deepEqual(result.paths, ['selected.txt']);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
  assert.equal(git(root, ['status', '--short']), '');
});

test('runs project-specific check commands without a shell', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  const result = await checkpointWork({
    root,
    message: 'custom checks',
    paths: ['selected.txt'],
    checkCommands: [[process.execPath, '-e', "process.exit(0)"]]
  });
  assert.equal(result.status, 'COMMITTED_LOCAL');
});

test('rejects malformed project check commands', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  await assert.rejects(
    checkpointWork({ root, message: 'bad checks', paths: ['selected.txt'], checkCommands: ['node --test'] }),
    error => error.code === 'HOLD_INVALID_CHECK_COMMAND'
  );
});

test('rejects empty project checks instead of creating an unverified commit', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  await assert.rejects(
    checkpointWork({ root, message: 'no checks', paths: ['selected.txt'], checkCommands: [] }),
    error => error.code === 'HOLD_CHECKS_REQUIRED'
  );
});

test('runs npm by its JavaScript entrypoint on Windows', { skip: process.platform !== 'win32' }, async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'selected\n');
  const result = await checkpointWork({
    root, message: 'windows npm', paths: ['selected.txt'], checkCommands: [['npm', '--version']]
  });
  assert.equal(result.status, 'COMMITTED_LOCAL');
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

test('commits a tracked deletion when its parent directory is also gone', async () => {
  const root = await repository();
  await rm(join(root, 'nested'), { recursive: true });
  const result = await checkpointWork({
    root, message: 'delete nested', paths: ['nested/tracked.txt'], checks: false
  });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.match(git(root, ['show', '--format=', '--name-status', 'HEAD']), /^D\s+nested\/tracked\.txt$/);
});

test('successful local hooks cannot mutate the validated commit snapshot', async () => {
  const root = await repository();
  await writeFile(join(root, 'selected.txt'), 'changed\n');
  const hook = join(root, '.git', 'hooks', 'pre-commit');
  await writeFile(hook, '#!/bin/sh\necho hook > other.txt\ngit add other.txt\n', { mode: 0o755 });
  const result = await checkpointWork({ root, message: 'hook bypassed', paths: ['selected.txt'], checks: false });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
  assert.equal(await readFile(join(root, 'other.txt'), 'utf8'), 'base\n');
});

test('a real failing repository test blocks commit and leaves files unstaged', async () => {
  const root = await repository();
  await mkdir(join(root, 'test'));
  await writeFile(join(root, 'test', 'fail.test.mjs'),
    "import test from 'node:test'; test('fails', () => { throw new Error('expected'); });\n");
  const before = git(root, ['rev-parse', 'HEAD']);
  await assert.rejects(checkpointWork({
    root, message: 'must not commit', paths: ['test/fail.test.mjs']
  }));
  assert.equal(git(root, ['rev-parse', 'HEAD']), before);
  assert.equal(git(root, ['diff', '--cached', '--name-only']), '');
});

test('a check that mutates a selected file cannot commit unvalidated bytes', async () => {
  const root = await repository();
  await mkdir(join(root, 'test'));
  await writeFile(join(root, 'test', 'mutate.test.mjs'),
    "import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('mutates', async () => { await writeFile('selected.txt', 'mutated by check\\n'); });\n");
  git(root, ['add', 'test/mutate.test.mjs']);
  git(root, ['commit', '-m', 'add mutating check']);
  await writeFile(join(root, 'selected.txt'), 'candidate\n');
  const before = git(root, ['rev-parse', 'HEAD']);
  await assert.rejects(
    checkpointWork({ root, message: 'must not commit mutation', paths: ['selected.txt'] }),
    error => error.code === 'HOLD_SELECTED_CHANGED_DURING_CHECKS'
  );
  assert.equal(git(root, ['rev-parse', 'HEAD']), before);
  assert.equal(git(root, ['diff', '--cached', '--name-only']), '');
});

test('a check cannot create an uncommitted dependency that made validation pass', async () => {
  const root = await repository();
  await mkdir(join(root, 'test'));
  await writeFile(join(root, 'test', 'generate.test.mjs'),
    "import test from 'node:test'; import { writeFile } from 'node:fs/promises'; test('generates', async () => { await writeFile('generated.json', '{}\\n'); });\n");
  git(root, ['add', 'test/generate.test.mjs']);
  git(root, ['commit', '-m', 'add generating check']);
  await writeFile(join(root, 'selected.txt'), 'candidate\n');
  const before = git(root, ['rev-parse', 'HEAD']);
  await assert.rejects(
    checkpointWork({ root, message: 'must include dependencies', paths: ['selected.txt'] }),
    error => error.code === 'HOLD_SELECTED_CHANGED_DURING_CHECKS'
  );
  assert.equal(git(root, ['rev-parse', 'HEAD']), before);
  assert.equal(git(root, ['diff', '--cached', '--name-only']), '');
});

test('uses an isolated lock inside a real linked worktree', async () => {
  const primary = await repository('main');
  const linked = await mkdtemp(join(tmpdir(), 'ai-core-linked-'));
  await rm(linked, { recursive: true });
  git(primary, ['worktree', 'add', '-b', 'work/codex/linked', linked]);
  await writeFile(join(linked, 'selected.txt'), 'linked change\n');
  const primaryLock = join(primary, '.git', 'ai-core-checkpoint.lock');
  await writeFile(primaryLock, 'primary lane lock');
  const result = await checkpointWork({
    root: linked, message: 'linked checkpoint', paths: ['selected.txt'], checks: false
  });
  assert.equal(result.status, 'COMMITTED_LOCAL');
  const linkedLock = git(linked, ['rev-parse', '--git-path', 'ai-core-checkpoint.lock']);
  await assert.rejects(readFile(join(linked, linkedLock), 'utf8'), error => error.code === 'ENOENT');
  assert.equal(await readFile(primaryLock, 'utf8'), 'primary lane lock');
});

test('remote divergence holds before creating a local checkpoint', async () => {
  const { root, other } = await remotePair();
  await writeFile(join(other, 'selected.txt'), 'remote\n');
  git(other, ['add', 'selected.txt']);
  git(other, ['commit', '-m', 'remote change']);
  git(other, ['push', 'origin', 'HEAD']);
  await writeFile(join(root, 'selected.txt'), 'local\n');
  const before = git(root, ['rev-parse', 'HEAD']);
  await assert.rejects(
    checkpointWork({ root, message: 'local change', paths: ['selected.txt'], checks: false }),
    error => error.code === 'HOLD_REMOTE_DIVERGED'
  );
  assert.equal(git(root, ['rev-parse', 'HEAD']), before);
});

test('non-force push publishes a fast-forward checkpoint', async () => {
  const { root, bare } = await remotePair();
  await writeFile(join(root, 'selected.txt'), 'published\n');
  const result = await checkpointWork({
    root, message: 'publish change', paths: ['selected.txt'], checks: false, push: true
  });
  assert.equal(result.status, 'COMMITTED_AND_PUSHED');
  assert.equal(git(bare, ['rev-parse', 'refs/heads/work/codex/example']), result.commit);
});

test('push race keeps the local commit when remote rejects it', async () => {
  const { root, bare, other } = await remotePair();
  await writeFile(join(other, 'selected.txt'), 'racing remote\n');
  git(other, ['add', 'selected.txt']);
  git(other, ['commit', '-m', 'racing remote']);
  await writeFile(join(root, 'selected.txt'), 'local retained\n');
  const hook = join(root, '.git', 'hooks', 'pre-push');
  const otherPath = other.replaceAll('\\', '/');
  await writeFile(hook,
    `#!/bin/sh\ngit -C "${otherPath}" push origin HEAD:work/codex/example\n`, { mode: 0o755 });
  await assert.rejects(
    checkpointWork({ root, message: 'local retained', paths: ['selected.txt'], checks: false, push: true }),
    error => error.code === 'HOLD_PUSH_REJECTED'
  );
  const local = git(root, ['rev-parse', 'HEAD']);
  const remote = git(bare, ['rev-parse', 'refs/heads/work/codex/example']);
  assert.notEqual(local, remote);
  assert.equal(git(root, ['show', '--format=', '--name-only', 'HEAD']), 'selected.txt');
});

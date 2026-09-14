import { closeSync, existsSync, lstatSync, openSync, statSync, unlinkSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function git(root, args, options = {}) {
  const output = execFileSync('git', args, {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options
  });
  return output == null ? '' : String(output).trim();
}

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function normalizePath(root, path) {
  if (!path || isAbsolute(path)) fail('HOLD_INVALID_PATH');
  const absolute = resolve(root, path);
  const rel = relative(root, absolute).replaceAll('\\', '/');
  if (!rel || rel === '..' || rel.startsWith('../')) fail('HOLD_INVALID_PATH');
  return rel;
}

function lines(value) {
  return value ? value.split(/\r?\n/).filter(Boolean).map(path => path.replaceAll('\\', '/')) : [];
}

async function assertSafeFile(root, path) {
  const absolute = resolve(root, path);
  try {
    const actual = await realpath(absolute);
    const outside = relative(root, actual);
    if (outside === '..' || outside.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)) {
      fail('HOLD_PATH_OUTSIDE_WORKTREE');
    }
    if (!statSync(actual).isFile()) fail('HOLD_PATH_NOT_FILE');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    try { git(root, ['ls-files', '--error-unmatch', '--', path]); }
    catch { fail('HOLD_PATH_MISSING'); }
    // The exact lexical path is inside root and is tracked. Its parent may
    // also have been deleted, so no filesystem target remains to escape.
  }
}

function changedPaths(root) {
  return [...new Set([
    ...lines(git(root, ['diff', '--name-only'])),
    ...lines(git(root, ['ls-files', '--others', '--exclude-standard']))
  ])];
}

async function selectedSnapshot(root, selected) {
  return selected.map(path => {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) return `${path}\0DELETED`;
    const metadata = lstatSync(absolute);
    return { path, absolute, metadata };
  }).reduce(async (pending, entry) => {
    const values = await pending;
    if (typeof entry === 'string') values.push(entry);
    else values.push([
      entry.path,
      entry.metadata.mode,
      entry.metadata.isSymbolicLink() ? 'symlink' : 'file',
      await realpath(entry.absolute),
      git(root, ['hash-object', '--', entry.path])
    ].join('\0'));
    return values;
  }, Promise.resolve([])).then(values => values.join('\n'));
}

function remoteBranchExists(root, branch) {
  try { git(root, ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`]); return true; }
  catch { return false; }
}

function runChecks(root) {
  const { NODE_TEST_CONTEXT: ignored, ...cleanEnv } = process.env;
  execFileSync(process.execPath, ['--test'], { cwd: root, stdio: 'inherit', env: cleanEnv });
  const verifier = resolve(root, 'scripts/verify-main-state.mjs');
  if (existsSync(verifier)) execFileSync(process.execPath, [verifier], { cwd: root, stdio: 'inherit' });
}

export async function checkpointWork({ root, message, paths, push = false, checks = true }) {
  root = await realpath(root);
  if (!String(message ?? '').trim()) fail('HOLD_MESSAGE_REQUIRED');
  if (!Array.isArray(paths) || !paths.length) fail('HOLD_PATHS_REQUIRED');
  const selected = [...new Set(paths.map(path => normalizePath(root, path)))];
  const lockPath = resolve(root, git(root, ['rev-parse', '--git-path', 'ai-core-checkpoint.lock']));
  let lock;
  let stagedByUs = false;
  let committed = false;
  try { lock = openSync(lockPath, 'wx'); } catch { fail('HOLD_CHECKPOINT_LOCKED'); }

  try {
    const branch = git(root, ['branch', '--show-current']);
    if (!/^work\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(branch)) fail('HOLD_BRANCH_NOT_OWNED');
    if (lines(git(root, ['diff', '--cached', '--name-only'])).length) fail('HOLD_PRESTAGED_CHANGES');
    for (const path of selected) await assertSafeFile(root, path);
    const dirty = changedPaths(root);
    const unrelated = dirty.filter(path => !selected.includes(path));
    if (unrelated.length) fail('HOLD_UNRELATED_DIRTY', `Unrelated dirty paths: ${unrelated.join(', ')}`);

    git(root, ['fetch', 'origin', '--prune']);
    if (remoteBranchExists(root, branch)) {
      try { git(root, ['merge-base', '--is-ancestor', `origin/${branch}`, 'HEAD']); }
      catch { fail('HOLD_REMOTE_DIVERGED'); }
    }

    const checkedDirty = JSON.stringify([...dirty].sort());
    const checkedSnapshot = await selectedSnapshot(root, selected);
    if (checks) runChecks(root);
    for (const path of selected) await assertSafeFile(root, path);
    if (JSON.stringify(changedPaths(root).sort()) !== checkedDirty ||
        await selectedSnapshot(root, selected) !== checkedSnapshot) {
      fail('HOLD_SELECTED_CHANGED_DURING_CHECKS');
    }
    git(root, ['add', '--', ...selected]);
    stagedByUs = true;
    if (await selectedSnapshot(root, selected) !== checkedSnapshot) {
      fail('HOLD_SELECTED_CHANGED_DURING_STAGING');
    }
    const staged = lines(git(root, ['diff', '--cached', '--name-only']));
    if (!staged.length) fail('HOLD_NO_SELECTED_CHANGES');
    if (staged.some(path => !selected.includes(path))) fail('HOLD_STAGED_SCOPE_MISMATCH');
    const stagedTree = git(root, ['write-tree']);
    const parent = git(root, ['rev-parse', 'HEAD']);
    const commit = git(root, ['commit-tree', stagedTree, '-p', parent], { input: `${message.trim()}\n` });
    git(root, ['update-ref', `refs/heads/${branch}`, commit, parent]);
    committed = true;
    const commitTree = git(root, ['rev-parse', 'HEAD^{tree}']);
    const committedPaths = lines(git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']));
    if (commitTree !== stagedTree || JSON.stringify(committedPaths.sort()) !== JSON.stringify([...staged].sort())) {
      fail('HOLD_COMMIT_SNAPSHOT_MISMATCH', `Commit ${commit} does not match the validated index snapshot`);
    }
    if (push) {
      try { git(root, ['push', '--set-upstream', 'origin', `HEAD:${branch}`], { stdio: 'inherit' }); }
      catch { fail('HOLD_PUSH_REJECTED', `Commit ${commit} is local; push was rejected`); }
    }
    return { status: push ? 'COMMITTED_AND_PUSHED' : 'COMMITTED_LOCAL', branch, commit, paths: staged };
  } finally {
    if (stagedByUs && !committed) {
      try { git(root, ['reset', '--mixed', 'HEAD', '--', ...selected]); } catch {}
    }
    if (lock != null) closeSync(lock);
    try { unlinkSync(lockPath); } catch {}
  }
}

function parseArgs(args) {
  const result = { paths: [], push: false };
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--message') result.message = args[++i];
    else if (args[i] === '--path') result.paths.push(args[++i]);
    else if (args[i] === '--push') result.push = true;
    else fail('HOLD_UNKNOWN_ARGUMENT', args[i]);
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(await checkpointWork({ root: process.cwd(), ...parseArgs(process.argv.slice(2)) }), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ status: error.code ?? 'HOLD_CHECKPOINT_FAILED', reason: error.message }));
    process.exitCode = 1;
  }
}

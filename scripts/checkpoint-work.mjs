import { closeSync, openSync, unlinkSync } from 'node:fs';
import { access, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function git(root, args, options = {}) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim();
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

function remoteBranchExists(root, branch) {
  try { git(root, ['show-ref', '--verify', '--quiet', `refs/remotes/origin/${branch}`]); return true; }
  catch { return false; }
}

function runChecks(root) {
  execFileSync(process.execPath, ['--test'], { cwd: root, stdio: 'inherit' });
  const verifier = resolve(root, 'scripts/verify-main-state.mjs');
  try {
    execFileSync(process.execPath, [verifier], { cwd: root, stdio: 'inherit' });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
}

export async function checkpointWork({ root, message, paths, push = false, checks = true }) {
  root = await realpath(root);
  if (!String(message ?? '').trim()) fail('HOLD_MESSAGE_REQUIRED');
  if (!Array.isArray(paths) || !paths.length) fail('HOLD_PATHS_REQUIRED');
  const selected = [...new Set(paths.map(path => normalizePath(root, path)))];
  const gitDir = resolve(root, git(root, ['rev-parse', '--git-dir']));
  const lockPath = resolve(gitDir, 'ai-core-checkpoint.lock');
  let lock;
  try { lock = openSync(lockPath, 'wx'); } catch { fail('HOLD_CHECKPOINT_LOCKED'); }

  try {
    const branch = git(root, ['branch', '--show-current']);
    if (!/^work\/[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(branch)) fail('HOLD_BRANCH_NOT_OWNED');
    if (lines(git(root, ['diff', '--cached', '--name-only'])).length) fail('HOLD_PRESTAGED_CHANGES');
    for (const path of selected) await access(resolve(root, path));

    git(root, ['fetch', 'origin', '--prune']);
    if (remoteBranchExists(root, branch)) {
      try { git(root, ['merge-base', '--is-ancestor', `origin/${branch}`, 'HEAD']); }
      catch { fail('HOLD_REMOTE_DIVERGED'); }
    }

    if (checks) runChecks(root);
    git(root, ['add', '--', ...selected]);
    const staged = lines(git(root, ['diff', '--cached', '--name-only']));
    if (!staged.length) fail('HOLD_NO_SELECTED_CHANGES');
    if (staged.some(path => !selected.includes(path))) fail('HOLD_STAGED_SCOPE_MISMATCH');
    git(root, ['commit', '-m', message.trim()]);
    const commit = git(root, ['rev-parse', 'HEAD']);
    if (push) {
      try { git(root, ['push', '--set-upstream', 'origin', `HEAD:${branch}`], { stdio: 'inherit' }); }
      catch { fail('HOLD_PUSH_REJECTED', `Commit ${commit} is local; push was rejected`); }
    }
    return { status: push ? 'COMMITTED_AND_PUSHED' : 'COMMITTED_LOCAL', branch, commit, paths: staged };
  } finally {
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

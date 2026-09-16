import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProjectRegistry } from './validate-project-registry.mjs';

const gitExec = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const repoName = url => url.replace(/\\/g, '/').replace(/\.git$/, '').match(/(?:github\.com[/:])([^/]+\/[^/]+)$/i)?.[1] ?? null;
const hold = (reason, detail = {}) => ({ status: 'HOLD', reason, updated: false, ...detail });

export function classifyRepoSync({ dirty, ahead, behind, branchRegistered, remoteMatches, update }) {
  if (!remoteMatches) return hold('CANONICAL_REMOTE_MISMATCH');
  if (!branchRegistered) return hold('WORK_BRANCH_UNREGISTERED');
  if (dirty) return hold('DIRTY_WORKTREE');
  if (ahead > 0 && behind > 0) return hold('DIVERGED', { ahead, behind });
  if (ahead > 0) return hold('LOCAL_COMMITS_UNPUSHED', { ahead, behind });
  if (behind > 0 && !update) return hold('REMOTE_AHEAD', { ahead, behind, next_action: 'REVIEW_THEN_RUN_WITH_UPDATE' });
  return { status: behind > 0 ? 'FAST_FORWARD_ALLOWED' : 'CURRENT', reason: null, ahead, behind, updated: false };
}

export async function repoSyncPreflight({ repoPath, registryPath, projectId, expectedBranch, update = false, git = gitExec }) {
  const registry = JSON.parse((await readFile(resolve(registryPath), 'utf8')).replace(/^\uFEFF/, ''));
  if (validateProjectRegistry(registry).status !== 'VALID') return hold('REGISTRY_INVALID');
  const project = registry.projects.find(row => row.project_id === projectId);
  if (!project) return hold('PROJECT_NOT_REGISTERED');
  const cwd = resolve(repoPath); let branch, remote, dirty, counts;
  try {
    branch = git(cwd, ['branch', '--show-current']); remote = git(cwd, ['remote', 'get-url', 'origin']);
    dirty = Boolean(git(cwd, ['status', '--porcelain']));
  } catch { return hold('GIT_INSPECTION_FAILED'); }
  if (branch !== expectedBranch) return hold('WORKTREE_BRANCH_MISMATCH', { expected_branch: expectedBranch, observed_branch: branch });
  const registered = branch === project.default_branch || (project.work_branches ?? []).includes(branch);
  if (repoName(remote)?.toLowerCase() !== project.repository.toLowerCase()) return hold('CANONICAL_REMOTE_MISMATCH', { branch });
  try {
    git(cwd, ['fetch', '--no-tags', 'origin', branch]); counts = git(cwd, ['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`]).split(/\s+/).map(Number);
    if (counts.length !== 2 || counts.some(value => !Number.isSafeInteger(value) || value < 0)) throw new Error('INVALID_COUNTS');
  }
  catch { return hold('REMOTE_COMPARISON_FAILED', { branch }); }
  let result = classifyRepoSync({ dirty, ahead: counts[0], behind: counts[1], branchRegistered: registered, remoteMatches: true, update });
  if (result.status === 'FAST_FORWARD_ALLOWED') {
    try { git(cwd, ['merge', '--ff-only', `origin/${branch}`]); result = { ...result, status: 'UPDATED_FAST_FORWARD', updated: true, behind: 0 }; }
    catch { return hold('FAST_FORWARD_FAILED', { branch, ahead: counts[0], behind: counts[1] }); }
  }
  let head = null, remoteHead = null;
  try { head = git(cwd, ['rev-parse', 'HEAD']); remoteHead = git(cwd, ['rev-parse', `origin/${branch}`]); } catch {}
  return { ...result, project_id: projectId, repository: project.repository, default_branch: project.default_branch, branch,
    head, remote_head: remoteHead, registry_subject_revision: project.head_revision,
    automatic_actions: result.updated ? ['fetch', 'fast-forward'] : ['fetch'], forbidden_actions: ['push', 'force', 'reset', 'clean', 'stash', 'checkout', 'branch-switch'] };
}

async function main(args) {
  const options = Object.fromEntries(args.map((v, i) => v.startsWith('--') ? [v.slice(2), args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true] : null).filter(Boolean));
  if (!options.repo || !options.registry || !options.project || !options.branch) throw new Error('USAGE');
  const result = await repoSyncPreflight({ repoPath: options.repo, registryPath: options.registry, projectId: options.project, expectedBranch: options.branch, update: options.update === true });
  console.log(JSON.stringify(result, null, 2)); if (result.status === 'HOLD') process.exitCode = 1;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 2; });

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyRepoSync, repoSyncPreflight } from '../scripts/repo-sync-preflight.mjs';

test('classification only permits clean, non-diverged fast-forward', () => {
  assert.equal(classifyRepoSync({ dirty: true, ahead: 0, behind: 1, branchRegistered: true, remoteMatches: true, update: true }).reason, 'DIRTY_WORKTREE');
  assert.equal(classifyRepoSync({ dirty: false, ahead: 1, behind: 1, branchRegistered: true, remoteMatches: true, update: true }).reason, 'DIVERGED');
  assert.equal(classifyRepoSync({ dirty: false, ahead: 1, behind: 0, branchRegistered: true, remoteMatches: true, update: true }).reason, 'LOCAL_COMMITS_UNPUSHED');
  assert.equal(classifyRepoSync({ dirty: false, ahead: 0, behind: 1, branchRegistered: true, remoteMatches: true, update: false }).reason, 'REMOTE_AHEAD');
  assert.equal(classifyRepoSync({ dirty: false, ahead: 0, behind: 1, branchRegistered: true, remoteMatches: true, update: true }).status, 'FAST_FORWARD_ALLOWED');
});

test('preflight pins registry remote/branch and performs only allowed fast-forward', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-sync-')); t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'registry.json');
  await writeFile(registryPath, JSON.stringify({ schema_version: '1.0', observed_at: '2026-09-15T00:00:00Z', projects: [{ project_id: 'ai-core', name: 'AI Core', organization: 'HEADQUARTERS', status: 'ACTIVE', mission: 'Test', repository: 'freepass-creator/ai-core', default_branch: 'main', work_branches: ['codex/order-control-integration'], local_path: null, head_revision: 'a'.repeat(40), authoritative_sources: [{ kind: 'GIT', ref: 'freepass-creator/ai-core', revision: 'a'.repeat(40), observed_at: '2026-09-15T00:00:00Z' }], commands: { install: null, test: 'npm test', build: 'npm run verify' }, deploy_targets: [], required_approvals: [], known_blockers: [] }] }));
  const calls = []; const git = (_cwd, args) => { calls.push(args); const key = args.join(' ');
    if (key === 'branch --show-current') return 'codex/order-control-integration'; if (key === 'remote get-url origin') return 'https://github.com/freepass-creator/ai-core.git';
    if (key === 'status --porcelain') return ''; if (key.startsWith('fetch ')) return ''; if (key.startsWith('rev-list ')) return '0 1';
    if (key.startsWith('merge ')) return ''; if (key === 'rev-parse HEAD' || key.startsWith('rev-parse origin/')) return 'b'.repeat(40); throw new Error(key); };
  const result = await repoSyncPreflight({ repoPath: root, registryPath, projectId: 'ai-core', expectedBranch: 'codex/order-control-integration', update: true, git });
  assert.equal(result.status, 'UPDATED_FAST_FORWARD'); assert.deepEqual(result.automatic_actions, ['fetch', 'fast-forward']);
  assert.ok(calls.some(args => args.join(' ') === 'merge --ff-only origin/codex/order-control-integration'));
  assert.equal(calls.some(args => ['push', 'reset', 'clean', 'stash', 'checkout', 'switch'].includes(args[0])), false);
});

test('preflight holds mismatched branch before fetch or update', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-sync-')); t.after(() => rm(root, { recursive: true, force: true }));
  const registryPath = join(root, 'registry.json'); const registry = JSON.parse(await (await import('node:fs/promises')).readFile(new URL('../examples/project-registry.json', import.meta.url)));
  await writeFile(registryPath, JSON.stringify(registry)); const calls = [];
  const result = await repoSyncPreflight({ repoPath: root, registryPath, projectId: 'ai-core', expectedBranch: 'main', git: (_cwd, args) => { calls.push(args); if (args[0] === 'branch') return 'wrong'; if (args[0] === 'remote') return 'https://github.com/freepass-creator/ai-core.git'; if (args[0] === 'status') return ''; throw new Error('unexpected'); } });
  assert.equal(result.reason, 'WORKTREE_BRANCH_MISMATCH'); assert.equal(calls.some(args => args[0] === 'fetch'), false);
});

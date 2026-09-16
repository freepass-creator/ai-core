import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

function git(path, args) {
  try { return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

export async function inventoryRepositories(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const checkouts = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const path = join(root, entry.name);
    if (git(path, ['rev-parse', '--is-inside-work-tree']) !== 'true') continue;
    const porcelain = git(path, ['status', '--porcelain']) ?? '';
    checkouts.push({
      path,
      repository: git(path, ['remote', 'get-url', 'origin']),
      branch: git(path, ['branch', '--show-current']) || null,
      revision: git(path, ['rev-parse', 'HEAD']),
      dirty_entries: porcelain ? porcelain.split(/\r?\n/).length : 0,
      state: porcelain ? 'DIRTY_HOLD' : 'CLEAN',
    });
  }
  const byRepository = {};
  for (const checkout of checkouts) {
    const key = checkout.repository ?? `LOCAL_ONLY:${checkout.path}`;
    (byRepository[key] ??= []).push(checkout.path);
  }
  return {
    schema_version: '1.0',
    observed_at: new Date().toISOString(),
    root,
    checkout_count: checkouts.length,
    repository_count: Object.keys(byRepository).length,
    dirty_hold_count: checkouts.filter((item) => item.state === 'DIRTY_HOLD').length,
    duplicate_checkout_groups: Object.entries(byRepository).filter(([, paths]) => paths.length > 1).map(([repository, paths]) => ({ repository, paths })),
    checkouts,
  };
}

if (process.argv[1]?.endsWith('inventory-repositories.mjs')) {
  const root = process.argv[2] ?? 'C:\\dev';
  console.log(JSON.stringify(await inventoryRepositories(root), null, 2));
}

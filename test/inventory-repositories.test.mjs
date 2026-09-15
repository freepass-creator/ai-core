import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { inventoryRepositories } from '../scripts/inventory-repositories.mjs';

function git(path, args) { return execFileSync('git', ['-C', path, ...args], { encoding: 'utf8' }); }

test('inventory groups duplicate remotes and holds dirty checkouts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'repo-inventory-'));
  for (const name of ['one', 'two']) {
    const path = join(root, name);
    await mkdir(path);
    git(path, ['init']);
    git(path, ['config', 'user.email', 'test@example.com']);
    git(path, ['config', 'user.name', 'test']);
    git(path, ['remote', 'add', 'origin', 'https://github.com/example/shared.git']);
    await writeFile(join(path, 'tracked.txt'), 'base\n');
    git(path, ['add', 'tracked.txt']);
    git(path, ['commit', '-m', 'base']);
  }
  await writeFile(join(root, 'two', 'dirty.txt'), 'uncommitted\n');
  const result = await inventoryRepositories(root);
  assert.equal(result.checkout_count, 2);
  assert.equal(result.repository_count, 1);
  assert.equal(result.dirty_hold_count, 1);
  assert.equal(result.duplicate_checkout_groups.length, 1);
  assert.equal(result.checkouts.find((item) => item.path.endsWith('two')).state, 'DIRTY_HOLD');
});

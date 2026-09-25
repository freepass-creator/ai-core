import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(root, 'aiops');
const own = new Set(['PROVENANCE.json', 'README.md']);

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(relative(moduleRoot, path).replaceAll('\\', '/'));
  }
  return files;
}

const provenance = JSON.parse(await readFile(resolve(moduleRoot, 'PROVENANCE.json'), 'utf8'));

test('AIOps common copy is pinned, complete and byte-identical to source blobs', async () => {
  assert.equal(provenance.schema, 'ai-core-physical-copy-provenance/v1');
  assert.equal(provenance.source.repository, 'freepass-creator/aiops');
  assert.equal(provenance.source.revision, '3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9');
  assert.equal(provenance.policy.selection, 'HQ_COMMON');
  assert.equal(provenance.counts.source_tracked_files, 1407);
  assert.equal(provenance.counts.copied_files + provenance.counts.excluded_files, 1407);
  assert.equal(provenance.files.length, provenance.counts.copied_files);

  const copied = provenance.files.map(file => file.path);
  assert.equal(new Set(copied).size, copied.length);
  const excluded = new Set(provenance.excluded.map(item => item.path));
  assert(copied.every(path => !excluded.has(path)), 'a path cannot be both copied and excluded');

  const index = new Map(execFileSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--', 'aiops'],
    { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(entry => {
    const [metadata, path] = entry.split('\t');
    return [path.slice('aiops/'.length), metadata.split(' ')[1]];
  }));
  for (const file of provenance.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.equal(index.get(file.path), file.source_git_blob, `${file.path} differs from the source Git blob`);
  }

  const actual = (await walk(moduleRoot)).filter(path => !own.has(path)).sort();
  assert.deepEqual(actual, [...copied].sort(), 'unrecorded or missing AIOps files detected');
});

test('rental business, FreePass business and personal data never enter the HQ copy', () => {
  const byPath = new Map(provenance.excluded.map(item => [item.path, item.disposition]));
  const copied = new Set(provenance.files.map(file => file.path));
  for (const rental of ['lib/gwataeryo-gyuchik.mjs', 'docs/미수로직.md', 'docs/AI매뉴얼-과태료-2026-09.md', 'docs/보험매뉴얼.md']) {
    assert.equal(copied.has(rental), false, rental);
    assert.equal(byPath.get(rental), 'OWNED_BY_RENTAL_RENMAN', rental);
  }
  for (const held of ['lib/accounts.mjs', 'scripts/modusign.py', 'docs/AI시험지.md', 'docs/aiknowhow/보안권한.md']) {
    assert.equal(copied.has(held), false, held);
  }
  for (const prefix of ['wonja/', 'misu/', 'jageum/', 'boheom/', 'asset-engine/', 'unyoung/', 'outputs/', '사건/', '.ai-core/']) {
    assert(![...copied].some(path => path.startsWith(prefix)), prefix);
  }
});

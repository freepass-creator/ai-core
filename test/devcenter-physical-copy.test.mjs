import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(root, 'devcenter');

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(relative(moduleRoot, path).replaceAll('\\', '/'));
  }
  return files;
}

test('DevCenter physical copy is complete, immutable and traceable', async () => {
  const provenance = JSON.parse(await readFile(resolve(moduleRoot, 'PROVENANCE.json'), 'utf8'));
  assert.equal(provenance.schema, 'ai-core-physical-copy-provenance/v1');
  assert.equal(provenance.source.repository, 'freepass-creator/devcenter');
  assert.equal(provenance.source.revision, '7d750606026589fcec4299609e53dc94e907e47a');
  assert.deepEqual(provenance.counts, {
    source_tracked_files: 4535,
    copied_files: 225,
    excluded_files: 4310,
    source_markdown_files: 79,
    copied_markdown_files: 70,
    excluded_markdown_files: 9
  });

  const copiedPaths = provenance.files.map(file => file.path);
  assert.equal(new Set(copiedPaths).size, copiedPaths.length, 'copied paths must be unique');
  assert.equal(copiedPaths.filter(path => path.toLowerCase().endsWith('.md')).length, 70);
  assert(copiedPaths.every(path => !path.startsWith('.ai-core/')));
  assert(copiedPaths.every(path => !path.startsWith('portal/static/')));

  const indexEntries = execFileSync(
    'git', ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--', 'devcenter'],
    { cwd: root, encoding: 'utf8' }
  ).split('\0').filter(Boolean);
  const indexBlobs = new Map(indexEntries.map(entry => {
    const [metadata, path] = entry.split('\t');
    return [path.slice('devcenter/'.length), metadata.split(' ')[1]];
  }));
  for (const file of provenance.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.match(file.source_git_blob, /^[0-9a-f]{40}$/);
    assert.equal(indexBlobs.get(file.path), file.source_git_blob, `${file.path} differs from the source Git blob`);
  }

  const actualPaths = (await walk(moduleRoot)).filter(path => path !== 'PROVENANCE.json').sort();
  assert.deepEqual(actualPaths, [...copiedPaths].sort(), 'unrecorded or missing DevCenter files detected');
});

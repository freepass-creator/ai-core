import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const table = JSON.parse(readFileSync(resolve(root, 'registry/sunset-devcenter-absorption.json'), 'utf8'));
const { recovery } = table;
const area = 'devcenter/';
const gitBytes = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const git = (...args) => gitBytes(...args).toString('utf8');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const external = /^freepass-creator\/ai-ops@[0-9a-f]{7,40}:\S+$/;
const entries = git('ls-files', '-s', '-z').split('\0').filter(Boolean);
const tracked = new Map(entries.map(entry => {
  const [metadata, path] = entry.split('\t');
  const [mode, blob, stage] = metadata.split(' ');
  assert.equal(stage, '0', `unmerged index: ${path}`);
  return [path, { mode, blob }];
}));

function recoveryTree() {
  assert.equal(git('rev-parse', '--is-shallow-repository').trim(), 'false', 'Full history required; CI checkout must use fetch-depth: 0');
  assert.equal(recovery.kind, 'PROTECTED_MAIN_SHA');
  assert.equal(recovery.sha, 'd7f1935763a5511536ca8c31489cd282cb13b1d6');
  git('merge-base', '--is-ancestor', recovery.sha, 'HEAD');
  return new Map(git('ls-tree', '-rz', recovery.sha, '--', area).split('\0').filter(Boolean).map(entry => {
    const [metadata, path] = entry.split('\t');
    const [mode, type, blob] = metadata.split(' ');
    assert.equal(type, 'blob');
    return [path.slice(area.length), { mode, blob }];
  }));
}

test('recovery restores all 57 paths, modes, blobs and byte hashes from the protected main SHA', () => {
  const tree = recoveryTree();
  const paths = recovery.deleted_manifest.map(file => file.path);
  assert.equal(paths.length, 57);
  assert.equal(new Set(paths).size, 57, 'duplicate recovery paths');
  for (const path of paths) {
    assert.match(path, /^\S+$/);
    assert.ok(!path.startsWith('/') && !path.includes('\\') && !path.split('/').includes('..'), `unsafe path: ${path}`);
  }
  assert.deepEqual([...paths].sort(), [...tree.keys()].sort(), 'manifest must equal the complete recovery tree');
  for (const file of recovery.deleted_manifest) {
    const saved = tree.get(file.path);
    assert.equal(file.mode, saved.mode, `${file.path}: mode`);
    assert.equal(file.git_blob, saved.blob, `${file.path}: git_blob`);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    // Restore raw bytes to memory; never apply checkout newline conversion.
    const restored = gitBytes('cat-file', 'blob', `${recovery.sha}:${area}${file.path}`);
    assert.equal(hash(restored), file.sha256, `${file.path}: sha256`);
    assert.deepEqual(restored, gitBytes('cat-file', 'blob', file.git_blob), `${file.path}: restored bytes`);
  }
});

test('all 222 absorption rows have exactly one disposition: Core, AI-OPS or deleted', () => {
  recoveryTree();
  assert.equal(table.files.length, 222);
  // Two historical source rows were merged into docs/hubs/README.md.
  // Count dispositions per row; merged destination paths need not be unique.
  const deleted = new Set(recovery.deleted_manifest.map(file => area + file.path));
  const counts = { core: 0, ops: 0, deleted: 0 };
  for (const file of table.files) {
    const core = !file.path.startsWith(area) && tracked.has(file.path) && existsSync(resolve(root, file.path));
    const ops = external.test(file.path);
    const removed = deleted.has(file.path);
    assert.equal(Number(core) + Number(ops) + Number(removed), 1, `unresolved or ambiguous disposition: ${file.path}`);
    counts[core ? 'core' : ops ? 'ops' : 'deleted']++;
  }
  assert.deepEqual(counts, { core: 162, ops: 3, deleted: 57 });
  assert.deepEqual(table.files.filter(file => file.path.startsWith(area)).map(file => file.path).sort(), [...deleted].sort());
});

test('historical PROVENANCE preserves 225 original blobs and all 195 transformations', () => {
  const tree = recoveryTree();
  const provenance = JSON.parse(git('show', `${recovery.sha}:${area}PROVENANCE.json`));
  assert.equal(provenance.schema, 'ai-core-physical-copy-provenance/v1');
  assert.equal(provenance.source.repository, 'freepass-creator/devcenter');
  assert.equal(provenance.source.revision, '7d750606026589fcec4299609e53dc94e907e47a');
  assert.deepEqual(provenance.counts, {
    source_tracked_files: 4535, copied_files: 225, excluded_files: 4310,
    source_markdown_files: 79, copied_markdown_files: 70, excluded_markdown_files: 9
  });
  assert.equal(provenance.files.length, 225);
  const originals = new Map(provenance.files.map(file => [file.path, file]));
  assert.equal(originals.size, 225);
  assert.equal([...originals.keys()].filter(path => path.toLowerCase().endsWith('.md')).length, 70);
  assert.ok([...originals.keys()].every(path => !path.startsWith('.ai-core/') && !path.startsWith('portal/static/')));
  const transformations = new Map(provenance.transformations.map(item => [item.source_path, item]));
  assert.equal(provenance.transformations.length, 195);
  assert.equal(transformations.size, 195);
  for (const file of originals.values()) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.match(file.source_git_blob, /^[0-9a-f]{40}$/);
    git('cat-file', '-e', file.source_git_blob);
    assert.equal(git('cat-file', '-t', file.source_git_blob).trim(), 'blob');
    if (!transformations.has(file.path)) assert.equal(tree.get(file.path)?.blob, file.source_git_blob, `${file.path}: unchanged original`);
  }
  let exports = 0;
  const changedUnchanged = [];
  for (const item of transformations.values()) {
    assert.ok(originals.has(item.source_path), `unknown source: ${item.source_path}`);
    assert.match(item.reason, /\S/);
    if (item.disposition === 'EXPORTED_TO_AI_OPS') {
      exports++;
      assert.match(item.destination, external);
      assert.ok(table.files.some(file => file.path === item.destination), `unrecorded export: ${item.destination}`);
      assert.ok(!tracked.has(area + item.source_path), `export still tracked: ${item.source_path}`);
      continue;
    }
    const destination = item.destination.replaceAll('\\', '/');
    if (item.disposition === 'ADAPTED_IN_PLACE') {
      assert.equal(destination, area + item.source_path);
      assert.ok(tree.has(item.source_path), `adapted copy not recoverable: ${item.source_path}`);
      continue;
    }
    assert.ok(['ADAPTED_AND_MOVED', 'ADAPTED_AND_MOVED_MERGED', 'MOVED_UNCHANGED', 'MOVED_ADAPTED', 'MOVED_MERGED'].includes(item.disposition));
    assert.ok(tracked.has(destination) && existsSync(resolve(root, destination)), `missing tracked destination: ${destination}`);
    if (item.disposition === 'MOVED_UNCHANGED') {
      // 계보는 «흡수 당시» 변경 없이 옮겼음을 증명한다 — 복구 기준 SHA 시점의 blob 과 대조한다.
      // 흡수 뒤 본체에서 정상적으로 고친 파일(예: registry/hubs.json 5a 경로 수정)을 계보 위반으로 세지 않는다.
      const actual = git('rev-parse', `${recovery.sha}:${destination}`).trim();
      const expected = originals.get(item.source_path).source_git_blob;
      if (actual !== expected) changedUnchanged.push({ source: item.source_path, destination, expected, actual });
    }
  }
  assert.equal(exports, 3);
  assert.deepEqual(changedUnchanged, [], 'MOVED_UNCHANGED content changed');
});

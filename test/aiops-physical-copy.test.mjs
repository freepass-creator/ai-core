import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduleRoot = resolve(root, 'aiops');
const own = new Set(['PROVENANCE.json', 'README.md', 'package.json']);

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

test('AIOps common copy is pinned, complete and traceable to source blobs', async () => {
  assert.equal(provenance.schema, 'ai-core-physical-copy-provenance/v1');
  assert.equal(provenance.source.repository, 'freepass-creator/aiops');
  assert.equal(provenance.source.revision, '334b9474de5a10dfb406637d54e6a55daa3e0f3a');
  assert.equal(provenance.policy.selection, 'HQ');
  assert.equal(provenance.counts.source_tracked_files, 1360);
  assert.equal(provenance.counts.copied_files + provenance.counts.excluded_files, 1360);
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
    assert.match(file.source_git_blob, /^[0-9a-f]{40}$/);
    const bytes = await readFile(resolve(moduleRoot, file.path));
    /** ★실패가 «무엇을 하라»고 말해야 한다 (2026-09-29).
     *  이 검사가 깨지는 실제 이유는 언제나 하나다 — 사본을 «제자리에서» 고친 것이다.
     *  47b2cbd 가 gws 절차 9줄을 여기 덧붙여 열린 PR 셋이 전부 막혔고, 원인을 찾는 데 한참 걸렸다.
     *  사본은 원본을 재현하는 자리이지 쓰는 자리가 아니다. */
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'), file.sha256,
      `${file.path} 가 기록된 sha256 과 다르다.\n` +
      '      ★사본을 직접 고치지 마라 — 여기는 freepass-creator/aiops 를 «재현»하는 자리다.\n' +
      '      고칠 내용이면 원본 저장소에 쓰고, 거기서 다시 복사해 PROVENANCE 를 갱신한다.\n' +
      '      선례: 2026-09-29 이 파일에 9줄을 덧붙여 열린 PR 셋이 막혔다(aiops bef8fbf 로 옮겨 해결).'
    );
    if (file.copy_kind === 'EXACT_COPY') {
      assert.equal(index.get(file.path), file.source_git_blob, `${file.path} differs from the source Git blob`);
    } else {
      assert.equal(file.copy_kind, 'TRANSFORMED', file.path);
      assert.equal(file.transform, 'pseudonymize_personal_data', file.path);
      assert.match(file.source_sha256, /^[0-9a-f]{64}$/);
    }
  }

  const actual = (await walk(moduleRoot)).filter(path => !own.has(path)).sort();
  assert.deepEqual(actual, [...copied].sort(), 'unrecorded or missing AIOps files detected');
});

test('rental business, FreePass business and personal data never enter the HQ copy', () => {
  const byPath = new Map(provenance.excluded.map(item => [item.path, item.disposition]));
  const copied = new Set(provenance.files.map(file => file.path));
  for (const rental of ['lib/gwataeryo-gyuchik.mjs', 'docs/미수로직.md', 'docs/AI매뉴얼-과태료-2026-09.md', 'docs/보험매뉴얼.md']) {
    assert.equal(copied.has(rental), false, rental);
    assert.equal(byPath.get(rental), 'OWNED_BY_RENTAL', rental);
  }
  for (const held of ['scripts/modusign.py', 'docs/AI시험지.md', 'lib/sonokong.mjs', 'sheets/settlement-spec.mjs']) {
    assert.equal(copied.has(held), false, held);
  }
  for (const prefix of ['wonja/', 'misu/', 'jageum/', 'boheom/', 'asset-engine/', 'unyoung/', 'outputs/', '사건/', '.ai-core/']) {
    assert(![...copied].some(path => path.startsWith(prefix)), prefix);
  }
});

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
    // ★설치 산출물은 세지 않는다 — devcenter 쪽 검사가 portal/node_modules 를 깔고 나면
    //   이 검사가 그 4천여 파일을 「기록되지 않은 복사본」으로 보고 빨개졌다
    //   (2026-09-23 실측: 깨끗한 main 에서도 `npm test` 한 번 뒤 재현). 복사 대조는 추적 대상만 본다.
    if (entry.name === 'node_modules') continue;
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
  const transformations = new Map((provenance.transformations ?? []).map(item => [item.source_path, item]));
  assert.equal(transformations.size, provenance.transformations.length, 'transformed source paths must be unique');

  const indexEntries = execFileSync(
    'git', ['-c', 'core.quotepath=false', 'ls-files', '-s', '-z', '--', 'devcenter', 'registry'],
    { cwd: root, encoding: 'utf8' }
  ).split('\0').filter(Boolean);
  const allIndexBlobs = new Map(indexEntries.map(entry => {
    const [metadata, path] = entry.split('\t');
    return [path, metadata.split(' ')[1]];
  }));
  const indexBlobs = new Map([...allIndexBlobs]
    .filter(([path]) => path.startsWith('devcenter/'))
    .map(([path, blob]) => [path.slice('devcenter/'.length), blob]));
  for (const file of provenance.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.match(file.source_git_blob, /^[0-9a-f]{40}$/);
    if (!transformations.has(file.path)) {
      assert.equal(indexBlobs.get(file.path), file.source_git_blob, `${file.path} differs from the source Git blob`);
    }
  }

  const actualPaths = (await walk(moduleRoot)).filter(path => path !== 'PROVENANCE.json').sort();
  const movedPaths = new Set([...transformations.values()]
    .filter(item => item.disposition.includes('MOVED'))
    .map(item => item.source_path));
  assert.deepEqual(actualPaths, copiedPaths.filter(path => !movedPaths.has(path)).sort(), 'unrecorded or missing DevCenter files detected');

  for (const item of transformations.values()) {
    assert.match(item.reason, /\S/);
    const destination = item.destination.replaceAll('\\', '/');
    assert.doesNotThrow(() => execFileSync(
      'git', ['ls-files', '--error-unmatch', destination], { cwd: root, stdio: 'ignore' }
    ), `transformation destination is not tracked: ${destination}`);
    if (item.disposition === 'MOVED_UNCHANGED') {
      assert.equal(allIndexBlobs.get(destination), provenance.files.find(file => file.path === item.source_path).source_git_blob);
    }
  }
});

test('active DevCenter entrypoints delegate common rules to AI Core canon', async () => {
  const entrypoints = [
    'AGENTS.md',
    'docs/BASELINE.md',
    'docs/CURRENT-STANDARDS.md',
    'docs/FOUR-AI-WORKFLOW.md',
    'docs/SESSION-TOUR.md',
    'docs/README.md',
    'design/README.md',
    'standards/README.md',
    'ssot/PART.md'
  ];
  for (const path of entrypoints) {
    const text = await readFile(resolve(moduleRoot, path), 'utf8');
    assert.doesNotMatch(text, /PM\s*=\s*Claude|네 AI 작업 분담|C:\\dev\\devcenter\\ssot/);
    assert.match(text, /AI Core|ai-core|\.\.\//i);
  }

  const baseline = await readFile(resolve(moduleRoot, 'docs/BASELINE.md'), 'utf8');
  assert.match(baseline, /AI_WORKING_STANDARD\.md/);
  assert.match(baseline, /AI_ACADEMY_CURRICULUM\.md/);
  const design = await readFile(resolve(moduleRoot, 'design/README.md'), 'utf8');
  assert.match(design, /design-system\/tokens\.json/);
  assert.match(design, /registry\/design-hub-binding\.json/);
});

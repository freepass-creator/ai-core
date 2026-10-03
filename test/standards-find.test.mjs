import test from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { resolveLocator } from '../scripts/standards-find.mjs';

const repoRoot = resolve('sandbox', 'worktree');
const projectsRoot = resolve('projects');
const local = resolve('custom', 'erp-folder');
const projects = [{ project_id: 'erp', local_path: local }, { project_id: 'no-path' }];
const options = { repoRoot, projectsRoot, projects, exists: () => false };

test('프로젝트 id와 local_path 폴더 이름을 등록 경로로 푼다', () => {
  for (const name of ['erp', 'erp-folder']) {
    assert.equal(resolveLocator(name + '/components/ui/tokens.ts', options), join(local, 'components/ui/tokens.ts'));
  }
});

test('등록 경로가 없으면 worktree 밖 projectsRoot로 푼다', () => {
  for (const name of ['freepasserp4', 'no-path']) {
    assert.equal(resolveLocator(name + '/components/ui/tokens.ts', options), join(projectsRoot, name, 'components/ui/tokens.ts'));
  }
});

test('저장소 루트에 실제 있는 파일과 폴더가 우선이다', () => {
  const exists = path => ['docs', 'README.md', 'erp'].some(name => path === join(repoRoot, name));
  for (const locator of ['docs/rules.md', 'README.md', 'erp/tokens.ts']) {
    assert.equal(resolveLocator(locator, { ...options, exists }), join(repoRoot, locator));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('ERP5 resolves to active ERP4 repository while Firebase remains a separate runtime', async () => {
  const registry=JSON.parse(await readFile(new URL('../registry/projects.json',import.meta.url),'utf8'));
  const project=registry.projects.find(item=>item.project_id==='freepasserp4');
  assert.ok(project.system_aliases.includes('ERP5'));
  assert.equal(project.access_entrypoint.clone_repository,'freepass-creator/freepasserp4');
  assert.equal(project.access_entrypoint.data_runtime.project_id,'freepasserp5');
  assert.equal(project.access_entrypoint.data_runtime.repository,false);
  assert.ok(project.access_entrypoint.do_not_clone.includes('freepass-creator/jpkerp5'));
});

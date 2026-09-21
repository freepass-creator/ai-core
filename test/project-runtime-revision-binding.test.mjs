import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectRuntime } from '../src/engine/project-runtime.mjs';

const project = {
  project_id: 'project-a',
  execution_readiness_status: 'ACTIVE',
  local_path: '/tmp/project-a',
  head_revision: 'rev-a',
};

const moduleCapability = {
  id: 'test.module',
  title: 'Module test',
  mode: 'READ_ONLY',
  adapter: { kind: 'PROJECT_MODULE', entrypoint: 'adapter.mjs', export: 'run' },
};

const commandCapability = {
  id: 'test.command',
  title: 'Command test',
  mode: 'READ_ONLY',
  adapter: { kind: 'PROJECT_COMMAND', argv: ['node', 'script.mjs'] },
};

test('runModule rejects a result if project revision changes during execution', async () => {
  let head = 'rev-a';
  const runtime = createProjectRuntime({
    readHead: async () => head,
    readDirtyPaths: async () => [],
    importModule: async () => ({ run: async () => { head = 'rev-b'; return { ok: true }; } }),
  });

  await assert.rejects(runtime.runModule(moduleCapability, project, {}), /PROJECT_REVISION_STALE/);
});

test('runCommand rejects a result if project revision changes during execution', async () => {
  let head = 'rev-a';
  const runtime = createProjectRuntime({
    readHead: async () => head,
    readDirtyPaths: async () => [],
    runProcess: async () => { head = 'rev-b'; return { stdout: 'ok', stderr: '', exit_code: 0 }; },
  });

  await assert.rejects(runtime.runCommand(commandCapability, project), /PROJECT_REVISION_STALE/);
});

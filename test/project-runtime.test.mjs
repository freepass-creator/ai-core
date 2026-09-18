import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createProjectRuntime, parseRegistryCommand } from '../src/engine/project-runtime.mjs';

test('registry command를 shell 없이 argv로 좁힌다', () => {
  assert.deepEqual(parseRegistryCommand('node scripts/check.mjs --fast'), ['node', 'scripts/check.mjs', '--fast']);
  assert.throws(() => parseRegistryCommand('npm test && echo hacked'), /PROJECT_COMMAND_UNSAFE/);
  assert.throws(() => parseRegistryCommand('node x.mjs > out.txt'), /PROJECT_COMMAND_UNSAFE/);
});

test('실행 직전 project HEAD가 registry revision과 같아야 한다', async () => {
  let ran = 0;
  const runtime = createProjectRuntime({
    readHead: async () => 'a'.repeat(40),
    runProcess: async ({ argv }) => { ran++; return { stdout: argv.join(' '), stderr: '', exit_code: 0 }; },
  });
  const project = {
    project_id: 'sample', status: 'ACTIVE', local_path: resolve('/tmp/sample'),
    head_revision: 'a'.repeat(40), commands: { test: 'npm test', build: null, install: null },
  };
  const capability = { id: 'project.verify', title: 'verify', mode: 'LOCAL_MUTATION', adapter: { kind: 'PROJECT_REGISTRY_COMMAND', command_key: 'test' } };
  const result = await runtime.runCommand(capability, project);
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(ran, 1);
  assert.match(result.data.stdout, /npm test/);
});

test('stale checkout에서는 명령을 한 번도 실행하지 않는다', async () => {
  let ran = 0;
  const runtime = createProjectRuntime({
    readHead: async () => 'b'.repeat(40),
    runProcess: async () => { ran++; return { exit_code: 0 }; },
  });
  const project = {
    project_id: 'sample', status: 'ACTIVE', local_path: resolve('/tmp/sample'),
    head_revision: 'a'.repeat(40), commands: { test: 'npm test', build: null, install: null },
  };
  const capability = { id: 'project.verify', title: 'verify', mode: 'LOCAL_MUTATION', adapter: { kind: 'PROJECT_REGISTRY_COMMAND', command_key: 'test' } };
  await assert.rejects(runtime.runCommand(capability, project), /PROJECT_REVISION_STALE/);
  assert.equal(ran, 0);
});

test('PROJECT_MODULE은 프로젝트 루트 밖을 읽지 못한다', async () => {
  const runtime = createProjectRuntime({ readHead: async () => 'a'.repeat(40), importModule: async () => ({}) });
  const project = { project_id: 'sample', status: 'ACTIVE', local_path: resolve('/tmp/sample'), head_revision: 'a'.repeat(40) };
  const capability = { id: 'x', title: 'x', mode: 'READ_ONLY', adapter: { kind: 'PROJECT_MODULE', entrypoint: '../outside.mjs', export: 'run' } };
  await assert.rejects(runtime.runModule(capability, project, {}), /PROJECT_MODULE_PATH_ESCAPE/);
});

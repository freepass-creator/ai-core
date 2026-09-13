import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('CLI accepts the human-context envelope and exposes all four work lanes', () => {
  const root = new URL('..', import.meta.url);
  const stdout = execFileSync(
    process.execPath,
    ['src/cli.mjs', 'examples/human-agency.json'],
    { cwd: root, encoding: 'utf8' }
  );
  const output = JSON.parse(stdout);

  assert.equal(output.core_version, '0.5.0-candidate.0');
  assert.notEqual(output.human_orchestration.status, 'HOLD_INVALID_INPUT');
  assert.equal(output.human_orchestration.questions_to_ask.length, 1);
  assert.deepEqual(output.human_orchestration.research_now, []);
  assert.deepEqual(output.human_orchestration.actions.prepare_now.map(item => item.id), ['DRAFT']);
  assert.deepEqual(output.human_orchestration.actions.approval_required.map(item => item.id), [
    'DEPLOY'
  ]);
  assert.equal(output.execution_authorized, false);
});

test('CLI rejects system evidence smuggled through the human-context envelope', () => {
  const root = new URL('..', import.meta.url);
  assert.throws(
    () => execFileSync(
      process.execPath,
      ['src/cli.mjs', 'test/invalid-human-context.json'],
      { cwd: root, encoding: 'utf8', stdio: 'pipe' }
    ),
    error => /unsupported human_context fields: resolved_sources/.test(error.stderr)
  );
});

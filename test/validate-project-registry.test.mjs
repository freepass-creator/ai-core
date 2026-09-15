import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateProjectRegistry } from '../scripts/validate-project-registry.mjs';

const example = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const clone = (value) => structuredClone(value);
const codes = (value) => validateProjectRegistry(value).errors.map((error) => error.code);

test('example registry is valid and revision-bound', () => {
  assert.deepEqual(validateProjectRegistry(example), { status: 'VALID', errors: [] });
});

test('duplicate IDs repositories and local paths are rejected case-insensitively', () => {
  const input = clone(example);
  const duplicate = clone(input.projects[0]);
  duplicate.project_id = 'ai-core';
  duplicate.repository = 'FREEPASS-CREATOR/AI-CORE';
  duplicate.local_path = 'c:\\DEV\\AI-CORE-CONTROL-TOWER';
  input.projects.push(duplicate);
  const result = codes(input);
  assert.ok(result.includes('PROJECT_ID_DUPLICATE'));
  assert.ok(result.includes('REPOSITORY_DUPLICATE'));
  assert.ok(result.includes('LOCAL_PATH_DUPLICATE'));
});

test('active project requires test and build commands', () => {
  const input = clone(example);
  input.projects[0].commands.test = null;
  assert.ok(codes(input).includes('ACTIVE_PROJECT_CHECKS_INCOMPLETE'));
});

test('head revision must appear in a git source', () => {
  const input = clone(example);
  input.projects[0].authoritative_sources[0].revision = 'a'.repeat(40);
  assert.ok(codes(input).includes('HEAD_REVISION_NOT_SOURCE_BOUND'));
});

test('future source observation is rejected', () => {
  const input = clone(example);
  input.projects[0].authoritative_sources[0].observed_at = '2026-09-15T00:40:01Z';
  assert.ok(codes(input).includes('SOURCE_OBSERVED_AFTER_REGISTRY'));
});

test('retired project cannot retain a deploy target', () => {
  const input = clone(example);
  input.projects[0].status = 'RETIRE';
  input.projects[0].deploy_targets = ['production'];
  assert.ok(codes(input).includes('RETIRED_PROJECT_HAS_DEPLOY_TARGET'));
});

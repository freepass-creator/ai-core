import test from 'node:test';
import assert from 'node:assert/strict';
import { validateASessionCoverage } from '../scripts/validate-a-session-coverage.mjs';

function registry() {
  return {
    schema: 'ai-core-a-session-repo-coverage/v1',
    observed_on: '2026-09-20',
    repository_count: 2,
    repositories: [
      {
        repository: 'freepass-creator/ai-core',
        default_branch: 'main',
        observed_head: null,
        audit_state: 'CORE_BASELINE',
        independence: 'SELF',
        findings: [],
        note: null,
      },
      {
        repository: 'freepass-creator/example',
        default_branch: 'main',
        observed_head: 'a'.repeat(40),
        audit_state: 'DEEP_EVIDENCE',
        independence: 'INDEPENDENT',
        findings: ['BACKPORT: example'],
        note: null,
      },
    ],
  };
}

function snapshot(head = 'a'.repeat(40)) {
  return {
    schema: 'ai-core-a-session-head-snapshot/v1',
    observed_at: '2026-09-20T00:00:00Z',
    repositories: [
      { repository: 'freepass-creator/ai-core', head: 'b'.repeat(40) },
      { repository: 'freepass-creator/example', head },
    ],
  };
}

test('accepts a coherent A-session coverage registry', () => {
  assert.equal(validateASessionCoverage(registry(), snapshot()).status, 'VALID');
});

test('rejects repository_count drift', () => {
  const input = registry();
  input.repository_count = 99;
  const result = validateASessionCoverage(input);
  assert.ok(result.errors.some((x) => x.code === 'REPOSITORY_COUNT_MISMATCH'));
});

test('rejects a non-null AI Core self observed head', () => {
  const input = registry();
  input.repositories[0].observed_head = 'c'.repeat(40);
  const result = validateASessionCoverage(input);
  assert.ok(result.errors.some((x) => x.code === 'CORE_BASELINE_HEAD_MUST_BE_NULL'));
});

test('rejects duplicate repository entries', () => {
  const input = registry();
  input.repositories.push({ ...input.repositories[1] });
  input.repository_count = 3;
  const result = validateASessionCoverage(input);
  assert.ok(result.errors.some((x) => x.code === 'REPOSITORY_DUPLICATE'));
});

test('detects a stale observed head against an exact remote-head snapshot', () => {
  const result = validateASessionCoverage(registry(), snapshot('c'.repeat(40)));
  assert.ok(result.errors.some((x) => x.code === 'STALE_OBSERVED_HEAD'));
});

test('requires snapshot coverage for every non-self repository', () => {
  const s = snapshot();
  s.repositories = s.repositories.filter((x) => x.repository !== 'freepass-creator/example');
  const result = validateASessionCoverage(registry(), s);
  assert.ok(result.errors.some((x) => x.code === 'HEAD_SNAPSHOT_MISSING_REPOSITORY'));
});

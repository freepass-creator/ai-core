import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSourceRequirements, bindResolvedSources } from '../src/source-resolver.mjs';

test('development requires project, aiops control, devcenter registry and inspection', () => {
  const requirements = resolveSourceRequirements({ project: 'freepasserp4', domain: 'development' });
  assert.deepEqual(
    requirements.filter(item => item.required).map(item => `${item.system}:${item.kind}`),
    ['project:instructions', 'aiops:control', 'devcenter:registry', 'devcenter:inspection']
  );
});

test('missing required source holds', () => {
  const requirements = [{ system: 'aiops', kind: 'control', required: true }];
  assert.equal(bindResolvedSources(requirements, [])[0].status, 'HOLD');
});

test('authoritative versioned source binds', () => {
  const requirements = [{ system: 'aiops', kind: 'control', required: true }];
  const result = bindResolvedSources(requirements, [{
    system: 'aiops',
    kind: 'control',
    status: 'authoritative',
    location: 'docs/CONTROL_PLANE.md',
    revision_or_sha: 'abc'
  }]);
  assert.equal(result[0].status, 'BOUND');
});

test('multiple authoritative sources hold instead of guessing', () => {
  const requirements = [{ system: 'project', kind: 'instructions', required: true }];
  const result = bindResolvedSources(requirements, [
    { system: 'project', kind: 'instructions', status: 'authoritative', location: 'A', revision_or_sha: '1' },
    { system: 'project', kind: 'instructions', status: 'authoritative', location: 'B', revision_or_sha: '2' }
  ]);
  assert.equal(result[0].status, 'HOLD');
});

test('legal work requires a current official authority source', () => {
  const requirements = resolveSourceRequirements({ domain: 'legal' });
  const authority = requirements.find(item => (
    item.system === 'domain' && item.kind === 'current_authority'
  ));
  assert.equal(authority.required, true);
});

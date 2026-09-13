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

test('mixed legal-development work requires both authority and engineering sources', () => {
  const requirements = resolveSourceRequirements({
    project: 'legal-app',
    domain: 'legal',
    applicable_domains: ['legal', 'development']
  });
  const required = requirements.filter(item => item.required)
    .map(item => `${item.system}:${item.kind}`);
  assert.ok(required.includes('aiops:knowledge'));
  assert.ok(required.includes('devcenter:registry'));
  assert.ok(required.includes('devcenter:inspection'));
  assert.ok(required.includes('domain:current_authority'));
});

test('an empty overlay cannot erase the primary legal source requirement', () => {
  const requirements = resolveSourceRequirements({
    domain: 'legal',
    applicable_domains: []
  });
  assert.ok(requirements.some(item => (
    item.system === 'domain' && item.kind === 'current_authority' && item.required
  )));
});

test('project instructions bind only to the expected repository identity', () => {
  const requirements = resolveSourceRequirements({
    project: 'target-project',
    domain: 'development'
  });
  const projectRequirement = requirements.filter(item => item.system === 'project');
  const [binding] = bindResolvedSources(projectRequirement, [{
    system: 'project',
    kind: 'instructions',
    status: 'authoritative',
    location: 'freepass-creator/other-project:AGENTS.md',
    revision_or_sha: 'wrong-project-sha'
  }]);
  assert.equal(binding.status, 'HOLD');
});

test('source pointers are type checked and output through an allowlist', () => {
  const requirements = resolveSourceRequirements({
    project: 'target-project',
    domain: 'development'
  }).filter(item => item.system === 'project');
  const invalid = bindResolvedSources(requirements, [{
    system: 'project',
    kind: 'instructions',
    status: 'authoritative',
    location: 'freepass-creator/target-project:AGENTS.md',
    revision_or_sha: true
  }]);
  assert.equal(invalid[0].status, 'HOLD');

  const valid = bindResolvedSources(requirements, [{
    system: 'project',
    kind: 'instructions',
    status: 'authoritative',
    location: 'freepass-creator/target-project:AGENTS.md',
    revision_or_sha: 'project-sha',
    raw_content: 'PRIVATE TRANSCRIPT'
  }]);
  assert.equal(valid[0].status, 'BOUND');
  assert.equal(JSON.stringify(valid).includes('PRIVATE TRANSCRIPT'), false);
  assert.equal('raw_content' in valid[0].pointer, false);
});

test('known source kinds bind only to their approved artifact paths', () => {
  const requirements = resolveSourceRequirements({
    project: 'target-project',
    domain: 'development'
  });
  const impostors = requirements.map(requirement => ({
    system: requirement.system,
    kind: requirement.kind,
    status: 'authoritative',
    location: `${requirement.expected_repository}:totally-unrelated.bin`,
    revision_or_sha: 'impostor-sha'
  }));
  const bindings = bindResolvedSources(requirements, impostors);
  assert.ok(bindings.filter(item => item.required).every(item => item.status === 'HOLD'));
});

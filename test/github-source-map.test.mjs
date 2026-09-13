import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFetchManifest,
  projectRepository,
  toResolvedPointer
} from '../src/github-source-map.mjs';

test('maps aiops control to live repository path', () => {
  const manifest = buildFetchManifest(
    { project: 'freepasserp4' },
    [{ system: 'aiops', kind: 'control', required: true }]
  );
  assert.equal(manifest[0].repo, 'freepass-creator/aiops');
  assert.equal(manifest[0].path, 'docs/CONTROL_PLANE.md');
});

test('maps aiops knowledge to its approved index', () => {
  const manifest = buildFetchManifest(
    { project: 'freepasserp4' },
    [{ system: 'aiops', kind: 'knowledge', required: false }]
  );
  assert.equal(manifest[0].path, 'docs/aiknowhow/README.md');
});

test('project instructions use project repo candidates', () => {
  const manifest = buildFetchManifest(
    { project: 'freepasserp4' },
    [{ system: 'project', kind: 'instructions', required: true }]
  );
  assert.equal(manifest[0].repo, 'freepass-creator/freepasserp4');
  assert.ok(manifest[0].candidates.includes('AGENTS.md'));
});

test('fully qualified project repository is preserved', () => {
  assert.equal(projectRepository('another-owner/project'), 'another-owner/project');
});

test('fetched sha becomes versioned pointer', () => {
  const pointer = toResolvedPointer(
    { system: 'aiops', kind: 'control', repo: 'r', path: 'p', required: true },
    { sha: 'abc' }
  );
  assert.equal(pointer.revision_or_sha, 'abc');
  assert.equal(pointer.status, 'authoritative');
});

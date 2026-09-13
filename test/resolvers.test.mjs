import test from 'node:test';
import assert from 'node:assert/strict';
import { compileContext } from '../src/context-compiler.mjs';
import { resolveCapabilities } from '../src/capability-resolver.mjs';

test('context holds when required source lacks revision', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'p', domain: 'development' },
    sourcePointers: [{ system: 'project', kind: 'instructions', location: 'x', status: 'unresolved', required: true }]
  });
  assert.equal(output.status, 'HOLD');
});

test('context excludes unrelated failures', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'freepasserp4', domain: 'development' },
    failures: [{ scope: 'other', id: 1 }, { scope: 'freepasserp4.ui', id: 2 }]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), [2]);
});

test('authoritative capability without a source revision is only selected', () => {
  const output = resolveCapabilities(['dev.design.token'], {
    datasets: [{ scope: 'dev.design.token', role: 'authoritative', source: { locator: 'repo/tokens.ts' } }]
  });
  assert.equal(output[0].status, 'SELECTED');
});

test('capability resolves only after its source is pinned', () => {
  const output = resolveCapabilities(['dev.design.token'], {
    datasets: [{
      scope: 'dev.design.token',
      role: 'authoritative',
      source: { locator: 'repo/tokens.ts', revision_or_sha: 'abc' }
    }]
  });
  assert.equal(output[0].status, 'RESOLVED');
});

test('candidate is not promoted to authoritative', () => {
  const output = resolveCapabilities(['x'], {
    datasets: [{ scope: 'x', role: 'candidate', source: { revision_or_sha: 'abc' } }]
  });
  assert.equal(output[0].status, 'CANDIDATE_ONLY');
});

test('multiple authoritative assets hold instead of guessing', () => {
  const output = resolveCapabilities(['x'], {
    datasets: [
      { id: 'a', scope: 'x', role: 'authoritative' },
      { id: 'b', scope: 'x', role: 'authoritative' }
    ]
  });
  assert.equal(output[0].status, 'HOLD');
});

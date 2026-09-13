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
    failures: [{ scope: 'project:other', id: 1 }, { scope: 'project:freepasserp4.ui', id: 2 }]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), [2]);
});

test('mixed-domain context includes every applicable domain', () => {
  const output = compileContext({
    task: {
      task_id: 'T',
      project: 'legal-app',
      domain: 'legal',
      applicable_domains: ['legal', 'development']
    },
    failures: [
      { scope: 'domain:development.security', id: 'DEV' },
      { scope: 'domain:legal.authority', id: 'LEGAL' },
      { scope: 'domain:business', id: 'OTHER' }
    ],
    decisions: [{ scope: 'project:legal-app.ui', id: 'PROJECT' }]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), ['DEV', 'LEGAL']);
  assert.deepEqual(output.relevant_decisions.map(item => item.id), ['PROJECT']);
});

test('missing project never matches unrelated project or tenant context', () => {
  const output = compileContext({
    task: { task_id: 'T', project: null, domain: 'legal' },
    failures: [
      { scope: 'project:unrelated-secret', id: 'PROJECT-LEAK' },
      { scope: 'tenant:someone-else', id: 'TENANT-LEAK' },
      { scope: 'domain:legal', id: 'LEGAL' }
    ]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), ['LEGAL']);
});

test('scope matching uses boundaries instead of arbitrary substrings', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'app', domain: 'development' },
    failures: [
      { scope: 'project:application-secret', id: 'PREFIX-LEAK' },
      { scope: 'domain:developmental', id: 'DOMAIN-PREFIX-LEAK' },
      { scope: 'project:app.ui', id: 'MATCH' }
    ]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), ['MATCH']);
});

test('raw selector names cannot collide with scope namespaces', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'tenant', domain: 'business' },
    failures: [
      { scope: 'tenant:someone-else', id: 'TENANT-SECRET' },
      { scope: 'domain:legal', id: 'LEGAL-SECRET' },
      { scope: 'project:tenant', id: 'MATCH' }
    ]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), ['MATCH']);
});

test('context entries and pointers are emitted through allowlists', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'app', domain: 'development' },
    sourcePointers: [{
      system: 'project',
      kind: 'instructions',
      status: 'authoritative',
      location: 'freepass-creator/app:AGENTS.md',
      revision_or_sha: 'source-sha',
      raw_content: 'PRIVATE SOURCE BODY'
    }],
    capabilityRefs: [{
      scope: 'dev.repo.lifecycle',
      asset_id: 'repo',
      status: 'authoritative',
      location: 'repo/rule.md',
      revision_or_sha: 'cap-sha',
      secret: 'PRIVATE CAPABILITY BODY'
    }],
    failures: [{
      id: 'FAIL',
      scope: 'project:app',
      summary: '비식별 실패 요약',
      sanitized: true,
      raw_content: 'PRIVATE FAILURE BODY'
    }]
  });
  const serialized = JSON.stringify(output);
  assert.equal(serialized.includes('PRIVATE SOURCE BODY'), false);
  assert.equal(serialized.includes('PRIVATE CAPABILITY BODY'), false);
  assert.equal(serialized.includes('PRIVATE FAILURE BODY'), false);
  assert.equal(output.relevant_failures[0].summary, '비식별 실패 요약');
});

test('global context requires transfer-gate authority and sanitization', () => {
  const output = compileContext({
    task: { task_id: 'T', project: 'app', domain: 'development' },
    failures: [
      { id: 'UNTRUSTED', scope: '*', sanitized: true },
      { id: 'UNSANITIZED', scope: '*', authority: 'transfer_gate' },
      {
        id: 'TRUSTED',
        scope: '*',
        authority: 'transfer_gate',
        sanitized: true,
        summary: '검증된 범용 실패 패턴'
      }
    ]
  });
  assert.deepEqual(output.relevant_failures.map(item => item.id), ['TRUSTED']);
});

test('authoritative capability without a source revision is only selected', () => {
  const output = resolveCapabilities(['dev.design.token'], {
    datasets: [{ scope: 'dev.design.token', role: 'authoritative', source: { locator: 'repo/tokens.ts' } }]
  });
  assert.equal(output[0].status, 'SELECTED');
});

test('capability revision without a locator is not considered pinned', () => {
  const output = resolveCapabilities(['dev.repo.lifecycle'], {
    datasets: [{
      id: 'repo',
      scope: 'dev.repo.lifecycle',
      role: 'authoritative',
      source: { revision_or_sha: 'made-up' }
    }]
  });
  assert.equal(output[0].status, 'SELECTED');
});

test('capability output is allowlisted and malformed registries hold', () => {
  const output = resolveCapabilities(['dev.repo.lifecycle'], {
    datasets: [{
      id: 'repo',
      scope: 'dev.repo.lifecycle',
      role: 'authoritative',
      raw_content: 'PRIVATE TRANSCRIPT',
      source: {
        locator: 'repo/rule.md',
        revision_or_sha: 'capability-sha',
        secret: 'DO NOT COPY'
      }
    }]
  });
  assert.equal(output[0].status, 'RESOLVED');
  assert.equal(JSON.stringify(output).includes('PRIVATE TRANSCRIPT'), false);
  assert.equal(JSON.stringify(output).includes('DO NOT COPY'), false);

  const malformed = resolveCapabilities(['dev.repo.lifecycle'], { datasets: {} });
  assert.equal(malformed[0].status, 'HOLD');
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

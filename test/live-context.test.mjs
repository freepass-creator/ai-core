import test from 'node:test';
import assert from 'node:assert/strict';
import { orchestrateLive, parseCapabilityLocator } from '../src/live-context.mjs';

const registry = {
  version: 1,
  datasets: [{
    id: 'repo-lifecycle',
    scope: 'dev.repo.lifecycle',
    role: 'authoritative',
    source: { kind: 'markdown_doc', locator: 'aiops/docs/저장소지도.md' }
  }]
};

function fixtureFetcher(overrides = {}) {
  const fixtures = new Map([
    ['freepass-creator/ai-core:AGENTS.md', { sha: 'project-sha', content: 'project rules SECRET_BODY' }],
    ['freepass-creator/aiops:docs/CONTROL_PLANE.md', { sha: 'control-sha', content: 'control rules' }],
    ['freepass-creator/aiops:docs/aiknowhow/README.md', { sha: 'knowledge-sha', content: 'knowledge index' }],
    ['freepass-creator/devcenter:registry.json', { sha: 'registry-sha', content: JSON.stringify(registry) }],
    ['freepass-creator/devcenter:operations/inspection/POLICY.md', { sha: 'inspection-sha', content: 'inspection policy' }],
    ['freepass-creator/aiops:docs/저장소지도.md', { sha: 'capability-sha', content: 'repository lifecycle' }]
  ]);
  for (const [key, value] of Object.entries(overrides)) fixtures.set(key, value);

  return async ({ repo, path }) => {
    const fixture = fixtures.get(`${repo}:${path}`);
    if (fixture instanceof Error) throw fixture;
    if (!fixture) throw Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
    return { path, revision_kind: 'git_blob_sha', ...fixture };
  };
}

const fixtureRevisionFetcher = async ({ repo, ref }) => ({
  repo,
  ref,
  sha: 'subject-commit-sha',
  revision_kind: 'git_commit_sha'
});

test('live bootstrap pins required sources and capability before READY', async () => {
  const output = await orchestrateLive({
    task_id: 'LIVE-1',
    goal: 'AI Core 코드 문구 수정',
    project: 'ai-core',
    done_when: ['tests pass']
  }, { fetchFile: fixtureFetcher(), fetchRevision: fixtureRevisionFetcher });

  assert.equal(output.live_context.status, 'RESOLVED');
  assert.equal(output.status, 'READY');
  assert.equal(output.capability_bindings[0].status, 'RESOLVED');
  assert.equal(
    output.capability_bindings[0].asset.source.revision_or_sha,
    'capability-sha'
  );
  assert.equal(output.execution_authorized, false);
  assert.equal(output.work_packet.subject_revision, 'subject-commit-sha');
  assert.doesNotMatch(JSON.stringify(output), /SECRET_BODY/);
  assert.equal(output.evolution.status, 'NO_SIGNAL');
});

test('missing required source remains HOLD with explicit evidence', async () => {
  const missing = Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  const output = await orchestrateLive({
    goal: 'AI Core 코드 문구 수정',
    project: 'ai-core',
    done_when: ['tests pass']
  }, {
    fetchFile: fixtureFetcher({
      'freepass-creator/aiops:docs/CONTROL_PLANE.md': missing
    }),
    fetchRevision: fixtureRevisionFetcher
  });

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('SOURCE_HOLD'));
  const evidence = output.live_context.source_fetch_evidence.find(item => item.kind === 'control');
  assert.equal(evidence.outcome, 'NOT_FOUND');
});

test('invalid registry cannot become a bound authoritative source', async () => {
  const output = await orchestrateLive({
    goal: 'AI Core 코드 문구 수정',
    project: 'ai-core',
    done_when: ['tests pass']
  }, {
    fetchFile: fixtureFetcher({
      'freepass-creator/devcenter:registry.json': { sha: 'bad-registry-sha', content: '{bad json' }
    }),
    fetchRevision: fixtureRevisionFetcher
  });

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('SOURCE_HOLD'));
  assert.ok(output.holds.includes('CAPABILITY_UNRESOLVED'));
  const evidence = output.live_context.source_fetch_evidence.find(item => item.kind === 'registry');
  assert.equal(evidence.outcome, 'INVALID_REGISTRY_JSON');
});

test('capability locator accepts repository and owner-qualified forms', () => {
  assert.deepEqual(
    parseCapabilityLocator('aiops/docs/저장소지도.md'),
    { repo: 'freepass-creator/aiops', path: 'docs/저장소지도.md' }
  );
  assert.deepEqual(
    parseCapabilityLocator('freepass-creator/aiops/docs/저장소지도.md'),
    { repo: 'freepass-creator/aiops', path: 'docs/저장소지도.md' }
  );
});

test('live mode holds when subject branch cannot be pinned to a commit', async () => {
  const output = await orchestrateLive({
    goal: 'AI Core 코드 문구 수정',
    project: 'ai-core',
    project_ref: 'feature/missing',
    done_when: ['tests pass']
  }, { fetchFile: fixtureFetcher() });

  assert.equal(output.status, 'HOLD');
  assert.ok(output.holds.includes('SUBJECT_REVISION_UNRESOLVED'));
  assert.equal(
    output.live_context.subject_revision_evidence.outcome,
    'REVISION_FETCHER_MISSING'
  );
  assert.ok(output.evolution.candidates.some(candidate => candidate.target_system === 'ai-core'));
});

test('missing capability source becomes a DevCenter improvement candidate', async () => {
  const missing = Object.assign(new Error('not found'), { code: 'NOT_FOUND' });
  const output = await orchestrateLive({
    goal: 'AI Core 코드 문구 수정',
    project: 'ai-core',
    done_when: ['tests pass']
  }, {
    fetchFile: fixtureFetcher({
      'freepass-creator/aiops:docs/저장소지도.md': missing
    }),
    fetchRevision: fixtureRevisionFetcher
  });

  assert.equal(output.status, 'HOLD');
  const candidate = output.evolution.candidates.find(item => item.kind === 'capability_gap');
  assert.equal(candidate.target_system, 'devcenter');
  assert.equal(candidate.auto_adopted, false);
  assert.equal(candidate.transfer_gate.status, 'HOLD');
});

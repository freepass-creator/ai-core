import test from 'node:test';
import assert from 'node:assert/strict';
import { 관측한다, 최근 } from '../src/integration/landed-observer.mjs';

const NOW = new Date('2026-09-24T05:10:00Z');
const sha = c => c.repeat(40);
const registry = { projects: [{ project_id: 'p', repository: 'o/p', default_branch: 'main' }] };

test('malformed commit timestamp cannot produce a complete observed window', async () => {
  const gh = {
    head: async () => sha('a'),
    commits: async () => [{ sha: sha('b'), message: 'landed', author: 'a', committed_at: 'not-a-time' }],
    compare: async () => null,
  };
  const observation = await 관측한다({ registry, gh, now: NOW });
  assert.equal(observation.projects.p.status, 'UNKNOWN');
  assert.equal(observation.projects.p.reason, 'REMOTE_UNOBSERVED');
  assert.equal(최근(observation, { hours: 24, now: NOW }).projects[0].complete, false);
});

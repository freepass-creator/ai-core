import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { validateMainState, verifyRepository } from '../scripts/verify-main-state.mjs';

const valid = {
  readme: '`main`에는 실행 가능한 오케스트레이터가 없다 WORK_READ_FIRST.md MEMORY.md memory/CURRENT.md memory/RESEARCH_INDEX.md',
  current: 'Status: `AWAITING_USER_REVIEW` PR #1 is the only current implementation line to evaluate PR #17 PR #18 must not be advanced does not observe these facts itself',
  researchIndex: '#1 #17 #18 #19 DEFERRED_CANDIDATE',
  episode: {
    episode_id: 'DEV-EPISODE-001', status: 'AWAITING_USER_REVIEW',
    execution: { subject_revision: 'abc', changed_files: ['README.md'] },
    metrics: { false_completion_events: 1, criteria_with_current_evidence: 2, acceptance_criteria_total: 2 },
    evidence_state: { false_completion_events: 1 }
  },
  fileExists: () => true,
  revisionExists: () => true
};

test('current repository state is internally consistent', async () => {
  assert.deepEqual(await verifyRepository(fileURLToPath(new URL('..', import.meta.url))), []);
});

test('rejects the false quickstart that triggered this improvement', () => {
  const errors = validateMainState({ ...valid, readme: `${valid.readme}\n## 빠른 실행` });
  assert.ok(errors.some(error => error.includes('quickstart')));
});

test('rejects implementation-line inflation and status drift', () => {
  const errors = validateMainState({
    ...valid,
    current: 'Status: `NOT_STARTED` PR #17 PR #18 does not observe these facts itself'
  });
  assert.ok(errors.some(error => error.includes('sole implementation')));
  assert.ok(errors.some(error => error.includes('status')));
});

test('rejects inconsistent episode evidence', () => {
  const errors = validateMainState({
    ...valid,
    episode: {
      ...valid.episode,
      metrics: { false_completion_events: 2, criteria_with_current_evidence: 3, acceptance_criteria_total: 2 }
    },
    revisionExists: () => false
  });
  assert.ok(errors.some(error => error.includes('revision')));
  assert.ok(errors.some(error => error.includes('false completion')));
  assert.ok(errors.some(error => error.includes('exceed')));
});

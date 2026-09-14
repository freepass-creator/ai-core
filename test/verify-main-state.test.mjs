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
    execution: { subject_revision: null, changed_files: ['README.md'] },
    metrics: { false_completion_events: 1, criteria_with_current_evidence: 0, acceptance_criteria_total: 1, unverified_criteria_count: 1, files_touched_count: 1 },
    evidence_state: { false_completion_events: 1, proof_revision_matches_subject: null, passes: 0, commands_run: [] },
    intent: {
      requirement_set_digest: 'sha256:ece9590592f3aa1763d223cfdb3806540e031ab1d40943ee76288206837fbdc5',
      requirements: [{ id: 'REQ-006', text: 'check drift', provenance: 'AI_INFERRED', status: 'HOLD' }]
    }
  },
  fileExists: path => !['src/cli.mjs', 'src/core.mjs'].includes(path),
  revisionExists: () => true,
  changedFiles: ['README.md']
};

test('current repository state is internally consistent', async () => {
  assert.deepEqual(await verifyRepository(fileURLToPath(new URL('..', import.meta.url))), []);
});

test('rejects the false quickstart that triggered this improvement', () => {
  const errors = validateMainState({ ...valid, readme: `${valid.readme}\n## 빠른 실행` });
  assert.ok(errors.some(error => error.includes('quickstart')));
});

test('rejects a README that denies runtime files present in the tree', () => {
  const errors = validateMainState({
    ...valid,
    fileExists: path => path === 'src/core.mjs' || valid.fileExists(path)
  });
  assert.ok(errors.some(error => error.includes('exists in the tree')));
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
      metrics: { false_completion_events: 2, criteria_with_current_evidence: 3, acceptance_criteria_total: 2, unverified_criteria_count: 0 },
      evidence_state: { false_completion_events: 1, proof_revision_matches_subject: true },
      execution: { subject_revision: 'stale', changed_files: ['README.md'] },
      intent: { requirement_set_digest: 'stale', requirements: [{ id: 'REQ-006', text: 'check drift', provenance: 'USER_CONFIRMED', status: 'ACTIVE' }] }
    },
    revisionExists: () => false
  });
  assert.ok(errors.some(error => error.includes('revision')));
  assert.ok(errors.some(error => error.includes('false completion')));
  assert.ok(errors.some(error => error.includes('exceed')));
  assert.ok(errors.some(error => error.includes('final proof')));
  assert.ok(errors.some(error => error.includes('user-confirmed')));
  assert.ok(errors.some(error => error.includes('digest')));
});

test('does not count read commands as checks or invent post-completion observations', () => {
  const errors = validateMainState({
    ...valid,
    episode: {
      ...valid.episode,
      evidence_state: {
        ...valid.episode.evidence_state,
        commands_run: ['git ls-tree -r --name-only origin/main'],
        passes: 1
      },
      outcome: { post_completion_defects: 0 }
    }
  });
  assert.ok(errors.some(error => error.includes('not verification checks')));
  assert.ok(errors.some(error => error.includes('post-completion')));
});

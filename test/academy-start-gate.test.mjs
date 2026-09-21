import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAcademyStartReceipt } from '../src/academy/start-gate.mjs';

const base = {
  task: '고객 조회 화면을 개선한다', track: 'development',
  project: { project_id: 'sales', head_revision: 'b'.repeat(40), commands: { test: 'npm test', build: 'npm run build' } },
  repository: 'org/sales', branch: 'main', revision: 'a'.repeat(40), dirty: false,
  instructions: [{ path: 'AGENTS.md', body: 'rules' }],
  readings: [{ path: 'docs/AI_WORKING_STANDARD.md', body: 'constitution', purpose: 'constitution' }],
  observedAt: '2026-09-22T00:00:00Z',
};

test('academy start seals a revision-bound learning receipt before work', () => {
  const result = buildAcademyStartReceipt(base);
  assert.equal(result.status, 'READY');
  assert.equal(result.target.revision, 'a'.repeat(40));
  assert.equal(result.learned[0].sha256.length, 64);
  assert.equal(result.start_contract.create_only_after_reuse_decision, true);
});

test('academy start holds dirty, unknown, or unjustified creation work', () => {
  const result = buildAcademyStartReceipt({ ...base, dirty: true, project: null, reuse: { verdict: { status: 'HOLD' }, candidates: [] } });
  assert.deepEqual(result.blockers, ['PROJECT_NOT_REGISTERED', 'DIRTY_WORKTREE_REVIEW_REQUIRED', 'REUSE_DECISION_REQUIRED']);
  assert.equal(result.start_contract, null);
});

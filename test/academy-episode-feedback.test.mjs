import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildEpisodeFeedback } from '../src/academy/episode-feedback.mjs';

function episode(overrides = {}) {
  const base = {
    episode_id: 'OPS-EP-001',
    status: 'CLOSED',
    project: { id: 'ai-ops' },
    intent: {
      summary: 'Handle one employee task end-to-end without losing evidence.',
      requirement_set_digest: 'sha256:req',
      requirements: [{ id: 'R1', evidence_refs: ['commit:abc'] }]
    },
    execution: { subject_revision: 'abc123' },
    evidence_state: {
      proof_revision_matches_subject: true,
      independent_review: 'CONFIRMED',
      failures: 0,
      unresolved_p0: 0,
      unresolved_p1: 0,
      authority_violations: 0,
      evidence_loss_events: 0,
      user_control_violations: 0
    },
    metrics: {
      clarification_question_count: 0,
      repeated_information_request_count: 0,
      user_correction_count: 1,
      user_review_round_count: 1,
      rework_loop_count: 1,
      false_completion_events: 0,
      unverified_criteria_count: 0,
      regression_events: 0,
      acceptance_criteria_total: 2,
      criteria_with_current_evidence: 2
    },
    outcome: { observed: true, success: true },
    lesson_observations: [{
      kind: 'USER_CORRECTION',
      sanitized_summary: 'The operator treated an app adapter as the whole product instead of the PC-wide AI employee runtime.',
      evidence_ref: 'issue:211',
      proposed_change: 'Teach AI Ops as a PC-wide employee runtime and KakaoTalk as an adapter.',
      prediction: 'New sessions stop framing AI Ops as a Kakao-only bot.',
      target_scope: 'DOMAIN'
    }]
  };
  return { ...base, ...overrides };
}

test('closed evidence-bound episode becomes a READY feedback packet without granting adoption', () => {
  const result = buildEpisodeFeedback(episode());
  assert.equal(result.feedback_status, 'READY');
  assert.equal(result.feedback_id, 'FB-ai-ops-OPS-EP-001');
  assert.equal(result.lesson_candidates.length, 1);
  assert.equal(result.lesson_candidates[0].status, 'RESEARCH_CANDIDATE');
  assert.equal(result.lesson_candidates[0].target_scope, 'DOMAIN');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
  assert.deepEqual(result.evidence_refs.sort(), ['commit:abc', 'issue:211']);
});

test('open or unbound episode remains HOLD but still returns useful measurements', () => {
  const value = episode({
    status: 'OPEN',
    execution: { subject_revision: null },
    evidence_state: {
      ...episode().evidence_state,
      proof_revision_matches_subject: false,
      independent_review: 'PARTIAL'
    },
    outcome: { observed: false }
  });
  const result = buildEpisodeFeedback(value);
  assert.equal(result.feedback_status, 'HOLD');
  assert.ok(result.unresolved.includes('EPISODE_NOT_CLOSED'));
  assert.ok(result.unresolved.includes('SUBJECT_REVISION_MISSING'));
  assert.ok(result.unresolved.includes('PROOF_REVISION_UNBOUND'));
  assert.equal(result.lesson_candidates[0].status, 'HOLD_NEEDS_CAUSAL_DETAIL');
});

test('correction counts cannot silently become reusable lessons without structured evidence', () => {
  const value = episode({ lesson_observations: [] });
  const result = buildEpisodeFeedback(value);
  assert.equal(result.candidate_implications[0].kind, 'USER_CORRECTION_DETAIL_MISSING');
  assert.equal(result.candidate_implications[0].status, 'HOLD');
});

test('unknown raw transcript fields are not copied into the feedback packet', () => {
  const value = episode({ raw_transcript: 'PRIVATE CUSTOMER CONTENT' });
  const result = buildEpisodeFeedback(value);
  assert.equal(JSON.stringify(result).includes('PRIVATE CUSTOMER CONTENT'), false);
  assert.equal(result.privacy.raw_conversation_copied, false);
});

test('invalid lesson observation is explicit HOLD evidence rather than silently dropped', () => {
  const value = episode({
    lesson_observations: [{ kind: 'USER_CORRECTION', sanitized_summary: '' }]
  });
  const result = buildEpisodeFeedback(value);
  assert.equal(result.feedback_status, 'HOLD');
  assert.ok(result.unresolved.includes('LESSON_1_SANITIZED_SUMMARY_MISSING'));
});

test('CLI reads one episode file and emits the same non-authorizing packet', t => {
  const dir = mkdtempSync(join(tmpdir(), 'academy-feedback-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'episode.json');
  writeFileSync(path, JSON.stringify(episode()));
  const child = spawnSync(process.execPath, ['scripts/academy-feedback.mjs', path], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.feedback_status, 'READY');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

test('CLI rejects malformed input without echoing its contents', t => {
  const dir = mkdtempSync(join(tmpdir(), 'academy-feedback-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'bad.json');
  writeFileSync(path, '{PRIVATE');
  const child = spawnSync(process.execPath, ['scripts/academy-feedback.mjs', path], { encoding: 'utf8' });
  assert.equal(child.status, 2);
  assert.equal(child.stdout, '');
  assert.equal(child.stderr.includes('PRIVATE'), false);
});

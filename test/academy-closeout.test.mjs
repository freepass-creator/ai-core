import test from 'node:test';
import assert from 'node:assert/strict';
import { academyCloseout, parseWorkResult } from '../scripts/academy-closeout.mjs';

const work = (overrides = {}) => {
  const values = {
    '목적': 'Finish one bounded Academy task',
    '대상 revision': 'abc123',
    '변경': 'Changed the bounded files',
    '검증': 'Tests passed',
    '남음': 'NONE',
    '사용자 수정': '0',
    '재작업': '0',
    'false completion': '0',
    '학습환류': 'NONE',
    'next_start_here': 'NONE',
    ...overrides
  };
  return '# AI Work Result\n\n' + Object.entries(values).map(([k,v]) => `- ${k}: ${v}`).join('\n') + '\n';
};

const episode = (overrides = {}) => ({
  episode_id: 'EP-1',
  status: 'CLOSED',
  project: { id: 'ai-core' },
  intent: { summary: 'Finish one bounded Academy task', requirements: [] },
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
    rework_loop_count: 0,
    false_completion_events: 0,
    unverified_criteria_count: 0,
    regression_events: 0,
    acceptance_criteria_total: 1,
    criteria_with_current_evidence: 1
  },
  outcome: { observed: true, success: true },
  lesson_observations: [{
    kind: 'USER_CORRECTION',
    sanitized_summary: 'A reusable correction was observed.',
    evidence_ref: 'issue:1',
    proposed_change: 'Teach the corrected behavior.',
    prediction: 'The same correction should not recur.',
    target_scope: 'LOCAL'
  }],
  ...overrides
});

test('plain closeout is READY when no learning event was observed', () => {
  const result = academyCloseout({ workResultMarkdown: work() });
  assert.equal(result.status, 'READY');
  assert.equal(result.feedback, null);
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

test('user correction or rework cannot close silently without an Episode', () => {
  for (const field of ['사용자 수정', '재작업', 'false completion']) {
    const result = academyCloseout({ workResultMarkdown: work({ [field]: '1' }) });
    assert.equal(result.status, 'HOLD');
    assert.ok(result.blockers.includes('LEARNING_EPISODE_REQUIRED'));
  }
});

test('EPISODE mode requires the Episode input', () => {
  const result = academyCloseout({ workResultMarkdown: work({ '학습환류': 'EPISODE' }) });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('LEARNING_EPISODE_MISSING'));
});

test('valid evidence-bound Episode completes the closeout but grants no adoption authority', () => {
  const result = academyCloseout({
    workResultMarkdown: work({ '사용자 수정': '1', '학습환류': 'EPISODE' }),
    episode: episode()
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.feedback.feedback_status, 'READY');
  assert.equal(result.feedback.lesson_candidates[0].status, 'RESEARCH_CANDIDATE');
  assert.equal(result.auto_adopted, false);
  assert.equal(result.execution_authorized, false);
});

test('Episode feedback HOLD keeps the whole closeout on HOLD', () => {
  const result = academyCloseout({
    workResultMarkdown: work({ '사용자 수정': '1', '학습환류': 'EPISODE' }),
    episode: episode({
      evidence_state: { ...episode().evidence_state, independent_review: 'PARTIAL' }
    })
  });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('EPISODE_FEEDBACK_HOLD'));
  assert.ok(result.feedback.unresolved.includes('INDEPENDENT_REVIEW_UNCONFIRMED'));
});

test('work-result and Episode must refer to the same subject revision', () => {
  const result = academyCloseout({
    workResultMarkdown: work({ '사용자 수정': '1', '학습환류': 'EPISODE' }),
    episode: episode({ execution: { subject_revision: 'different' } })
  });
  assert.equal(result.status, 'HOLD');
  assert.ok(result.blockers.includes('WORK_RESULT_EPISODE_REVISION_MISMATCH'));
});

test('UNKNOWN or omitted learning counters do not masquerade as zero', () => {
  const parsed = parseWorkResult(work({ '재작업': 'UNKNOWN' }));
  assert.ok(parsed.problems.includes('WORK_RESULT_재작업_INVALID'));
  assert.equal(parsed.counts.rework_loop_count, null);
});

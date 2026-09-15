import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderIntent as normalize } from '../src/intake/normalize-order-intent.mjs';

const text = 'A 작업 이어서 서버에서 해줘. B도 후보. 내일 초안 확인.';
const evidence = [{ start: 0, end: text.length, quote: text }];
const claim = (value) => ({ value, evidence });
const base = () => ({ source: { message_id: 'message-1', origin: 'user', text }, intent: claim('resume'), targets: [claim('A')] });
const context = { target_snapshot: { ref: 'test-snapshot', revision: 'r1', order_ids: ['A', 'B'] } };
const codes = (result) => result.issues.map((i) => i.code);

test('resume candidate keeps provenance, with no invented deadline or authorization', () => {
  const result = normalize({ ...base(), execution_location: claim('server') }, context);
  assert.equal(result.status, 'CANDIDATE_VALIDATED');
  assert.equal(result.execution_location.value, 'server');
  assert.equal(result.execution_authorized, false);
  assert.equal(result.deadline, null);
  assert.equal(result.completion_condition, null);
  assert.equal(result.semantic_confirmation, 'REQUIRED');
  assert.deepEqual(result.target_snapshot, { ref: 'test-snapshot', revision: 'r1' });
});

test('all five intents validate structurally, without executing stop or status', () => {
  for (const intent of ['new', 'resume', 'change', 'status', 'stop']) {
    const c = { ...base(), intent: claim(intent), request: claim('초안 확인') };
    if (intent === 'new') c.targets = [];
    const r = normalize(c, context);
    assert.equal(r.status, 'CANDIDATE_VALIDATED');
    assert.equal(r.execution_authorized, false);
  }
});

test('multiple targets require a short choice, never choosing the first', () => {
  const r = normalize({ ...base(), targets: [claim('A'), claim('B')] }, context);
  assert.ok(codes(r).includes('AMBIGUOUS_TARGET'));
  assert.deepEqual(r.clarification.choices, [{ order_id: 'A' }, { order_id: 'B' }]);
});

test('unknown target, missing snapshot, and missing target fail closed', () => {
  assert.ok(codes(normalize({ ...base(), targets: [claim('missing')] }, context)).includes('UNKNOWN_TARGET'));
  assert.ok(codes(normalize(base())).includes('TARGET_LOOKUP_REQUIRED'));
  assert.ok(codes(normalize({ ...base(), targets: [] }, context)).includes('MISSING_TARGET'));
});

test('missing source/intent/request and malformed objects return issues', () => {
  for (const input of [undefined, null, [], 'continue', {}, { source: {} }]) {
    assert.equal(normalize(input).status, 'NEEDS_CLARIFICATION');
  }
  assert.ok(codes(normalize({ ...base(), intent: claim('new'), targets: [] })).includes('MISSING_REQUEST'));
  assert.ok(codes(normalize({ ...base(), intent: claim('change') }, context)).includes('MISSING_REQUEST'));
  assert.ok(codes(normalize({ ...base(), targets: {} }, context)).includes('INVALID_TARGETS'));
});

test('fabricated, out of range, fractional and missing evidence are rejected', () => {
  for (const bad of [[], [{ start: 0, end: 1, quote: 'Z' }], [{ start: -1, end: 2, quote: 'A ' }],
    [{ start: 0, end: 999, quote: text }], [{ start: 0.5, end: text.length, quote: text }]]) {
    assert.ok(codes(normalize({ ...base(), intent: { value: 'resume', evidence: bad } }, context)).includes('INVALID_EVIDENCE'));
  }
});

test('approval-like words and injected authority flags never grant permission', () => {
  const r = normalize({ ...base(), approval: claim('승인됨'), execution_authorized: true,
    authorization: { status: 'GRANTED' }, execution_location: claim('server') }, context);
  assert.equal(r.execution_authorized, false);
  assert.equal(r.authorization_status, 'NOT_EVALUATED');
  // Text matching cannot establish semantics, even for a structurally valid claim.
  assert.equal(r.semantic_confirmation, 'REQUIRED');
});

test('agent/document source needs user confirmation', () => {
  for (const origin of ['agent', 'document']) {
    const c = base(); c.source.origin = origin;
    assert.ok(codes(normalize(c, context)).includes('USER_CONFIRMATION_REQUIRED'));
  }
});

test('optional claims preserve literal wording; output is detached and deterministic', () => {
  const c = { ...base(), deadline: claim('내일'), completion_condition: claim('초안 확인') };
  const before = JSON.stringify(c);
  const r = normalize(c, context);
  assert.deepEqual(r, normalize(c, context));
  assert.equal(r.deadline.value, '내일');
  assert.equal(JSON.stringify(c), before);
  r.targets[0].evidence[0].quote = 'changed';
  assert.equal(JSON.stringify(c), before);
});

test('new intent with existing target cannot silently become resume', () => {
  assert.ok(codes(normalize({ ...base(), intent: claim('new'), request: claim('초안') }, context)).includes('NEW_WITH_EXISTING_TARGET'));
});

function extracted(text, intent, ids = []) {
  const source = { message_id: 'utterance-2', origin: 'user', text };
  const fromMessage = (value) => ({ value, evidence: [{ message_id: source.message_id, start: 0, end: text.length, quote: text }] });
  return { source, ...(intent ? { intent: fromMessage(intent) } : {}), targets: ids.map(fromMessage) };
}

test('requested utterances remain candidates with missing details and semantic gates', () => {
  const cases = [
    extracted('아까 하던거 이어줘', 'resume', ['A', 'B']),
    extracted('서버에서 해줘'),
    extracted('그건 하지마', 'stop'),
    extracted('완료는 아니고 검토만', 'change', ['A']),
    extracted('이전 조건 바꿔', 'change', ['A']),
  ];
  for (const c of cases) {
    const r = normalize(c, context);
    assert.equal(r.status, 'NEEDS_CLARIFICATION');
    assert.equal(r.execution_authorized, false);
    assert.equal(r.authorization_status, 'NOT_EVALUATED');
    assert.equal(r.semantic_confirmation, 'REQUIRED');
    assert.equal(r.deadline, null);
    assert.equal(r.completion_condition, null);
  }
  assert.deepEqual(normalize(cases[0], context).targets.map((t) => t.value), ['A', 'B']);
  assert.ok(codes(normalize(cases[1], context)).includes('MISSING_INTENT'));
  assert.ok(codes(normalize(cases[2], context)).includes('MISSING_TARGET'));
  assert.ok(codes(normalize(cases[4], context)).includes('MISSING_REQUEST'));
});

test('same quote from a different explicit message is rejected, matching attribution retained', () => {
  const c = extracted('그건 하지마', 'stop', ['A']);
  assert.equal(normalize(c, context).intent.evidence[0].message_id, 'utterance-2');
  c.intent.evidence[0].message_id = 'utterance-1';
  const r = normalize(c, context);
  assert.equal(r.intent, null);
  assert.ok(codes(r).includes('INVALID_EVIDENCE'));
});

test('source edits, offset shifts and cross-message quotes cannot reuse evidence', () => {
  for (const mutate of [
    (c) => { c.source.text = '그건 진행해'; },
    (c) => { c.source.message_id = 'other-message'; },
    (c) => { c.intent.evidence[0].start = 1; },
    (c) => { c.intent.evidence[0].quote = '서버에서 해줘'; },
  ]) {
    const c = extracted('그건 하지마', 'stop', ['A']);
    mutate(c);
    assert.ok(codes(normalize(c, context)).includes('INVALID_EVIDENCE'));
  }
});

test('incorrect interpretation of negation or review cannot grant execution or completion', () => {
  for (const utterance of ['그건 하지마', '완료는 아니고 검토만']) {
    // Deliberately wrong extractor output. Exact spans alone cannot detect this.
    const c = extracted(utterance, 'resume', ['A']);
    c.approval = { ...c.intent, value: 'GRANTED' };
    c.state = 'CLOSED';
    c.execution_authorized = true;
    const r = normalize(c, context);
    assert.equal(r.status, 'CANDIDATE_VALIDATED');
    assert.equal(r.semantic_confirmation, 'REQUIRED');
    assert.equal(r.execution_authorized, false);
    assert.equal(r.authorization_status, 'NOT_EVALUATED');
    assert.equal(Object.hasOwn(r, 'state'), false);
  }
});

test('old snapshot cannot establish freshness; its revision is preserved, never upgraded', () => {
  const c = extracted('아까 하던거 이어줘', 'resume', ['A']);
  const old = { target_snapshot: { ref: 'canonical-query', revision: 'old-r0', order_ids: ['A'] } };
  const current = { target_snapshot: { ref: 'canonical-query', revision: 'current-r2', order_ids: ['B'] } };
  const r = normalize(c, old);
  assert.equal(r.target_snapshot.revision, 'old-r0');
  assert.equal(r.execution_authorized, false);
  assert.equal(r.semantic_confirmation, 'REQUIRED');
  assert.ok(codes(normalize(c, current)).includes('UNKNOWN_TARGET'));
});

test('target ordering never resolves ambiguity, and invalid extra targets still block', () => {
  for (const ids of [['A', 'B'], ['B', 'A']]) {
    const r = normalize(extracted('아까 하던거 이어줘', 'resume', ids), context);
    assert.equal(r.status, 'NEEDS_CLARIFICATION');
    assert.deepEqual(r.clarification.choices.map((t) => t.order_id), ids);
  }
  const c = extracted('아까 하던거 이어줘', 'resume', ['A', 'B']);
  c.targets[1].evidence = [];
  const r = normalize(c, context);
  assert.equal(r.status, 'NEEDS_CLARIFICATION');
  assert.equal(r.execution_authorized, false);
});

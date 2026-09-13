import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileConversationLearning,
  normalizeLearningObservation
} from '../src/conversation-learning.mjs';

function observation(overrides = {}) {
  return {
    observation_id: 'OBS-1',
    rule_key: 'verify-before-claim',
    summary: 'Claims require executed evidence',
    expected_behavior: 'Never claim PASS for an unexecuted check',
    domains: ['development'],
    authority: 'user_directive',
    source_ref: {
      location: 'conversation:opaque-1#message-1',
      observed_at: '2026-09-13T10:00:00Z'
    },
    sanitized: true,
    ...overrides
  };
}

test('raw conversation bodies are rejected instead of copied into the core', () => {
  assert.throws(
    () => normalizeLearningObservation(observation({ raw_content: 'private transcript' })),
    /forbidden/
  );
  assert.throws(
    () => normalizeLearningObservation(observation({ sanitized: false })),
    /sanitized/
  );
});

test('one invalid or duplicate observation holds the full learning batch', () => {
  const invalid = compileConversationLearning([
    observation(),
    observation({ observation_id: 'OBS-2', sanitized: false })
  ]);
  assert.equal(invalid.status, 'HOLD_INVALID_INPUT');
  assert.equal(invalid.rejected.length, 1);

  const duplicate = compileConversationLearning([
    observation(),
    observation({
      source_ref: {
        location: 'conversation:opaque-2#message-1',
        observed_at: '2026-09-13T11:00:00Z'
      }
    })
  ]);
  assert.equal(duplicate.status, 'HOLD_INVALID_INPUT');
  assert.match(duplicate.rejected[0].reason, /duplicate observation_id/);
});

test('repeated equivalent observations deduplicate into a pattern', () => {
  const result = compileConversationLearning([
    observation(),
    observation({
      observation_id: 'OBS-2',
      source_ref: {
        location: 'conversation:opaque-2#message-7',
        observed_at: '2026-09-13T11:00:00Z'
      }
    })
  ]);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].source_refs.length, 2);
  assert.equal(result.candidates[0].maturity, 'PATTERN');
  assert.equal(result.raw_conversation_stored, false);
  assert.equal(result.semantic_sanitization_verified, false);
});

test('a causal rule with conditions, counterexample and small test becomes a system candidate', () => {
  const result = compileConversationLearning([observation({
    causal_principle: 'An assertion is only as strong as its bound execution evidence',
    required_conditions: ['same revision', 'non-zero executed checks'],
    failure_conditions: ['skipped checks', 'stale evidence'],
    counterexample: 'A created file is not proof that tests ran',
    small_test: 'Reject a PASS receipt with executed_checks=0'
  })]);
  assert.equal(result.candidates[0].maturity, 'SYSTEM_CANDIDATE');
  assert.equal(result.candidates[0].owner_system, 'devcenter');
  assert.equal(result.signals[0].kind, 'conversation_lesson');
});

test('legal and business lessons route to AIOPS while cross-system lessons route to Core', () => {
  const legal = compileConversationLearning([observation({
    domains: ['legal'],
    rule_key: 'legal-layers'
  })]);
  const cross = compileConversationLearning([observation({
    domains: ['development', 'business'],
    rule_key: 'cross-outcome'
  })]);
  assert.equal(legal.candidates[0].owner_system, 'aiops');
  assert.equal(cross.candidates[0].owner_system, 'ai-core');
});

test('conflicting learned rules remain HOLD and create a governance signal', () => {
  const result = compileConversationLearning([
    observation(),
    observation({
      observation_id: 'OBS-2',
      expected_behavior: 'Treat generated output as automatically verified',
      source_ref: {
        location: 'conversation:opaque-2#message-2',
        observed_at: '2026-09-13T10:00:00Z'
      }
    })
  ]);
  assert.equal(result.status, 'HOLD_CONFLICT');
  assert.equal(result.candidates.length, 0);
  assert.equal(result.conflicts[0].rule_key, 'verify-before-claim');
  assert.ok(result.signals.some(signal => signal.kind === 'governance_gap'));
});

test('a uniquely newer explicit user instruction wins while superseded evidence is preserved', () => {
  const result = compileConversationLearning([
    observation({ expected_behavior: 'Use the older workflow' }),
    observation({
      observation_id: 'OBS-NEW',
      expected_behavior: 'Use the current integrated workflow',
      source_ref: {
        location: 'conversation:opaque-3#message-9',
        observed_at: '2026-09-13T12:00:00Z'
      }
    })
  ]);
  assert.equal(result.status, 'LEARNING_CANDIDATES');
  assert.equal(result.candidates[0].expected_behavior, 'Use the current integrated workflow');
  assert.equal(result.resolved_conflicts[0].status, 'RESOLVED_BY_PRECEDENCE');
  assert.equal(result.resolved_conflicts[0].superseded_fingerprints.length, 1);
});

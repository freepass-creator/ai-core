import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowEngine } from '../src/workflow/engine.mjs';

const workflow = {
  workflow_id: 'test.safe-recovery',
  version: '1.0.0',
  state_axes: [],
  facts: [],
  guards: [],
  evidence_requirements: [],
  commands: [],
  events: [],
  transitions: [{
    transition_id: 'retryable-operation',
    retry: {
      strategy: 'FIXED',
      max_attempts: 3,
      base_delay_ms: 1000,
      retryable_error_codes: [],
    },
    failure: { on_exhausted: 'HOLD' },
    compensation_transition_id: null,
  }],
};

test('blank unclassified failure does not enter automatic retry', () => {
  const engine = createWorkflowEngine(workflow);
  const result = engine.resolveFailure({
    transition_id: 'retryable-operation',
    attempt: 1,
    error_code: '   ',
    occurred_at: '2026-09-26T00:00:00.000Z',
  });

  assert.equal(result.action, 'HOLD');
  assert.equal(result.error_code, '   ');
});

test('classified failure still retries when retry policy accepts any error code', () => {
  const engine = createWorkflowEngine(workflow);
  const result = engine.resolveFailure({
    transition_id: 'retryable-operation',
    attempt: 1,
    error_code: 'TEMPORARY_FAILURE',
    occurred_at: '2026-09-26T00:00:00.000Z',
  });

  assert.equal(result.action, 'RETRY');
  assert.equal(result.next_attempt, 2);
});

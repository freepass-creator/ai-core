import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCapabilityExecutionShadow } from '../src/workflow/capability-execution-shadow.mjs';

const registry = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const workflow = registry.workflows.find(item => item.workflow_id === 'ai-core.capability-execution');
const shadow = createCapabilityExecutionShadow(workflow);

const validResult = {
  schema: 'ai-core-work-result/v1',
  order_id: 'ORD-001',
  work_id: 'WORK-001',
  project_id: 'aiops',
  capability_id: 'operations.penalty.prepare',
  subject_revision: 'a'.repeat(40),
  mode: 'EXTERNAL_MUTATION',
  status: 'SUCCEEDED',
  summary: '완료',
  artifact_refs: ['artifact:result'],
  evidence_refs: ['MEASURED:receipt'],
  checks: [{ name: 'receipt', status: 'PASS', detail: 'verified' }],
  execution: {
    performed: true,
    external_effect: true,
    started_at: '2026-09-24T00:00:00.000Z',
    ended_at: '2026-09-24T00:00:01.000Z',
    authorization_source: 'control-tower',
  },
  outcome: { observed: true },
  blockers: [],
  next_action: null,
  walls: [],
};

test('result boundary rejects structured evidence refs instead of string-coercing them', () => {
  assert.ok(shadow.normalizeResult(validResult));
  assert.equal(shadow.normalizeResult({
    ...validResult,
    evidence_refs: [{ ref: 'MEASURED:receipt' }],
  }), null);
});

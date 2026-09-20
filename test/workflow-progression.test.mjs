import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planWorkflowProgression } from '../src/workflow/progression.mjs';
import { validateWorkflowProgressions } from '../scripts/validate-workflow-progressions.mjs';

const workflows = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const progressions = JSON.parse(readFileSync(new URL('../registry/workflow-progressions.json', import.meta.url), 'utf8'));
const progression = progressions.progressions.find(item => item.progression_id === 'freepass-sales.lead.core-progress');

test('Sales forward-skip progression registry validates against the SHADOW workflow', () => {
  const result = validateWorkflowProgressions(progressions, workflows);
  assert.equal(result.status, 'VALID', JSON.stringify(result.errors));
});

test('Sales progress is monotonic and permits forward skip without fabricating skipped completion', () => {
  const plan = planWorkflowProgression(progression, {
    current_state: 'INTERESTED',
    target_state: 'PROCEEDING_AGREED',
    facts: {
      'sales.quote-presented': false,
      'sales.quote-sent': false,
    },
  });

  assert.equal(plan.eligible, true);
  assert.equal(plan.kind, 'FORWARD_SKIP');
  assert.deepEqual(plan.skipped_states, ['QUOTE_PRESENTED']);
  assert.equal(plan.skipped_state_evidence_policy, 'NO_FABRICATED_COMPLETION');
  assert.equal(plan.inference_requirements.length, 1);
  assert.equal(plan.inference_requirements[0].fact_id, 'sales.quote-presented');
  assert.equal(plan.inference_requirements[0].provenance_required, true);
  assert.deepEqual(plan.inference_requirements[0].forbidden_completion_fact_ids, ['sales.quote-sent']);
});

test('Sales quote-presented inference disappears when the prerequisite is already proven', () => {
  const plan = planWorkflowProgression(progression, {
    current_state: 'INTERESTED',
    target_state: 'PROCEEDING_AGREED',
    facts: {
      'sales.quote-presented': true,
      'sales.quote-sent': false,
    },
  });

  assert.equal(plan.eligible, true);
  assert.deepEqual(plan.skipped_states, ['QUOTE_PRESENTED']);
  assert.deepEqual(plan.inference_requirements, []);
});

test('Sales progression rejects backward movement and transient contact facts do not regress progress', () => {
  const backward = planWorkflowProgression(progression, {
    current_state: 'SCREENING_SUBMITTED',
    target_state: 'INTERESTED',
    facts: { 'sales.contact-status': 'NO_ANSWER' },
  });
  assert.equal(backward.eligible, false);
  assert.ok(backward.reasons.includes('BACKWARD_PROGRESSION_FORBIDDEN'));

  const stable = planWorkflowProgression(progression, {
    current_state: 'QUOTE_PRESENTED',
    target_state: 'QUOTE_PRESENTED',
    facts: { 'sales.contact-status': 'NO_ANSWER', 'sales.contact-attempts': 2 },
  });
  assert.equal(stable.eligible, true);
  assert.equal(stable.kind, 'SAME');
});

test('progression validator rejects unknown inference facts and fake runtime maturity', () => {
  const broken = structuredClone(progressions);
  broken.progressions[0].inference_rules[0].inferred_fact_id = 'sales.unknown-fact';
  broken.progressions[0].adoption_evidence.stage = 'RUNTIME_PILOT';

  const result = validateWorkflowProgressions(broken, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'WORKFLOW_PROGRESSION_INFERRED_FACT_UNKNOWN'));
  assert.ok(result.errors.some(item => item.code === 'SHADOW_PROGRESSION_CANNOT_CLAIM_RUNTIME_ADOPTION'));
});

test('progression SOURCE_PARITY_VERIFIED requires successful CI evidence', () => {
  const broken = structuredClone(progressions);
  broken.progressions[0].adoption_evidence.stage = 'SOURCE_PARITY_VERIFIED';
  broken.progressions[0].adoption_evidence.verification.kind = 'RUNTIME';
  broken.progressions[0].adoption_evidence.verification.conclusion = 'HOLD';

  const result = validateWorkflowProgressions(broken, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'SOURCE_PROGRESSION_PARITY_REQUIRES_SUCCESSFUL_CI'));
});


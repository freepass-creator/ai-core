import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveWorkflowProjection } from '../src/workflow/projection.mjs';
import { validateWorkflowProjections } from '../scripts/validate-workflow-projections.mjs';
import { createWorkflowEngine } from '../src/workflow/engine.mjs';

const workflows = JSON.parse(readFileSync(new URL('../registry/workflows.json', import.meta.url), 'utf8'));
const projections = JSON.parse(readFileSync(new URL('../registry/workflow-projections.json', import.meta.url), 'utf8'));
const workflow = workflows.workflows.find(item => item.workflow_id === 'freepass-admin.application-lifecycle');
const statusProjection = projections.projections.find(item => item.projection_id === 'freepass-admin.application.status');

const facts = (overrides = {}) => ({
  'application.contract-completed': false,
  'application.documents-completed': false,
  'application.balance-completed': false,
  'application.delivery-completed': false,
  'application.cancellation-reason': null,
  ...overrides,
});

function derive(state = 'ACTIVE', overrides = {}) {
  return deriveWorkflowProjection(statusProjection, {
    states: { lifecycle: state },
    facts: facts(overrides),
  }).value;
}

test('FreePass Admin workflow projection registry validates against D workflows', () => {
  const result = validateWorkflowProjections(projections, workflows);
  assert.equal(result.status, 'VALID', JSON.stringify(result.errors));
});

test('Admin ApplicationStatus parity keeps progress facts separate from authoritative lifecycle', () => {
  assert.equal(derive(), 'RECEIVED');
  assert.equal(derive('ACTIVE', { 'application.documents-completed': true }), 'RECEIVED');
  assert.equal(derive('ACTIVE', { 'application.balance-completed': true }), 'RECEIVED');
  assert.equal(derive('ACTIVE', { 'application.contract-completed': true }), 'CONTRACTED');
  assert.equal(derive('ACTIVE', {
    'application.contract-completed': true,
    'application.documents-completed': true,
    'application.balance-completed': true,
  }), 'CONTRACTED');
  assert.equal(derive('ACTIVE', { 'application.delivery-completed': true }), 'DELIVERED');
  assert.equal(derive('CANCELLED', {
    'application.contract-completed': true,
    'application.delivery-completed': true,
  }), 'CANCELLED');
});

test('Admin cancellation is the only authoritative lifecycle transition in D shadow', () => {
  const engine = createWorkflowEngine(workflow, {
    now: () => '2026-09-20T00:00:00.000Z',
    idFactory: (() => { let n = 0; return () => `admin-shadow-${++n}`; })(),
    evaluateGuard: (guard, context) => {
      if (guard.guard_id === 'freepass-admin.application.cancellation-reason-present') {
        return typeof context.reason === 'string' && context.reason.trim().length > 0;
      }
      return false;
    },
  });

  const projection = { entity_id: 'app-1', revision: 0, states: { lifecycle: 'ACTIVE' } };
  const accepted = engine.decide({
    projection,
    transition_id: 'freepass-admin.application.cancel',
    command_id: 'freepass-admin.application.cancel',
    actor: { actor_id: 'staff-1' },
    reason: 'customer changed mind',
    expected_revision: 0,
  });

  assert.equal(accepted.next_projection.states.lifecycle, 'CANCELLED');
  assert.equal(accepted.event.event_type, 'freepass-admin.application.cancelled');
});

test('projection validator rejects unknown facts and duplicate priority', () => {
  const broken = structuredClone(projections);
  broken.projections[0].rules[1].priority = broken.projections[0].rules[0].priority;
  broken.projections[0].rules[2].all[0].fact_id = 'application.unknown-fact';
  const result = validateWorkflowProjections(broken, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'WORKFLOW_PROJECTION_PRIORITY_DUPLICATE'));
  assert.ok(result.errors.some(item => item.code === 'WORKFLOW_PROJECTION_FACT_UNKNOWN'));
});

test('Admin D6 source parity evidence is revision-bound and remains SHADOW', () => {
  assert.equal(workflow.adoption_status, 'SHADOW');
  assert.equal(workflow.adoption_evidence.stage, 'SOURCE_PARITY_VERIFIED');
  assert.equal(workflow.adoption_evidence.revision, '2aede7df82591470308f25bd3ccd4e5358aa7c3c');
  assert.equal(workflow.adoption_evidence.verification.kind, 'CI');
  assert.equal(workflow.adoption_evidence.verification.conclusion, 'SUCCESS');
  assert.equal(workflow.adoption_evidence.verification.run_id, 35480824168);

  assert.equal(statusProjection.adoption_status, 'SHADOW');
  assert.equal(statusProjection.adoption_evidence.stage, 'SOURCE_PARITY_VERIFIED');
  assert.equal(statusProjection.adoption_evidence.revision, workflow.adoption_evidence.revision);
});

test('projection maturity rejects SHADOW runtime claims and PILOT without runtime evidence', () => {
  const falseRuntime = structuredClone(projections);
  falseRuntime.projections[0].adoption_evidence.stage = 'RUNTIME_PILOT';
  let result = validateWorkflowProjections(falseRuntime, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'SHADOW_PROJECTION_CANNOT_CLAIM_RUNTIME_ADOPTION'));

  const pilotWithoutEvidence = structuredClone(projections);
  pilotWithoutEvidence.projections[0].adoption_status = 'PILOT';
  delete pilotWithoutEvidence.projections[0].adoption_evidence;
  result = validateWorkflowProjections(pilotWithoutEvidence, workflows);
  assert.equal(result.status, 'INVALID');
  assert.ok(result.errors.some(item => item.code === 'PILOT_PROJECTION_ADOPTION_EVIDENCE_REQUIRED'));
});


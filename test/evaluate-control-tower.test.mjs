import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateControlTower } from '../scripts/evaluate-control-tower.mjs';

const example = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const clone = (value) => structuredClone(value);

test('prepared example permits execution but cannot self-authorize or close', () => {
  const evaluation = evaluateControlTower(example);
  assert.equal(evaluation.status, 'READY');
  assert.equal(evaluation.execution_authorized, false);
  assert.equal(evaluation.items[0].actions.execute.enabled, true);
  assert.deepEqual(evaluation.items[0].actions.close.reasons, ['VERIFICATION_REQUIRED', 'EXECUTION_NOT_CONFIRMED', 'OUTCOME_NOT_CONFIRMED']);
});

test('inferred intent cannot control preparation or execution', () => {
  const input = clone(example);
  input.items[0].intent = { status: 'INFERRED', provenance: 'AI_INFERRED' };
  const item = evaluateControlTower(input).items[0];
  assert.ok(item.actions.prepare.reasons.includes('CONTROLLING_INTENT_UNCONFIRMED'));
  assert.ok(item.actions.execute.reasons.includes('CONTROLLING_INTENT_UNCONFIRMED'));
});

test('expired changed critical source blocks execution', () => {
  const input = clone(example);
  input.items[0].sources[0].valid_until = input.as_of;
  input.items[0].sources[0].status = 'CHANGED';
  const reasons = evaluateControlTower(input).items[0].actions.execute.reasons;
  assert.ok(reasons.includes('CRITICAL_OBSERVATION_EXPIRED'));
  assert.ok(reasons.includes('CRITICAL_SOURCE_CHANGED'));
});

test('future observation and unavailable material source block execution', () => {
  const input = clone(example);
  Object.assign(input.items[0].sources[0], {
    severity: 'MATERIAL',
    observed_at: '2026-09-15T00:00:01Z',
    status: 'UNAVAILABLE',
  });
  const reasons = evaluateControlTower(input).items[0].actions.execute.reasons;
  assert.ok(reasons.includes('MATERIAL_OBSERVATION_FROM_FUTURE'));
  assert.ok(reasons.includes('MATERIAL_SOURCE_UNAVAILABLE'));
});

test('advisory source drift warns without blocking execution', () => {
  const input = clone(example);
  Object.assign(input.items[0].sources[0], { severity: 'ADVISORY', valid_until: input.as_of, status: 'CHANGED' });
  const item = evaluateControlTower(input).items[0];
  assert.equal(item.actions.execute.enabled, true);
  assert.deepEqual(item.warnings, ['ADVISORY_OBSERVATION_EXPIRED', 'ADVISORY_SOURCE_CHANGED']);
});

test('unaccepted commitment and waiting dependency hold execution', () => {
  const input = clone(example);
  input.items[0].commitment.accepted = false;
  input.items[0].commitment.dependencies = [{ id: 'SSOT', status: 'WAITING' }];
  const reasons = evaluateControlTower(input).items[0].actions.execute.reasons;
  assert.ok(reasons.includes('COMMITMENT_NOT_ACTIVE'));
  assert.ok(reasons.includes('DEPENDENCY_UNRESOLVED'));
});

test('overlap blocks every overcommitted item', () => {
  const input = clone(example);
  const second = clone(input.items[0]);
  second.id = 'DEV-002';
  input.items.push(second);
  for (const item of evaluateControlTower(input).items) assert.ok(item.actions.execute.reasons.includes('RESOURCE_OVERCOMMITTED'));
});

test('unresolved capacity and invalid allocation window block execution', () => {
  const input = clone(example);
  Object.assign(input.items[0].allocations[0], {
    resource: 'missing-lane',
    start: '2026-09-16T00:00:00Z',
    end: '2026-09-15T00:00:00Z',
  });
  const reasons = evaluateControlTower(input).items[0].actions.execute.reasons;
  assert.ok(reasons.includes('CAPACITY_UNRESOLVED'));
  assert.ok(reasons.includes('ALLOCATION_WINDOW_INVALID'));
});

test('authorization remains independent from readiness', () => {
  const input = clone(example);
  input.items[0].authorization = { required: true, status: 'PENDING' };
  assert.ok(evaluateControlTower(input).items[0].actions.execute.reasons.includes('AUTHORIZATION_REQUIRED'));
});

test('inconsistent authorization state fails closed', () => {
  const input = clone(example);
  input.items[0].authorization = { required: false, status: 'GRANTED' };
  assert.ok(evaluateControlTower(input).items[0].actions.execute.reasons.includes('AUTHORIZATION_STATE_INVALID'));
});

test('closure needs the complete evidence chain', () => {
  const input = clone(example);
  Object.assign(input.items[0], { verification: 'PASS', execution: 'CONFIRMED', outcome: 'SUCCESS' });
  assert.deepEqual(evaluateControlTower(input).items[0].actions.close, { enabled: true, reasons: [] });
});

test('schema-invalid input fails closed', () => {
  const input = clone(example);
  input.items[0].extra = true;
  const evaluation = evaluateControlTower(input);
  assert.equal(evaluation.status, 'INVALID');
  assert.equal(evaluation.execution_authorized, false);
  assert.deepEqual(evaluation.items, []);
});

test('duplicate item identifiers invalidate and disable every action', () => {
  const input = clone(example);
  input.items.push(clone(input.items[0]));
  const evaluation = evaluateControlTower(input);
  assert.equal(evaluation.status, 'INVALID');
  assert.ok(evaluation.errors.some((error) => error.code === 'ITEM_ID_DUPLICATE'));
  for (const item of evaluation.items) {
    assert.deepEqual(item.actions.prepare, { enabled: false, reasons: ['SNAPSHOT_INVALID'] });
    assert.ok(item.actions.execute.reasons.includes('SNAPSHOT_INVALID'));
  }
});

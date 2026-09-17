import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deriveControlSnapshot } from '../scripts/derive-control-snapshot.mjs';
import { evaluateControlTower } from '../scripts/evaluate-control-tower.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const registry = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const PROJECT = registry.projects[0].project_id;
const HEAD = registry.projects[0].head_revision;
const AS_OF = '2026-09-17T05:00:00Z';

const event = (extra = {}) => ({
  event_id: 'EVENT-001', work_id: 'DEV-001', project_id: PROJECT, type: 'CREATED',
  from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: HEAD,
  observed_at: '2026-09-16T00:00:00Z', evidence_refs: [], ...extra,
});

// Build a genuine hash-chained ledger rather than hand-written JSONL, so the
// derivation is proved against text the real verifier accepts.
async function ledger(t, events) {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-derive-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'work.jsonl');
  let head = null;
  for (const entry of events) head = (await appendLedgerEvent(path, entry, head)).head;
  return readFile(path, 'utf8');
}

// assert.throws does not hand back the error, and `skipped` rides on it.
const refusal = (fn) => { try { fn(); } catch (error) { return error; } throw new Error('EXPECTED_REFUSAL'); };

test('★a derived skeleton authorizes nothing, ever', async (t) => {
  const ledgerText = await ledger(t, [event()]);
  const { snapshot } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  const result = evaluateControlTower(snapshot);

  // The ledger never authorized anything, so a skeleton derived from it must not
  // read as though someone did.
  assert.notEqual(result.status, 'INVALID');
  assert.equal(result.execution_authorized, false);
  for (const item of result.items) {
    assert.equal(item.actions.execute.enabled, false);
    assert.equal(item.actions.close.enabled, false);
  }
});

test('the blockers name exactly what a human still owes', async (t) => {
  const ledgerText = await ledger(t, [event()]);
  const { snapshot } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  const reasons = evaluateControlTower(snapshot).items[0].actions.execute.reasons;
  for (const owed of ['CONTROLLING_INTENT_UNCONFIRMED', 'COMMITMENT_NOT_ACTIVE',
    'COMMITMENT_CONTROL_INCOMPLETE', 'AUTHORIZATION_REQUIRED', 'MATERIAL_OBSERVATION_EXPIRED']) {
    assert.ok(reasons.includes(owed), `${owed} missing from ${reasons.join(', ')}`);
  }
});

test('★an observation nobody bounded does not stay valid', async (t) => {
  const ledgerText = await ledger(t, [event()]);
  const { snapshot } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  const source = snapshot.items[0].sources[0];
  // Equal, not later: no one has said how long this observation is good for, so
  // it is not good now. Picking any future date would be an assertion.
  assert.equal(source.valid_until, source.observed_at);
});

test('★work with no subject revision is skipped, not given one', async (t) => {
  const ledgerText = await ledger(t, [event({ subject_revision: null })]);
  // Borrowing the registry head would bind the item to a revision the ledger
  // never observed it against, so the item is dropped and named instead.
  const error = refusal(() => deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF }));
  assert.equal(error.message, 'NO_DERIVABLE_WORK_ITEMS');
  assert.deepEqual(error.skipped, [{ work_id: 'DEV-001', reason: 'WORK_REVISION_REQUIRED' }]);
});

test('work in an unregistered project is skipped and named', async (t) => {
  const ledgerText = await ledger(t, [event({ project_id: 'not-registered' })]);
  const error = refusal(() => deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF }));
  assert.equal(error.message, 'NO_DERIVABLE_WORK_ITEMS');
  assert.equal(error.skipped[0].reason, 'PROJECT_NOT_REGISTERED');
});

test('one usable item still derives while an unusable sibling is reported', async (t) => {
  const ledgerText = await ledger(t, [
    event(),
    event({ event_id: 'EVENT-002', work_id: 'DEV-002', subject_revision: null, observed_at: '2026-09-16T02:00:00Z' }),
  ]);
  const { snapshot, skipped } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  assert.deepEqual(snapshot.items.map(item => item.id), ['DEV-001']);
  assert.deepEqual(skipped, [{ work_id: 'DEV-002', reason: 'WORK_REVISION_REQUIRED' }]);
});

test('the latest event in chain order describes the item', async (t) => {
  const ledgerText = await ledger(t, [
    event(),
    event({ event_id: 'EVENT-002', type: 'TRANSITIONED', from_state: 'RECEIVED', to_state: 'PLANNED',
      observed_at: '2026-09-16T01:00:00Z' }),
  ]);
  const { snapshot } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  assert.equal(snapshot.items.length, 1);
  assert.equal(snapshot.items[0].sources[0].observed_at, '2026-09-16T01:00:00Z');
});

test('the title is marked as unasserted rather than invented', async (t) => {
  const ledgerText = await ledger(t, [event()]);
  const { snapshot } = deriveControlSnapshot({ ledgerText, registry, asOf: AS_OF });
  assert.match(snapshot.items[0].title, /not asserted/);
});

test('a broken ledger or registry is refused instead of partially derived', async (t) => {
  const ledgerText = await ledger(t, [event()]);
  assert.throws(() => deriveControlSnapshot({ ledgerText: '{"event_id":"E"}\n', registry, asOf: AS_OF }), /LEDGER_INVALID/);
  const broken = structuredClone(registry);
  broken.projects[0].commands.test = null;
  assert.throws(() => deriveControlSnapshot({ ledgerText, registry: broken, asOf: AS_OF }), /PROJECT_REGISTRY_INVALID/);
  assert.throws(() => deriveControlSnapshot({ ledgerText, registry, asOf: 'not a date' }), /AS_OF_REQUIRED/);
});

test('★an empty ledger yields no snapshot at all, not an invalid one', () => {
  // control-tower.schema.json requires items.minItems = 1, so there is no such
  // thing as a valid empty snapshot. Handing one over would be handing over a
  // document already known to fail its own contract.
  const error = refusal(() => deriveControlSnapshot({ ledgerText: '', registry, asOf: AS_OF }));
  assert.equal(error.message, 'NO_DERIVABLE_WORK_ITEMS');
  assert.deepEqual(error.skipped, []);
});

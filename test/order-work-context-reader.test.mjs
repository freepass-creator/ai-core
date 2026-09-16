// Covers src/integration/order-work-context-reader.mjs.
//
// This file drives the REAL createOrderWorkAdapter, the REAL OrderStore, the REAL
// scripts/work-ledger.mjs and the REAL scripts/run-control-tower.mjs against temp
// files. The reader is not tested through a double: if it were, "the adapter accepts
// it" would be a claim about the double, not about the contract.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { OrderStore } from '../src/orders/store.mjs';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { createOrderWorkContextReader } from '../src/integration/order-work-context-reader.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';

const registryTemplate = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const snapshotTemplate = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const asOf = '2026-09-15T01:00:00Z';

let dir, count = 0;
const stores = [];
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'ai-core-reader-')); });
test.after(async () => {
  for (const store of stores) { try { store.close(); } catch { /* already closed */ } }
  await rm(dir, { recursive: true, force: true });
});

// Real order record + real READY ledger chain + real registry/snapshot on disk.
async function realWorld() {
  const workId = `READ-${String(++count).padStart(3, '0')}`;
  const registry = structuredClone(registryTemplate);
  const snapshot = structuredClone(snapshotTemplate);
  snapshot.as_of = asOf;
  const item = snapshot.items[0];
  item.id = workId;

  const store = new OrderStore(join(dir, `${workId}.sqlite`));
  stores.push(store);
  const order = store.create({ requestId: workId, title: '리더 시험 오더', intent: '읽기 전용 문맥 제공자를 검증한다',
    project: item.project_id, criteria: ['실제 어댑터가 LINKED를 낸다'], source: 'test-fixture' });

  const ledgerPath = join(dir, `${workId}.jsonl`);
  const baseEvent = { work_id: workId, project_id: item.project_id, actor: 'TEST',
    observed_at: asOf, subject_revision: item.subject_revision, evidence_refs: [] };
  let result = await appendLedgerEvent(ledgerPath, { ...baseEvent, event_id: `${workId}-001`, type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, null);
  for (const [index, [from_state, to_state]] of [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']].entries()) {
    result = await appendLedgerEvent(ledgerPath, { ...baseEvent, event_id: `${workId}-00${index + 2}`, type: 'TRANSITIONED', from_state, to_state }, result.head);
  }

  const mapping = { order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: workId, project_id: item.project_id, subject_revision: item.subject_revision };
  const readLedgerText = () => readFile(ledgerPath, 'utf8');
  return { store, order, registry, snapshot, mapping, ledgerPath, readLedgerText, head: result.head };
}

const wire = (f, overrides = {}) => createOrderWorkContextReader({
  store: f.store, registry: f.registry, snapshot: f.snapshot, mappings: [f.mapping], readLedgerText: f.readLedgerText, ...overrides });

test('the reader drives the real adapter to a LINKED projection', async () => {
  const f = await realWorld();
  const adapter = createOrderWorkAdapter({ readContext: wire(f), verifyLedgerText, runControlTower });
  const projection = await adapter.readWorkProjection(f.order.id);
  assert.equal(projection.status, 'LINKED', projection.reason);
  assert.equal(projection.canonical_state, 'READY');
  assert.equal(projection.ledger_head, f.head);
  assert.equal(projection.execution_authorized, false);
  assert.equal(projection.completion_authorized, false);
});

test('supplied inputs may be values or zero-arg readers, and are never mutated', async () => {
  const f = await realWorld();
  const before = structuredClone({ registry: f.registry, snapshot: f.snapshot, mapping: f.mapping });
  const reader = createOrderWorkContextReader({ store: f.store, registry: () => f.registry,
    snapshot: () => f.snapshot, mappings: () => [f.mapping], readLedgerText: f.readLedgerText });
  const context = await reader(f.order.id);
  context.registry.projects = []; context.mappings[0].work_id = 'MUTATED-999';
  assert.deepEqual({ registry: f.registry, snapshot: f.snapshot, mapping: f.mapping }, before);
  assert.deepEqual(context.usedCommandIds, []);
  assert.deepEqual(context.usedEventIds, []);
});

test('an order changed between the two reads is refused, not blended', async () => {
  const f = await realWorld();
  let calls = 0;
  const shifting = { get: id => { const order = f.store.get(id);
    if (++calls === 2) order.version += 1; return order; } };
  const reader = wire(f, { store: shifting });
  await assert.rejects(() => reader(f.order.id), /^Error: CANONICAL_READ_CHANGED$/);
  calls = 0;
  const adapter = createOrderWorkAdapter({ readContext: reader, verifyLedgerText, runControlTower });
  assert.deepEqual(await adapter.readWorkProjection(f.order.id), { status: 'HOLD', reason: 'CANONICAL_READ_CHANGED',
    execution_authorized: false, completion_authorized: false, sent: false });
});

test('a ledger appended between the two reads is refused', async () => {
  const f = await realWorld();
  let calls = 0;
  // Wraps — never replaces — the real file read, so this asserts against the real text.
  const shifting = async () => { const text = await f.readLedgerText();
    return ++calls === 1 ? text : `${text}{"event_id":"LATE-001"}\n`; };
  const reader = wire(f, { readLedgerText: shifting });
  await assert.rejects(() => reader(f.order.id), /^Error: CANONICAL_READ_CHANGED$/);
});

test('an order revision changed between the two reads is refused', async () => {
  const f = await realWorld();
  let calls = 0;
  const shifting = { get: id => { const order = f.store.get(id);
    if (++calls === 2) order.revision += 1; return order; } };
  await assert.rejects(() => wire(f, { store: shifting })(f.order.id), /^Error: CANONICAL_READ_CHANGED$/);
});

test('append/submit capabilities cannot be passed in, and missing inputs are refused', async () => {
  const f = await realWorld();
  assert.throws(() => wire(f, { appendLedgerEvent }), /^Error: DEPENDENCY_NOT_ACCEPTED$/);
  assert.throws(() => wire(f, { submitWorkCommand: () => {} }), /^Error: DEPENDENCY_NOT_ACCEPTED$/);
  assert.throws(() => wire(f, { readLedgerText: undefined }), /^Error: DEPENDENCY_REQUIRED$/);
  assert.throws(() => wire(f, { store: {} }), /^Error: DEPENDENCY_REQUIRED$/);
  assert.throws(() => wire(f, { snapshot: undefined }), /^Error: DEPENDENCY_REQUIRED$/);
  const reader = wire(f);
  assert.equal(typeof reader, 'function');
  assert.equal(Object.keys(await reader(f.order.id)).length, 7);
});

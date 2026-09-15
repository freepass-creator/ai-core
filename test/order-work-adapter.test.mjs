import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';

const sha = 'a'.repeat(40);
const head = `sha256:${'b'.repeat(64)}`;
const mapping = { order_id: 'ORD-00000000-0000-4000-8000-000000000001', requirement_revision: 2,
  record_version: 7, work_id: 'WORK-001', project_id: 'sample-project', subject_revision: sha };

// Dependency doubles test the boundary; they do not reimplement PR20 algorithms.
function fixture() {
  const context = {
    order: { id: mapping.order_id, revision: 2, version: 7, status: 'CLOSED', closure: { kind: 'USER_ACCEPTED' },
      tasks: [{ status: 'RUNNING', lease: { token: 'not-authorization' } }] },
    mappings: [structuredClone(mapping)], registry: { projects: [{ project_id: mapping.project_id, status: 'ACTIVE', head_revision: sha }] },
    snapshot: { items: [{ id: mapping.work_id, project_id: mapping.project_id, subject_revision: sha }] },
    ledgerText: 'canonical-input', usedCommandIds: [], usedEventIds: [],
  };
  const ledger = { status: 'VALID', head, work: { 'WORK-001': { state: 'READY', project_id: mapping.project_id, subject_revision: sha } } };
  const control = { status: 'READY', execution_authorized: false, ledger_head: head, items: [{
    id: mapping.work_id, project_id: mapping.project_id, ledger_state: 'READY',
    execute: { enabled: true, reasons: [] }, close: { enabled: false, reasons: ['OUTCOME_NOT_OBSERVED'] },
  }] };
  const calls = [];
  const adapter = createOrderWorkAdapter({
    readContext: async id => { calls.push(['read', id]); return context; },
    verifyLedgerText: text => { assert.equal(text, context.ledgerText); calls.push(['verify']); return ledger; },
    runControlTower: input => { assert.deepEqual(input, { registry: context.registry, snapshot: context.snapshot, ledgerText: context.ledgerText }); calls.push(['evaluate']); return control; },
  });
  const command = { mapping: structuredClone(mapping), command_id: 'command-1', event_id: 'EVENT-001', expected_head: head, intent: 'REQUEST_EXECUTION_REVIEW' };
  return { adapter, context, ledger, control, command, calls };
}

test('canonical state is projected despite UI CLOSED and active claim; READY never authorizes', async () => {
  const f = fixture(); const before = structuredClone(f.context);
  const result = await f.adapter.readWorkProjection(mapping.order_id);
  assert.equal(result.canonical_state, 'READY'); assert.equal(result.status, 'LINKED');
  assert.equal(result.execution_authorized, false); assert.equal(result.completion_authorized, false);
  assert.deepEqual(f.context, before); assert.deepEqual(f.calls.map(row => row[0]), ['read', 'verify', 'evaluate']);
  result.mapping.work_id = 'BAD-999'; assert.equal(f.context.mappings[0].work_id, 'WORK-001');
});

test('link preparation never creates or persists a mapping', async () => {
  const f = fixture(); f.context.mappings = [];
  assert.equal((await f.adapter.linkOrder(mapping)).status, 'LINK_PREPARED');
  assert.deepEqual(f.context.mappings, []);
  assert.equal((await f.adapter.readWorkProjection(mapping.order_id)).status, 'UNLINKED');
});

for (const [name, mutate, reason] of [
  ['missing mapping', f => { f.context.mappings = []; }, 'UNLINKED'],
  ['duplicate order ID', f => { f.context.mappings.push({ ...mapping, work_id: 'WORK-002' }); }, 'DUPLICATE_ORDER_MAPPING'],
  ['duplicate work ID', f => { f.context.mappings.push({ ...mapping, order_id: 'another-order' }); }, 'DUPLICATE_WORK_MAPPING'],
  ['requirement changed', f => { f.context.order.revision++; }, 'REQUIREMENT_REVISION_STALE'],
  ['record changed independently', f => { f.context.order.version++; }, 'RECORD_VERSION_STALE'],
  ['SHA used as record version', f => { f.context.mappings[0].record_version = sha; }, 'MAPPING_REVISION_INVALID'],
  ['project advanced', f => { f.context.registry.projects[0].head_revision = 'c'.repeat(40); }, 'SUBJECT_REVISION_STALE'],
  ['snapshot old commit', f => { f.context.snapshot.items[0].subject_revision = 'c'.repeat(40); }, 'SUBJECT_REVISION_STALE'],
  ['ledger old commit', f => { f.ledger.work['WORK-001'].subject_revision = 'c'.repeat(40); }, 'SUBJECT_REVISION_STALE'],
  ['unbound ledger revision', f => { f.ledger.work['WORK-001'].subject_revision = null; }, 'SUBJECT_REVISION_STALE'],
  ['wrong project', f => { f.ledger.work['WORK-001'].project_id = 'other-project'; }, 'WORK_PROJECT_MISMATCH'],
  ['missing work', f => { delete f.ledger.work['WORK-001']; }, 'CANONICAL_LINK_MISSING'],
  ['registry duplicate', f => { f.context.registry.projects.push(f.context.registry.projects[0]); }, 'DUPLICATE_OR_INVALID_PROJECTS'],
  ['snapshot duplicate', f => { f.context.snapshot.items.push(f.context.snapshot.items[0]); }, 'DUPLICATE_OR_INVALID_WORK_ITEMS'],
  ['invalid canonical chain', f => { f.ledger.status = 'INVALID'; }, 'LEDGER_INVALID'],
  ['invalid evaluator', f => { f.control.status = 'INVALID'; }, 'CONTROL_INVALID'],
  ['fake evaluator approval', f => { f.control.execution_authorized = true; }, 'CONTROL_INVALID'],
  ['inconsistent evaluator head', f => { f.control.ledger_head = 'other'; }, 'LEDGER_HEAD_MISMATCH'],
  ['inconsistent state', f => { f.control.items[0].ledger_state = 'CLOSED'; }, 'CONTROL_WORK_MISMATCH'],
]) test(name, async () => {
  const f = fixture(); mutate(f); const result = await f.adapter.readWorkProjection(mapping.order_id);
  assert.equal(result.reason, reason); assert.equal(result.sent, false); assert.equal(result.execution_authorized, false);
});

test('conflicting candidate is rejected without replacing the existing link', async () => {
  const f = fixture(); const result = await f.adapter.linkOrder({ ...mapping, work_id: 'WORK-002' });
  assert.equal(result.reason, 'MAPPING_CONFLICT'); assert.deepEqual(f.context.mappings, [mapping]);
});

test('each refresh reads again and fails closed after requirements change', async () => {
  const f = fixture(); assert.equal((await f.adapter.refreshControlResult(mapping.order_id)).status, 'LINKED');
  f.context.order.revision++; assert.equal((await f.adapter.refreshControlResult(mapping.order_id)).reason, 'REQUIREMENT_REVISION_STALE');
});

test('command is detached review intent, never sent, persisted, authorized or reserved', async () => {
  const f = fixture(); const before = structuredClone(f.context);
  const result = await f.adapter.submitWorkCommand(f.command);
  assert.equal(result.status, 'PREPARED_NOT_SENT'); assert.equal(result.sent, false); assert.equal(result.persisted, false);
  assert.equal(result.execution_authorized, false); assert.equal(result.completion_authorized, false);
  assert.equal(result.command.to_state, undefined); assert.deepEqual(result.command, f.command);
  assert.deepEqual(f.context, before);
  // Repeating preparation is permitted: this adapter makes no reservation/delivery promise.
  assert.deepEqual(await f.adapter.prepareWorkCommand(f.command), result);
});

for (const [name, mutate, reason] of [
  ['head conflict', f => { f.command.expected_head = 'old'; }, 'LEDGER_HEAD_CHANGED'],
  ['stale command mapping', f => { f.command.mapping.record_version--; }, 'COMMAND_MAPPING_STALE'],
  ['command duplicate', f => { f.context.usedCommandIds.push('command-1'); }, 'COMMAND_ID_DUPLICATE'],
  ['event duplicate', f => { f.context.usedEventIds.push('EVENT-001'); }, 'EVENT_ID_DUPLICATE'],
  ['unknown ID inventory', f => { delete f.context.usedEventIds; }, 'ID_INVENTORY_UNAVAILABLE'],
  ['UI close is not close authority', f => { f.command.intent = 'REQUEST_CLOSE_REVIEW'; }, 'CANONICAL_ACTION_BLOCKED'],
  ['claim is not a canonical action', f => { f.command.intent = 'claim'; }, 'INTENT_NOT_SUPPORTED'],
  ['fake approval field', f => { f.command.confirmed = true; }, 'COMMAND_FIELDS_INVALID'],
  ['injected transition', f => { f.command.to_state = 'CLOSED'; }, 'COMMAND_FIELDS_INVALID'],
  ['execute gate blocked', f => { f.control.items[0].execute = { enabled: false, reasons: ['AUTHORIZATION_PENDING'] }; }, 'CANONICAL_ACTION_BLOCKED'],
]) test(name, async () => {
  const f = fixture(); mutate(f); const result = await f.adapter.prepareWorkCommand(f.command);
  assert.equal(result.reason, reason); assert.equal(result.sent, false); assert.equal(result.command, undefined);
});

test('read failure fails closed and missing dependency is rejected', async () => {
  assert.throws(() => createOrderWorkAdapter({}), /DEPENDENCY_REQUIRED/);
  const adapter = createOrderWorkAdapter({ readContext: () => { throw new Error('READ_UNAVAILABLE'); }, verifyLedgerText() {}, runControlTower() {} });
  assert.equal((await adapter.readWorkProjection(mapping.order_id)).reason, 'READ_UNAVAILABLE');
});

test('non-Error reader rejection still returns HOLD', async () => {
  const adapter = createOrderWorkAdapter({ readContext: () => Promise.reject(null), verifyLedgerText() {}, runControlTower() {} });
  const result = await adapter.readWorkProjection(mapping.order_id);
  assert.equal(result.status, 'HOLD'); assert.equal(result.reason, 'ADAPTER_READ_FAILED');
});

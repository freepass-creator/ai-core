import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
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
    ledgerText: '{"event_id":"EXISTING-001"}\n', usedCommandIds: [], usedEventIds: ['EXISTING-001'],
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
  f.ledger.work['WORK-001'].state = 'RECEIVED'; f.control.items[0].ledger_state = 'RECEIVED';
  assert.equal((await f.adapter.linkOrder(mapping)).status, 'LINK_PREPARED');
  assert.deepEqual(f.context.mappings, []);
  assert.equal((await f.adapter.readWorkProjection(mapping.order_id)).status, 'UNLINKED');
});

for (const [name, mutate, reason] of [
  ['missing mapping', f => { f.context.mappings = []; }, 'UNLINKED'],
  ['duplicate order ID', f => { f.context.mappings.push({ ...mapping, work_id: 'WORK-002' }); }, 'DUPLICATE_ORDER_MAPPING'],
  ['duplicate work ID', f => { f.context.mappings.push({ ...mapping, order_id: 'another-order' }); }, 'DUPLICATE_WORK_MAPPING'],
  ['requirement changed', f => { f.context.order.revision++; }, 'REQUIREMENT_REVISION_STALE'],
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

test('record-only change refreshes observation without a new work identity; stale command fails', async () => {
  const f = fixture(); f.context.order.version++;
  const projection = await f.adapter.readWorkProjection(mapping.order_id);
  assert.equal(projection.status, 'LINKED'); assert.equal(projection.mapping.record_version, 8);
  assert.equal(projection.mapping.work_id, mapping.work_id);
  assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'COMMAND_MAPPING_STALE');
  f.command.mapping = projection.mapping;
  assert.equal((await f.adapter.prepareWorkCommand(f.command)).status, 'PREPARED_NOT_SENT');
});

test('same work cannot be reused across requirement revisions in full history', async () => {
  const f = fixture(); f.context.order.revision++;
  f.context.mappings.push({ ...mapping, requirement_revision: f.context.order.revision });
  assert.equal((await f.adapter.readWorkProjection(mapping.order_id)).reason, 'DUPLICATE_WORK_MAPPING');
});

test('new link cannot claim an existing READY work', async () => {
  const f = fixture(); f.context.mappings = [];
  assert.equal((await f.adapter.linkOrder(mapping)).reason, 'NEW_LINK_REQUIRES_RECEIVED');
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
  ['malformed ID inventory', f => { f.context.usedCommandIds.push(null); }, 'ID_INVENTORY_INVALID'],
  ['duplicate inventory entries', f => { f.context.usedEventIds.push('EXISTING-001'); }, 'ID_INVENTORY_INVALID'],
  ['actual event omitted from inventory', f => { f.context.usedEventIds = []; f.command.event_id = 'EXISTING-001'; }, 'EVENT_ID_DUPLICATE'],
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

test('supplemental event list need not repeat every verified ledger ID', async () => {
  const f = fixture(); f.context.usedEventIds = [];
  assert.equal((await f.adapter.prepareWorkCommand(f.command)).status, 'PREPARED_NOT_SENT');
});

test('non-Error reader rejection still returns HOLD', async () => {
  const adapter = createOrderWorkAdapter({ readContext: () => Promise.reject(null), verifyLedgerText() {}, runControlTower() {} });
  const result = await adapter.readWorkProjection(mapping.order_id);
  assert.equal(result.status, 'HOLD'); assert.equal(result.reason, 'ADAPTER_READ_FAILED');
});

const canonicalCommit = 'b438fca22bd60ac7f6efa1d509c701897e821e76';
const canonicalCheckout = process.env.ORDER_ADAPTER_PR20_CHECKOUT;

test('pinned PR20 real-contract integration', {
  skip: canonicalCheckout ? false : 'Set ORDER_ADAPTER_PR20_CHECKOUT to an isolated checkout of the documented PR20 commit',
  timeout: 15000,
}, async t => {
  const root = resolve(canonicalCheckout);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', timeout: 5000 }).trim(), canonicalCommit);
  // Reject edited canonical files: passing against locally patched logic is not evidence.
  assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8', timeout: 5000 }).trim(), '');
  const { verifyLedgerText, appendLedgerEvent } = await import(pathToFileURL(join(root, 'scripts/work-ledger.mjs')));
  const { runControlTower } = await import(pathToFileURL(join(root, 'scripts/run-control-tower.mjs')));
  const registryTemplate = JSON.parse(await readFile(join(root, 'examples/project-registry.json'), 'utf8'));
  const snapshotTemplate = JSON.parse(await readFile(join(root, 'examples/control-tower.json'), 'utf8'));
  const fixtureRoot = await mkdtemp(join(root, '.adapter-test-'));
  t.after(async () => {
    // Only this newly allocated directory inside the specified isolated checkout is removed.
    assert.ok(resolve(fixtureRoot).startsWith(`${root}${sep}`));
    await rm(fixtureRoot, { recursive: true });
  });
  let count = 0;
  async function realFixture(subjectRevision = snapshotTemplate.items[0].subject_revision) {
    const registry = structuredClone(registryTemplate), snapshot = structuredClone(snapshotTemplate);
    const item = snapshot.items[0];
    const path = join(fixtureRoot, `ledger-${++count}.jsonl`);
    const baseEvent = { work_id: item.id, project_id: item.project_id, actor: 'TEST',
      observed_at: snapshot.as_of, subject_revision: subjectRevision, evidence_refs: [] };
    let result = await appendLedgerEvent(path, { ...baseEvent, event_id: 'TEST-001', type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, null);
    for (const [index, [from_state, to_state]] of [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']].entries()) {
      result = await appendLedgerEvent(path, { ...baseEvent, event_id: `TEST-00${index + 2}`, type: 'TRANSITIONED', from_state, to_state }, result.head);
    }
    const link = { ...mapping, work_id: item.id, project_id: item.project_id, subject_revision: item.subject_revision };
    const context = { order: { id: link.order_id, revision: link.requirement_revision, version: link.record_version, status: 'NEW' },
      mappings: [link], registry, snapshot, ledgerText: await readFile(path, 'utf8'),
      usedCommandIds: [], usedEventIds: ['TEST-001', 'TEST-002', 'TEST-003', 'TEST-004', 'TEST-005'] };
    const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
    const command = { mapping: structuredClone(link), command_id: 'review-1', event_id: 'REVIEW-001',
      expected_head: result.head, intent: 'REQUEST_EXECUTION_REVIEW' };
    return { adapter, context, command, path, baseEvent };
  }

  await t.test('real READY chain and evaluator prepare a review without authorization', async () => {
    const f = await realFixture();
    assert.equal(verifyLedgerText(f.context.ledgerText).status, 'VALID');
    const result = await f.adapter.prepareWorkCommand(f.command);
    assert.equal(result.status, 'PREPARED_NOT_SENT');
    assert.equal(result.execution_authorized, false); assert.equal(result.sent, false);
  });

  await t.test('canonical null-revision READY gap is blocked by adapter exact revision check', async () => {
    const f = await realFixture(null);
    const canonical = runControlTower(f.context);
    assert.equal(canonical.status, 'READY'); // Pinned upstream counterexample, not an approval.
    assert.equal(canonical.items[0].execute.enabled, true);
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'SUBJECT_REVISION_STALE');
  });

  await t.test('new requirements cannot reuse old linked READY', async () => {
    const f = await realFixture(); f.context.order.revision++; f.context.order.version++;
    assert.equal(runControlTower(f.context).status, 'READY');
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'REQUIREMENT_REVISION_STALE');
  });

  await t.test('full mapping history rejects reusing old READY for new requirements', async () => {
    const f = await realFixture(); f.context.order.revision++; f.context.order.version++;
    const rebound = { ...f.context.mappings[0], requirement_revision: f.context.order.revision, record_version: f.context.order.version };
    f.context.mappings.push(rebound); f.command.mapping = structuredClone(rebound);
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'DUPLICATE_WORK_MAPPING');
  });

  await t.test('new requirement uses a distinct RECEIVED work and preserves historical READY', async () => {
    const f = await realFixture(); f.context.order.revision++; f.context.order.version++;
    const old = structuredClone(f.context.mappings[0]);
    const next = { ...old, work_id: 'DEV-002', requirement_revision: f.context.order.revision, record_version: f.context.order.version };
    await appendLedgerEvent(f.path, { ...f.baseEvent, work_id: next.work_id, event_id: 'TEST-006',
      type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, f.command.expected_head);
    f.context.ledgerText = await readFile(f.path, 'utf8');
    f.context.snapshot.items = [{ ...f.context.snapshot.items[0], id: next.work_id }];
    const proposal = await f.adapter.linkOrder(next);
    assert.equal(proposal.status, 'LINK_PREPARED'); assert.equal(proposal.canonical_state, 'RECEIVED');
    assert.deepEqual(f.context.mappings, [old]); // Adapter did not persist or remove history.
    f.context.mappings.push(next); // Simulated coordinator persistence only.
    f.command.mapping = structuredClone(next); f.command.expected_head = verifyLedgerText(f.context.ledgerText).head;
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'CANONICAL_ACTION_BLOCKED');
  });

  await t.test('record-only update retains work but rejects stale prepared command', async () => {
    const f = await realFixture(); f.context.order.version++;
    const projection = await f.adapter.readWorkProjection(f.command.mapping.order_id);
    assert.equal(projection.mapping.work_id, f.command.mapping.work_id);
    assert.equal(projection.mapping.record_version, f.context.order.version);
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'COMMAND_MAPPING_STALE');
    f.command.mapping = projection.mapping;
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).status, 'PREPARED_NOT_SENT');
  });

  await t.test('characterization: remapping new requirements onto old READY is not bound by PR20', async () => {
    const f = await realFixture();
    const originalHead = verifyLedgerText(f.context.ledgerText).head;
    f.context.order.revision++; f.context.order.version++;
    f.context.mappings[0].requirement_revision = f.context.order.revision;
    f.context.mappings[0].record_version = f.context.order.version;
    f.command.mapping = structuredClone(f.context.mappings[0]);
    assert.equal(verifyLedgerText(f.context.ledgerText).head, originalHead);
    // Known cross-contract gap: requires coordinator policy, not an invented adapter ledger.
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).status, 'PREPARED_NOT_SENT');
  });

  await t.test('UI CLOSED/confirmed cannot override required canonical approval or closure evidence', async () => {
    const f = await realFixture();
    f.context.order.status = 'CLOSED'; f.context.order.confirmed = true;
    f.context.order.closure = { kind: 'USER_ACCEPTED' };
    f.context.snapshot.items[0].authorization = { required: true, status: 'PENDING' };
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'CANONICAL_ACTION_BLOCKED');
    f.command.intent = 'REQUEST_CLOSE_REVIEW';
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'CANONICAL_ACTION_BLOCKED');
    f.command.confirmed = true;
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'COMMAND_FIELDS_INVALID');
  });

  await t.test('real append changes head; stale command and canonical stale append both fail', async () => {
    const f = await realFixture();
    const changed = { ...f.baseEvent, event_id: 'TEST-006', type: 'BLOCKED', from_state: 'READY', to_state: 'BLOCKED' };
    await appendLedgerEvent(f.path, changed, f.command.expected_head);
    f.context.ledgerText = await readFile(f.path, 'utf8');
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'LEDGER_HEAD_CHANGED');
    await assert.rejects(appendLedgerEvent(f.path, changed, f.command.expected_head), /LEDGER_HEAD_CHANGED/);
  });

  await t.test('verified ledger IDs defeat an omitted or incomplete supplied event inventory', async () => {
    const f = await realFixture(); f.context.usedEventIds = [];
    f.command.event_id = 'TEST-005';
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).reason, 'EVENT_ID_DUPLICATE');
    f.command.event_id = 'REVIEW-001';
    assert.equal((await f.adapter.prepareWorkCommand(f.command)).status, 'PREPARED_NOT_SENT');
  });
});

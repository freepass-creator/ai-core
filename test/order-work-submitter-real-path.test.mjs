// The "next single check" named by the independent GPT review of PR #29.
//
// WHAT IS REAL HERE, AND WHY THIS FILE EXISTS
// -------------------------------------------
// test/order-work-submitter.test.mjs already proves the submitter's durability
// against the real hash-chained ledger, but it drives the adapter with a stub
// readContext and a hand-written runControlTower that always answers READY.
// scripts/demo-order-to-projection.mjs wires the real intake normalizer, the real
// adapter and the real control tower together, but it appends its CREATED event
// itself and never calls openOrderWorkSubmitter at all. Neither artifact shows the
// real decision logic and the submitter on one path.
//
// This file closes exactly that gap and nothing else:
//
//   real scripts/run-control-tower.mjs  (which composes the real
//        evaluate-control-tower.mjs + validate-project-registry.mjs)
//   + real scripts/work-ledger.mjs      (verifyLedgerText / appendLedgerEvent)
//   + real src/integration/order-work-adapter.mjs prepareWorkCommand
//   + real src/integration/order-work-submitter.mjs openOrderWorkSubmitter
//   + a fresh projection re-read from the on-disk ledger on every call
//
// STILL NOT REAL, AND THIS IS NOT HIDEABLE: `readContext`. There is no readContext
// implementation anywhere in the tree (grep: only adapter/submitter parameters,
// tests, and the demo's own closure define one). order-work-adapter.mjs documents it
// as "trusted application wiring" supplied by a coordinator that does not exist yet.
// The closure below is therefore NOT a stand-in for judgement logic — it computes
// nothing and decides nothing — it is a data source that re-reads the real ledger
// bytes from disk and hands over the registry/snapshot documents. Every validation,
// hash, transition and gate below is executed by the real modules.
//
// The fixtures (registry, snapshot, order record) are synthetic and live in a
// throwaway temp root, as the submitter's SYNTHETIC_ROOT_REQUIRED guard demands.
//
// HOST EVENT INTENT vs PREPARED COMMAND (read off the code, not asserted as design):
//   * adapter.prepareWorkCommand returns an *intent envelope* only:
//     { command_id, event_id, intent: REQUEST_EXECUTION_REVIEW | REQUEST_CLOSE_REVIEW,
//       mapping, expected_head }. It carries no from_state/to_state and is explicitly
//     "NOT a ledger event or execution permission" (order-work-adapter.mjs).
//   * The host (the caller — here, this test) constructs the canonical ledger event
//     with the actual state transition. The submitter binds the two but never derives
//     the transition: submit() only checks event_id/work_id/project_id/subject_revision
//     identity with the command, and attempt() maps intent -> which gate must be open
//     (REQUEST_EXECUTION_REVIEW -> control_result.execute, otherwise .close).
//   * Legality of the transition itself stays with verifyLedgerText/appendLedgerEvent.
//     So: intent selects the *gate*, the host event selects the *transition*, and the
//     two are only ever cross-checked on identity — a mismatched pair fails at the
//     ledger (TRANSITION_NOT_ALLOWED/FROM_STATE_MISMATCH), never by re-derivation.
//   * Consequence checked below: a REQUEST_EXECUTION_REVIEW command whose gate is open
//     still cannot append an event the ledger's own state machine refuses.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { openOrderWorkSubmitter } from '../src/integration/order-work-submitter.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';

const registryTemplate = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const snapshotTemplate = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const asOf = '2026-09-15T01:00:00Z';
const orderId = 'ORD-00000000-0000-4000-8000-000000000099';
let counter = 0;

// Builds, inside a real submitter-allocated synthetic root, a real ledger chain
// CREATED -> PLANNED -> IN_PROGRESS -> VERIFYING -> READY for one work item, written
// only through the real appendLedgerEvent (never hand-written JSONL), plus the live
// readContext closure and a real adapter over the real control tower.
async function realFixture(t, patchSnapshotItem = {}) {
  const workId = `RSUB-${String(++counter).padStart(3, '0')}`;
  const registry = structuredClone(registryTemplate);
  const snapshot = structuredClone(snapshotTemplate);
  snapshot.as_of = asOf;
  const item = snapshot.items[0];
  item.id = workId;
  Object.assign(item, patchSnapshotItem);
  const order = { id: orderId, revision: 1, version: 1, status: 'NEW' };
  const mapping = { order_id: orderId, requirement_revision: 1, record_version: 1,
    work_id: workId, project_id: item.project_id, subject_revision: item.subject_revision };

  // readContext: a data source, not a judge. It re-reads the ledger file every call so
  // the projection is genuinely fresh, and reports whatever the mutable fixture holds.
  const state = { order, mapping, registry, snapshot, usedCommandIds: [], usedEventIds: [] };
  const instances = [];
  let ledgerPath;
  const readContext = async requestedOrderId => {
    if (requestedOrderId !== state.order.id) throw new Error('UNKNOWN_ORDER');
    return { order: state.order, mappings: [state.mapping], registry: state.registry, snapshot: state.snapshot,
      ledgerText: await readFile(ledgerPath, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)),
      usedCommandIds: [...state.usedCommandIds], usedEventIds: [...state.usedEventIds] };
  };

  // First open only allocates the synthetic root/ledger path; its outbox is empty, so
  // closing and reopening against the same root is the documented reopen path.
  const bootstrap = await openOrderWorkSubmitter({ root: null, readContext, verifyLedgerText, runControlTower, appendLedgerEvent });
  const root = bootstrap.root;
  ledgerPath = bootstrap.ledgerPath;
  bootstrap.close();
  t.after(async () => { for (const i of instances) { try { i.close(); } catch { /* already closed */ } } await rm(root, { recursive: true, force: true }); });

  const base = { work_id: workId, project_id: item.project_id, actor: 'TEST', observed_at: asOf,
    subject_revision: item.subject_revision, evidence_refs: [] };
  let appended = await appendLedgerEvent(ledgerPath, { ...base, event_id: `${workId}-001`, type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, null);
  state.usedEventIds.push(`${workId}-001`);
  for (const [index, [from_state, to_state]] of [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']].entries()) {
    const eventId = `${workId}-00${index + 2}`;
    appended = await appendLedgerEvent(ledgerPath, { ...base, event_id: eventId, type: 'TRANSITIONED', from_state, to_state }, appended.head);
    state.usedEventIds.push(eventId);
  }

  const open = async (options = {}) => {
    const instance = await openOrderWorkSubmitter({ root, readContext, verifyLedgerText, runControlTower, appendLedgerEvent, ledgerPath, ...options });
    instances.push(instance); return instance;
  };
  const adapter = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });
  return { workId, root, ledgerPath, state, base, adapter, open, submitter: await open(),
    ledger: async () => verifyLedgerText(await readFile(ledgerPath, 'utf8')) };
}

// Prepares through the REAL adapter against the REAL control tower and builds the host
// event for the canonical READY -> EXECUTED transition the prepared intent asks review for.
async function prepare(f, suffix, { intent = 'REQUEST_EXECUTION_REVIEW', to_state = 'EXECUTED', from_state = 'READY' } = {}) {
  const projection = await f.adapter.readWorkProjection(orderId);
  assert.equal(projection.status, 'LINKED');
  const eventId = `RSUBEVT-${suffix}`;
  const prepared = await f.adapter.prepareWorkCommand({ mapping: projection.mapping, command_id: `rsub-cmd-${suffix}`,
    event_id: eventId, expected_head: projection.ledger_head, intent });
  const event = { ...f.base, event_id: eventId, type: 'TRANSITIONED', from_state, to_state };
  return { projection, prepared, event };
}

// ---------------------------------------------------------------------------
// 1. The connected path, and the same work before / after / across a restart
// ---------------------------------------------------------------------------
test('real judge + real adapter + submitter + real ledger: one work item stays the same before prepare, after submit, and after restart', async t => {
  const f = await realFixture(t);

  // BEFORE: the real control tower says the work is READY and execution is reviewable,
  // while still refusing to authorize execution itself.
  const before = await f.adapter.readWorkProjection(orderId);
  assert.equal(before.canonical_state, 'READY');
  assert.equal(before.control_result.execute.enabled, true);
  assert.deepEqual(before.control_result.execute.reasons, []);
  assert.equal(before.execution_authorized, false);
  const beforeLedger = await f.ledger();
  assert.equal(beforeLedger.status, 'VALID');
  assert.equal(beforeLedger.event_count, 5);

  const { prepared, event } = await prepare(f, '001');
  assert.equal(prepared.status, 'PREPARED_NOT_SENT');
  assert.equal(prepared.sent, false);
  assert.equal(prepared.command.intent, 'REQUEST_EXECUTION_REVIEW');
  assert.equal(prepared.command.expected_head, beforeLedger.head);
  assert.ok(!('from_state' in prepared.command), 'the prepared command carries intent, never a transition');
  assert.equal(await readFile(f.ledgerPath, 'utf8'), await readFile(f.ledgerPath, 'utf8')); // preparing wrote nothing
  assert.equal((await f.ledger()).event_count, 5);

  // AFTER SUBMIT: the only writer is the submitter.
  const result = await f.submitter.submit(prepared, event);
  assert.equal(result.status, 'LEDGER_APPENDED');
  assert.equal(result.sent, true);
  assert.equal(result.execution_authorized, false);
  assert.equal(result.completion_authorized, false);
  assert.equal(result.external_execution, 'NOT_ATTEMPTED');
  const afterLedger = await f.ledger();
  assert.equal(afterLedger.status, 'VALID');
  assert.equal(afterLedger.event_count, 6);
  assert.equal(afterLedger.work[f.workId].state, 'EXECUTED');
  assert.equal(result.observed_head, afterLedger.head);

  // The same work, re-projected through the real judge, has moved exactly one step and
  // the execute gate is now closed for the canonical reason, not by the submitter.
  const afterProjection = await f.adapter.readWorkProjection(orderId);
  assert.equal(afterProjection.canonical_state, 'EXECUTED');
  assert.equal(afterProjection.control_result.execute.enabled, false);
  assert.ok(afterProjection.control_result.execute.reasons.includes('WORK_STATE_EXECUTED'));

  // AFTER RESTART: a new submitter over the same root sees the same command, the same
  // receipt, and appends nothing more.
  f.submitter.close();
  const reopened = await f.open();
  assert.deepEqual(await reopened.reconcile(prepared.command.command_id), result);
  assert.deepEqual(await reopened.submit(prepared, event), result);
  const restartLedger = await f.ledger();
  assert.equal(restartLedger.event_count, 6);
  assert.equal(restartLedger.head, afterLedger.head);
  assert.equal(restartLedger.work[f.workId].state, 'EXECUTED');
  assert.deepEqual(reopened.outbox().map(row => [row.command_id, row.state]), [[prepared.command.command_id, 'APPENDED']]);
});

// ---------------------------------------------------------------------------
// 2. Duplicate submission, on the real path
// ---------------------------------------------------------------------------
// Already covered WITH STUBS in test/order-work-submitter.test.mjs (idempotent replay,
// COMMAND_PAYLOAD_CONFLICT, EVENT_ID_ALREADY_OUTBOXED) and at the adapter level in
// test/order-work-integration-scenarios.test.mjs (COMMAND_ID_DUPLICATE). What is new
// here is that the real control tower re-runs on every retry and the second attempt is
// blocked by canonical state, not only by the outbox's bookkeeping.
test('duplicate submission on the real path: replay is idempotent, and a fresh command for already-executed work is blocked by the real judge', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '002');
  const first = await f.submitter.submit(prepared, event);
  assert.equal(first.status, 'LEDGER_APPENDED');
  assert.deepEqual(await f.submitter.submit(prepared, event), first);
  assert.equal((await f.ledger()).event_count, 6);

  // A genuinely new command for the same work: the real evaluator now refuses, so
  // prepare never yields an envelope to submit.
  f.state.usedCommandIds.push(prepared.command.command_id);
  const retryProjection = await f.adapter.readWorkProjection(orderId);
  const second = await f.adapter.prepareWorkCommand({ mapping: retryProjection.mapping, command_id: 'rsub-cmd-002b',
    event_id: 'RSUBEVT-902', expected_head: retryProjection.ledger_head, intent: 'REQUEST_EXECUTION_REVIEW' });
  assert.equal(second.status, 'HOLD');
  assert.equal(second.reason, 'CANONICAL_ACTION_BLOCKED');
  // And a stale duplicate forced at the submitter under a new command_id is still refused.
  const relabelled = { ...prepared, command: { ...prepared.command, command_id: 'rsub-cmd-002c' } };
  const forced = await f.submitter.submit(relabelled, event);
  assert.equal(forced.status, 'HOLD');
  assert.equal(forced.reason, 'EVENT_ID_ALREADY_OUTBOXED');
  assert.equal((await f.ledger()).event_count, 6);
});

// ---------------------------------------------------------------------------
// 3. Permission expiry, on the real path
// ---------------------------------------------------------------------------
// test/order-work-integration-scenarios.test.mjs already covers the real evaluator's
// AUTHORIZATION_EXPIRED and AUTHORIZATION_REQUIRED blocking prepareWorkCommand. NEW
// here: a command prepared while the grant was still valid, whose grant then expires
// before submission. Only the submitter's own re-evaluation can catch that, and it can
// only be checked with the real evaluator in the loop.
test('a grant that expires between prepare and submit holds at the submitter, with the real evaluator supplying the reason', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '003');
  assert.equal(prepared.status, 'PREPARED_NOT_SENT');

  f.state.snapshot.items[0].authorization = { required: true, status: 'GRANTED', action: 'EXECUTE',
    target: 'freepass-creator/ai-core', revision: f.state.mapping.subject_revision, scope: ['execute'],
    authorized_by: 'HUMAN:jpkpyh', authorized_at: '2026-09-14T00:00:00Z', expires_at: '2026-09-14T12:00:00Z' };
  // The real control tower, run directly, is the source of that verdict.
  const control = runControlTower({ registry: f.state.registry, snapshot: f.state.snapshot, ledgerText: await readFile(f.ledgerPath, 'utf8') });
  assert.equal(control.status, 'HOLD');
  assert.deepEqual(control.items[0].execute.reasons, ['AUTHORIZATION_EXPIRED']);

  const held = await f.submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'CANONICAL_ACTION_BLOCKED');
  assert.equal(held.sent, false);
  assert.equal((await f.ledger()).event_count, 5); // nothing appended
  // A blind retry stays held; the outbox row does not silently re-fire.
  assert.equal((await f.submitter.submit(prepared, event)).reason, 'CANONICAL_ACTION_BLOCKED');
  assert.equal((await f.ledger()).event_count, 5);
});

// ---------------------------------------------------------------------------
// 4. Requirement / target change, on the real path
// ---------------------------------------------------------------------------
test('a requirement revision that moves after prepare holds the submission as stale', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '004');
  f.state.order = { ...f.state.order, revision: 2, version: 2 }; // the order's requirement was revised
  const held = await f.submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'REQUIREMENT_REVISION_STALE');
  assert.equal((await f.ledger()).event_count, 5);
});

test('a subject (target) revision that moves after prepare holds the submission as stale', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '005');
  const moved = 'f'.repeat(40);
  f.state.registry.projects[0].head_revision = moved;
  f.state.snapshot.items[0].subject_revision = moved;
  const held = await f.submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'SUBJECT_REVISION_STALE');
  assert.equal((await f.ledger()).event_count, 5);
});

// A mapping whose record_version moved is rejected against the freshly projected mapping
// rather than being appended under the stale one.
test('a record version that moves after prepare is caught as a stale command mapping', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '006');
  f.state.order = { ...f.state.order, version: 9 };
  const held = await f.submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'COMMAND_MAPPING_STALE');
  assert.equal((await f.ledger()).event_count, 5);
});

// ---------------------------------------------------------------------------
// 5. Response loss, on the real path
// ---------------------------------------------------------------------------
// test/order-work-submitter.test.mjs already covers real process crash/restart at
// after_outbox_write / before_ledger_append / after_ledger_append — with stubs. NEW
// here: the append lands but its result never reaches the caller, and recovery is
// re-derived from the real ledger and re-checked by the real judge, with the submitter
// still the only writer (nothing here calls appendLedgerEvent to fake the effect).
test('a lost append response is recovered from the real ledger, once, without a second append', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '007');
  f.submitter.close();
  const lossy = await f.open({ checkpoint: point => { if (point === 'after_ledger_append') throw new Error('RESPONSE_LOST'); } });
  const recovered = await lossy.submit(prepared, event);
  assert.equal(recovered.status, 'LEDGER_APPENDED'); // reconciled from the ledger, not from the lost reply
  const afterLedger = await f.ledger();
  assert.equal(afterLedger.event_count, 6);
  assert.equal(afterLedger.work[f.workId].state, 'EXECUTED');
  assert.equal(recovered.observed_head, afterLedger.head);

  // Restart after the loss: the same command resolves to the same receipt, still once.
  lossy.close();
  const reopened = await f.open();
  assert.deepEqual(await reopened.submit(prepared, event), recovered);
  assert.equal((await f.ledger()).event_count, 6);
  assert.deepEqual(reopened.history(prepared.command.command_id).map(row => row.state), ['OUTBOXED', 'APPENDED']);
});

// ---------------------------------------------------------------------------
// 6. Intent vs transition: the command picks the gate, the host picks the transition
// ---------------------------------------------------------------------------
test('an open execute gate does not let the host event invent a transition the real ledger refuses', async t => {
  const f = await realFixture(t);
  // Same REQUEST_EXECUTION_REVIEW intent (gate open, verified above), but the host builds
  // an event for a transition the ledger's own state machine does not allow from READY.
  const { prepared, event } = await prepare(f, '008', { to_state: 'CLOSED', from_state: 'READY' });
  assert.equal(prepared.status, 'PREPARED_NOT_SENT');
  const held = await f.submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'TRANSITION_NOT_ALLOWED');
  assert.equal((await f.ledger()).event_count, 5);
});

// A moved head must be caught BEFORE the ledger is touched, not only by the ledger.
// Found by deliberately deleting the submitter's own head check: every existing test
// still passed, because appendLedgerEvent independently raises the identical
// LEDGER_HEAD_CHANGED code, so the reason string alone cannot tell the two apart. The
// spy below wraps — never replaces — the real appendLedgerEvent, so this asserts the
// pre-append guard itself.
test('a head that moves between prepare and submit is refused before the real appendLedgerEvent is ever called', async t => {
  const f = await realFixture(t);
  const { prepared, event } = await prepare(f, '009');
  let calls = 0;
  const spied = (...args) => { calls += 1; return appendLedgerEvent(...args); };
  f.submitter.close();
  const submitter = await f.open({ appendLedgerEvent: spied });
  // Another writer advances the head, through the real ledger writer.
  const head = (await f.ledger()).head;
  await appendLedgerEvent(f.ledgerPath, { ...f.base, work_id: 'RSUBOTHER-009', event_id: 'RSUBOTHER-001', type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, head);
  const held = await submitter.submit(prepared, event);
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'LEDGER_HEAD_CHANGED');
  assert.equal(calls, 0, 'the ledger writer must not be reached once the head is known stale');
  assert.equal((await f.ledger()).event_count, 6); // only the other writer's event
});

// ---------------------------------------------------------------------------
// 7. The submitter is the only writer on this path
// ---------------------------------------------------------------------------
test('the real path never reaches a ledger outside the synthetic root', async t => {
  const f = await realFixture(t);
  const outside = await mkdtemp(join(tmpdir(), 'ai-core-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await assert.rejects(() => f.open({ ledgerPath: join(outside, 'work.jsonl') }), error => error.message === 'SYNTHETIC_LEDGER_REQUIRED');
  await assert.rejects(() => readFile(join(outside, 'work.jsonl'), 'utf8'), error => error.code === 'ENOENT');
});

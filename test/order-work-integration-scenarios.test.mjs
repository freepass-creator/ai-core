// Coverage for docs/ORDER_CONTROL_INTEGRATION.md "브랜치 통합 순서" step 4:
// separate test ledgers proving duplicate IDs, requirement/commit changes, expired lease,
// head conflict, response loss, partial write, missing permission, and two clients
// continuing each other's work.
//
// test/order-work-adapter.test.mjs already covers, with both mocked and real (PR20)
// functions: duplicate order/work/command/event IDs, requirement-revision and
// record-version changes, head conflict, and UI-confirmed/claim never overriding
// canonical state. This file does NOT repeat those — it targets the four items that
// were not yet named anywhere: expired lease, response loss, partial write, and two
// clients continuing each other's work. It also closes "missing permission" for real,
// since the existing file only exercised it against a control-tower mock.
//
// Every fixture below drives the actual scripts/work-ledger.mjs (appendLedgerEvent,
// verifyLedgerText) and scripts/run-control-tower.mjs (which composes the real
// evaluate-control-tower.mjs and validate-project-registry.mjs) against temp files on
// disk — no reimplementation of PR20's chain/state/evaluation logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';

const registryTemplate = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const snapshotTemplate = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const asOf = '2026-09-15T01:00:00Z';
const orderId = 'ORD-00000000-0000-4000-8000-000000000099';

let dir, count = 0;
test.before(async () => { dir = await mkdtemp(join(tmpdir(), 'ai-core-scenario-')); });
test.after(async () => { await rm(dir, { recursive: true, force: true }); });

// Builds a real, on-disk ledger chain (CREATED -> ... -> READY) for one work item and
// returns everything needed to drive the real adapter against it. Mirrors the shape of
// order-work-adapter.test.mjs's realFixture helper, kept intentionally independent so a
// bug in one file's fixture cannot mask a bug the other is meant to catch.
async function realReady(patchSnapshotItem = {}) {
  const workId = `SCEN-${String(++count).padStart(3, '0')}`;
  const registry = structuredClone(registryTemplate);
  const snapshot = structuredClone(snapshotTemplate);
  snapshot.as_of = asOf;
  const item = snapshot.items[0];
  item.id = workId;
  Object.assign(item, patchSnapshotItem);
  const path = join(dir, `${workId}.jsonl`);
  const baseEvent = { work_id: workId, project_id: item.project_id, actor: 'TEST',
    observed_at: asOf, subject_revision: item.subject_revision, evidence_refs: [] };
  let result = await appendLedgerEvent(path, { ...baseEvent, event_id: `${workId}-001`, type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, null);
  const chain = [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']];
  const eventIds = [`${workId}-001`];
  for (const [index, [from_state, to_state]] of chain.entries()) {
    const eventId = `${workId}-00${index + 2}`;
    result = await appendLedgerEvent(path, { ...baseEvent, event_id: eventId, type: 'TRANSITIONED', from_state, to_state }, result.head);
    eventIds.push(eventId);
  }
  const mapping = { order_id: orderId, requirement_revision: 1, record_version: 1,
    work_id: workId, project_id: item.project_id, subject_revision: item.subject_revision };
  return { registry, snapshot, path, baseEvent, mapping, head: result.head, eventIds };
}

function staticContext(f, extra = {}) {
  return { order: { id: orderId, revision: 1, version: 1, status: 'NEW' }, mappings: [f.mapping],
    registry: f.registry, snapshot: f.snapshot, ledgerText: '', usedCommandIds: [], usedEventIds: [...f.eventIds], ...extra };
}

// ---------------------------------------------------------------------------
// Expired lease
// ---------------------------------------------------------------------------
//
// FINDING: PR20/PR22 has no "lease" concept at all in the adapter's own contract.
// order-work-adapter.mjs never reads order.tasks or any lease/claim field (grep
// confirms zero references), so nothing here can expire from the adapter's point of
// view. The only lease/claim implementation in the tree is src/orders/store.mjs's
// task.lease (PR21, UI-side), which docs/ORDER_CONTROL_INTEGRATION.md explicitly
// places outside the canonical boundary ("claim/lease와 commitment/allocations | UI
// 확보는 작업 수락이나 자원 예약·실행 승인이 아니다"). Faking an adapter-level lease
// test would misrepresent the contract, so the first test below proves the adapter is
// correctly blind to an expired PR21-style claim instead.
//
// What PR20 *does* model, and the adapter *does* enforce transitively through
// runControlTower, is a canonical authorization grant with its own expiry:
// contracts/control-tower.schema.json's authorization.expires_at, evaluated by
// scripts/evaluate-control-tower.mjs into AUTHORIZATION_EXPIRED. That is the real,
// canonical analogue of "expired lease" for execution permission, so the second test
// drives it for real.
test('adapter is blind to an expired PR21 UI claim/lease; it is not a canonical concept here', async () => {
  const f = await realReady();
  const context = staticContext(f, {
    ledgerText: await readFile(f.path, 'utf8'),
    order: { id: orderId, revision: 1, version: 1, status: 'NEW',
      tasks: [{ status: 'RUNNING', assigned: 'someone', lease: { token: 'stale-token', expiresAt: '2020-01-01T00:00:00Z' } }] },
  });
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  const result = await adapter.readWorkProjection(orderId);
  assert.equal(result.status, 'LINKED');
  assert.equal(result.control_result.execute.enabled, true);
  assert.equal(result.control_result.execute.reasons.length, 0);
});

test('real evaluator AUTHORIZATION_EXPIRED blocks the adapter action; expired grant is not a stale head', async () => {
  const f = await realReady({
    authorization: { required: true, status: 'GRANTED', action: 'EXECUTE', target: 'freepass-creator/ai-core',
      revision: snapshotTemplate.items[0].subject_revision, scope: ['execute'], authorized_by: 'HUMAN:jpkpyh',
      authorized_at: '2026-09-14T00:00:00Z', expires_at: '2026-09-14T12:00:00Z' },
  });
  const context = staticContext(f, { ledgerText: await readFile(f.path, 'utf8') });
  const control = runControlTower({ registry: f.registry, snapshot: f.snapshot, ledgerText: context.ledgerText });
  assert.equal(control.status, 'HOLD');
  assert.deepEqual(control.items[0].execute.reasons, ['AUTHORIZATION_EXPIRED']);
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  const projection = await adapter.readWorkProjection(orderId);
  assert.equal(projection.status, 'LINKED'); assert.equal(projection.control_status, 'HOLD');
  const command = { mapping: projection.mapping, command_id: 'lease-cmd-1', event_id: 'EVENT-301',
    expected_head: projection.ledger_head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const result = await adapter.prepareWorkCommand(command);
  assert.equal(result.reason, 'CANONICAL_ACTION_BLOCKED'); assert.equal(result.sent, false);
});

// ---------------------------------------------------------------------------
// Missing permission
// ---------------------------------------------------------------------------
//
// The adapter has no authorization logic of its own (confirmed by reading
// order-work-adapter.mjs in full: it only ever checks the boolean/reasons that
// runControlTower already computed). docs/ORDER_CONTROL_INTEGRATION.md assigns
// "근거·권한 결합" to PR20. This is in scope for the adapter only in the sense that it
// must correctly defer and fail closed -- which is what this test proves against the
// real evaluator instead of a mocked control_result.
test('real evaluator AUTHORIZATION_REQUIRED (permission never granted) blocks the adapter action', async () => {
  const f = await realReady({ authorization: { required: true, status: 'PENDING' } });
  const context = staticContext(f, { ledgerText: await readFile(f.path, 'utf8') });
  const control = runControlTower({ registry: f.registry, snapshot: f.snapshot, ledgerText: context.ledgerText });
  assert.equal(control.status, 'HOLD');
  assert.deepEqual(control.items[0].execute.reasons, ['AUTHORIZATION_REQUIRED']);
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  const projection = await adapter.readWorkProjection(orderId);
  const command = { mapping: projection.mapping, command_id: 'perm-cmd-1', event_id: 'EVENT-302',
    expected_head: projection.ledger_head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const result = await adapter.prepareWorkCommand(command);
  assert.equal(result.reason, 'CANONICAL_ACTION_BLOCKED'); assert.equal(result.sent, false);
});

// ---------------------------------------------------------------------------
// Response loss / retry
// ---------------------------------------------------------------------------
test('identical retry after a lost response reproduces the identical PREPARED_NOT_SENT result', async () => {
  const f = await realReady();
  const context = staticContext(f, { ledgerText: await readFile(f.path, 'utf8') });
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  const command = { mapping: f.mapping, command_id: 'retry-cmd-1', event_id: 'EVENT-401', expected_head: f.head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const first = await adapter.prepareWorkCommand(command);
  assert.equal(first.status, 'PREPARED_NOT_SENT');
  // Client never saw `first`; it retries with byte-identical input against unchanged canonical state.
  const second = await adapter.prepareWorkCommand(command);
  assert.deepEqual(second, first);
});

test('retry after the side effect actually landed is rejected as duplicate, not silently reprocessed', async () => {
  const f = await realReady();
  const command = { mapping: f.mapping, command_id: 'retry-cmd-2', event_id: 'EVENT-402', expected_head: f.head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const context = staticContext(f, { ledgerText: await readFile(f.path, 'utf8') });
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  const first = await adapter.prepareWorkCommand(command);
  assert.equal(first.status, 'PREPARED_NOT_SENT');
  // The coordinator's outbox actually recorded and dispatched attempt 1 even though the
  // client never received the HTTP response. Its bookkeeping now shows command/event used.
  context.usedCommandIds.push(command.command_id);
  context.usedEventIds.push(command.event_id);
  const retried = await adapter.prepareWorkCommand(command);
  assert.equal(retried.reason, 'COMMAND_ID_DUPLICATE');
  assert.equal(retried.sent, false);
  // Correct recovery is reading current projection, not re-preparing blindly.
  const projection = await adapter.readWorkProjection(orderId);
  assert.equal(projection.status, 'LINKED');
});

// ---------------------------------------------------------------------------
// Partial write
// ---------------------------------------------------------------------------
//
// FINDING: order-work-adapter.mjs has zero write surface -- it never imports or calls
// appendLedgerEvent (grep confirms this), matching docs/ORDER_CONTROL_INTEGRATION.md's
// "No persistence, append, transport, authorization or outbox dependency is accepted."
// A "partial write" cannot happen *at this boundary* because nothing is ever written
// here; the test below proves that architectural claim for real rather than asserting
// something the adapter was never meant to do.
//
// The actual partial-write/crash-recovery surface is scripts/work-ledger.mjs's
// appendLedgerEvent (lock file + single fsync'd append) as used by
// src/integration/durable-order-work-sandbox.mjs, and it is already exhaustively
// covered by real process-kill tests in test/durable-order-work.test.mjs -- see
// "real process crash/reopen at ${point} never duplicates a ledger event" for all six
// checkpoints, including before/after_ledger_append, and "lost append response
// reconciles exact ledger". That coverage is not duplicated here.
test('adapter calls never touch the ledger file on disk, even on a rejected candidate', async () => {
  const f = await realReady();
  const before = await readFile(f.path, 'utf8');
  const context = staticContext(f, { ledgerText: before });
  const adapter = createOrderWorkAdapter({ readContext: () => context, verifyLedgerText, runControlTower });
  await adapter.readWorkProjection(orderId);
  await adapter.linkOrder({ ...f.mapping, work_id: 'SCEN-999-CONFLICT' }); // rejected candidate: MAPPING_CONFLICT path
  await adapter.prepareWorkCommand({ mapping: f.mapping, command_id: 'noop-1', event_id: 'EVENT-403', expected_head: f.head, intent: 'REQUEST_EXECUTION_REVIEW' });
  await adapter.prepareWorkCommand({ mapping: f.mapping, command_id: 'noop-1', event_id: 'EVENT-403', expected_head: 'wrong-head', intent: 'REQUEST_EXECUTION_REVIEW' }); // rejected: LEDGER_HEAD_CHANGED path
  const after = await readFile(f.path, 'utf8');
  assert.equal(after, before);
  await assert.rejects(readFile(`${f.path}.lock`, 'utf8'), /ENOENT/);
});

// ---------------------------------------------------------------------------
// Two clients continuing each other's work
// ---------------------------------------------------------------------------
test('a second client cannot silently continue past the first client\'s actually-sent command', async () => {
  const f = await realReady();
  // Two independent adapter instances (two processes/UI sessions) share one live
  // coordinator data source, re-read fresh on every call -- exactly the intended usage.
  let liveLedgerText = await readFile(f.path, 'utf8');
  const usedCommandIds = [], usedEventIds = [...f.eventIds];
  const readContext = () => ({ order: { id: orderId, revision: 1, version: 1, status: 'NEW' },
    mappings: [f.mapping], registry: f.registry, snapshot: f.snapshot,
    ledgerText: liveLedgerText, usedCommandIds: [...usedCommandIds], usedEventIds: [...usedEventIds] });
  const clientA = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });
  const clientB = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });

  const [projectionA, projectionB] = await Promise.all([clientA.readWorkProjection(orderId), clientB.readWorkProjection(orderId)]);
  assert.equal(projectionA.ledger_head, f.head); assert.equal(projectionB.ledger_head, f.head);

  const commandA = { mapping: f.mapping, command_id: 'client-a-cmd', event_id: 'EVENT-501', expected_head: f.head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const commandB = { mapping: f.mapping, command_id: 'client-b-cmd', event_id: 'EVENT-502', expected_head: f.head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const [preparedA, preparedB] = await Promise.all([clientA.prepareWorkCommand(commandA), clientB.prepareWorkCommand(commandB)]);
  assert.equal(preparedA.status, 'PREPARED_NOT_SENT'); assert.equal(preparedB.status, 'PREPARED_NOT_SENT');

  // A coordinator (outside the adapter's scope) actually dispatches client A's command:
  // real appendLedgerEvent, real state transition, real head advance.
  const sentEvent = { ...f.baseEvent, event_id: commandA.event_id, type: 'TRANSITIONED', from_state: 'READY', to_state: 'EXECUTED' };
  const appended = await appendLedgerEvent(f.path, sentEvent, f.head);
  liveLedgerText = await readFile(f.path, 'utf8');
  usedCommandIds.push(commandA.command_id); usedEventIds.push(commandA.event_id);
  assert.notEqual(appended.head, f.head);

  // Client B, still holding its stale expected_head, must not be able to resubmit as if nothing happened.
  const staleRetry = await clientB.prepareWorkCommand(commandB);
  assert.equal(staleRetry.reason, 'LEDGER_HEAD_CHANGED'); assert.equal(staleRetry.sent, false);

  // Client B does the correct thing and re-reads before acting again: it is forced to see A's effect.
  const freshB = await clientB.readWorkProjection(orderId);
  assert.equal(freshB.canonical_state, 'EXECUTED'); assert.equal(freshB.control_result.execute.enabled, false);
  const rebuiltCommandB = { mapping: freshB.mapping, command_id: 'client-b-cmd-2', event_id: 'EVENT-503', expected_head: freshB.ledger_head, intent: 'REQUEST_EXECUTION_REVIEW' };
  const secondAttemptB = await clientB.prepareWorkCommand(rebuiltCommandB);
  assert.equal(secondAttemptB.reason, 'CANONICAL_ACTION_BLOCKED'); assert.equal(secondAttemptB.sent, false);

  // Defense in depth: even if a caller bypassed the adapter entirely and handed B's
  // stale-head envelope straight to the real ledger writer, it is independently rejected.
  await assert.rejects(appendLedgerEvent(f.path, { ...sentEvent, event_id: commandB.event_id }, f.head), /LEDGER_HEAD_CHANGED/);
});

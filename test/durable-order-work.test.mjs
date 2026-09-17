import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { openDurableOrderWorkSandbox } from '../src/integration/durable-order-work-sandbox.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';

const registry = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const snapshot = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const asOf = '2026-09-15T01:00:00Z';
const request = (suffix = '001') => ({ command_id: `command-${suffix}`, event_id: `DURABLE-${suffix}`, operation: 'new', project_id: 'ai-core',
  subject_revision: registry.projects[0].head_revision, input: { title: 'Synthetic durable intake', intent: 'Preserve this requirement', criteria: ['Ledger readback'], source: 'synthetic' } });
async function fixture(t, options = {}) {
  const instances = []; const first = await openDurableOrderWorkSandbox({ registry, asOf, ...options }); instances.push(first);
  t.after(async () => { for (const s of instances) { try { s.close(); } catch {} } await rm(first.root, { recursive: true, force: true }); });
  return { s: first, async reopen(extra = {}) { const s = await openDurableOrderWorkSandbox({ root: first.root, registry, asOf, ...extra }); instances.push(s); return s; } };
}
const readLedger = async s => verifyLedgerText(await readFile(s.ledgerPath, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)));
function snapshotFor(binding) {
  const value = structuredClone(snapshot); value.as_of = asOf; value.items[0].id = binding.work_id; return value;
}

test('atomic prepare assigns durable identity; flush observes original ledger without execution', async t => {
  const { s } = await fixture(t); const prepared = await s.prepare(request());
  assert.equal(prepared.status, 'PREPARED_NOT_SENT'); assert.equal(prepared.coordination_persisted, true);
  assert.equal(prepared.ledger_observed, false); assert.equal((await readLedger(s)).event_count, 0);
  assert.equal(s.mappingHistory().length, 1); assert.equal(s.store.list().length, 1);
  assert.equal((await s.readWorkProjection(prepared.order_id, snapshotFor(prepared))).reason, 'OUTBOX_NOT_OBSERVED');
  const observed = await s.flush(prepared.command_id);
  assert.equal(observed.status, 'LEDGER_OBSERVED'); assert.equal(observed.external_execution, 'NOT_ATTEMPTED');
  assert.equal(observed.execution_authorized, false); assert.equal(s.execute, undefined);
  assert.equal((await readLedger(s)).event_count, 1);
  const projection = await s.readWorkProjection(prepared.order_id, snapshotFor(prepared));
  assert.equal(projection.status, 'LINKED'); assert.equal(projection.canonical_state, 'RECEIVED'); assert.equal(projection.control_result.execute.enabled, false);
});

test('same command/payload survives reopen; different payload or event ID cannot reuse command', async t => {
  const f = await fixture(t); const p = await f.s.prepare(request()); await f.s.flush(p.command_id); f.s.close();
  const s = await f.reopen(); assert.equal((await s.prepare(request())).status, 'LEDGER_OBSERVED');
  assert.equal((await s.prepare({ ...request(), input: { ...request().input, intent: 'changed' } })).reason, 'COMMAND_PAYLOAD_CONFLICT');
  assert.equal((await s.prepare({ ...request(), event_id: 'DURABLE-002' })).reason, 'COMMAND_PAYLOAD_CONFLICT');
  assert.equal((await readLedger(s)).event_count, 1); assert.equal(s.store.list().length, 1);
});

test('requirement change assigns new ID, preserves old mapping, and note refreshes record version', async t => {
  const { s } = await fixture(t); const first = await s.prepare(request()); await s.flush(first.command_id);
  const old = s.mappingHistory()[0]; let order = s.store.get(first.order_id);
  order = s.store.mutate(order.id, { requestId: 'note-1', action: 'note', version: order.version, note: 'same requirement' });
  const projection = await s.readWorkProjection(order.id, snapshotFor(first)); assert.equal(projection.mapping.record_version, order.version);
  const second = await s.prepare({ ...request('002'), operation: 'change', order_id: order.id, expected_version: order.version,
    input: { intent: 'A new requirement', criteria: ['A new condition'], reason: 'Synthetic revision' } });
  assert.equal(second.status, 'PREPARED_NOT_SENT'); assert.notEqual(first.work_id, second.work_id); assert.equal(second.requirement_revision, 2);
  assert.deepEqual(s.mappingHistory()[0], old);
  assert.equal((await s.readWorkProjection(order.id, snapshotFor(first))).reason, 'OUTBOX_NOT_OBSERVED');
  await s.flush(second.command_id);
  assert.equal((await s.readWorkProjection(order.id, snapshotFor(second))).mapping.work_id, second.work_id);
  assert.throws(() => s.store.db.exec('UPDATE coordination_bindings SET requirement_revision=99'), /BINDING_IMMUTABLE/);
  assert.throws(() => s.store.db.exec('DELETE FROM coordination_bindings'), /BINDING_IMMUTABLE/);
  assert.throws(() => s.store.db.exec("UPDATE coordination_commands SET event_json='{}'"), /COMMAND_IMMUTABLE/);
  assert.throws(() => s.store.db.exec('DELETE FROM coordination_history'), /HISTORY_IMMUTABLE/);
});

test('save-hook failure rolls back order, receipt, event, binding and outbox together', async t => {
  const { s } = await fixture(t, { checkpoint: point => { if (point === 'inside_sqlite_transaction') throw new Error('SIMULATED_FAILURE'); } });
  assert.equal((await s.prepare(request())).reason, 'SIMULATED_FAILURE');
  for (const table of ['orders', 'events', 'receipts', 'coordination_bindings', 'coordination_commands', 'coordination_history']) {
    assert.equal(s.store.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
  }
  assert.equal((await readLedger(s)).event_count, 0);
  assert.throws(() => s.store.create({ ...request().input, project: 'ai-core', requestId: 'bypass' }), /COORDINATOR_REQUIRED/);
  assert.throws(() => s.store.save({ id: 'unbound' }, 'CREATED', 'test', {}), { code: 'REQUIREMENT_TRANSACTION_REQUIRED' });
  assert.equal(s.store.list().length, 0);
});

test('event-ID collision holds on exact payload mismatch; no duplicate append', async t => {
  const { s } = await fixture(t); const p = await s.prepare(request());
  const row = s.store.db.prepare('SELECT event_json FROM coordination_commands').get(); const other = JSON.parse(row.event_json); other.actor = 'DIFFERENT_ACTOR';
  await appendLedgerEvent(s.ledgerPath, other, null);
  assert.equal((await s.reconcile(p.command_id)).reason, 'EVENT_PAYLOAD_CONFLICT');
  assert.equal((await s.flush(p.command_id)).reason, 'EVENT_PAYLOAD_CONFLICT');
  assert.equal((await readLedger(s)).event_count, 1);
});

test('head conflict needs explicit revalidation; semantic payload stays immutable', async t => {
  const { s } = await fixture(t); const a = await s.prepare(request('001')), b = await s.prepare(request('002'));
  const before = s.store.db.prepare('SELECT payload_digest,event_digest FROM coordination_commands WHERE command_id=?').get(b.command_id);
  await s.flush(a.command_id); assert.equal((await s.flush(b.command_id)).reason, 'LEDGER_HEAD_CHANGED');
  assert.equal((await s.flush(b.command_id)).status, 'HOLD'); assert.equal((await readLedger(s)).event_count, 1);
  const head = (await readLedger(s)).head;
  assert.equal((await s.revalidateHead(b.command_id, null)).reason, 'LEDGER_HEAD_CHANGED');
  assert.equal((await s.revalidateHead(b.command_id, head)).status, 'PREPARED_NOT_SENT');
  assert.equal((await s.flush(b.command_id)).status, 'LEDGER_OBSERVED');
  assert.deepEqual(s.store.db.prepare('SELECT payload_digest,event_digest FROM coordination_commands WHERE command_id=?').get(b.command_id), before);
  assert.equal((await readLedger(s)).event_count, 2);
});

test('superseded prepared requirement is never silently sent or rebound', async t => {
  const { s } = await fixture(t); const a = await s.prepare(request()); const order = s.store.get(a.order_id);
  const b = await s.prepare({ ...request('002'), operation: 'change', order_id: order.id, expected_version: order.version,
    input: { intent: 'replacement', criteria: ['replacement'], reason: 'new requirement' } });
  assert.equal((await s.flush(a.command_id)).reason, 'REQUIREMENT_SUPERSEDED');
  assert.equal((await s.revalidateHead(a.command_id, null)).reason, 'REQUIREMENT_SUPERSEDED');
  assert.equal((await s.flush(b.command_id)).status, 'LEDGER_OBSERVED'); assert.equal(s.mappingHistory().length, 2);
});

test('lost append response reconciles exact ledger; missing observed history and orphan lock HOLD', async t => {
  const { s } = await fixture(t, { checkpoint: point => { if (point === 'after_ledger_append') throw new Error('LOST_RESPONSE'); } });
  const a = await s.prepare(request()); assert.equal((await s.flush(a.command_id)).status, 'LEDGER_OBSERVED');
  assert.equal((await readLedger(s)).event_count, 1);
  await writeFile(s.ledgerPath, ''); assert.equal((await s.reconcile(a.command_id)).reason, 'OBSERVED_LEDGER_HISTORY_MISSING');
  const g = await fixture(t); const b = await g.s.prepare(request()); await writeFile(`${g.s.ledgerPath}.lock`, '');
  assert.equal((await g.s.flush(b.command_id)).reason, 'LEDGER_LOCKED');
  assert.equal(await readFile(`${g.s.ledgerPath}.lock`, 'utf8'), ''); assert.equal((await readLedger(g.s)).event_count, 0);
  await writeFile(g.s.ledgerPath, '{partial'); assert.equal((await g.s.reconcile(b.command_id)).reason, 'LEDGER_INVALID');
});

test('reopen never silently recreates a missing coordination database', async t => {
  const f = await fixture(t); const p = await f.s.prepare(request()); await f.s.flush(p.command_id); f.s.close();
  await rm(f.s.dbPath);
  await assert.rejects(f.reopen(), /COORDINATION_HISTORY_MISSING/);
  assert.equal((await readLedger(f.s)).event_count, 1);
});

test('revision changed between reconciliation and dispatch is rechecked under writer lock', async t => {
  let s, change;
  const f = await fixture(t, { checkpoint: point => {
    if (point === 'before_dispatch_transaction' && change) { const input = change; change = null; return s.prepare(input); }
  } });
  s = f.s;
  const a = await s.prepare(request()); const order = s.store.get(a.order_id);
  change = { ...request('002'), operation: 'change', order_id: order.id, expected_version: order.version,
    input: { intent: 'concurrent replacement', criteria: ['new'], reason: 'new revision' } };
  assert.equal((await s.flush(a.command_id)).reason, 'REQUIREMENT_SUPERSEDED');
  assert.equal((await readLedger(s)).event_count, 0); assert.equal(s.store.get(order.id).revision, 2);
});

test('same event ID with a second command rolls back the second intake', async t => {
  const { s } = await fixture(t); const a = await s.prepare(request());
  const b = await s.prepare({ ...request(), command_id: 'another-command' });
  assert.equal(b.status, 'HOLD'); assert.equal(s.store.list().length, 1); assert.equal(s.mappingHistory().length, 1);
  assert.equal((await s.flush(a.command_id)).status, 'LEDGER_OBSERVED');
});

function child(root, point, payload) {
  const script = `import {openDurableOrderWorkSandbox} from ${JSON.stringify(new URL('../src/integration/durable-order-work-sandbox.mjs', import.meta.url).href)};
    const [root,point,payload,registry]=process.argv.slice(1).map(JSON.parse);
    const s=await openDurableOrderWorkSandbox({root,registry,asOf:${JSON.stringify(asOf)},checkpoint:p=>{if(p===point)process.exit(73)}});
    const prepared=await s.prepare(payload); const result=prepared.status==='PREPARED_NOT_SENT'?await s.flush(payload.command_id):prepared;
    console.log(JSON.stringify(result));s.close();`;
  return new Promise((resolve, reject) => {
    const processChild = spawn(process.execPath, ['--input-type=module', '-e', script, ...[root, point, payload, registry].map(value => JSON.stringify(value))], { windowsHide: true, timeout: 15000 });
    let stdout = '', stderr = ''; processChild.stdout.on('data', value => stdout += value); processChild.stderr.on('data', value => stderr += value);
    processChild.on('error', reject); processChild.on('close', code => resolve({ code, stdout, stderr }));
  });
}
for (const point of ['inside_sqlite_transaction', 'after_sqlite_commit', 'before_ledger_append', 'after_ledger_append', 'before_observation_saved', 'after_observation_saved']) {
  test(`real process crash/reopen at ${point} never duplicates a ledger event`, async t => {
    const f = await fixture(t); f.s.close(); const crashed = await child(f.s.root, point, request());
    assert.equal(crashed.code, 73, crashed.stderr);
    const s = await f.reopen();
    if (point === 'inside_sqlite_transaction') { assert.equal(s.store.list().length, 0); assert.equal(s.mappingHistory().length, 0); await s.prepare(request()); }
    else { assert.equal(s.store.list().length, 1); assert.equal(s.mappingHistory().length, 1); }
    assert.equal((await s.flush(request().command_id)).status, 'LEDGER_OBSERVED');
    assert.equal((await s.flush(request().command_id)).status, 'LEDGER_OBSERVED');
    assert.equal((await readLedger(s)).event_count, 1); assert.equal(s.store.events(s.store.list()[0].id).length, 1);
  });
}

test('two real processes preparing/flushing the same command cannot duplicate intake or event', async t => {
  const f = await fixture(t); f.s.close(); const outputs = await Promise.all([child(f.s.root, null, request()), child(f.s.root, null, request())]);
  for (const result of outputs) assert.equal(result.code, 0, result.stderr);
  const s = await f.reopen(); assert.equal((await s.reconcile(request().command_id)).status, 'LEDGER_OBSERVED');
  assert.equal(s.store.list().length, 1); assert.equal(s.mappingHistory().length, 1); assert.equal((await readLedger(s)).event_count, 1);
});

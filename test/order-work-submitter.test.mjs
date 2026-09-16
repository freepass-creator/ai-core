import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, rm, mkdtemp } from 'node:fs/promises';
import { symlinkSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { openOrderWorkSubmitter } from '../src/integration/order-work-submitter.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';

const sha = 'a'.repeat(40);
const mapping = { order_id: 'ORD-1', requirement_revision: 1, record_version: 1, work_id: 'WORK-001', project_id: 'ai-core', subject_revision: sha };
const observedAt = '2026-09-15T01:00:00Z';
const defaultGate = { execute: { enabled: true, reasons: [] }, close: { enabled: false, reasons: ['OUTCOME_NOT_OBSERVED'] } };

// Dependency doubles supply PR20 read/evaluate access the same way order-work-adapter.test.mjs
// does; verifyLedgerText and appendLedgerEvent are the real, unmodified work-ledger.mjs functions
// so durability is checked against the real hash-chained ledger, not a stand-in.
function deps(ledgerPathRef, gate) {
  const readContext = async () => ({
    order: { id: mapping.order_id, revision: mapping.requirement_revision, version: mapping.record_version },
    mappings: [mapping],
    registry: { projects: [{ project_id: mapping.project_id, status: 'ACTIVE', head_revision: mapping.subject_revision }] },
    snapshot: { items: [{ id: mapping.work_id, project_id: mapping.project_id, subject_revision: mapping.subject_revision }] },
    ledgerText: await readFile(ledgerPathRef.current, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)),
    usedCommandIds: [], usedEventIds: [],
  });
  const runControlTower = ({ ledgerText }) => {
    const verified = verifyLedgerText(ledgerText);
    return { status: 'READY', execution_authorized: false, ledger_head: verified.head, items: [{
      id: mapping.work_id, project_id: mapping.project_id, ledger_state: verified.work[mapping.work_id]?.state ?? null,
      execute: gate.execute, close: gate.close,
    }] };
  };
  return { readContext, verifyLedgerText, runControlTower };
}

async function harness(t, gate = defaultGate) {
  const ledgerPathRef = {};
  const { readContext, verifyLedgerText: vlt, runControlTower } = deps(ledgerPathRef, gate);
  // First open (root: null) only to allocate a synthetic root/ledger path; the outbox it
  // creates is legitimate but empty, so it is safe to close and reopen against the same root.
  const bootstrap = await openOrderWorkSubmitter({ root: null, readContext, verifyLedgerText: vlt, runControlTower, appendLedgerEvent });
  const root = bootstrap.root, ledgerPath = bootstrap.ledgerPath;
  ledgerPathRef.current = ledgerPath;
  bootstrap.close();
  const seed = { event_id: 'SEED-001', work_id: mapping.work_id, project_id: mapping.project_id, type: 'CREATED',
    from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: sha, observed_at: observedAt, evidence_refs: [] };
  await appendLedgerEvent(ledgerPath, seed, null);
  const instances = [];
  async function open(options = {}) {
    const s = await openOrderWorkSubmitter({ root, readContext, verifyLedgerText: vlt, runControlTower, appendLedgerEvent, ledgerPath, ...options });
    instances.push(s); return s;
  }
  const s = await open();
  t.after(async () => { for (const instance of instances) { try { instance.close(); } catch { /* already closed */ } } await rm(root, { recursive: true, force: true }); });
  const adapter = createOrderWorkAdapter({ readContext, verifyLedgerText: vlt, runControlTower });
  return { s, root, ledgerPath, gate, open, adapter };
}

async function prepareAndEvent(f, suffix, intent = 'REQUEST_EXECUTION_REVIEW') {
  const projection = await f.adapter.readWorkProjection(mapping.order_id);
  assert.equal(projection.status, 'LINKED');
  const request = { mapping: projection.mapping, command_id: `cmd-${suffix}`, event_id: `EVT-${suffix}`, expected_head: projection.ledger_head, intent };
  const prepared = await f.adapter.prepareWorkCommand(request);
  assert.equal(prepared.status, 'PREPARED_NOT_SENT');
  const event = { event_id: request.event_id, work_id: mapping.work_id, project_id: mapping.project_id, type: 'TRANSITIONED',
    from_state: 'RECEIVED', to_state: 'PLANNED', actor: 'TEST', subject_revision: sha, observed_at: observedAt, evidence_refs: [] };
  return { prepared, event };
}

test('durably submits a PREPARED_NOT_SENT command: outboxed, then appended to the real ledger', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '001');
  const result = await f.s.submit(prepared, event);
  assert.equal(result.status, 'LEDGER_APPENDED');
  assert.equal(result.sent, true); assert.equal(result.ledger_appended, true);
  assert.equal(result.execution_authorized, false); assert.equal(result.completion_authorized, false);
  assert.equal(result.external_execution, 'NOT_ATTEMPTED');
  const verified = verifyLedgerText(await readFile(f.ledgerPath, 'utf8'));
  assert.equal(verified.status, 'VALID'); assert.equal(verified.event_count, 2);
  assert.equal(verified.work[mapping.work_id].state, 'PLANNED');
  assert.equal(result.observed_head, verified.head);
});

test('replaying the same command_id with the same payload is idempotent and never double-appends', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '002');
  const first = await f.s.submit(prepared, event);
  const second = await f.s.submit(prepared, event);
  assert.deepEqual(second, first);
  assert.equal(verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).event_count, 2);
});

test('a conflicting payload reusing a command_id is rejected, not silently overwritten', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '003');
  await f.s.submit(prepared, event);
  const conflicting = { ...event, evidence_refs: ['unexpected'] };
  const result = await f.s.submit(prepared, conflicting);
  assert.equal(result.status, 'HOLD'); assert.equal(result.reason, 'COMMAND_PAYLOAD_CONFLICT');
  assert.equal(verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).event_count, 2);
});

test('reusing an event_id under a different command_id is rejected', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '004');
  await f.s.submit(prepared, event);
  const relabelled = { ...prepared, command: { ...prepared.command, command_id: 'cmd-004b' } };
  const result = await f.s.submit(relabelled, event);
  assert.equal(result.status, 'HOLD'); assert.equal(result.reason, 'EVENT_ID_ALREADY_OUTBOXED');
});

test('ledger head moving between prepare and submit holds instead of appending; explicit revalidation recovers', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '005');
  const priorHead = verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).head;
  await appendLedgerEvent(f.ledgerPath, { event_id: 'OTHER-001', work_id: 'WORK-999', project_id: mapping.project_id, type: 'CREATED',
    from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: sha, observed_at: observedAt, evidence_refs: [] }, priorHead);
  const held = await f.s.submit(prepared, event);
  assert.equal(held.status, 'HOLD'); assert.equal(held.reason, 'LEDGER_HEAD_CHANGED');
  // A HOLD row is never silently retried against its old head.
  const retriedWithoutRevalidation = await f.s.submit(prepared, event);
  assert.equal(retriedWithoutRevalidation.status, 'HOLD'); assert.equal(retriedWithoutRevalidation.reason, 'LEDGER_HEAD_CHANGED');
  assert.equal(verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).event_count, 2);
  const newHead = verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).head;
  assert.equal((await f.s.revalidateHead(prepared.command.command_id, 'not-the-current-head')).reason, 'LEDGER_HEAD_CHANGED');
  const revalidated = await f.s.revalidateHead(prepared.command.command_id, newHead);
  assert.equal(revalidated.status, 'OUTBOXED_NOT_SENT');
  const retried = await f.s.submit(prepared, event);
  assert.equal(retried.status, 'LEDGER_APPENDED');
  assert.equal(verifyLedgerText(await readFile(f.ledgerPath, 'utf8')).event_count, 3);
});

test('reopening a caller-supplied root never silently recreates a missing outbox', async t => {
  const bareRoot = await mkdtemp(join(tmpdir(), 'ai-core-submit-'));
  t.after(async () => { await rm(bareRoot, { recursive: true, force: true }); });
  await assert.rejects(openOrderWorkSubmitter({ root: bareRoot, readContext: () => {}, verifyLedgerText, runControlTower: () => {}, appendLedgerEvent }), /SUBMISSION_HISTORY_MISSING/);
});

function child(root, point, mapping, gate, prepared, event, ledgerPath) {
  const script = `
    import { openOrderWorkSubmitter } from ${JSON.stringify(new URL('../src/integration/order-work-submitter.mjs', import.meta.url).href)};
    import { appendLedgerEvent, verifyLedgerText } from ${JSON.stringify(new URL('../scripts/work-ledger.mjs', import.meta.url).href)};
    import { readFile } from 'node:fs/promises';
    const [root, point, mapping, gate, prepared, event, ledgerPath] = process.argv.slice(1).map(JSON.parse);
    const readContext = async () => ({
      order: { id: mapping.order_id, revision: mapping.requirement_revision, version: mapping.record_version },
      mappings: [mapping],
      registry: { projects: [{ project_id: mapping.project_id, status: 'ACTIVE', head_revision: mapping.subject_revision }] },
      snapshot: { items: [{ id: mapping.work_id, project_id: mapping.project_id, subject_revision: mapping.subject_revision }] },
      ledgerText: await readFile(ledgerPath, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)),
      usedCommandIds: [], usedEventIds: [],
    });
    const runControlTower = ({ ledgerText }) => {
      const verified = verifyLedgerText(ledgerText);
      return { status: 'READY', execution_authorized: false, ledger_head: verified.head, items: [{
        id: mapping.work_id, project_id: mapping.project_id, ledger_state: verified.work[mapping.work_id]?.state ?? null,
        execute: gate.execute, close: gate.close }] };
    };
    const s = await openOrderWorkSubmitter({ root, readContext, verifyLedgerText, runControlTower, appendLedgerEvent, ledgerPath,
      checkpoint: p => { if (p === point) process.exit(73); } });
    const result = await s.submit(prepared, event);
    console.log(JSON.stringify(result));
    s.close();`;
  return new Promise((resolvePromise, reject) => {
    const proc = spawn(process.execPath, ['--input-type=module', '-e', script,
      ...[root, point, mapping, gate, prepared, event, ledgerPath].map(value => JSON.stringify(value))], { windowsHide: true, timeout: 15000 });
    let stdout = '', stderr = '';
    proc.stdout.on('data', value => stdout += value); proc.stderr.on('data', value => stderr += value);
    proc.on('error', reject); proc.on('close', code => resolvePromise({ code, stdout, stderr }));
  });
}

let crashSuffix = 100;
for (const point of ['after_outbox_write', 'before_ledger_append', 'after_ledger_append']) {
  test(`real process crash/restart at ${point} recovers on reopen without duplicating or losing the ledger event`, async t => {
    const f = await harness(t);
    const { prepared, event } = await prepareAndEvent(f, String(++crashSuffix));
    f.s.close(); // release the sqlite handle before a second process opens the same file
    const crashed = await child(f.root, point, mapping, f.gate, prepared, event, f.ledgerPath);
    assert.equal(crashed.code, 73, crashed.stderr);
    const reopened = await f.open();
    const recovered = await reopened.submit(prepared, event);
    assert.equal(recovered.status, 'LEDGER_APPENDED');
    const replayed = await reopened.submit(prepared, event);
    assert.deepEqual(replayed, recovered);
    const verified = verifyLedgerText(await readFile(f.ledgerPath, 'utf8'));
    assert.equal(verified.event_count, 2); // seed + exactly one submitted event, never duplicated
  });
}

// Ledger boundary regression. PR #29 static review found that root and the SQLite
// DB/WAL/SHM paths were containment-checked but a caller-supplied `ledgerPath` was
// not: it was only `realpathSync`d and then handed straight to readFile and
// appendLedgerEvent, so the doc comment's "synthetic root only" promise was not
// enforced by the code. These three cases check the boundary actually rejects,
// and that it rejects *before* the ledger is read or appended.

test('rejects a ledger path in a separate temp directory, before any ledger read or append', async t => {
  const f = await harness(t);
  const outside = await mkdtemp(join(tmpdir(), 'ai-core-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  const before = await readFile(f.ledgerPath, 'utf8');
  await assert.rejects(() => f.open({ ledgerPath: join(outside, 'work.jsonl') }),
    error => error.message === 'SYNTHETIC_LEDGER_REQUIRED');
  // the outside path must not have been created, read or written at all
  await assert.rejects(() => readFile(join(outside, 'work.jsonl'), 'utf8'), error => error.code === 'ENOENT');
  assert.equal(await readFile(f.ledgerPath, 'utf8'), before);
});

test('rejects a link inside the root that leads to an outside ledger', async t => {
  const f = await harness(t);
  const outside = await mkdtemp(join(tmpdir(), 'ai-core-outside-'));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, 'work.jsonl'), 'REAL LEDGER BYTES\n');
  const before = await readFile(join(outside, 'work.jsonl'), 'utf8');
  // Prefer a file symlink; on Windows without Developer Mode/admin that is EPERM,
  // so fall back to a directory junction, which needs no privilege. If neither can
  // be created this is UNVERIFIED on this machine - that is not the same as "safe".
  // The link is placed *at the ledger path itself*, directly inside the root, so the
  // containment check passes on the literal path and only the real-path/symlink loop
  // can reject it. A link one directory down would be caught by containment alone and
  // would leave that loop untested.
  let kind = null;
  const ledgerPath = join(f.root, 'work-link.jsonl');
  try { symlinkSync(join(outside, 'work.jsonl'), ledgerPath, 'file'); kind = 'symlink'; }
  catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'ENOSYS') throw error;
    // Junction: a directory reparse point, creatable without privilege on Windows.
    try { symlinkSync(outside, ledgerPath, 'junction'); kind = 'junction'; }
    catch (fallback) { if (fallback.code !== 'EPERM' && fallback.code !== 'ENOSYS') throw fallback; }
  }
  if (kind === null) { t.skip('neither a file symlink nor a directory junction could be created here'); return; }
  await assert.rejects(() => f.open({ ledgerPath }), error => error.message === 'SYNTHETIC_PATH_REQUIRED');
  assert.equal(await readFile(join(outside, 'work.jsonl'), 'utf8'), before);
});

test('rejects reopening an outbox against a different ledger and leaves the original bytes untouched', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '900');
  assert.equal((await f.s.submit(prepared, event)).status, 'LEDGER_APPENDED');
  const before = await readFile(f.ledgerPath, 'utf8');
  f.s.close();
  // A second ledger *inside* the same synthetic root: containment alone would allow
  // it, so only the recorded binding can reject re-pointing this outbox at it.
  const other = join(f.root, 'other.jsonl');
  await writeFile(other, '');
  await assert.rejects(() => f.open({ ledgerPath: other }), error => error.message === 'LEDGER_BINDING_CONFLICT');
  assert.equal(await readFile(f.ledgerPath, 'utf8'), before);
  assert.equal(await readFile(other, 'utf8'), ''); // never read from or appended to
  // the correct binding still reopens and stays replay-safe
  const reopened = await f.open();
  assert.equal((await reopened.submit(prepared, event)).status, 'LEDGER_APPENDED');
  assert.equal(await readFile(f.ledgerPath, 'utf8'), before);
});

// Different from the LEDGER_BINDING_CONFLICT test above: there the binding row EXISTS
// and disagrees. Here it is ABSENT while dedup history exists — an outbox written
// before the binding table did (legacy). The old code read "no row" as "first open"
// and bound it to whatever ledger the caller named, so a legacy outbox's dedup history
// would have been applied to a ledger it never owned. The spy wraps — never replaces —
// the real appendLedgerEvent, so this asserts the refusal happens before the ledger is
// reached rather than inferring that from an error code.
test('refuses a legacy outbox that carries dedup history but no binding, leaving both ledgers byte-identical', async t => {
  const f = await harness(t);
  const { prepared, event } = await prepareAndEvent(f, '901');
  assert.equal((await f.s.submit(prepared, event)).status, 'LEDGER_APPENDED');
  const originalBytes = await readFile(f.ledgerPath, 'utf8');
  const dbPath = f.s.dbPath;
  f.s.close();
  // Age the outbox back to before the binding table existed. Dropping the table drops
  // its triggers with it, so reopening recreates an empty one — exactly the shape a
  // pre-binding outbox presents: dedup history rows, no binding row.
  const aged = new DatabaseSync(dbPath);
  aged.exec('DROP TABLE submission_binding');
  assert.ok(aged.prepare('SELECT COUNT(*) AS n FROM submission_commands').get().n > 0, 'the legacy outbox must still carry dedup history');
  aged.close();
  const other = join(f.root, 'legacy-other.jsonl');
  await writeFile(other, '');
  let calls = 0;
  const spied = (...args) => { calls += 1; return appendLedgerEvent(...args); };
  await assert.rejects(() => f.open({ ledgerPath: other, appendLedgerEvent: spied }), error => error.message === 'LEDGER_BINDING_REQUIRED');
  assert.equal(calls, 0, 'a legacy outbox must be refused before the ledger writer is reached');
  assert.equal(await readFile(other, 'utf8'), ''); // never read from or appended to
  assert.equal(await readFile(f.ledgerPath, 'utf8'), originalBytes); // the old ledger is untouched too
  // The ledger it actually owned is unknowable from the DB, so even the right name is refused.
  await assert.rejects(() => f.open(), error => error.message === 'LEDGER_BINDING_REQUIRED');
  assert.equal(await readFile(f.ledgerPath, 'utf8'), originalBytes);
});

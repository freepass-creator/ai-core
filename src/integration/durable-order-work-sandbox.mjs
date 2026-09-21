import { randomBytes, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, readFile } from 'node:fs/promises';
import { realpathSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { OrderStore } from '../orders/store.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';
import { validateProjectRegistry } from '../../scripts/validate-project-registry.mjs';
import { createOrderWorkAdapter } from './order-work-adapter.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const encode = value => JSON.stringify(canonical(value));
const digest = value => `sha256:${createHash('sha256').update(encode(value)).digest('hex')}`;
const requirementDigest = order => digest({ intent: order.intent, criteria: order.criteria });
const need = (condition, code) => { if (!condition) throw new Error(code); };
const errorCode = error => /^[A-Z][A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'COORDINATION_FAILED';
const hold = reason => ({ status: 'HOLD', reason, execution_authorized: false, completion_authorized: false, external_execution: 'NOT_ATTEMPTED' });
const eventPayload = ({ previous_hash, event_hash, ...event }) => event;
const eventId = value => typeof value === 'string' && /^[A-Z][A-Z0-9_-]*-[0-9]{3,}$/.test(value);
const pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

// Reopenable laboratory only: no production path, connection discovery or executor.
export async function openDurableOrderWorkSandbox({ root = null, registry, asOf, checkpoint = () => {} }) {
  need(validateProjectRegistry(registry).status === 'VALID', 'REGISTRY_INVALID');
  need(Number.isFinite(Date.parse(asOf)), 'AS_OF_REQUIRED');
  const temp = realpathSync(tmpdir());
  const reopening = root !== null;
  if (root === null) root = await mkdtemp(join(temp, 'ai-core-durable-'));
  root = realpathSync(resolve(root));
  need(dirname(root).toLowerCase() === temp.toLowerCase() && basename(root).startsWith('ai-core-durable-'), 'SYNTHETIC_ROOT_REQUIRED');
  const dbPath = join(root, 'intake.sqlite'), ledgerPath = join(root, 'work.jsonl');
  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, ledgerPath]) {
    try { need(!lstatSync(path).isSymbolicLink() && dirname(realpathSync(path)).toLowerCase() === root.toLowerCase(), 'SYNTHETIC_PATH_REQUIRED'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (reopening) {
    let verified = false;
    for (let attempt = 0; attempt < 8 && !verified; attempt++) {
      let probe;
      try {
        probe = new DatabaseSync(dbPath, { readOnly: true });
        const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
        need(['coordination_commands', 'coordination_bindings', 'coordination_history'].every(name => tables.includes(name)), 'COORDINATION_HISTORY_MISSING');
        verified = true;
      } catch (error) {
        if (!/locked|busy/i.test(error?.message ?? '') || attempt === 7) throw new Error('COORDINATION_HISTORY_MISSING');
        pause(25 * (attempt + 1));
      } finally { probe?.close(); }
    }
  }
  const policy = structuredClone(registry);
  let pending = null;
  const store = new OrderStore(dbPath, { onRequirementSaved: order => {
    need(pending, 'COORDINATOR_REQUIRED');
    const { payload, payloadDigest, head } = pending;
    const workId = `WORK-${BigInt(`0x${randomBytes(16).toString('hex')}`).toString()}`;
    const event = { event_id: payload.event_id, work_id: workId, project_id: payload.project_id, type: 'CREATED', from_state: null,
      to_state: 'RECEIVED', actor: 'SYNTHETIC_COORDINATOR', subject_revision: payload.subject_revision, observed_at: asOf, evidence_refs: [] };
    db.prepare('INSERT INTO coordination_commands VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(payload.command_id, payloadDigest, encode(payload), encode(event), digest(event), order.id, order.revision, 'PREPARED', head, null, null, 1);
    db.prepare('INSERT INTO coordination_bindings VALUES (?,?,?,?,?,?,?,?,?)').run(order.id, order.revision, workId, payload.project_id, payload.subject_revision,
      requirementDigest(order), order.version, payload.command_id, payload.event_id);
    history(payload.command_id, 'PREPARED', head, null);
    // Synchronous fault injection is confined to the synthetic host.
    const value = checkpoint('inside_sqlite_transaction');
    need(!value?.then, 'ASYNC_CHECKPOINT_DENIED');
  } });
  const db = store.db;
  db.exec(`
    CREATE TABLE IF NOT EXISTS coordination_commands (
      command_id TEXT PRIMARY KEY, payload_digest TEXT NOT NULL, payload_json TEXT NOT NULL,
      event_json TEXT NOT NULL, event_digest TEXT NOT NULL, order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL,
      state TEXT NOT NULL CHECK(state IN ('PREPARED','OBSERVED','HOLD')), attempt_head TEXT, observed_head TEXT, reason TEXT, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS coordination_bindings (
      order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL, work_id TEXT UNIQUE NOT NULL,
      project_id TEXT NOT NULL, subject_revision TEXT NOT NULL, requirement_digest TEXT NOT NULL,
      created_record_version INTEGER NOT NULL, command_id TEXT UNIQUE NOT NULL, event_id TEXT UNIQUE NOT NULL,
      PRIMARY KEY(order_id,requirement_revision));
    CREATE TABLE IF NOT EXISTS coordination_history (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL, state TEXT NOT NULL, head TEXT, reason TEXT);
    CREATE TRIGGER IF NOT EXISTS binding_no_update BEFORE UPDATE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS binding_no_delete BEFORE DELETE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS command_no_rewrite BEFORE UPDATE OF command_id,payload_digest,payload_json,event_json,event_digest,order_id,requirement_revision ON coordination_commands BEGIN SELECT RAISE(ABORT,'COMMAND_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS command_no_delete BEFORE DELETE ON coordination_commands BEGIN SELECT RAISE(ABORT,'COMMAND_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS history_no_update BEFORE UPDATE ON coordination_history BEGIN SELECT RAISE(ABORT,'HISTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS history_no_delete BEFORE DELETE ON coordination_history BEGIN SELECT RAISE(ABORT,'HISTORY_IMMUTABLE'); END;
  `);
  function history(id, state, head, reason) { db.prepare('INSERT INTO coordination_history(command_id,state,head,reason) VALUES (?,?,?,?)').run(id, state, head, reason); }
  const bindings = () => db.prepare('SELECT * FROM coordination_bindings ORDER BY order_id,requirement_revision').all();
  function command(id) {
    const row = db.prepare('SELECT * FROM coordination_commands WHERE command_id=?').get(id);
    need(row, 'COMMAND_NOT_FOUND');
    const payload = JSON.parse(row.payload_json), event = JSON.parse(row.event_json);
    need(digest(payload) === row.payload_digest && digest(event) === row.event_digest, 'COMMAND_DIGEST_MISMATCH');
    const binding = bindings().find(value => value.command_id === id);
    need(binding && binding.event_id === event.event_id && binding.work_id === event.work_id && binding.project_id === event.project_id
      && binding.subject_revision === event.subject_revision && binding.order_id === row.order_id && binding.requirement_revision === row.requirement_revision, 'COMMAND_BINDING_MISMATCH');
    return { ...row, payload, event, binding };
  }
  async function ledger() {
    const text = await readFile(ledgerPath, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error));
    const result = verifyLedgerText(text); need(result.status === 'VALID', 'LEDGER_INVALID');
    const events = text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
    for (const row of db.prepare("SELECT command_id FROM coordination_commands WHERE state='OBSERVED'").all()) {
      const saved = command(row.command_id), found = events.find(event => event.event_id === saved.event.event_id);
      need(found && digest(eventPayload(found)) === saved.event_digest, 'OBSERVED_LEDGER_HISTORY_MISSING');
    }
    return { ...result, text, events };
  }
  function activeBinding(row) {
    const order = store.get(row.order_id);
    need(order.revision === row.requirement_revision, 'REQUIREMENT_SUPERSEDED');
    need(requirementDigest(order) === row.binding.requirement_digest, 'REQUIREMENT_DIGEST_CHANGED');
    const project = policy.projects.find(value => value.project_id === row.binding.project_id);
    need((project?.execution_readiness_status ?? project?.status) === 'ACTIVE' && project.head_revision === row.binding.subject_revision, 'PROJECT_REVISION_CHANGED');
    return order;
  }
  function state(row, next, head, reason = null) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const update = db.prepare('UPDATE coordination_commands SET state=?,observed_head=?,reason=?,version=version+1 WHERE command_id=? AND version=?')
        .run(next, next === 'OBSERVED' ? head : row.observed_head, reason, row.command_id, row.version);
      need(update.changes === 1, 'COORDINATION_VERSION_CHANGED'); history(row.command_id, next, head, reason); db.exec('COMMIT');
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    return command(row.command_id);
  }
  const receipt = row => ({ status: row.state === 'OBSERVED' ? 'LEDGER_OBSERVED' : row.state === 'PREPARED' ? 'PREPARED_NOT_SENT' : 'HOLD',
    reason: row.reason, command_id: row.command_id, order_id: row.order_id, requirement_revision: row.requirement_revision,
    work_id: row.binding.work_id, coordination_persisted: true, ledger_observed: row.state === 'OBSERVED', observed_head: row.observed_head,
    next_action: row.state === 'OBSERVED' ? 'READ_CURRENT_WORK_PROJECTION' : row.state === 'HOLD' ? 'RECONCILE_OR_EXPLICITLY_REVALIDATE' : 'CHECK_HEAD_AND_DISPATCH_LEDGER_ONLY',
    execution_authorized: false, completion_authorized: false, external_execution: 'NOT_ATTEMPTED' });
  async function reconcile(id) {
    try {
      let row = command(id); const current = await ledger();
      const found = current.events.find(event => event.event_id === row.event.event_id);
      if (found) {
        need(digest(eventPayload(found)) === row.event_digest, 'EVENT_PAYLOAD_CONFLICT');
        if (row.state !== 'OBSERVED') {
          await checkpoint('before_observation_saved');
          row = state(row, 'OBSERVED', current.head);
          await checkpoint('after_observation_saved');
        }
        return receipt(row);
      }
      need(row.state !== 'OBSERVED', 'OBSERVED_LEDGER_HISTORY_MISSING');
      return receipt(row);
    } catch (error) { return hold(errorCode(error)); }
  }
  async function prepare(input) {
    try {
      const payload = JSON.parse(JSON.stringify(input));
      need(typeof payload.command_id === 'string' && payload.command_id.trim() && payload.command_id.length <= 200 && eventId(payload.event_id), 'COMMAND_ID_INVALID');
      need(['new', 'change'].includes(payload.operation), 'OPERATION_NOT_SUPPORTED');
      const payloadDigest = digest(payload);
      const existing = db.prepare('SELECT payload_digest FROM coordination_commands WHERE command_id=?').get(payload.command_id);
      if (existing) { need(existing.payload_digest === payloadDigest, 'COMMAND_PAYLOAD_CONFLICT'); return reconcile(payload.command_id); }
      const project = policy.projects.find(value => value.project_id === payload.project_id);
      need((project?.execution_readiness_status ?? project?.status) === 'ACTIVE' && project.head_revision === payload.subject_revision, 'PROJECT_REVISION_CHANGED');
      if (payload.operation === 'change') {
        const order = store.get(payload.order_id);
        need(order.version === payload.expected_version, 'STALE_ORDER_VERSION');
        const prior = bindings().find(value => value.order_id === order.id && value.requirement_revision === order.revision);
        need(prior && prior.project_id === payload.project_id, 'PRIOR_BINDING_REQUIRED');
      }
      const current = await ledger();
      // A process may have won this command while the ledger read was pending.
      need(!pending, 'COORDINATOR_BUSY'); pending = { payload, payloadDigest, head: current.head };
      try {
        if (payload.operation === 'new') store.create({ ...payload.input, requestId: payload.command_id, project: payload.project_id });
        else store.mutate(payload.order_id, { ...payload.input, requestId: payload.command_id, version: payload.expected_version, action: 'revise' });
      } finally { pending = null; }
      const row = command(payload.command_id); need(row.payload_digest === payloadDigest, 'COMMAND_PAYLOAD_CONFLICT');
      await checkpoint('after_sqlite_commit');
      return row.state === 'OBSERVED' ? reconcile(payload.command_id) : receipt(row);
    } catch (error) { pending = null; return hold(errorCode(error)); }
  }
  async function flush(id) {
    const recovered = await reconcile(id);
    if (recovered.status === 'LEDGER_OBSERVED' || recovered.status === 'HOLD') return recovered;
    try {
      await checkpoint('before_dispatch_transaction');
      // Serialize requirement revisions with dispatch; only this worker section
      // holds SQLite's writer lock across bounded local ledger I/O. The save hook does not.
      db.exec('BEGIN IMMEDIATE');
      try {
        const row = command(id); activeBinding(row); const current = await ledger();
        need(current.head === row.attempt_head, 'LEDGER_HEAD_CHANGED');
        need(!current.work[row.binding.work_id], 'WORK_ID_ALREADY_REGISTERED');
        await checkpoint('before_ledger_append');
        await appendLedgerEvent(ledgerPath, row.event, row.attempt_head);
        await checkpoint('after_ledger_append');
        db.exec('COMMIT');
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      return reconcile(id);
    } catch (error) {
      // Lost append response is resolved from exact canonical payload, never replayed here.
      const observed = await reconcile(id); if (observed.status === 'LEDGER_OBSERVED') return observed;
      try { state(command(id), 'HOLD', null, errorCode(error)); } catch { /* another writer may have observed it */ }
      return hold(errorCode(error));
    }
  }
  async function revalidateHead(id, expectedHead) {
    try {
      const observed = await reconcile(id); if (observed.status === 'LEDGER_OBSERVED') return observed;
      const row = command(id); activeBinding(row); const current = await ledger();
      need(!current.events.some(event => event.event_id === row.event.event_id), 'EVENT_PAYLOAD_CONFLICT');
      need(!current.work[row.binding.work_id], 'WORK_ID_ALREADY_REGISTERED');
      need(current.head === expectedHead, 'LEDGER_HEAD_CHANGED');
      db.exec('BEGIN IMMEDIATE');
      try {
        const update = db.prepare("UPDATE coordination_commands SET state='PREPARED',attempt_head=?,reason=NULL,version=version+1 WHERE command_id=? AND version=?").run(expectedHead, id, row.version);
        need(update.changes === 1, 'COORDINATION_VERSION_CHANGED'); history(id, 'PREPARED', expectedHead, 'HEAD_REVALIDATED'); db.exec('COMMIT');
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      return receipt(command(id));
    } catch (error) { return hold(errorCode(error)); }
  }
  async function readWorkProjection(orderId, snapshot) {
    try {
      const before = store.get(orderId); const current = await ledger(); const after = store.get(orderId);
      need(before.version === after.version, 'ORDER_CHANGED_DURING_READ');
      const binding = bindings().find(row => row.order_id === orderId && row.requirement_revision === after.revision);
      need(binding, 'UNLINKED'); const row = command(binding.command_id); activeBinding(row);
      const event = current.events.find(value => value.event_id === row.event.event_id);
      need(row.state === 'OBSERVED' && event && digest(eventPayload(event)) === row.event_digest, 'OUTBOX_NOT_OBSERVED');
      const all = bindings().map(value => ({ order_id: value.order_id, requirement_revision: value.requirement_revision, record_version: value.created_record_version,
        work_id: value.work_id, project_id: value.project_id, subject_revision: value.subject_revision }));
      const adapter = createOrderWorkAdapter({ verifyLedgerText, runControlTower, readContext: () => ({ order: after, mappings: all, registry: policy,
        snapshot, ledgerText: current.text, usedCommandIds: db.prepare('SELECT command_id FROM coordination_commands').all().map(value => value.command_id), usedEventIds: [] }) });
      const projection = await adapter.readWorkProjection(orderId);
      need(store.get(orderId).version === after.version && (await ledger()).head === current.head, 'CANONICAL_READ_CHANGED');
      return { mode: 'SYNTHETIC_ONLY', ...projection };
    } catch (error) { return hold(errorCode(error)); }
  }
  return { root, dbPath, ledgerPath, store, prepare, flush, reconcile, revalidateHead, readWorkProjection,
    mappingHistory: () => structuredClone(bindings()), commandHistory: id => db.prepare('SELECT * FROM coordination_history WHERE command_id=? ORDER BY sequence').all(id),
    close: () => store.close() };
}

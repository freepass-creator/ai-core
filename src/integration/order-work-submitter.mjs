import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { existsSync, realpathSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { createOrderWorkAdapter } from './order-work-adapter.mjs';

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const encode = value => JSON.stringify(canonical(value));
const digest = value => `sha256:${createHash('sha256').update(encode(value)).digest('hex')}`;
const need = (condition, code) => { if (!condition) throw new Error(code); };
const errorCode = error => /^[A-Z][A-Z0-9_]+$/.test(error?.message ?? '') ? error.message : 'SUBMISSION_FAILED';
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const identifier = value => typeof value === 'string' && /^[A-Z][A-Z0-9_-]*-[0-9]{3,}$/.test(value);
const eventPayload = ({ previous_hash, event_hash, ...event }) => event;
const mappingFields = ['order_id', 'requirement_revision', 'record_version', 'work_id', 'project_id', 'subject_revision'];
const holdOf = (reason, extra = {}) => ({ status: 'HOLD', reason, sent: false, execution_authorized: false, completion_authorized: false, external_execution: 'NOT_ATTEMPTED', ...extra });
const pause = milliseconds => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

/**
 * Non-production / HOLD library. Reopenable laboratory only: no production
 * path, connection discovery or executor, and no CI/deploy wiring.
 *
 * Durably submits an `order-work-adapter.mjs` `prepareWorkCommand` result
 * (status PREPARED_NOT_SENT) to the canonical work ledger via the trusted,
 * unmodified `appendLedgerEvent`. The command is persisted to a digest-bound
 * outbox *before* the ledger append is attempted, so a crash between
 * "prepared" and "appended" is recoverable and replay-safe on reopen: the
 * same command_id with the same payload digest always resolves to the same
 * recorded result, and a different payload under a reused command_id or
 * event_id is rejected rather than silently overwritten.
 *
 * This intentionally narrows and adapts `durable-order-work-sandbox.mjs`'s
 * outbox pattern (payload-digest-bound commands/history tables with
 * immutability triggers, reconcile-before-retry, explicit head
 * revalidation instead of silent retry) rather than reinventing it, and
 * rather than importing that module's OrderStore-coupled `prepare`/`flush`
 * machinery, which creates new canonical work items — a different job from
 * submitting an already-prepared adapter command. It never constructs
 * order/work identity itself and never touches OrderStore.
 *
 * Only caller-supplied synthetic roots are accepted (same restriction the
 * sandbox enforces on itself), so this stays a reusable library rather than
 * a production connector. It must not be pointed at a real `.local` DB, a
 * real ledger path taken from application config, an HTTP endpoint or a
 * CI/deploy step. Promotion out of HOLD requires the missing independent
 * high-risk source review named in docs/integration/INTEGRATION_STATUS.md.
 *
 * Boundary and its limits. The DB, its WAL/SHM siblings and the ledger are all
 * pinned to that synthetic root, by resolved real path, and rejected before any
 * ledger read or append; the ledger binding is additionally frozen in the outbox
 * DB so a reopen cannot repoint it. This is a *path* check, not OS isolation, and
 * must not be described as one: it does not survive a root whose own contents are
 * rewritten by another process between check and use (TOCTOU), a bind mount or
 * hardlink that aliases an out-of-root file under a name inside the root, or any
 * caller running with privileges to relocate the root itself. Real containment
 * would need a sandbox/jail at the OS level. Previously this comment promised the
 * test-root restriction while the code left `ledgerPath` unchecked — keep claims
 * here no stronger than the `need(...)` calls immediately below actually enforce.
 */
export async function openOrderWorkSubmitter({
  root = null, readContext, verifyLedgerText, runControlTower, appendLedgerEvent,
  ledgerPath = null, checkpoint = () => {}, pathMode = 'synthetic', initialize = false,
}) {
  need([readContext, verifyLedgerText, runControlTower, appendLedgerEvent].every(fn => typeof fn === 'function'), 'DEPENDENCY_REQUIRED');
  need(['synthetic', 'trusted'].includes(pathMode), 'PATH_MODE_INVALID');
  const temp = realpathSync(tmpdir());
  const synthetic = pathMode === 'synthetic';
  let reopening = root !== null;

  if (synthetic) {
    if (root === null) root = await mkdtemp(join(temp, 'ai-core-submit-'));
  } else {
    need(typeof root === 'string' && root.length > 0 && typeof ledgerPath === 'string' && ledgerPath.length > 0, 'TRUSTED_PATH_REQUIRED');
    if (initialize) await mkdir(resolve(root), { recursive: true });
  }

  root = realpathSync(resolve(root));
  if (synthetic) {
    need(dirname(root).toLowerCase() === temp.toLowerCase() && basename(root).startsWith('ai-core-submit-'), 'SYNTHETIC_ROOT_REQUIRED');
  }

  const dbPath = join(root, 'submission.sqlite');
  const ledger = ledgerPath === null ? join(root, 'work.jsonl') : resolve(ledgerPath);
  need(dirname(ledger).toLowerCase() === root.toLowerCase(), synthetic ? 'SYNTHETIC_LEDGER_REQUIRED' : 'TRUSTED_LEDGER_ROOT_MISMATCH');

  for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`, ledger]) {
    try {
      need(!lstatSync(path).isSymbolicLink() && dirname(realpathSync(path)).toLowerCase() === root.toLowerCase(),
        synthetic ? 'SYNTHETIC_PATH_REQUIRED' : 'TRUSTED_PATH_REQUIRED');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  // synthetic caller-supplied root and trusted existing DB are both reopen operations.
  // trusted initialization is explicit; merely naming a real directory never creates
  // a fresh outbox silently.
  if (!synthetic) reopening = existsSync(dbPath);
  if (!synthetic && !reopening && !initialize) throw new Error('OPERATING_OUTBOX_INITIALIZATION_REQUIRED');

  if (reopening) {
    let verified = false;
    for (let attempt = 0; attempt < 8 && !verified; attempt++) {
      let probe;
      try {
        probe = new DatabaseSync(dbPath, { readOnly: true });
        const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);
        need(['submission_commands', 'submission_history'].every(name => tables.includes(name)), 'SUBMISSION_HISTORY_MISSING');
        verified = true;
      } catch (error) {
        if (!/locked|busy/i.test(error?.message ?? '') || attempt === 7) throw new Error('SUBMISSION_HISTORY_MISSING');
        pause(25 * (attempt + 1));
      } finally { probe?.close(); }
    }
  }
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS submission_commands (
      command_id TEXT PRIMARY KEY, event_id TEXT UNIQUE NOT NULL, payload_digest TEXT NOT NULL,
      command_json TEXT NOT NULL, event_json TEXT NOT NULL, event_digest TEXT NOT NULL, expected_head TEXT,
      state TEXT NOT NULL CHECK(state IN ('OUTBOXED','APPENDED','HOLD')), observed_head TEXT, reason TEXT, version INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS submission_history (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL, state TEXT NOT NULL, head TEXT, reason TEXT);
    CREATE TRIGGER IF NOT EXISTS submission_command_no_rewrite BEFORE UPDATE OF command_id,event_id,payload_digest,command_json,event_json,event_digest ON submission_commands BEGIN SELECT RAISE(ABORT,'SUBMISSION_COMMAND_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS submission_command_no_delete BEFORE DELETE ON submission_commands BEGIN SELECT RAISE(ABORT,'SUBMISSION_COMMAND_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS submission_history_no_update BEFORE UPDATE ON submission_history BEGIN SELECT RAISE(ABORT,'SUBMISSION_HISTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS submission_history_no_delete BEFORE DELETE ON submission_history BEGIN SELECT RAISE(ABORT,'SUBMISSION_HISTORY_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS submission_binding (
      id INTEGER PRIMARY KEY CHECK(id=1), ledger_name TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS submission_binding_no_rewrite BEFORE UPDATE ON submission_binding BEGIN SELECT RAISE(ABORT,'SUBMISSION_BINDING_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS submission_binding_no_delete BEFORE DELETE ON submission_binding BEGIN SELECT RAISE(ABORT,'SUBMISSION_BINDING_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS submission_location_binding (
      id INTEGER PRIMARY KEY CHECK(id=1), root_path TEXT NOT NULL, ledger_path TEXT NOT NULL);
    CREATE TRIGGER IF NOT EXISTS submission_location_no_rewrite BEFORE UPDATE ON submission_location_binding BEGIN SELECT RAISE(ABORT,'SUBMISSION_LOCATION_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS submission_location_no_delete BEFORE DELETE ON submission_location_binding BEGIN SELECT RAISE(ABORT,'SUBMISSION_LOCATION_IMMUTABLE'); END;
  `);
  // An outbox owns exactly one ledger for its whole life. The binding is recorded
  // immutably (like the command/history tables) and re-checked on every reopen
  // *before* any ledger read or append, so a reopened root cannot be redirected at a
  // different ledger and have its dedup history applied to it. Stored as a name
  // relative to the root, since the ledger is root-contained.
  //
  // "Recorded on first open" is only true for an outbox this version created. An
  // outbox written *before* the binding table existed (legacy) has no binding row
  // however much dedup history it already carries, so recording whatever ledger the
  // current caller named would silently adopt that caller's ledger and apply another
  // ledger's dedup history to it — the exact repointing the binding exists to stop.
  // The two are told apart by history, not by the absent row: a genuinely new outbox
  // has zero submission_commands/submission_history rows, so it binds normally; a
  // legacy outbox has rows and is refused here (LEDGER_BINDING_REQUIRED), before any
  // ledger read or append, because its original ledger is unknowable from the DB.
  try {
    const bound = db.prepare('SELECT ledger_name FROM submission_binding WHERE id=1').get();
    if (bound) need(bound.ledger_name === basename(ledger), 'LEDGER_BINDING_CONFLICT');
    else {
      const used = db.prepare('SELECT (SELECT COUNT(*) FROM submission_commands) + (SELECT COUNT(*) FROM submission_history) AS rows').get();
      need(used.rows === 0, 'LEDGER_BINDING_REQUIRED');
      db.prepare('INSERT INTO submission_binding(id,ledger_name) VALUES (1,?)').run(basename(ledger));
    }
  } catch (error) { db.close(); throw error; } // never leak the handle on a rejected open

  // Absolute location binding matters in trusted operating mode: copying an outbox DB
  // to another directory with the same ledger basename must not silently repoint its
  // dedup history. Synthetic roots get the same binding so behavior is uniform.
  try {
    const location = db.prepare('SELECT root_path,ledger_path FROM submission_location_binding WHERE id=1').get();
    if (location) {
      need(location.root_path === root && location.ledger_path === ledger, 'OUTBOX_LOCATION_BINDING_CONFLICT');
    } else {
      const used = db.prepare('SELECT (SELECT COUNT(*) FROM submission_commands) + (SELECT COUNT(*) FROM submission_history) AS rows').get();
      need(used.rows === 0, 'OUTBOX_LOCATION_BINDING_REQUIRED');
      db.prepare('INSERT INTO submission_location_binding(id,root_path,ledger_path) VALUES (1,?,?)').run(root, ledger);
    }
  } catch (error) { db.close(); throw error; }

  // Reused only to re-verify freshness (readWorkProjection) immediately before append.
  // prepareWorkCommand is deliberately not called again here: its ID-duplication gate
  // assumes every call is minting a brand-new command, which would reject re-checking
  // a command this same outbox already owns. ID uniqueness is this outbox's own job
  // (command_id PRIMARY KEY, event_id UNIQUE, digest-bound conflict checks below).
  const adapter = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });

  function history(id, state, head, reason) { db.prepare('INSERT INTO submission_history(command_id,state,head,reason) VALUES (?,?,?,?)').run(id, state, head, reason); }
  function row(id) {
    const record = db.prepare('SELECT * FROM submission_commands WHERE command_id=?').get(id);
    need(record, 'COMMAND_NOT_FOUND');
    const command = JSON.parse(record.command_json), event = JSON.parse(record.event_json);
    need(digest({ command, event }) === record.payload_digest && digest(event) === record.event_digest, 'SUBMISSION_DIGEST_MISMATCH');
    return { ...record, command, event };
  }
  async function ledgerText() { return await readFile(ledger, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)); }
  const receipt = record => ({
    status: record.state === 'APPENDED' ? 'LEDGER_APPENDED' : record.state === 'OUTBOXED' ? 'OUTBOXED_NOT_SENT' : 'HOLD',
    reason: record.reason, command_id: record.command_id, event_id: record.event_id,
    outbox_persisted: true, ledger_appended: record.state === 'APPENDED', observed_head: record.observed_head,
    sent: record.state === 'APPENDED', execution_authorized: false, completion_authorized: false, external_execution: 'NOT_ATTEMPTED',
  });
  function setState(record, next, head, reason = null) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const update = db.prepare('UPDATE submission_commands SET state=?,observed_head=?,reason=?,version=version+1 WHERE command_id=? AND version=?')
        .run(next, next === 'APPENDED' ? head : record.observed_head, reason, record.command_id, record.version);
      need(update.changes === 1, 'SUBMISSION_VERSION_CHANGED'); history(record.command_id, next, head, reason); db.exec('COMMIT');
    } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
    return row(record.command_id);
  }

  async function reconcile(commandId) {
    try {
      let record = row(commandId);
      const text = await ledgerText();
      const verified = verifyLedgerText(text);
      need(verified.status === 'VALID', 'LEDGER_INVALID');
      const found = text.trim() ? text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).find(value => value.event_id === record.event_id) : null;
      if (found) {
        need(digest(eventPayload(found)) === record.event_digest, 'EVENT_PAYLOAD_CONFLICT');
        if (record.state !== 'APPENDED') { await checkpoint('before_observation_saved'); record = setState(record, 'APPENDED', verified.head); await checkpoint('after_observation_saved'); }
        return receipt(record);
      }
      need(record.state !== 'APPENDED', 'LEDGER_HISTORY_MISSING');
      return receipt(record);
    } catch (error) { return holdOf(errorCode(error), { command_id: commandId }); }
  }

  async function attempt(commandId) {
    const observed = await reconcile(commandId);
    // A HOLD outbox row is never silently retried with its old expected_head:
    // the caller must call revalidateHead() first, mirroring the sandbox's
    // PREPARED/HOLD split so a stale attempt cannot be re-fired unnoticed.
    if (observed.status === 'LEDGER_APPENDED' || observed.status === 'HOLD') return observed;
    try {
      let record = row(commandId);
      const projection = await adapter.readWorkProjection(record.command.mapping.order_id);
      need(projection.status === 'LINKED', projection.reason ?? 'CANONICAL_LINK_UNAVAILABLE');
      need(mappingFields.every(key => projection.mapping[key] === record.command.mapping[key]), 'COMMAND_MAPPING_STALE');
      need(projection.ledger_head === record.expected_head, 'LEDGER_HEAD_CHANGED');
      const action = record.command.intent === 'REQUEST_EXECUTION_REVIEW' ? projection.control_result.execute : projection.control_result.close;
      need(action?.enabled && action.reasons.length === 0, 'CANONICAL_ACTION_BLOCKED');
      await checkpoint('before_ledger_append');
      const result = await appendLedgerEvent(ledger, record.event, record.expected_head);
      await checkpoint('after_ledger_append');
      record = setState(record, 'APPENDED', result.head);
      return receipt(record);
    } catch (error) {
      const recovered = await reconcile(commandId); if (recovered.status === 'LEDGER_APPENDED') return recovered;
      try { setState(row(commandId), 'HOLD', null, errorCode(error)); } catch { /* another writer may have observed or held it first */ }
      return holdOf(errorCode(error), { command_id: commandId });
    }
  }

  /**
   * `prepared` is the exact `{ status: 'PREPARED_NOT_SENT', command, ... }`
   * result from `order-work-adapter.mjs`'s `prepareWorkCommand`. `event` is
   * the full canonical work-ledger event (type/from_state/to_state/actor/
   * evidence_refs, etc.) the trusted caller has constructed for that
   * command's intent — prepareWorkCommand only returns a review-intent
   * envelope, never a ledger event, so the transition itself is not
   * invented here. Only identity/consistency with the prepared command is
   * checked; the transition's legality is still enforced by
   * verifyLedgerText/appendLedgerEvent, never re-derived by this module.
   */
  async function submit(prepared, event) {
    try {
      need(prepared?.status === 'PREPARED_NOT_SENT' && prepared.sent === false && prepared.command, 'PREPARED_COMMAND_REQUIRED');
      const command = JSON.parse(JSON.stringify(prepared.command));
      need(nonempty(command.command_id) && identifier(command.event_id) && command.mapping
        && mappingFields.every(key => nonempty(String(command.mapping[key] ?? '')) || Number.isSafeInteger(command.mapping[key]))
        && (typeof command.expected_head === 'string' || command.expected_head === null), 'COMMAND_SHAPE_INVALID');
      const candidate = JSON.parse(JSON.stringify(event));
      need(candidate && typeof candidate === 'object', 'EVENT_REQUIRED');
      need(candidate.event_id === command.event_id, 'EVENT_ID_MISMATCH');
      need(candidate.work_id === command.mapping.work_id, 'EVENT_WORK_MISMATCH');
      need(candidate.project_id === command.mapping.project_id, 'EVENT_PROJECT_MISMATCH');
      need(candidate.subject_revision === command.mapping.subject_revision, 'EVENT_SUBJECT_MISMATCH');
      const payloadDigest = digest({ command, event: candidate });
      const existing = db.prepare('SELECT payload_digest FROM submission_commands WHERE command_id=?').get(command.command_id);
      if (existing) { need(existing.payload_digest === payloadDigest, 'COMMAND_PAYLOAD_CONFLICT'); return attempt(command.command_id); }
      need(!db.prepare('SELECT command_id FROM submission_commands WHERE event_id=?').get(candidate.event_id), 'EVENT_ID_ALREADY_OUTBOXED');
      db.prepare('INSERT INTO submission_commands VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
        command.command_id, candidate.event_id, payloadDigest, encode(command), encode(candidate), digest(candidate), command.expected_head, 'OUTBOXED', null, null, 1);
      history(command.command_id, 'OUTBOXED', null, null);
      await checkpoint('after_outbox_write');
      return attempt(command.command_id);
    } catch (error) { return holdOf(errorCode(error)); }
  }

  /** Explicitly re-arms a HELD command against a freshly read expected head. Never mutates the stored command/event identity or their digests. */
  async function revalidateHead(commandId, expectedHead) {
    try {
      const observed = await reconcile(commandId); if (observed.status === 'LEDGER_APPENDED') return observed;
      const record = row(commandId);
      const text = await ledgerText(); const verified = verifyLedgerText(text);
      need(verified.status === 'VALID', 'LEDGER_INVALID');
      const events = text.trim() ? text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) : [];
      need(!events.some(value => value.event_id === record.event_id), 'EVENT_PAYLOAD_CONFLICT');
      need(verified.head === expectedHead, 'LEDGER_HEAD_CHANGED');
      db.exec('BEGIN IMMEDIATE');
      try {
        const update = db.prepare("UPDATE submission_commands SET state='OUTBOXED',expected_head=?,reason=NULL,version=version+1 WHERE command_id=? AND version=?").run(expectedHead, commandId, record.version);
        need(update.changes === 1, 'SUBMISSION_VERSION_CHANGED'); history(commandId, 'OUTBOXED', expectedHead, 'HEAD_REVALIDATED'); db.exec('COMMIT');
      } catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
      return receipt(row(commandId));
    } catch (error) { return holdOf(errorCode(error), { command_id: commandId }); }
  }

  return {
    root, dbPath, ledgerPath: ledger, submit, reconcile, revalidateHead,
    history: id => db.prepare('SELECT * FROM submission_history WHERE command_id=? ORDER BY sequence').all(id),
    outbox: () => db.prepare('SELECT command_id,event_id,state,observed_head,reason FROM submission_commands ORDER BY command_id').all(),
    close: () => db.close(),
  };
}

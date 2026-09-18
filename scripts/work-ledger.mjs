import { createHash } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(readFileSync(new URL('../contracts/work-ledger-event.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEvent = ajv.compile(schema);
const transitions = new Map([
  ['RECEIVED', ['PLANNED', 'BLOCKED', 'CANCELLED']],
  ['PLANNED', ['IN_PROGRESS', 'BLOCKED', 'CANCELLED']],
  ['IN_PROGRESS', ['VERIFYING', 'BLOCKED', 'CANCELLED']],
  ['VERIFYING', ['IN_PROGRESS', 'AWAITING_AUTHORIZATION', 'READY', 'BLOCKED']],
  ['AWAITING_AUTHORIZATION', ['READY', 'BLOCKED', 'CANCELLED']],
  ['READY', ['EXECUTED', 'BLOCKED', 'CANCELLED']],
  ['EXECUTED', ['OBSERVING', 'BLOCKED']],
  ['OBSERVING', ['CLOSED', 'BLOCKED']],
  ['BLOCKED', ['PLANNED', 'IN_PROGRESS', 'VERIFYING', 'AWAITING_AUTHORIZATION', 'READY', 'OBSERVING', 'CANCELLED']],
]);
export const REOBSERVABLE = ['RECEIVED', 'PLANNED', 'IN_PROGRESS'];
// States that claim "this revision was verified". Reachable only from VERIFYING,
// from each other, or from BLOCKED.
const VERIFIED_PATH = ['AWAITING_AUTHORIZATION', 'READY', 'EXECUTED', 'OBSERVING', 'CLOSED'];

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function eventHash(event) {
  const { event_hash: ignored, ...content } = event;
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex')}`;
}

export function verifyLedgerText(text) {
  const errors = [];
  const events = text.trim() ? text.trim().split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line); } catch { errors.push({ code: 'LEDGER_JSON_INVALID', line: index + 1 }); return null; }
  }).filter(Boolean) : [];
  const workStates = new Map();
  // work_id -> the revision it last entered VERIFYING at. Absent = never verified,
  // or the verification was voided by going back to RECEIVED/PLANNED/IN_PROGRESS.
  const verifiedAt = new Map();
  const eventIds = new Set();
  let head = null;
  for (const [index, event] of events.entries()) {
    const line = index + 1;
    const storedHash = event.event_hash;
    const { previous_hash: previousHash, event_hash: ignoredHash, ...candidate } = event;
    if (!validateEvent(candidate)) errors.push({ code: 'EVENT_SCHEMA_INVALID', line });
    if (eventIds.has(event.event_id)) errors.push({ code: 'EVENT_ID_DUPLICATE', line });
    eventIds.add(event.event_id);
    if (previousHash !== head) errors.push({ code: 'LEDGER_CHAIN_BROKEN', line });
    if (storedHash !== eventHash(event)) errors.push({ code: 'EVENT_HASH_INVALID', line });
    const prior = workStates.get(event.work_id);
    if (event.type === 'CREATED') {
      if (prior || event.from_state !== null || event.to_state !== 'RECEIVED') errors.push({ code: 'CREATE_STATE_INVALID', line });
    } else if (event.type === 'REOBSERVED') {
      // ★2026-09-18: the subject moves (aiops 7, fp4 204 commits a day) but a work
      // item could only follow it by changing state. REOBSERVED carries the work to a
      // new revision WITHOUT moving it: same state, new revision, evidence required.
      // Only before verification — a verified/authorized item must not ride onto code
      // nobody verified; that path stays through BLOCKED -> VERIFYING.
      if (!prior || event.from_state !== prior.state || event.to_state !== prior.state) errors.push({ code: 'FROM_STATE_MISMATCH', line });
      if (!REOBSERVABLE.includes(prior?.state)) errors.push({ code: 'REOBSERVE_STATE_NOT_ALLOWED', line });
      if (!event.subject_revision || event.subject_revision === prior?.subject_revision) errors.push({ code: 'REOBSERVE_REVISION_UNCHANGED', line });
      if (!event.evidence_refs?.length) errors.push({ code: 'REOBSERVE_EVIDENCE_REQUIRED', line });
      if (prior?.project_id !== event.project_id) errors.push({ code: 'PROJECT_CHANGED', line });
    } else {
      if (!prior || event.from_state !== prior.state) errors.push({ code: 'FROM_STATE_MISMATCH', line });
      if (!transitions.get(event.from_state)?.includes(event.to_state)) errors.push({ code: 'TRANSITION_NOT_ALLOWED', line });
      if (prior?.project_id !== event.project_id) errors.push({ code: 'PROJECT_CHANGED', line });
      // ★2026-09-18: every event carries its own subject_revision, so without this a
      // step could swap it silently — VERIFYING(A) -> READY(B), READY(B) -> EXECUTED(C).
      // Once verified, the revision is frozen until the item re-enters VERIFYING
      // (BLOCKED -> VERIFYING is re-verification) or verification is voided by going
      // back to IN_PROGRESS/PLANNED. Checked for every event type here, not only
      // TRANSITIONED: the type label is not tied to the state move, so a check keyed on
      // it would be bypassed by labelling the same move RESUMED.
      if (event.to_state !== 'VERIFYING' && !REOBSERVABLE.includes(event.to_state)) {
        if (verifiedAt.has(event.work_id)) {
          if (event.subject_revision !== verifiedAt.get(event.work_id)) errors.push({ code: 'REVISION_CHANGED_AFTER_VERIFICATION', line });
        } else if (VERIFIED_PATH.includes(event.to_state)) {
          // BLOCKED -> READY/AWAITING_AUTHORIZATION/OBSERVING for an item blocked
          // before it was ever verified: READY at a revision nobody verified.
          errors.push({ code: 'VERIFICATION_SKIPPED', line });
        }
      }
    }
    if (event.to_state === 'VERIFYING') verifiedAt.set(event.work_id, event.subject_revision);
    else if (REOBSERVABLE.includes(event.to_state)) verifiedAt.delete(event.work_id);
    if (event.to_state === 'CLOSED' && (!event.subject_revision || !event.evidence_refs.length)) errors.push({ code: 'CLOSURE_EVIDENCE_REQUIRED', line });
    // `revisions` — every revision this work was ever observed at, in chain order.
    // A binding made at an earlier revision stays valid only if it is in here.
    const revisions = [...(prior?.revisions ?? [])];
    if (event.subject_revision && revisions.at(-1) !== event.subject_revision) revisions.push(event.subject_revision);
    workStates.set(event.work_id, { state: event.to_state, project_id: event.project_id, subject_revision: event.subject_revision, revisions });
    head = storedHash;
  }
  return { status: errors.length ? 'INVALID' : 'VALID', head, event_count: events.length, work: Object.fromEntries(workStates), errors };
}

export async function appendLedgerEvent(path, event, expectedHead = null) {
  const lockPath = `${path}.lock`;
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error('LEDGER_LOCKED');
    throw error;
  }
  try {
    let text = '';
    try { text = await readFile(path, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const current = verifyLedgerText(text);
    if (current.status !== 'VALID') throw new Error('LEDGER_INVALID');
    if (current.head !== expectedHead) throw new Error('LEDGER_HEAD_CHANGED');
    const record = { ...event, previous_hash: current.head };
    record.event_hash = eventHash(record);
    const candidateText = `${text.trim()}${text.trim() ? '\n' : ''}${JSON.stringify(record)}\n`;
    const candidate = verifyLedgerText(candidateText);
    if (candidate.status !== 'VALID') throw new Error(candidate.errors[0]?.code ?? 'EVENT_INVALID');
    const writer = await open(path, 'a');
    try { await writer.writeFile(`${JSON.stringify(record)}\n`, 'utf8'); await writer.sync(); } finally { await writer.close(); }
    return { head: record.event_hash, event: record };
  } finally {
    await lock?.close();
    await unlink(lockPath).catch(() => {});
  }
}

if (process.argv[1]?.endsWith('work-ledger.mjs')) {
  const [command, path, eventPath, expectedHead] = process.argv.slice(2);
  if (command === 'verify' && path) {
    // ★A ledger that is not there is not an empty ledger. Reading ENOENT as ''
    // made `verify` answer VALID for any path at all, including a typo, so the
    // command could not tell "this chain is sound" from "I found nothing to read".
    const text = await readFile(path, 'utf8').catch((error) => error.code === 'ENOENT' ? null : Promise.reject(error));
    if (text === null) {
      console.log(JSON.stringify({ status: 'MISSING', head: null, event_count: 0, work: {},
        errors: [{ code: 'LEDGER_FILE_MISSING', path }] }, null, 2));
      process.exitCode = 1;
    } else {
      const result = verifyLedgerText(text); console.log(JSON.stringify(result, null, 2));
      if (result.status !== 'VALID') process.exitCode = 1;
    }
  } else if (command === 'append' && path && eventPath) {
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    console.log(JSON.stringify(await appendLedgerEvent(path, event, expectedHead === 'null' ? null : expectedHead), null, 2));
  } else {
    console.error('Usage: node scripts/work-ledger.mjs verify <ledger.jsonl> | append <ledger.jsonl> <event.json> <expected-head|null>');
    process.exitCode = 2;
  }
}

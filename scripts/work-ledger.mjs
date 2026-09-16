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
    } else {
      if (!prior || event.from_state !== prior.state) errors.push({ code: 'FROM_STATE_MISMATCH', line });
      if (!transitions.get(event.from_state)?.includes(event.to_state)) errors.push({ code: 'TRANSITION_NOT_ALLOWED', line });
      if (prior?.project_id !== event.project_id) errors.push({ code: 'PROJECT_CHANGED', line });
    }
    if (event.to_state === 'CLOSED' && (!event.subject_revision || !event.evidence_refs.length)) errors.push({ code: 'CLOSURE_EVIDENCE_REQUIRED', line });
    workStates.set(event.work_id, { state: event.to_state, project_id: event.project_id, subject_revision: event.subject_revision });
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
    const text = await readFile(path, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error));
    const result = verifyLedgerText(text); console.log(JSON.stringify(result, null, 2));
    if (result.status !== 'VALID') process.exitCode = 1;
  } else if (command === 'append' && path && eventPath) {
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    console.log(JSON.stringify(await appendLedgerEvent(path, event, expectedHead === 'null' ? null : expectedHead), null, 2));
  } else {
    console.error('Usage: node scripts/work-ledger.mjs verify <ledger.jsonl> | append <ledger.jsonl> <event.json> <expected-head|null>');
    process.exitCode = 2;
  }
}

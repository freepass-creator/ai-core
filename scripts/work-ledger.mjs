import { createHash } from 'node:crypto';
import { open, readFile, unlink } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { getWorkflow, lifecycleGraph } from '../src/workflow/registry.mjs';
import { createWorkLedgerShadow } from '../src/workflow/work-ledger-shadow.mjs';

const schema = JSON.parse(readFileSync(new URL('../contracts/work-ledger-event.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateEvent = ajv.compile(schema);
const WORKFLOW_ID = 'ai-core.work-lifecycle';
const graph = lifecycleGraph(WORKFLOW_ID);
const transitions = graph.transitions;
export const REOBSERVABLE = graph.reobservable;
const VERIFIED_PATH = graph.verifiedPath;
const workflowAdmission = createWorkLedgerShadow(getWorkflow(WORKFLOW_ID));

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

function eventHash(event) {
  const { event_hash: ignored, ...content } = event;
  return `sha256:${createHash('sha256').update(JSON.stringify(canonical(content))).digest('hex')}`;
}

function parseLedgerEvents(text) {
  return text.trim()
    ? text.trim().split(/\r?\n/).map(line => JSON.parse(line))
    : [];
}

function currentWorkProjection(text, current, event) {
  const prior = current.work?.[event?.work_id] ?? null;
  if (!prior) return null;

  let verification_captured = false;
  let verified_revision = null;
  let event_count = 0;

  for (const recorded of parseLedgerEvents(text)) {
    if (recorded.work_id !== event.work_id) continue;
    event_count += 1;
    if (recorded.to_state === 'VERIFYING') {
      verification_captured = true;
      verified_revision = recorded.subject_revision;
    } else if (REOBSERVABLE.includes(recorded.to_state)) {
      verification_captured = false;
      verified_revision = null;
    }
  }

  return {
    entity_id: event.work_id,
    // CREATED establishes revision 0. Every later workflow event increments it.
    revision: Math.max(0, event_count - 1),
    states: { lifecycle: prior.state },
    project_id: prior.project_id,
    subject_revision: prior.subject_revision,
    verification_captured,
    verified_revision,
    revisions: [...(prior.revisions ?? [])],
    event_count,
  };
}

function inspectLedgerEventAgainstCurrent(text, current, event) {
  const projection = event?.type === 'CREATED'
    ? null
    : currentWorkProjection(text, current, event);
  return workflowAdmission.inspect(projection, event);
}

function decideLedgerEventAgainstCurrent(text, current, event) {
  const projection = event?.type === 'CREATED'
    ? null
    : currentWorkProjection(text, current, event);
  return workflowAdmission.decide(projection, event);
}

export function inspectLedgerEventWithWorkflow(text, event) {
  const current = verifyLedgerText(text);
  if (current.status !== 'VALID') {
    return {
      eligible: false,
      reasons: ['WORKFLOW_LEDGER_INVALID'],
      ledger_errors: current.errors,
    };
  }
  return inspectLedgerEventAgainstCurrent(text, current, event);
}

export function verifyLedgerText(text) {
  const errors = [];
  const events = text.trim() ? text.trim().split(/\r?\n/).map((line, index) => {
    try { return JSON.parse(line); } catch { errors.push({ code: 'LEDGER_JSON_INVALID', line: index + 1 }); return null; }
  }).filter(Boolean) : [];
  const workStates = new Map();
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

      if (event.to_state !== 'VERIFYING' && !REOBSERVABLE.includes(event.to_state)) {
        if (verifiedAt.has(event.work_id)) {
          if (event.subject_revision !== verifiedAt.get(event.work_id)) errors.push({ code: 'REVISION_CHANGED_AFTER_VERIFICATION', line });
        } else if (VERIFIED_PATH.includes(event.to_state)) {
          errors.push({ code: 'VERIFICATION_SKIPPED', line });
        }
      }
    }
    if (event.to_state === 'VERIFYING') verifiedAt.set(event.work_id, event.subject_revision);
    else if (REOBSERVABLE.includes(event.to_state)) verifiedAt.delete(event.work_id);

    if (event.to_state === 'CLOSED' && (!event.subject_revision || !event.evidence_refs.length)) errors.push({ code: 'CLOSURE_EVIDENCE_REQUIRED', line });

    // Proven revision history is stricter than the raw current field.
    // Historical ledgers may contain a plain transition that first attached a revision.
    // Keep those ledgers readable, but do NOT treat such a revision as evidence-backed history.
    // New writes are blocked in appendLedgerEvent below; only CREATED/REOBSERVED can add a revision.
    const revisions = [...(prior?.revisions ?? [])];
    if ((event.type === 'CREATED' || event.type === 'REOBSERVED') && event.subject_revision && revisions.at(-1) !== event.subject_revision) revisions.push(event.subject_revision);
    workStates.set(event.work_id, { state: event.to_state, project_id: event.project_id, subject_revision: event.subject_revision, revisions });
    head = storedHash;
  }
  return { status: errors.length ? 'INVALID' : 'VALID', head, event_count: events.length, work: Object.fromEntries(workStates), errors };
}

function decideLedgerAppendAgainstCurrent(text, current, event) {
  const workflowAdjudication = decideLedgerEventAgainstCurrent(text, current, event);
  const workflowInspection = workflowAdjudication.inspection;

  const record = { ...event, previous_hash: current.head };
  record.event_hash = eventHash(record);
  const candidateText = `${text.trim()}${text.trim() ? '\n' : ''}${JSON.stringify(record)}\n`;
  const candidate = verifyLedgerText(candidateText);
  const prior = current.work?.[event?.work_id] ?? null;

  let rejectionCode = null;

  if (!workflowInspection.eligible) {
    // Before D3 this was an imperative append-only precheck. D now owns the rule
    // through work.subject-revision-same; keep the old public error code stable.
    if (prior
      && event?.type !== 'REOBSERVED'
      && event?.type !== 'CREATED'
      && event?.subject_revision !== prior.subject_revision) {
      rejectionCode = 'REVISION_CHANGE_REQUIRES_REOBSERVED';
    } else if (candidate.status !== 'VALID') {
      // Historical/storage verifier translates existing public Ledger errors
      // such as TRANSITION_NOT_ALLOWED and REOBSERVE_EVIDENCE_REQUIRED.
      rejectionCode = candidate.errors[0]?.code ?? 'EVENT_INVALID';
    } else {
      // D is intentionally stricter than the historical reader. Fail closed and
      // expose the inspection instead of silently letting legacy readability
      // become new-write authority.
      rejectionCode = 'WORKFLOW_DECISION_MISMATCH';
    }
  } else if (candidate.status !== 'VALID') {
    // D owns workflow semantics; the Ledger verifier still owns event schema,
    // hash-chain/history compatibility and storage-integrity constraints.
    rejectionCode = candidate.errors[0]?.code ?? 'EVENT_INVALID';
  }

  return {
    accepted: rejectionCode === null,
    rejection_code: rejectionCode,
    workflow_inspection: workflowInspection,
    workflow_decision: workflowAdjudication.decision ?? null,
    candidate_verification: candidate,
    record,
  };
}

export function decideLedgerAppend(text, event) {
  const current = verifyLedgerText(text);
  if (current.status !== 'VALID') {
    return {
      accepted: false,
      rejection_code: 'LEDGER_INVALID',
      workflow_inspection: {
        eligible: false,
        reasons: ['WORKFLOW_LEDGER_INVALID'],
        ledger_errors: current.errors,
      },
      workflow_decision: null,
      candidate_verification: null,
      record: null,
    };
  }
  return decideLedgerAppendAgainstCurrent(text, current, event);
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

    // D3: D Workflow Engine is the primary new-write workflow admission.
    // The historical Ledger verifier remains a storage/history compatibility
    // backstop and stable-error translator, not a second business state machine.
    const decision = decideLedgerAppendAgainstCurrent(text, current, event);
    if (!decision.accepted) {
      const error = new Error(decision.rejection_code ?? 'EVENT_INVALID');
      error.workflow_inspection = decision.workflow_inspection;
      error.candidate_errors = decision.candidate_verification?.errors ?? [];
      throw error;
    }

    const writer = await open(path, 'a');
    try { await writer.writeFile(`${JSON.stringify(decision.record)}\n`, 'utf8'); await writer.sync(); } finally { await writer.close(); }
    return { head: decision.record.event_hash, event: decision.record };
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

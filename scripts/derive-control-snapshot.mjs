// Derives the SKELETON of a control-tower snapshot from the work ledger and the
// project registry, and refuses to fill anything neither of them knows.
//
// ★What this is not. It is not "the snapshot producer". A control-tower snapshot
// is mostly a DECLARATION, not a derivation: whether a user confirmed the
// controlling intent, who owns a commitment and when it is due, what resources are
// allocated, whether execution is authorized, how long an observation stays valid
// — none of that is computable from a ledger or a git history. Somebody has to
// assert it. Inventing plausible values would produce a snapshot that reads as
// authoritative while stating things nobody ever said.
//
// ★What it is. The ledger genuinely knows WHICH work items exist, which project
// each belongs to, and which subject revision each was observed against. That part
// is mechanical and is the part people currently hand-copy. This fills exactly
// that, and writes every remaining field as the schema's own "not established"
// value, so `evaluateControlTower` HOLDS every action rather than granting one.
//
// A derived snapshot therefore authorizes nothing. That is the correct output:
// the ledger alone never authorized anything, and the skeleton must not pretend
// otherwise. Running the control tower over it shows exactly which assertions a
// human still owes, per work item.
//
// Read-only: reads two files, writes stdout.

import { readFile } from 'node:fs/promises';
import { verifyLedgerText } from './work-ledger.mjs';
import { validateProjectRegistry } from './validate-project-registry.mjs';

// Every field below is the schema value that means "nobody has asserted this",
// chosen so the control tower holds. They are markers, never claims.
const UNASSERTED = {
  // 'INFERRED' is literally "this was not user-confirmed" -> CONTROLLING_INTENT_UNCONFIRMED.
  intent: () => ({ status: 'INFERRED', provenance: 'AI_INFERRED' }),
  // Not accepted, no owner, no due date -> COMMITMENT_NOT_ACTIVE + COMMITMENT_CONTROL_INCOMPLETE.
  commitment: () => ({ status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] }),
  // Required but not granted -> AUTHORIZATION_REQUIRED. Declaring NOT_REQUIRED
  // would be an assertion, and the riskier one, so it is never the default.
  authorization: () => ({ required: true, status: 'PENDING' }),
};

const SKELETON_TITLE = (workId) => `${workId} (title not asserted)`;

/**
 * deriveControlSnapshot({ ledgerText, registry, asOf }) -> { snapshot, unasserted, skipped }
 *
 * `skipped` names work items the ledger cannot describe well enough to place in a
 * snapshot at all. They are reported, never guessed at.
 */
export function deriveControlSnapshot({ ledgerText, registry, asOf }) {
  if (!Number.isFinite(Date.parse(asOf))) throw new Error('AS_OF_REQUIRED');
  const ledger = verifyLedgerText(ledgerText);
  if (ledger.status !== 'VALID') throw new Error('LEDGER_INVALID');
  const registryResult = validateProjectRegistry(registry);
  if (registryResult.status !== 'VALID') throw new Error('PROJECT_REGISTRY_INVALID');

  const events = ledgerText.trim() ? ledgerText.trim().split(/\r?\n/).map(line => JSON.parse(line)) : [];
  const projects = new Map(registry.projects.map(project => [project.project_id, project]));

  // Latest observation per work item, in chain order. The chain is authoritative,
  // so "latest" is the last event for that work id, not the newest timestamp.
  const latest = new Map();
  for (const event of events) latest.set(event.work_id, event);

  const items = [];
  const skipped = [];
  for (const [workId, event] of latest) {
    const project = projects.get(event.project_id);
    if (!project) { skipped.push({ work_id: workId, reason: 'PROJECT_NOT_REGISTERED' }); continue; }
    // A work item with no subject revision cannot carry an execution decision, and
    // the schema requires 40 hex. Guessing one from the registry head would bind
    // the item to a revision the ledger never observed it against.
    if (!/^[0-9a-f]{40}$/.test(event.subject_revision ?? '')) {
      skipped.push({ work_id: workId, reason: 'WORK_REVISION_REQUIRED' }); continue;
    }
    items.push({
      id: workId,
      project_id: event.project_id,
      title: SKELETON_TITLE(workId),
      intent: UNASSERTED.intent(),
      sources: [{
        ref: project.repository,
        revision: event.subject_revision,
        observed_at: event.observed_at,
        // ★Nobody has said how long this observation stays good, so it does not
        // stay good. Equal to observed_at means already expired at any as_of
        // after it -> MATERIAL_OBSERVATION_EXPIRED, a blocker.
        valid_until: event.observed_at,
        status: 'CURRENT',
        severity: 'MATERIAL',
      }],
      commitment: UNASSERTED.commitment(),
      allocations: [],
      authorization: UNASSERTED.authorization(),
      subject_revision: event.subject_revision,
      evidence_receipts: [],
      verification: 'NOT_RUN',
      execution: 'NOT_STARTED',
      outcome: 'NOT_OBSERVED',
    });
  }

  // The contract requires a snapshot to describe at least one work item
  // (control-tower.schema.json items.minItems = 1). Emitting an empty one would
  // hand the caller a document that is known to be schema-invalid, so say why
  // instead. `skipped` is attached so the caller learns whether the ledger was
  // empty or whether everything in it was unusable.
  if (!items.length) {
    const error = new Error('NO_DERIVABLE_WORK_ITEMS');
    error.skipped = skipped;
    throw error;
  }

  return {
    snapshot: { schema_version: '1.0', as_of: asOf, capacities: [], items },
    // Named so a caller can print the debt rather than discover it by running the
    // control tower and reading blocker codes.
    unasserted: ['intent', 'commitment.owner', 'commitment.due_at', 'allocations',
      'authorization', 'sources[].valid_until', 'title', 'evidence_receipts'],
    skipped,
  };
}

if (process.argv[1]?.endsWith('derive-control-snapshot.mjs')) {
  const [ledgerPath, registryPath, asOf] = process.argv.slice(2);
  if (!ledgerPath || !registryPath || !asOf) {
    console.error('Usage: node scripts/derive-control-snapshot.mjs <ledger.jsonl> <registry.json> <as-of-iso>');
    console.error('Writes a snapshot SKELETON to stdout. Every judgement field is left unasserted,');
    console.error('so the control tower holds every action until a human fills them in.');
    process.exit(2);
  }
  const ledgerText = await readFile(ledgerPath, 'utf8');
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  const { snapshot, unasserted, skipped } = deriveControlSnapshot({ ledgerText, registry, asOf });
  console.log(JSON.stringify(snapshot, null, 2));
  console.error(`\n${snapshot.items.length} work items derived; ${skipped.length} skipped.`);
  for (const entry of skipped) console.error(`  skipped ${entry.work_id}: ${entry.reason}`);
  console.error(`still unasserted on every item: ${unasserted.join(', ')}`);
  console.error('This skeleton authorizes nothing. The control tower will hold every action.');
}

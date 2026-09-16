// Read-only, non-operational demonstration of the order-intent -> canonical-work
// projection wiring described in docs/integration/ORDER_TO_PROJECTION_DEMO.md.
//
// This script proves that four ALREADY-REAL pieces (intake normalization, the
// order-work adapter, the work ledger, the control tower) actually fit together
// for one hardcoded natural-language order request. It invents no canonical
// logic of its own: every decision (validation, hashing, state transition,
// control status) is made by the real imported functions.
//
// Safety posture (matches src/integration/order-intake-sandbox.mjs):
//   - Only ever writes inside a freshly created os.tmpdir() mkdtemp root.
//   - Never opens a real `.local` DB, a real ledger path, or the network.
//   - Never claims execution/completion authorization. Every printed
//     projection carries execution_authorized: false, completion_authorized: false.
//   - The temp root is removed again before the process exits.
//
// Usage: node scripts/demo-order-to-projection.mjs

import { createHash } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';

import { normalizeOrderIntent } from '../src/intake/normalize-order-intent.mjs';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { appendLedgerEvent, verifyLedgerText } from './work-ledger.mjs';
import { runControlTower } from './run-control-tower.mjs';

const section = (title) => console.log(`\n=== ${title} ===`);
const print = (label, value) => console.log(`${label}:\n${JSON.stringify(value, null, 2)}`);

// A 40-hex "subject revision" derived deterministically, standing in for a
// git commit SHA. It is never treated as a real repository revision.
const sha40 = (seed) => createHash('sha1').update(seed).digest('hex');
const SUBJECT_REVISION = sha40('demo-order-to-projection-fixture');

const PROJECT_ID = 'demo-project';
const WORK_ID = 'DEMO-001';
const ORDER_ID = 'ORDER-DEMO-0001';
const REGISTRY_OBSERVED_AT = '2026-09-16T00:00:00Z';
const SOURCE_OBSERVED_AT = '2026-09-15T23:00:00Z';
const SNAPSHOT_AS_OF = '2026-09-16T00:00:00Z';
const LEDGER_EVENT_OBSERVED_AT = '2026-09-15T23:30:00Z';

async function main() {
  // ---------------------------------------------------------------------
  // STEP 1 — INTENT: one hardcoded natural-language order request goes
  // through the real intake normalizer. No parsing/authorization/execution
  // happens here; normalizeOrderIntent only validates structure and evidence.
  // ---------------------------------------------------------------------
  section('INTENT');
  const rawText = '결제 모듈 리팩토링 작업을 새로 시작해 주세요. 서버에서 처리해 주세요.';
  const evidence = [{ start: 0, end: rawText.length, quote: rawText }];
  const candidate = {
    source: { message_id: 'demo-message-1', origin: 'user', text: rawText },
    intent: { value: 'new', evidence },
    request: { value: rawText, evidence },
    execution_location: { value: 'server', evidence },
  };
  console.log('Raw natural-language request:');
  console.log(`  "${rawText}"`);
  const normalized = normalizeOrderIntent(candidate);
  print('normalizeOrderIntent(candidate) result', normalized);

  if (normalized.status !== 'CANDIDATE_VALIDATED') {
    console.log('\nIntake did not validate; failing closed before any fixture is built.');
    console.log('issues:', normalized.issues);
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------------------------------------
  // STEP 2 — FIXTURE: a temporary, self-contained project registry + a real
  // append-only work ledger with one CREATED (RECEIVED-state) work item,
  // written via the real appendLedgerEvent so the hash chain is genuine.
  // Everything lives under a fresh mkdtemp() root, never a real path.
  // ---------------------------------------------------------------------
  section('FIXTURE');
  const root = await mkdtemp(join(tmpdir(), 'ai-core-order-demo-'));
  console.log(`Temp fixture root (mkdtemp): ${root}`);
  try {
    const registry = {
      schema_version: '1.0',
      observed_at: REGISTRY_OBSERVED_AT,
      projects: [{
        project_id: PROJECT_ID,
        name: 'Demo Project',
        organization: 'HEADQUARTERS',
        status: 'ACTIVE',
        mission: 'Throwaway fixture project for the order-to-projection demo.',
        repository: 'demo-org/demo-project',
        default_branch: 'main',
        work_branches: [],
        local_path: null,
        head_revision: SUBJECT_REVISION,
        authoritative_sources: [{
          kind: 'GIT', ref: 'demo-org/demo-project',
          revision: SUBJECT_REVISION, observed_at: SOURCE_OBSERVED_AT,
        }],
        commands: { install: 'npm ci', test: 'npm test', build: 'npm run build' },
        deploy_targets: [],
        required_approvals: [],
        known_blockers: [],
      }],
    };

    const ledgerPath = join(root, 'work.jsonl');
    const createdEvent = {
      event_id: 'DEMOEVENT-001', work_id: WORK_ID, project_id: PROJECT_ID,
      type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'DEMO_SCRIPT',
      subject_revision: SUBJECT_REVISION, observed_at: LEDGER_EVENT_OBSERVED_AT, evidence_refs: [],
    };
    // Real hash-chained append, not hand-written JSONL: expectedHead null means
    // "the ledger must currently be empty," which it is (a fresh temp file).
    const appended = await appendLedgerEvent(ledgerPath, createdEvent, null);
    const ledgerText = await readFile(ledgerPath, 'utf8');
    const ledgerVerification = verifyLedgerText(ledgerText);
    console.log(`Ledger file: ${ledgerPath}`);
    console.log('Ledger line (real appendLedgerEvent output):');
    console.log(`  ${JSON.stringify(appended.event)}`);
    print('verifyLedgerText(ledgerText) on the real appended chain', ledgerVerification);

    const snapshot = {
      schema_version: '1.0',
      as_of: SNAPSHOT_AS_OF,
      capacities: [],
      items: [{
        id: WORK_ID, project_id: PROJECT_ID, title: 'Demo: refactor payment module',
        intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
        sources: [{
          ref: 'demo-org/demo-project', revision: SUBJECT_REVISION,
          observed_at: SOURCE_OBSERVED_AT, valid_until: '2026-09-20T00:00:00Z',
          status: 'CURRENT', severity: 'ADVISORY',
        }],
        commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
        allocations: [],
        authorization: { required: true, status: 'PENDING' },
        subject_revision: SUBJECT_REVISION,
        evidence_receipts: [],
        verification: 'NOT_RUN',
        execution: 'NOT_STARTED',
        outcome: 'NOT_OBSERVED',
      }],
    };
    print('Fixture registry (registry/projects.json-shaped)', registry);
    print('Fixture control-tower snapshot', snapshot);

    // -------------------------------------------------------------------
    // STEP 3 — MAPPING: connect the normalized intent to the fixture work
    // item. This is the order<->work identity binding the real adapter
    // requires as input; the demo wires it directly instead of going
    // through a coordinator/store, since none is in scope here.
    // -------------------------------------------------------------------
    section('MAPPING');
    const order = { id: ORDER_ID, revision: 1, version: 1 };
    const mapping = {
      order_id: ORDER_ID, requirement_revision: order.revision, record_version: order.version,
      work_id: WORK_ID, project_id: PROJECT_ID, subject_revision: SUBJECT_REVISION,
    };
    console.log('Order record (fixture, not a real order store):');
    console.log(`  ${JSON.stringify(order)}`);
    print('mapping (order_id, requirement_revision, record_version, work_id, project_id, subject_revision)', mapping);
    console.log('\nNormalized intent that this mapping represents fulfilling:');
    console.log(`  intent=${normalized.intent.value} request="${normalized.request.value}"`);

    // -------------------------------------------------------------------
    // STEP 4 — PROJECTION: hand the real createOrderWorkAdapter a readContext
    // closure over exactly this fixture, and call the real readWorkProjection.
    // Every check inside (mapping validity, ledger chain validity, project
    // ACTIVE, subject-revision agreement, control-tower re-evaluation) is the
    // real PR20 adapter logic — nothing here re-implements it.
    // -------------------------------------------------------------------
    section('PROJECTION');
    async function readContext(requestedOrderId) {
      if (requestedOrderId !== order.id) throw new Error('UNKNOWN_ORDER');
      return {
        order, mappings: [mapping], registry, snapshot, ledgerText,
        usedCommandIds: [], usedEventIds: [],
      };
    }
    const adapter = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });
    const projection = await adapter.readWorkProjection(ORDER_ID);
    print('adapter.readWorkProjection(orderId) — the real, final result', projection);

    console.log(`\nstatus=${projection.status}`);
    if (projection.canonical_state !== undefined) console.log(`canonical_state=${projection.canonical_state}`);
    if (projection.control_status !== undefined) console.log(`control_status=${projection.control_status}`);
    if (projection.control_result !== undefined) console.log(`control_result=${JSON.stringify(projection.control_result)}`);
    console.log(`execution_authorized=${projection.execution_authorized} completion_authorized=${projection.completion_authorized}`);

    if (projection.status !== 'LINKED') {
      console.log('\nThe chain failed closed before producing a LINKED projection.');
      console.log(`reason=${projection.reason ?? '(none given)'}`);
      process.exitCode = 1;
    }
  } finally {
    // Mirrors the order-intake-sandbox.mjs safety pattern: only ever remove
    // the exact freshly allocated temp directory, never anything else.
    if (resolve(root).startsWith(`${resolve(tmpdir())}${sep}`)) {
      await rm(root, { recursive: true, force: true });
      console.log(`\nRemoved temp fixture root: ${root}`);
    }
  }
}

main().catch((error) => {
  console.error('\nDemo failed closed with an unexpected error:');
  console.error(error);
  process.exitCode = 1;
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrderStore } from '../src/orders/store.mjs';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';
import { createOrderWorkContextReader } from '../src/integration/order-work-context-reader.mjs';
import { createOrderWorkBinder } from '../src/integration/order-work-binder.mjs';
import { readOrderMappingInventory, hasBindingTable } from '../src/integration/order-mapping-inventory.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';
import { readFile } from 'node:fs/promises';

const SUBJECT = createHash('sha1').update('order-work-binder-fixture').digest('hex');
const PROJECT = 'demo-project';
const WORK = 'DEMO-001';

const orderInput = () => ({
  requestId: randomUUID(), title: '묶는 행위 확인', intent: '오더 하나를 업무에 묶는다.',
  project: 'ai-core', kind: 'general', criteria: ['묶어도 권한은 생기지 않는다.'],
});

const registry = () => ({
  schema_version: '1.1', observed_at: '2026-09-16T00:00:00Z',
  projects: [{
    project_id: PROJECT, name: 'Demo', organization: 'HEADQUARTERS', repository_lifecycle_status: 'ACTIVE', execution_readiness_status: 'ACTIVE',
    mission: 'fixture', repository: 'demo-org/demo-project', default_branch: 'main',
    work_branches: [], local_path: null, head_revision: SUBJECT,
    authoritative_sources: [{ kind: 'GIT', ref: 'demo-org/demo-project', revision: SUBJECT, observed_at: '2026-09-15T23:00:00Z' }],
    commands: { install: 'npm ci', test: 'npm test', build: 'npm run build' },
    deploy_targets: [], required_approvals: [], known_blockers: [],
  }],
});

const snapshot = () => ({
  schema_version: '1.0', as_of: '2026-09-16T00:00:00Z', capacities: [],
  items: [{
    id: WORK, project_id: PROJECT, title: 'fixture work',
    intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
    sources: [{ ref: 'demo-org/demo-project', revision: SUBJECT, observed_at: '2026-09-15T23:00:00Z',
      valid_until: '2026-09-20T00:00:00Z', status: 'CURRENT', severity: 'ADVISORY' }],
    commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
    allocations: [], authorization: { required: true, status: 'PENDING' },
    subject_revision: SUBJECT, evidence_receipts: [],
    verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED' }],
});

async function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-binder-'));
  const store = new OrderStore(join(dir, 'orders.sqlite'));
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });

  const ledgerPath = join(dir, 'work.jsonl');
  await appendLedgerEvent(ledgerPath, {
    event_id: 'BINDEVENT-001', work_id: WORK, project_id: PROJECT, type: 'CREATED',
    from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: SUBJECT,
    observed_at: '2026-09-15T23:30:00Z', evidence_refs: [],
  }, null);

  const readLedgerText = () => readFile(ledgerPath, 'utf8');
  const mappings = () => (hasBindingTable(store.db) ? readOrderMappingInventory(store.db) : []);
  const adapter = createOrderWorkAdapter({
    readContext: createOrderWorkContextReader({ store, registry: registry(), snapshot: snapshot(), mappings, readLedgerText }),
    verifyLedgerText, runControlTower,
  });
  return { store, adapter, bind: createOrderWorkBinder({ store, adapter }), dir };
}

const good = (order) => ({ order_id: order.id, work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT });

test('★binding one real order writes exactly one row and reads back', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());

  assert.equal(hasBindingTable(store.db), false);
  const result = await bind(good(order));
  assert.equal(result.status, 'LINKED');
  assert.equal(result.persisted, true);

  const inventory = readOrderMappingInventory(store.db);
  assert.equal(inventory.length, 1);
  assert.deepEqual(inventory[0], {
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  });
});

test('★a binding grants nothing', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  const result = await bind(good(order));
  assert.equal(result.execution_authorized, false);
  assert.equal(result.completion_authorized, false);
  assert.equal(result.sent, false);
});

test('★a refused link writes nothing at all', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  // A work item the ledger has never heard of.
  const result = await bind({ ...good(order), work_id: 'NOSUCH-999' });
  assert.notEqual(result.status, 'LINKED');
  // Not merely "no row": the table must not even come into existence, or an
  // absent inventory would start reading as an empty one.
  assert.equal(hasBindingTable(store.db), false);
});

test('the adapter keeps its own words when it refuses', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  const wrongProject = await bind({ ...good(order), project_id: 'not-registered' });
  assert.equal(wrongProject.status, 'HOLD');
  // The binder must not re-phrase or soften the adapter's reason.
  assert.ok(typeof wrongProject.reason === 'string' && wrongProject.reason.length > 0);
});

test('binding the same pair twice is a no-op, not an error and not a second row', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  assert.equal((await bind(good(order))).persisted, true);
  const again = await bind(good(order));
  assert.equal(again.status, 'LINKED');
  assert.equal(again.persisted, false);
  assert.equal(readOrderMappingInventory(store.db).length, 1);
});

test('★an existing binding is never overwritten by a different one', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  await bind(good(order));
  const conflict = await bind({ ...good(order), work_id: 'OTHER-002' });
  // In the standard wiring the ADAPTER refuses first, because the inventory it
  // reads is this same binding table, so it already sees the first binding.
  // The binder never reaches its own check here.
  assert.equal(conflict.reason, 'MAPPING_CONFLICT');
  assert.equal(readOrderMappingInventory(store.db)[0].work_id, WORK);
});

test('★the binder backstop conflict check is not dead code', async (t) => {
  // Prove the backstop fires, rather than leaving a comment that claims it would.
  // Here the adapter is handed an inventory that does NOT include the binding
  // table, which is what a caller wiring a separate mappings source would do.
  // The adapter then sees no conflict and approves; only the binder can refuse.
  const { store } = await fixture(t);
  const order = store.create(orderInput());
  const blindAdapter = { linkOrder: async (mapping) => ({ status: 'LINK_PREPARED', persisted: false, mapping }) };
  const blindBind = createOrderWorkBinder({ store, adapter: blindAdapter });

  assert.equal((await blindBind(good(order))).persisted, true);
  const conflict = await blindBind({ ...good(order), work_id: 'OTHER-002' });
  assert.equal(conflict.reason, 'BINDING_CONFLICT');
  assert.equal(conflict.persisted, false);
  assert.equal(readOrderMappingInventory(store.db)[0].work_id, WORK);
});

test('★the caller cannot name the order revision it binds at', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  // Supplying revision/version is refused outright: a caller that could name them
  // could bind an order to a revision it is not actually at.
  await assert.rejects(() => bind({ ...good(order), requirement_revision: 99 }), /REQUEST_FIELDS_INVALID/);
  assert.equal(hasBindingTable(store.db), false);
});

test('a written binding cannot be updated or deleted', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  await bind(good(order));
  assert.throws(() => store.db.prepare("UPDATE coordination_bindings SET work_id='X'").run(), /BINDING_IMMUTABLE/);
  assert.throws(() => store.db.prepare('DELETE FROM coordination_bindings').run(), /BINDING_IMMUTABLE/);
});

test('a link-created binding records no command and no event', async (t) => {
  const { store, bind } = await fixture(t);
  const order = store.create(orderInput());
  await bind(good(order));
  const row = store.db.prepare('SELECT command_id, event_id FROM coordination_bindings').get();
  // Inventing ids here would make a link look like a command that was never sent.
  assert.equal(row.command_id, null);
  assert.equal(row.event_id, null);
});

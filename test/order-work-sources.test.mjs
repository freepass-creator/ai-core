// Proves the server's `readWorkProjection` socket is actually filled, and that
// what comes out is HONEST: a missing source must never be reported as an
// absence of linkage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';
import { createWorkProjectionProvider, resolveWorkSourcePaths, defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';

const SUBJECT = createHash('sha1').update('order-work-sources-fixture').digest('hex');
const PROJECT = 'demo-project';
const WORK = 'DEMO-001';

const orderInput = () => ({
  requestId: randomUUID(), title: '원천 배선 확인', intent: '실제 오더 한 건으로 투영을 읽는다.',
  project: 'ai-core', kind: 'general', criteria: ['정직한 상태를 돌려준다.'],
});

const registry = () => ({
  schema_version: '1.0', observed_at: '2026-09-16T00:00:00Z',
  projects: [{
    project_id: PROJECT, name: 'Demo', organization: 'HEADQUARTERS', status: 'ACTIVE',
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
    sources: [{
      ref: 'demo-org/demo-project', revision: SUBJECT, observed_at: '2026-09-15T23:00:00Z',
      valid_until: '2026-09-20T00:00:00Z', status: 'CURRENT', severity: 'ADVISORY',
    }],
    commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] },
    allocations: [], authorization: { required: true, status: 'PENDING' },
    subject_revision: SUBJECT, evidence_receipts: [],
    verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED',
  }],
});

async function fixtureRoot(t, { omit = [], mappingsFor = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-core-sources-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const paths = {
    registry: join(root, 'registry.json'), snapshot: join(root, 'snapshot.json'),
    mappings: join(root, 'mappings.json'), ledger: join(root, 'work.jsonl'),
  };
  if (!omit.includes('registry')) writeFileSync(paths.registry, JSON.stringify(registry()));
  if (!omit.includes('snapshot')) writeFileSync(paths.snapshot, JSON.stringify(snapshot()));
  if (!omit.includes('mappings')) writeFileSync(paths.mappings, JSON.stringify(mappingsFor ?? []));
  if (!omit.includes('ledger')) {
    await appendLedgerEvent(paths.ledger, {
      event_id: 'SRCEVENT-001', work_id: WORK, project_id: PROJECT, type: 'CREATED',
      from_state: null, to_state: 'RECEIVED', actor: 'TEST', subject_revision: SUBJECT,
      observed_at: '2026-09-15T23:30:00Z', evidence_refs: [],
    }, null);
  }
  return { root, paths, workSources: paths };
}

async function serve(t, workSources) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-srv-'));
  const fixture = await startServer({ dbPath: join(dir, 'orders.sqlite'), port: 0, standalone: true, workSources });
  t.after(async () => {
    fixture.server.closeAllConnections();
    await new Promise(done => fixture.server.close(done));
    rmSync(dir, { recursive: true, force: true });
  });
  return fixture;
}

const readWork = (url, id) => fetch(`${url}/api/orders/${id}/work`).then(r => r.json());

test('an unconfigured server keeps answering exactly as before', async (t) => {
  const { url, store } = await serve(t, null);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE');
});

test('★a missing mapping inventory is HOLD, never UNLINKED', async (t) => {
  // The whole point. The adapter answers UNLINKED when the inventory it is given
  // has no row for the order. If an absent file were read as [], every order would
  // be reported UNLINKED — a confident answer manufactured by missing data.
  const { workSources } = await fixtureRoot(t, { omit: ['mappings'] });
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.reason, 'WORK_SOURCE_MISSING_MAPPINGS');
  assert.equal(result.status, 'HOLD');
  assert.equal(result.execution_authorized, false);
});

test('each absent source names itself instead of one blanket reason', async (t) => {
  for (const key of ['registry', 'snapshot', 'ledger']) {
    const { workSources } = await fixtureRoot(t, { omit: [key] });
    const { url, store } = await serve(t, workSources);
    const order = store.create(orderInput());
    assert.equal((await readWork(url, order.id)).reason, `WORK_SOURCE_MISSING_${key.toUpperCase()}`);
  }
});

test('an unreadable source is distinguished from an absent one', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  writeFileSync(paths.mappings, '{ not json');
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNREADABLE_MAPPINGS');
});

test('a mapping inventory that is present but not a list is refused, not coerced', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  writeFileSync(paths.mappings, JSON.stringify({ rows: [] }));
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNREADABLE_MAPPINGS');
});

test('a partially configured policy names the unconfigured key', async (t) => {
  // Not `ledger`: that one has a settled convention and is filled from the order
  // DB's directory. The sources with no canonical home must still be named.
  const { workSources } = await fixtureRoot(t);
  const partial = { ...workSources };
  delete partial.snapshot;
  const { url, store } = await serve(t, partial);
  const order = store.create(orderInput());
  assert.equal((await readWork(url, order.id)).reason, 'WORK_SOURCE_UNCONFIGURED_SNAPSHOT');
});

test('a complete inventory with no row for this order is honestly UNLINKED', async (t) => {
  const { workSources } = await fixtureRoot(t, { mappingsFor: [] });
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'UNLINKED');
  assert.equal(result.execution_authorized, false);
});

test('★a real order with a real mapping reads LINKED through the real server', async (t) => {
  const { workSources, paths } = await fixtureRoot(t);
  const { url, store } = await serve(t, workSources);
  const order = store.create(orderInput());
  writeFileSync(paths.mappings, JSON.stringify([{
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  }]));
  const result = await readWork(url, order.id);
  assert.equal(result.status, 'LINKED');
  assert.equal(result.canonical_state, 'RECEIVED');
  assert.equal(result.mapping.work_id, WORK);
  // Read-only means read-only: reading never grants anything.
  assert.equal(result.execution_authorized, false);
  assert.equal(result.completion_authorized, false);
  assert.equal(result.sent, false);
});

test('resolveWorkSourcePaths reports the first unconfigured key and never invents one', () => {
  assert.equal(resolveWorkSourcePaths(null), null);
  assert.equal(resolveWorkSourcePaths({ registry: 'a.json' }).missing, 'snapshot');
  assert.equal(createWorkProjectionProvider({ store: {}, workSources: null }), null);
});

test('★the operating ledger defaults to the order store’s own directory', async (t) => {
  const { workSources, paths, root } = await fixtureRoot(t);
  const withoutLedger = { ...workSources };
  delete withoutLedger.ledger;

  // Configured without a ledger, but told where the order DB is: the convention
  // fills it in, and the resolved path sits beside that DB — never somewhere else.
  const dbPath = join(root, 'nested', 'orders.sqlite');
  const resolved = resolveWorkSourcePaths(withoutLedger, { ordersDbPath: dbPath });
  assert.equal(resolved.paths.ledger, join(root, 'nested', 'work-ledger.jsonl'));
  assert.equal(defaultWorkLedgerPath(dbPath), resolved.paths.ledger);

  // With no order DB to anchor to, it stays unconfigured rather than guessing.
  assert.equal(resolveWorkSourcePaths(withoutLedger).missing, 'ledger');

  // An explicitly configured ledger still wins over the convention.
  assert.equal(resolveWorkSourcePaths(workSources, { ordersDbPath: dbPath }).paths.ledger, paths.ledger);
});

test('a server given no ledger path reads the one beside its own database', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-srv-'));
  const { workSources, paths } = await fixtureRoot(t);
  const withoutLedger = { ...workSources };
  delete withoutLedger.ledger;

  const dbPath = join(dir, 'orders.sqlite');
  copyFileSync(paths.ledger, join(dir, 'work-ledger.jsonl'));
  const boot = await startServer({ dbPath, port: 0, standalone: true, workSources: withoutLedger });
  t.after(async () => {
    boot.server.closeAllConnections();
    await new Promise(done => boot.server.close(done));
    rmSync(dir, { recursive: true, force: true });
  });

  const order = boot.store.create(orderInput());
  writeFileSync(paths.mappings, JSON.stringify([{
    order_id: order.id, requirement_revision: order.revision, record_version: order.version,
    work_id: WORK, project_id: PROJECT, subject_revision: SUBJECT,
  }]));
  const result = await readWork(boot.url, order.id);
  assert.equal(result.status, 'LINKED');
  assert.equal(result.canonical_state, 'RECEIVED');
});

const BINDING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS coordination_bindings (
    order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL, work_id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL, subject_revision TEXT NOT NULL, requirement_digest TEXT NOT NULL,
    created_record_version INTEGER NOT NULL, command_id TEXT UNIQUE NOT NULL, event_id TEXT UNIQUE NOT NULL,
    PRIMARY KEY(order_id,requirement_revision));`;

test('★with no mapping table at all the server says MISSING, not UNLINKED', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());
  const result = await readWork(url, order.id);
  // Nothing has ever produced a binding in this deployment. "I do not know" is
  // the only honest answer; UNLINKED would be a conclusion drawn from no data.
  assert.equal(result.reason, 'WORK_SOURCE_MISSING_MAPPINGS');
  assert.equal(result.status, 'HOLD');
});

test('★a binding in the order database reaches LINKED with no mappings path configured', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());

  store.db.exec(BINDING_SCHEMA);
  store.db.prepare('INSERT INTO coordination_bindings VALUES (?,?,?,?,?,?,?,?,?)')
    .run(order.id, order.revision, WORK, PROJECT, SUBJECT, 'digest', order.version, 'CMD-1', 'EVENT-001');

  const result = await readWork(url, order.id);
  assert.equal(result.status, 'LINKED', JSON.stringify(result));
  assert.equal(result.mapping.work_id, WORK);
  assert.equal(result.execution_authorized, false);
});

test('an empty binding table is honestly UNLINKED, unlike an absent one', async (t) => {
  const { workSources } = await fixtureRoot(t);
  const byConvention = { ...workSources };
  delete byConvention.mappings;
  const { url, store } = await serve(t, byConvention);
  const order = store.create(orderInput());
  store.db.exec(BINDING_SCHEMA);
  assert.equal((await readWork(url, order.id)).status, 'UNLINKED');
});

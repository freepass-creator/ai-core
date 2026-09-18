import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrderStore } from '../src/orders/store.mjs';
import { openOperatingOrderWorkSubmitter } from '../src/integration/operating-order-work-submitter.mjs';

test('운영 durable submitter는 기본 OFF다', async () => {
  const result = await openOperatingOrderWorkSubmitter({});
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'OPERATING_SUBMITTER_DISABLED');
  assert.equal(result.enabled, false);
});

test('명시 enable+initialize 때만 canonical ledger 옆에 durable outbox를 만든다', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-operating-outbox-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dbPath = join(root, 'orders.sqlite');
  const store = new OrderStore(dbPath);
  t.after(() => { try { store.close(); } catch {} });

  const registryPath = join(root, 'projects.json');
  const snapshotPath = join(root, 'snapshot.json');
  await writeFile(registryPath, JSON.stringify({ schema_version:'1.0', observed_at:new Date().toISOString(), projects:[] }));
  await writeFile(snapshotPath, JSON.stringify({ schema_version:'1.0', as_of:new Date().toISOString(), items:[] }));

  const result = await openOperatingOrderWorkSubmitter({
    store,
    ordersDbPath: dbPath,
    workSources: { registry: registryPath, snapshot: snapshotPath },
    enabled: true,
    initialize: true,
  });
  t.after(() => result.close());
  assert.equal(result.status, 'READY');
  assert.equal(result.enabled, true);
  assert.equal(result.ledgerPath, join(root, 'work-ledger.jsonl'));
  assert.equal(result.dbPath, join(root, 'submission.sqlite'));
});

test('새 운영 root를 단순히 지정하는 것만으로는 outbox를 초기화하지 않는다', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-operating-outbox-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dbPath = join(root, 'orders.sqlite');
  const store = new OrderStore(dbPath);
  t.after(() => { try { store.close(); } catch {} });
  const registryPath = join(root, 'projects.json');
  const snapshotPath = join(root, 'snapshot.json');
  await writeFile(registryPath, JSON.stringify({ schema_version:'1.0', observed_at:new Date().toISOString(), projects:[] }));
  await writeFile(snapshotPath, JSON.stringify({ schema_version:'1.0', as_of:new Date().toISOString(), items:[] }));

  await assert.rejects(() => openOperatingOrderWorkSubmitter({
    store, ordersDbPath:dbPath, workSources:{registry:registryPath,snapshot:snapshotPath},
    enabled:true, initialize:false,
  }), /OPERATING_OUTBOX_INITIALIZATION_REQUIRED/);
});

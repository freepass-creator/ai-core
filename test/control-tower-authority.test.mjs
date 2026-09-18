import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';
import { createControlTowerAuthorityBridge } from '../src/engine/control-tower-authority.mjs';

const registry = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url), 'utf8'));
const baseSnapshot = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url), 'utf8'));
const orderId = 'ORD-00000000-0000-4000-8000-000000000777';

async function fixture() {
  const snapshot = structuredClone(baseSnapshot);
  snapshot.as_of = '2026-09-15T01:00:00Z';
  const item = snapshot.items[0];
  item.authorization = {
    required: true,
    status: 'GRANTED',
    action: 'develop',
    target: 'ai-core',
    revision: item.subject_revision,
    scope: ['read', 'build', 'test'],
    authorized_by: 'DIR-ai-core/대표@DIRAPPROVAL-777',
    authorized_at: '2026-09-15T00:00:00Z',
    expires_at: '2026-09-16T00:00:00Z',
  };
  const root = await mkdtemp(join(tmpdir(), 'authority-'));
  const ledgerPath = join(root, 'work.jsonl');
  const base = {
    work_id: item.id, project_id: item.project_id, actor: 'TEST',
    subject_revision: item.subject_revision, observed_at: '2026-09-15T00:30:00Z',
    evidence_refs: ['RECEIVED:test authority'],
  };
  let result = await appendLedgerEvent(ledgerPath, { ...base, event_id: 'AUTH-EVENT-001', type: 'CREATED', from_state: null, to_state: 'RECEIVED' }, null);
  for (const [i, [from_state, to_state]] of [['RECEIVED','PLANNED'],['PLANNED','IN_PROGRESS'],['IN_PROGRESS','VERIFYING'],['VERIFYING','READY']].entries()) {
    result = await appendLedgerEvent(ledgerPath, { ...base, event_id: `AUTH-EVENT-00${i + 2}`, type: 'TRANSITIONED', from_state, to_state }, result.head);
  }
  const ledgerText = await readFile(ledgerPath, 'utf8');
  const mapping = {
    order_id: orderId, requirement_revision: 1, record_version: 1,
    work_id: item.id, project_id: item.project_id, subject_revision: item.subject_revision,
  };
  const context = {
    order: { id: orderId, revision: 1, version: 1 },
    mappings: [mapping], registry, snapshot, ledgerText,
  };
  const plan = {
    order_id: orderId, work_id: item.id, project_id: item.project_id,
    subject_revision: item.subject_revision, capability_id: 'test.external',
  };
  const capability = { id: 'test.external', required_scopes: ['read', 'build'] };
  return { context, plan, capability };
}

const bridgeFor = f => createControlTowerAuthorityBridge({
  readContext: async () => structuredClone(f.context),
  verifyLedgerText,
  runControlTower,
  clock: () => Date.parse('2026-09-15T01:00:00Z'),
});

test('실제 Control Tower READY 상태에서만 canonical authority receipt를 발급하고 검증한다', async () => {
  const f = await fixture();
  const bridge = bridgeFor(f);
  const receipt = await bridge.issue({ plan: f.plan, capability: f.capability });
  assert.equal(receipt.schema, 'ai-core-authority-receipt/v1');
  assert.equal(receipt.status, 'GRANTED');
  assert.equal(receipt.order_id, orderId);
  assert.equal(receipt.work_id, f.plan.work_id);
  assert.deepEqual(receipt.scopes, ['read', 'build']);
  assert.equal(await bridge.verify({ authority: receipt, plan: f.plan, capability: f.capability }), true);
});

test('stale ledger head receipt는 검증 시 즉시 무효다', async () => {
  const f = await fixture();
  const bridge = bridgeFor(f);
  const receipt = await bridge.issue({ plan: f.plan, capability: f.capability });
  assert.equal(await bridge.verify({ authority: { ...receipt, ledger_head: 'stale' }, plan: f.plan, capability: f.capability }), false);
});

test('canonical authorization에 없는 scope를 요구하면 receipt 자체를 발급하지 않는다', async () => {
  const f = await fixture();
  const bridge = bridgeFor(f);
  const capability = { ...f.capability, required_scopes: ['read', 'delete-anything'] };
  const receipt = await bridge.issue({ plan: f.plan, capability });
  assert.equal(receipt.status, 'HOLD');
  assert.equal(receipt.reason, 'CANONICAL_AUTHORITY_SCOPE_MISSING');
});

test('Control Tower execute가 HOLD면 receipt를 만들지 않는다', async () => {
  const f = await fixture();
  f.context.snapshot.items[0].commitment.accepted = false;
  const bridge = bridgeFor(f);
  const receipt = await bridge.issue({ plan: f.plan, capability: f.capability });
  assert.equal(receipt.status, 'HOLD');
  assert.equal(receipt.reason, 'COMMITMENT_NOT_ACTIVE');
});

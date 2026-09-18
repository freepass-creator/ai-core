import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';
import { createControlTowerAuthorityVerifier } from '../src/engine/control-tower-authority.mjs';

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
  const authority = {
    status: 'GRANTED', order_id: orderId, work_id: item.id, project_id: item.project_id,
    capability_id: capability.id, subject_revision: item.subject_revision,
    ledger_head: result.head, scopes: ['read', 'build'],
  };
  return { context, plan, capability, authority };
}

test('실제 Control Tower가 execute READY이고 scope/head/revision이 모두 맞을 때만 승인한다', async () => {
  const f = await fixture();
  const verifier = createControlTowerAuthorityVerifier({
    readContext: async () => structuredClone(f.context),
    verifyLedgerText,
    runControlTower,
  });
  assert.equal(await verifier({ authority: f.authority, plan: f.plan, capability: f.capability }), true);
});

test('stale ledger head receipt는 승인하지 않는다', async () => {
  const f = await fixture();
  const verifier = createControlTowerAuthorityVerifier({
    readContext: async () => structuredClone(f.context),
    verifyLedgerText,
    runControlTower,
  });
  assert.equal(await verifier({ authority: { ...f.authority, ledger_head: 'stale' }, plan: f.plan, capability: f.capability }), false);
});

test('receipt scope가 canonical authorization보다 넓으면 승인하지 않는다', async () => {
  const f = await fixture();
  const verifier = createControlTowerAuthorityVerifier({
    readContext: async () => structuredClone(f.context),
    verifyLedgerText,
    runControlTower,
  });
  const capability = { ...f.capability, required_scopes: ['read', 'delete-anything'] };
  const authority = { ...f.authority, scopes: ['read', 'delete-anything'] };
  assert.equal(await verifier({ authority, plan: f.plan, capability }), false);
});

test('Control Tower execute가 HOLD면 receipt 모양이 맞아도 승인하지 않는다', async () => {
  const f = await fixture();
  f.context.snapshot.items[0].commitment.status = 'PENDING';
  const verifier = createControlTowerAuthorityVerifier({
    readContext: async () => structuredClone(f.context),
    verifyLedgerText,
    runControlTower,
  });
  assert.equal(await verifier({ authority: f.authority, plan: f.plan, capability: f.capability }), false);
});

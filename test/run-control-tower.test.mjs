import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { appendLedgerEvent } from '../scripts/work-ledger.mjs';
import { runControlTower } from '../scripts/run-control-tower.mjs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const registry = JSON.parse(await readFile(new URL('../examples/project-registry.json', import.meta.url)));
const snapshot = JSON.parse(await readFile(new URL('../examples/control-tower.json', import.meta.url)));
const clone = (value) => structuredClone(value);
const created = { event_id: 'EVENT-001', work_id: 'DEV-001', project_id: 'ai-core', type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'CODEX', subject_revision: null, observed_at: '2026-09-15T00:41:00Z', evidence_refs: [] };

async function readyLedger(revision = snapshot.items[0].subject_revision) {
  const root = await mkdtemp(join(tmpdir(), 'control-run-'));
  const path = join(root, 'ledger.jsonl');
  let result = await appendLedgerEvent(path, created, null);
  for (const [index, [from_state, to_state]] of [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']].entries()) {
    result = await appendLedgerEvent(path, { ...created, event_id: `EVENT-00${index + 2}`, type: 'TRANSITIONED', from_state, to_state, subject_revision: revision }, result.head);
  }
  return readFile(path, 'utf8');
}

test('aligned registry snapshot and ready ledger enable execution without granting authority', async () => {
  const result = runControlTower({ registry, snapshot, ledgerText: await readyLedger() });
  assert.equal(result.status, 'READY');
  assert.equal(result.execution_authorized, false);
  assert.deepEqual(result.items[0].execute, { enabled: true, reasons: [] });
});

test('missing ledger work holds execution', () => {
  const result = runControlTower({ registry, snapshot, ledgerText: '' });
  assert.ok(result.items[0].execute.reasons.includes('WORK_NOT_REGISTERED'));
});

test('READY ledger without a subject SHA holds execution', async () => {
  const result = runControlTower({ registry, snapshot, ledgerText: await readyLedger(null) });
  assert.equal(result.status, 'HOLD');
  assert.equal(result.items[0].execute.enabled, false);
  assert.ok(result.items[0].execute.reasons.includes('WORK_REVISION_REQUIRED'));
});

test('READY ledger with a different subject SHA holds execution', async () => {
  const result = runControlTower({ registry, snapshot, ledgerText: await readyLedger('a'.repeat(40)) });
  assert.equal(result.items[0].execute.enabled, false);
  assert.ok(result.items[0].execute.reasons.includes('WORK_REVISION_STALE'));
});

test('project revision drift holds execution', async () => {
  const input = clone(registry);
  input.projects[0].head_revision = 'a'.repeat(40);
  input.projects[0].authoritative_sources[0].revision = 'a'.repeat(40);
  const result = runControlTower({ registry: input, snapshot, ledgerText: await readyLedger() });
  assert.ok(result.items[0].execute.reasons.includes('PROJECT_REVISION_STALE'));
});

test('invalid ledger invalidates the complete decision', () => {
  const result = runControlTower({ registry, snapshot, ledgerText: '{bad json}\n' });
  assert.equal(result.status, 'INVALID');
  assert.equal(result.execution_authorized, false);
});

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
snapshot.as_of = '2026-09-15T01:00:00Z';
const clone = (value) => structuredClone(value);
const created = { event_id: 'EVENT-001', work_id: 'DEV-001', project_id: 'ai-core', type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'CODEX', subject_revision: null, observed_at: '2026-09-15T00:41:00Z', evidence_refs: [] };

async function readyLedger(revision = snapshot.items[0].subject_revision) {
  const root = await mkdtemp(join(tmpdir(), 'control-run-'));
  const path = join(root, 'ledger.jsonl');
  let result = await appendLedgerEvent(path, created, null);
  let next = 2;
  if (revision) {
    result = await appendLedgerEvent(path, {
      ...created, event_id: 'EVENT-002', type: 'REOBSERVED',
      from_state: 'RECEIVED', to_state: 'RECEIVED', subject_revision: revision,
      evidence_refs: ['MEASURED:fixture revision bound @test'],
    }, result.head);
    next = 3;
  }
  for (const [index, [from_state, to_state]] of [['RECEIVED', 'PLANNED'], ['PLANNED', 'IN_PROGRESS'], ['IN_PROGRESS', 'VERIFYING'], ['VERIFYING', 'READY']].entries()) {
    result = await appendLedgerEvent(path, { ...created, event_id: `EVENT-00${index + next}`, type: 'TRANSITIONED', from_state, to_state, subject_revision: revision }, result.head);
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

test('future target observations hold both actions; equal as_of is valid', async () => {
  const ledgerText = await readyLedger();
  const input = clone(snapshot); input.as_of = '2026-09-15T00:40:59Z';
  const result = runControlTower({ registry, snapshot: input, ledgerText });
  assert.ok(result.items[0].execute.reasons.includes('WORK_OBSERVED_AFTER_AS_OF'));
  assert.ok(result.items[0].close.reasons.includes('WORK_OBSERVED_AFTER_AS_OF'));
  input.as_of = created.observed_at;
  assert.equal(runControlTower({ registry, snapshot: input, ledgerText }).status, 'READY');
});

test('delayed observations follow chain order; unrelated future work does not block target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'control-time-'));
  const path = join(root, 'ledger.jsonl');
  const { writeFile } = await import('node:fs/promises');
  const { verifyLedgerText } = await import('../scripts/work-ledger.mjs');
  await writeFile(path, await readyLedger());
  let head = verifyLedgerText(await readFile(path, 'utf8')).head;
  for (const [index, from_state, to_state] of [[7, 'READY', 'BLOCKED'], [8, 'BLOCKED', 'READY']]) {
    head = (await appendLedgerEvent(path, { ...created, event_id: `EVENT-00${index}`, type: 'TRANSITIONED', from_state, to_state,
      subject_revision: snapshot.items[0].subject_revision, observed_at: '2026-09-15T00:30:00Z' }, head)).head;
  }
  await appendLedgerEvent(path, { ...created, event_id: 'EVENT-009', work_id: 'OTHER-001', observed_at: '2026-09-16T00:00:00Z' }, head);
  assert.equal(runControlTower({ registry, snapshot, ledgerText: await readFile(path, 'utf8') }).status, 'READY');
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

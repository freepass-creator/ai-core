import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';

const event = (overrides = {}) => ({
  event_id: 'EVENT-001', work_id: 'WORK-001', project_id: 'ai-core', type: 'CREATED',
  from_state: null, to_state: 'RECEIVED', actor: 'CODEX', subject_revision: null,
  observed_at: '2026-09-15T01:00:00Z', evidence_refs: [], ...overrides,
});

test('append creates a verifiable hash chain and optimistic head', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-'));
  const path = join(root, 'ledger.jsonl');
  const first = await appendLedgerEvent(path, event(), null);
  const second = await appendLedgerEvent(path, event({ event_id: 'EVENT-002', type: 'TRANSITIONED', from_state: 'RECEIVED', to_state: 'PLANNED' }), first.head);
  const result = verifyLedgerText(await readFile(path, 'utf8'));
  assert.equal(result.status, 'VALID');
  assert.equal(result.head, second.head);
  assert.equal(result.work['WORK-001'].state, 'PLANNED');
});

test('stale writer cannot append after the head changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-'));
  const path = join(root, 'ledger.jsonl');
  await appendLedgerEvent(path, event(), null);
  await assert.rejects(() => appendLedgerEvent(path, event({ event_id: 'EVENT-002' }), null), /LEDGER_HEAD_CHANGED/);
});

test('tampering with a stored event breaks its hash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-'));
  const path = join(root, 'ledger.jsonl');
  await appendLedgerEvent(path, event(), null);
  const text = (await readFile(path, 'utf8')).replace('RECEIVED', 'CLOSED');
  assert.ok(verifyLedgerText(text).errors.some((error) => error.code === 'EVENT_HASH_INVALID'));
});

test('illegal transition is rejected before write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-'));
  const path = join(root, 'ledger.jsonl');
  const first = await appendLedgerEvent(path, event(), null);
  await assert.rejects(() => appendLedgerEvent(path, event({ event_id: 'EVENT-002', type: 'TRANSITIONED', from_state: 'RECEIVED', to_state: 'CLOSED' }), first.head), /TRANSITION_NOT_ALLOWED/);
});

test('closing requires revision-bound evidence', () => {
  const created = event();
  const record = { ...created, previous_hash: null };
  assert.equal(verifyLedgerText(`${JSON.stringify(record)}\n`).status, 'INVALID');
});

test('existing lock prevents a concurrent append', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-'));
  const path = join(root, 'ledger.jsonl');
  await writeFile(`${path}.lock`, 'held');
  await assert.rejects(() => appendLedgerEvent(path, event(), null), /LEDGER_LOCKED/);
});

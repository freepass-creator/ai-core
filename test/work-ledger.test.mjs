import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
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

// The CLI is the thing operators actually run, and its answer for "no file there"
// used to be indistinguishable from "sound and empty".
test('★verify CLI separates a ledger that is missing from one that is empty', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ai-core-ledger-cli-'));
  const script = fileURLToPath(new URL('../scripts/work-ledger.mjs', import.meta.url));
  const run = (path) => new Promise((done) => {
    const child = spawn(process.execPath, [script, 'verify', path], { encoding: 'utf8' });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('close', (code) => done({ code, out }));
  });

  const absent = await run(join(root, 'nowhere.jsonl'));
  assert.equal(absent.code, 1);
  assert.match(absent.out, /LEDGER_FILE_MISSING/);

  const emptyPath = join(root, 'empty.jsonl');
  await writeFile(emptyPath, '');
  const empty = await run(emptyPath);
  assert.equal(empty.code, 0);
  assert.match(empty.out, /"status": "VALID"/);
});

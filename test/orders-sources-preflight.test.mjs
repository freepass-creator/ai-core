import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectWorkSources } from '../scripts/orders-sources-preflight.mjs';

const state = (report, key) => report.sources.find(source => source.key === key).state;

function root(t) {
  const dir = mkdtempSync(join(tmpdir(), 'ai-core-preflight-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// The repository's own canonical registry, so the happy path is proved against a
// real file rather than only against fixtures.
const realSources = (dir, overrides = {}) => ({
  registry: 'registry/projects.json',
  snapshot: 'examples/control-tower.json',
  ledger: 'examples/work-ledger.jsonl',
  mappings: join(dir, 'mappings.json'),
  ...overrides,
});

test('no workSources block at all is UNCONFIGURED, not READY', async () => {
  const report = await inspectWorkSources(null);
  assert.equal(report.status, 'UNCONFIGURED');
  assert.deepEqual(report.sources, []);
});

test('a partially configured block names every key that is still unset', async () => {
  const report = await inspectWorkSources({ registry: 'registry/projects.json' });
  assert.equal(report.status, 'UNCONFIGURED');
  assert.equal(state(report, 'registry'), 'OK');
  for (const key of ['snapshot', 'mappings', 'ledger']) assert.equal(state(report, key), 'UNCONFIGURED');
});

test('every source present and valid reads READY', async (t) => {
  const dir = root(t);
  writeFileSync(join(dir, 'mappings.json'), '[]');
  const report = await inspectWorkSources(realSources(dir));
  assert.equal(report.status, 'READY', JSON.stringify(report.sources));
  for (const key of ['registry', 'snapshot', 'mappings', 'ledger']) assert.equal(state(report, key), 'OK');
});

test('★an absent source and an invalid one are different states', async (t) => {
  const dir = root(t);
  // Absent: the file is not there at all.
  const absent = await inspectWorkSources(realSources(dir));
  assert.equal(state(absent, 'mappings'), 'MISSING');

  // Present but wrong: something IS there, and it is not usable.
  writeFileSync(join(dir, 'mappings.json'), JSON.stringify({ rows: [] }));
  const invalid = await inspectWorkSources(realSources(dir));
  assert.equal(state(invalid, 'mappings'), 'INVALID');

  // Collapsing these two would hide "nobody has produced this yet" inside
  // "someone produced it badly", which are different jobs for different people.
  assert.notEqual(state(absent, 'mappings'), state(invalid, 'mappings'));
  assert.equal(absent.status, 'HOLD');
  assert.equal(invalid.status, 'HOLD');
});

test('a mapping row missing an adapter field is refused', async (t) => {
  const dir = root(t);
  writeFileSync(join(dir, 'mappings.json'), JSON.stringify([{ order_id: 'ORD-1', work_id: 'DEV-001' }]));
  const report = await inspectWorkSources(realSources(dir));
  assert.equal(state(report, 'mappings'), 'INVALID');
  assert.match(report.sources.find(s => s.key === 'mappings').detail, /row 0/);
});

test('a broken ledger chain is reported by the real verifier, not by a guess', async (t) => {
  const dir = root(t);
  writeFileSync(join(dir, 'mappings.json'), '[]');
  writeFileSync(join(dir, 'work.jsonl'), '{"event_id":"E-001"}\n');
  const report = await inspectWorkSources(realSources(dir, { ledger: join(dir, 'work.jsonl') }));
  assert.equal(state(report, 'ledger'), 'INVALID');
  assert.equal(report.status, 'HOLD');
});

test('unparseable JSON is UNREADABLE rather than INVALID', async (t) => {
  const dir = root(t);
  writeFileSync(join(dir, 'mappings.json'), '{ not json');
  const report = await inspectWorkSources(realSources(dir));
  assert.equal(state(report, 'mappings'), 'UNREADABLE');
});

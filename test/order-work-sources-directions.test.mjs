import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkSourceContextProvider } from '../src/integration/order-work-sources.mjs';

function fixture(t, { malformedDirections = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'ai-core-directions-source-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const workSources = {
    registry: join(root, 'projects.json'),
    snapshot: join(root, 'snapshot.json'),
    mappings: join(root, 'mappings.json'),
    ledger: join(root, 'work.jsonl'),
  };
  writeFileSync(workSources.registry, JSON.stringify({ projects: [] }));
  writeFileSync(workSources.snapshot, JSON.stringify({
    schema_version: '1.0', as_of: '2026-09-23T00:00:00Z', capacities: [], items: [],
  }));
  writeFileSync(workSources.mappings, '[]');
  writeFileSync(workSources.ledger, '');
  if (malformedDirections) writeFileSync(join(root, 'directions.json'), '{ not json');

  const order = { id: 'ORDER-1', version: 1, revision: 1 };
  const store = { get: () => order };
  return createWorkSourceContextProvider({ store, workSources });
}

test('an unreadable directions file beside the configured registry fails closed', async (t) => {
  const readContext = fixture(t, { malformedDirections: true });
  await assert.rejects(
    () => readContext('ORDER-1'),
    /WORK_SOURCE_UNREADABLE_DIRECTIONS/,
  );
});

test('an absent registry-adjacent directions file still means no directions', async (t) => {
  const readContext = fixture(t);
  const context = await readContext('ORDER-1');
  assert.deepEqual(context.snapshot.items, []);
});

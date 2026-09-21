import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRuntimeSetCatalog, selectRuntimeSet } from '../src/engine/runtime-set-catalog.mjs';

const catalog = JSON.parse(await readFile(new URL('../registry/runtime-sets.candidate.json', import.meta.url), 'utf8'));

test('catalog validates permanent component IDs and required run sets', () => {
  assert.deepEqual(validateRuntimeSetCatalog(catalog), {
    status: 'VALID',
    component_count: 16,
    runtime_set_count: 4,
  });
});

test('spoken UI and runtime selection preserves both IDs without granting authority', () => {
  const selected = selectRuntimeSet(catalog, 'UI SET-01 + 실행세트 RUN-01');
  assert.equal(selected.status, 'HOLD');
  assert.equal(selected.ui_set_id, 'SET-01');
  assert.equal(selected.runtime_set_id, 'RUN-01');
  assert.equal(selected.execution_authorized, false);
  assert.equal(selected.deployment_authorized, false);
  assert.ok(selected.component_ids.includes('E-WORKFLOW-001'));
  assert.ok(selected.component_ids.includes('A-FIRESTORE-PATH-001'));
  assert.ok(selected.component_ids.includes('R-FIRESTORE-001'));
  assert.ok(selected.component_ids.includes('X-GITHUB-WORK-EVIDENCE-001'));
});

test('unknown, absent and ambiguous runtime selection fails closed', () => {
  assert.throws(() => selectRuntimeSet(catalog, 'SET-01만'), /RUNTIME_SELECTION_NOT_FOUND/);
  assert.throws(() => selectRuntimeSet(catalog, 'RUN-99'), /RUNTIME_SET_NOT_FOUND/);
  assert.throws(() => selectRuntimeSet(catalog, 'RUN-01 또는 RUN-02'), /RUNTIME_SELECTION_AMBIGUOUS/);
});

test('catalog rejects forbidden retired database components', () => {
  const invalid = structuredClone(catalog);
  invalid.components[0].implementation = 'Realtime Database fallback';
  assert.throws(() => validateRuntimeSetCatalog(invalid), /RTDB_COMPONENT_FORBIDDEN/);
});

test('file adapters remain local shadow HOLD', () => {
  const invalid = structuredClone(catalog);
  invalid.components.find(item => item.id === 'A-FILE-APPLICATION-001').decision = 'ADOPTED';
  assert.throws(() => validateRuntimeSetCatalog(invalid), /RUNTIME_LOCAL_SHADOW_MUST_HOLD/);
});

test('RUN-01 cannot lose the recommended workflow, Firestore and GitHub boundary', () => {
  const invalid = structuredClone(catalog);
  invalid.runtime_sets.find(item => item.id === 'RUN-01').component_ids = ['E-CAPABILITY-001'];
  assert.throws(() => validateRuntimeSetCatalog(invalid), /RUN_01_DEFAULT_COMPONENT_REQUIRED/);
});

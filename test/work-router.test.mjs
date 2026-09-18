import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeWork, validateWorkMap } from '../src/routing/work-router.mjs';

const workMap = JSON.parse(readFileSync(new URL('../registry/work-map.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(readFileSync(new URL('../registry/projects.json', import.meta.url), 'utf8'));
const capabilityRegistry = JSON.parse(readFileSync(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const fixtures = JSON.parse(readFileSync(new URL('../registry/work-routing-fixtures.json', import.meta.url), 'utf8')).fixtures;

test('OPS-P0 work map is schema-valid and points only to registered projects', () => {
  assert.deepEqual(validateWorkMap(workMap, projectRegistry, capabilityRegistry), { status: 'VALID', errors: [] });
  assert.ok(workMap.work_types.length >= 20);
});

test('natural-language fixtures resolve to the expected work type and current project gate', async (t) => {
  for (const fixture of fixtures) {
    await t.test(fixture.query, () => {
      const result = routeWork(fixture.query, { workMap, projectRegistry, capabilityRegistry });
      assert.equal(result.work_type_id, fixture.expected_work_type_id);
      assert.equal(result.status, fixture.expected_status);
      assert.ok(result.target_project_id);
    });
  }
});

test('unknown work stays fail-closed', () => {
  const result = routeWork('달에서 감자 키우는 업무 시작해', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.reason, 'NO_WORK_TYPE_MATCH');
});

test('HOLD projects and capabilities never become executable routes', () => {
  const result = routeWork('보고서 만들어', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(result.work_type_id, 'document-production');
  assert.equal(result.status, 'HOLD_PROJECT_HOLD');
  assert.equal(result.project_status, 'HOLD');

  const capHold = routeWork('ERP 상품 상세 고쳐', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(capHold.status, 'HOLD_CAPABILITY_HOLD');
  assert.equal(capHold.capability_id, 'erp.product');

  const active = routeWork('과태료 처리해', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(active.status, 'RESOLVED');
  assert.equal(active.capability_id, 'operations.penalty.prepare');
  assert.ok(/^[0-9a-f]{40}$/.test(active.target_revision));
});

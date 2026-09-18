import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routeWork, validateWorkMap } from '../src/routing/work-router.mjs';

const workMap = JSON.parse(readFileSync(new URL('../registry/work-map.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(readFileSync(new URL('../registry/projects.json', import.meta.url), 'utf8'));
const fixtures = JSON.parse(readFileSync(new URL('../registry/work-routing-fixtures.json', import.meta.url), 'utf8')).fixtures;

test('OPS-P0 work map is schema-valid and points only to registered projects', () => {
  assert.deepEqual(validateWorkMap(workMap, projectRegistry), { status: 'VALID', errors: [] });
  assert.ok(workMap.work_types.length >= 20);
});

test('natural-language fixtures resolve to the expected work type and current project gate', async (t) => {
  for (const fixture of fixtures) {
    await t.test(fixture.query, () => {
      const result = routeWork(fixture.query, { workMap, projectRegistry });
      assert.equal(result.work_type_id, fixture.expected_work_type_id);
      assert.equal(result.status, fixture.expected_status);
      assert.ok(result.target_project_id);
    });
  }
});

test('unknown work stays fail-closed', () => {
  const result = routeWork('달에서 감자 키우는 업무 시작해', { workMap, projectRegistry });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(result.reason, 'NO_WORK_TYPE_MATCH');
});

test('HOLD projects never become executable routes', () => {
  const result = routeWork('보고서 만들어', { workMap, projectRegistry });
  assert.equal(result.work_type_id, 'document-production');
  assert.equal(result.status, 'HOLD_PROJECT_HOLD');
  assert.equal(result.project_status, 'HOLD');
});

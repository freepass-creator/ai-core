import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { routeWork, validateWorkMap } from '../src/routing/work-router.mjs';

const workMap = JSON.parse(readFileSync(new URL('../registry/work-map.json', import.meta.url), 'utf8'));
const workMapSchema = JSON.parse(readFileSync(new URL('../contracts/work-map.schema.json', import.meta.url), 'utf8'));
const projectRegistry = JSON.parse(readFileSync(new URL('../registry/projects.json', import.meta.url), 'utf8'));
const capabilityRegistry = JSON.parse(readFileSync(new URL('../registry/capabilities.json', import.meta.url), 'utf8'));
const fixtures = JSON.parse(readFileSync(new URL('../registry/work-routing-fixtures.json', import.meta.url), 'utf8')).fixtures;

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validateWorkMapContract = ajv.compile(workMapSchema);

test('shared work map contract keeps hub_routes project-scoped', () => {
  const { hub_routes: _devCenterExtension, ...genericWorkMap } = workMap;

  assert.equal(validateWorkMapContract(genericWorkMap), true, JSON.stringify(validateWorkMapContract.errors));
  assert.equal(validateWorkMapContract(workMap), true, JSON.stringify(validateWorkMapContract.errors));
});

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
      if (fixture.expected_target_project_id) {
        assert.equal(result.target_project_id, fixture.expected_target_project_id);
      }
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
  assert.equal(result.project_execution_readiness_status, 'HOLD');
  assert.equal(result.project_lifecycle_status, 'ACTIVE');

  const capHold = routeWork('ERP 상품 상세 고쳐', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(capHold.status, 'HOLD_CAPABILITY_HOLD');
  assert.equal(capHold.capability_id, 'erp.product');

  const active = routeWork('과태료 처리해', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(active.status, 'RESOLVED');
  assert.equal(active.capability_id, 'operations.penalty.prepare');
  assert.ok(/^[0-9a-f]{40}$/.test(active.target_revision));
});


test('canonical estimator authority remains FreePass Estimate-only', () => {
  const work = workMap.work_types.find((item) => item.work_type_id === 'estimator');
  const capability = capabilityRegistry.capabilities.find((item) => item.id === 'sales.vehicle-estimator');

  assert.ok(work, 'estimator work type missing');
  assert.ok(capability, 'sales.vehicle-estimator capability missing');
  assert.equal(work.target_project_id, 'freepass-estimate');
  assert.deepEqual(capability.projects, ['freepass-estimate']);

  const result = routeWork('견적기 고쳐', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(result.target_project_id, 'freepass-estimate');
  assert.equal(result.target_repository, 'freepass-creator/freepass-estimate');
});


test('repository lifecycle and execution readiness stay separate in routing', () => {
  const registry = structuredClone(projectRegistry);
  const welrix = registry.projects.find((item) => item.project_id === 'welrixtable');
  if (welrix) {
    assert.equal(welrix.repository_lifecycle_status, 'REFERENCE');
    assert.equal(welrix.execution_readiness_status, 'HOLD');
  }

  const docshub = registry.projects.find((item) => item.project_id === 'docshub');
  assert.equal(docshub.repository_lifecycle_status, 'ACTIVE');
  assert.equal(docshub.execution_readiness_status, 'HOLD');
});

test('duplicate project registry identities fail closed in validation and routing', () => {
  const registry = structuredClone(projectRegistry);
  const duplicate = structuredClone(registry.projects.find((item) => item.project_id === 'freepass-estimate'));
  duplicate.repository = 'freepass-creator/ambiguous-estimate-shadow';
  registry.projects.push(duplicate);

  const validation = validateWorkMap(workMap, registry, capabilityRegistry);
  assert.equal(validation.status, 'INVALID');
  assert.ok(validation.errors.some((error) => error.code === 'PROJECT_REGISTRY_INVALID'));

  const result = routeWork('견적기 고쳐', { workMap, projectRegistry: registry, capabilityRegistry });
  assert.equal(result.status, 'HOLD_REGISTRY_INVALID');
  assert.equal(result.reason, 'PROJECT_REGISTRY_DUPLICATE');
});

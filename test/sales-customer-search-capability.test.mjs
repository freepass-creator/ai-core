import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork } from '../src/routing/work-router.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('Sales customer search routes to the verified read-only adapter', async () => {
  const [workMap, projectRegistry, capabilityRegistry] = await Promise.all([
    readJson('../registry/work-map.json'),
    readJson('../registry/projects.json'),
    readJson('../registry/capabilities.json'),
  ]);

  const route = routeWork('고객 조회', { workMap, projectRegistry, capabilityRegistry });
  assert.equal(route.status, 'RESOLVED');
  assert.equal(route.target_project_id, 'freepass-sales');
  assert.equal(route.capability_id, 'sales.customer-search');
  const project = projectRegistry.projects.find(item => item.project_id === 'freepass-sales');
  assert.equal(route.target_revision, project.head_revision);
  assert.ok(project.authoritative_sources.some(source => source.revision === project.head_revision));

  const capability = capabilityRegistry.capabilities.find(item => item.id === 'sales.customer-search');
  assert.equal(capability.status, 'ACTIVE');
  assert.equal(capability.mode, 'READ_ONLY');
  assert.deepEqual(capability.adapter, {
    kind: 'PROJECT_MODULE',
    entrypoint: 'lib/ai-core-sales-adapters.mjs',
    export: 'aiCoreCustomerSearch',
  });
  assert.deepEqual(capability.inputs, [{ name: 'query', required: true }]);

  const engine = createCapabilityEngine({
    capabilityRegistry,
    projectRegistry,
    builtins: new Map(),
    runtime: {
      runModule: async () => { throw new Error('NOT_EXECUTED_IN_PLAN_TEST'); },
      runCommand: async () => { throw new Error('NOT_EXECUTED_IN_PLAN_TEST'); },
    },
  });

  const plan = engine.plan({ route });
  assert.equal(plan.status, 'PLANNED');
  assert.equal(plan.mode, 'READ_ONLY');
  assert.equal(plan.subject_revision, route.target_revision);
});

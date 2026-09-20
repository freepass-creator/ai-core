import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork } from '../src/routing/work-router.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const readJson=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));

test('insurance status query routes to AIOps read-only evidence adapter',async()=>{
  const [workMap,projectRegistry,capabilityRegistry]=await Promise.all([
    readJson('../registry/work-map.json'),
    readJson('../registry/projects.json'),
    readJson('../registry/capabilities.json')
  ]);
  const route=routeWork('보험 정합성 확인',{workMap,projectRegistry,capabilityRegistry});
  assert.equal(route.status,'RESOLVED');
  assert.equal(route.target_project_id,'aiops');
  assert.equal(route.capability_id,'operations.insurance-status');
  assert.equal(route.target_revision,'03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3');
  const capability=capabilityRegistry.capabilities.find(x=>x.id==='operations.insurance-status');
  assert.equal(capability.status,'ACTIVE');
  assert.equal(capability.mode,'READ_ONLY');
  assert.deepEqual(capability.adapter,{
    kind:'PROJECT_MODULE',
    entrypoint:'lib/ai-core-insurance-adapter.mjs',
    export:'aiCoreInsuranceStatus'
  });
  const engine=createCapabilityEngine({
    capabilityRegistry,projectRegistry,builtins:new Map(),
    runtime:{runModule:async()=>{throw new Error('NOT_EXECUTED_IN_PLAN_TEST');},runCommand:async()=>{throw new Error('NOT_EXECUTED_IN_PLAN_TEST');}}
  });
  const plan=engine.plan({route});
  assert.equal(plan.status,'PLANNED');
  assert.equal(plan.mode,'READ_ONLY');
  assert.equal(plan.subject_revision,route.target_revision);
});

test('generic insurance operation remains separate mutation HOLD',async()=>{
  const capabilityRegistry=await readJson('../registry/capabilities.json');
  const mutation=capabilityRegistry.capabilities.find(x=>x.id==='operations.insurance');
  assert.equal(mutation.status,'HOLD');
  assert.equal(mutation.mode,'LOCAL_MUTATION');
});

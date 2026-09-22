import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork } from '../src/routing/work-router.mjs';

const readJson=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));

test('MyData intake is registered but remains fail-closed until production binding',async()=>{
  const [workMap,projectRegistry,capabilityRegistry]=await Promise.all([
    readJson('../registry/work-map.json'),
    readJson('../registry/projects.json'),
    readJson('../registry/capabilities.json')
  ]);
  const route=routeWork('마이데이터 수집',{workMap,projectRegistry,capabilityRegistry});
  assert.equal(route.target_project_id,'freepass-sales');
  assert.equal(route.capability_id,'sales.mydata-intake');
  assert.equal(route.target_revision,projectRegistry.projects.find(x=>x.project_id==='freepass-sales').head_revision);
  assert.equal(route.status,'HOLD_CAPABILITY_HOLD');
  const capability=capabilityRegistry.capabilities.find(x=>x.id==='sales.mydata-intake');
  assert.equal(capability.mode,'EXTERNAL_MUTATION');
  assert.equal(capability.status,'HOLD');
  assert.ok(capability.required_scopes.includes('contacts-write'));
  assert.ok(capability.walls.includes('scheduler-enable'));
});

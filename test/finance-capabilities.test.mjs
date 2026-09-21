import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork,validateWorkMap } from '../src/routing/work-router.mjs';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';

const workMap=JSON.parse(await readFile(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const projects=JSON.parse(await readFile(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilities=JSON.parse(await readFile(new URL('../registry/capabilities.json',import.meta.url),'utf8'));

test('재무 capability registry와 work map이 함께 유효하다',()=>{
  assert.equal(validateCapabilityRegistryReferences(capabilities,projects).status,'VALID');
  assert.equal(validateWorkMap(workMap,projects,capabilities).status,'VALID');
});

test('돈 관련 요청은 실제 ACTIVE cash-status adapter로 resolve된다',()=>{
  const route=routeWork('돈 관련해서 이상한 거 봐줘',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.status,'RESOLVED');
  assert.equal(route.capability_id,'finance.cash-status');
  assert.equal(route.target_project_id,'aiops');
  const cap=capabilities.capabilities.find(x=>x.id===route.capability_id);
  assert.deepEqual(cap.adapter,{
    kind:'PROJECT_MODULE',
    entrypoint:'lib/ai-core-finance-adapters.mjs',
    export:'aiCoreCashStatus',
  });
});

test('미수 요청은 비식별 receivables adapter로 resolve된다',()=>{
  const route=routeWork('미수 얼마냐',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.status,'RESOLVED');
  assert.equal(route.capability_id,'finance.receivables');
  const cap=capabilities.capabilities.find(x=>x.id===route.capability_id);
  assert.equal(cap.mode,'READ_ONLY');
  assert.equal(cap.adapter.export,'aiCoreReceivables');
});

test('AI Core finance route is bound to the latest observed AIOps revision',()=>{
  const project=projects.projects.find(x=>x.project_id==='aiops');
  const route=routeWork('돈 관련해서 이상한 거 봐줘',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.target_revision,project.head_revision);
  assert.ok(project.authoritative_sources.some(source=>source.revision===project.head_revision));
});

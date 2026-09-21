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

test('AI Core가 참조하는 AIOps revision은 보험 adapter까지 포함한 현재 검증 head에 고정된다',()=>{
  const project=projects.projects.find(x=>x.project_id==='aiops');
  assert.equal(project.head_revision,'03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3');
});

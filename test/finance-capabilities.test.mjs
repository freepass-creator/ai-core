import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork,validateWorkMap } from '../src/routing/work-router.mjs';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const workMap=JSON.parse(await readFile(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const {projectRegistry: projects} = await import('./fixtures/routing-registry.mjs');
const realProjects=JSON.parse(await readFile(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilities=JSON.parse(await readFile(new URL('../registry/capabilities.json',import.meta.url),'utf8'));

// ★2026-10-03 대표 결정으로 aiops 가 은퇴했다. 자금·미수 adapter 는 aiops 에 있었고(jageum/status.mjs,
//   이미 없는 lib/wonja 미수 JSON) 어디로도 옮겨지지 않았다(ARCHIVE_ONLY). 정본 읽기의 주인은 renman-data 다.
//   그래서 «주인은 renman-data, 실행은 HOLD» 가 지금의 사실이다 — 없는 adapter 로 RESOLVED 를 주면 거짓이다.

test('재무 capability registry와 work map이 함께 유효하다',()=>{
  assert.equal(validateCapabilityRegistryReferences(capabilities,projects).status,'VALID');
  assert.equal(validateWorkMap(workMap,projects,capabilities).status,'VALID');
});

for(const [query,capabilityId] of [['돈 관련해서 이상한 거 봐줘','finance.cash-status'],['미수 얼마냐','finance.receivables']]){
  test(`${capabilityId}: 정본 읽기 주인 renman-data 로 가되 adapter 가 없어 실행되지 않는다`,()=>{
    const route=routeWork(query,{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
    assert.equal(route.capability_id,capabilityId);
    assert.equal(route.target_project_id,'renman-data');
    assert.notEqual(route.status,'RESOLVED');
    const cap=capabilities.capabilities.find(x=>x.id===capabilityId);
    assert.equal(cap.mode,'READ_ONLY');
    assert.equal(cap.status,'HOLD');
    assert.equal(cap.adapter,undefined,'옮겨지지 않은 aiops adapter 를 다른 저장소 경로로 가리키면 안 된다');
    assert.match(cap.hold_reason,/aiops 은퇴/);
    const plan=createCapabilityEngine({capabilityRegistry:capabilities,projectRegistry:projects}).plan({route});
    assert.equal(plan.status,'HOLD');
  });
}

test('AI Core finance route is bound to the latest observed renman-data revision',()=>{
  const project=projects.projects.find(x=>x.project_id==='renman-data');
  const route=routeWork('돈 관련해서 이상한 거 봐줘',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.target_revision,project.head_revision);
  assert.ok(project.authoritative_sources.some(source=>source.revision===project.head_revision));
});

test('은퇴한 aiops 로 가는 업무·capability 가 없다 — 할 일은 후속 저장소로 옮겨졌다',()=>{
  // workcontrol 처럼 «옮길 곳 없이 닫힌» 프로젝트는 HOLD_PROJECT_DISABLED 로 알려 주려고 남겨 둔다.
  // aiops 는 다르다: 과태료는 renman, 자금·미수·보험 읽기는 renman-data 로 주인이 정해졌다.
  assert.equal(realProjects.projects.find(p=>p.project_id==='aiops').repository_lifecycle_status,'RETIRE');
  assert.deepEqual(workMap.work_types.filter(w=>w.target_project_id==='aiops').map(w=>w.work_type_id),[]);
  assert.deepEqual(capabilities.capabilities.filter(c=>c.projects.includes('aiops')).map(c=>c.id),[]);
});

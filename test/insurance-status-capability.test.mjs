import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeWork } from '../src/routing/work-router.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const readJson=async p=>JSON.parse(await readFile(new URL(p,import.meta.url),'utf8'));

// ★2026-10-03 aiops 은퇴: 보험 상태 adapter(aiops lib/ai-core-insurance-adapter.mjs)는 보관만(ARCHIVE_ONLY)으로 남았다.
//   읽기 주인은 renman-data, 업무 처리 주인은 renman. adapter 가 다시 서기 전까지 둘 다 HOLD 다.

test('insurance status query routes to renman-data read owner and stays HOLD without an adapter',async()=>{
  /** 실행 준비 상태만 고정한 등록부를 쓴다 — 왜인지는 test/fixtures/routing-registry.mjs 머리에 있다. */
  const {workMap,projectRegistry,capabilityRegistry}=(await import('./fixtures/routing-registry.mjs')).routingConfig;
  const route=routeWork('보험 정합성 확인',{workMap,projectRegistry,capabilityRegistry});
  assert.notEqual(route.status,'RESOLVED');
  assert.equal(route.target_project_id,'renman-data');
  assert.equal(route.capability_id,'operations.insurance-status');
  assert.equal(route.target_revision,projectRegistry.projects.find(x=>x.project_id==='renman-data').head_revision);
  const capability=capabilityRegistry.capabilities.find(x=>x.id==='operations.insurance-status');
  assert.equal(capability.status,'HOLD');
  assert.equal(capability.mode,'READ_ONLY');
  assert.equal(capability.adapter,undefined);
  assert.match(capability.hold_reason,/aiops 은퇴/);
  const engine=createCapabilityEngine({
    capabilityRegistry,projectRegistry,builtins:new Map(),
    runtime:{runModule:async()=>{throw new Error('NOT_EXECUTED_IN_PLAN_TEST');},runCommand:async()=>{throw new Error('NOT_EXECUTED_IN_PLAN_TEST');}}
  });
  const plan=engine.plan({route});
  assert.equal(plan.status,'HOLD');
});

test('generic insurance operation remains separate mutation HOLD',async()=>{
  const capabilityRegistry=await readJson('../registry/capabilities.json');
  const mutation=capabilityRegistry.capabilities.find(x=>x.id==='operations.insurance');
  assert.equal(mutation.status,'HOLD');
  assert.equal(mutation.mode,'LOCAL_MUTATION');
  assert.deepEqual(mutation.projects,['renman']);
});

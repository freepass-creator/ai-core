import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';

const projects=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilities=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));

test('builtin adapter는 선언하지 않은 capability mode로 실행되지 않는다',async()=>{
  const registry=structuredClone(capabilities);
  const cap=registry.capabilities.find(x=>x.id==='core.brief');
  cap.mode='LOCAL_MUTATION';
  const project=projects.projects.find(x=>x.project_id==='ai-core');
  const engine=createCapabilityEngine({capabilityRegistry:registry,projectRegistry:projects});

  const result=await engine.run({
    route:{capability_id:'core.brief',target_project_id:'ai-core',target_revision:project.head_revision},
    input:{},perform:true,
  });

  assert.equal(result.status,'HOLD');
  assert.deepEqual(result.blockers,['BUILTIN_ADAPTER_MODE_UNSUPPORTED:core.brief:LOCAL_MUTATION']);
  assert.equal(result.execution.performed,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateCapabilityRegistryReferences } from '../src/engine/capability-registry.mjs';
import { createCapabilityEngine } from '../src/engine/capability-engine.mjs';
import { createProjectRuntime } from '../src/engine/project-runtime.mjs';
import { routeWork } from '../src/routing/work-router.mjs';

const capabilities=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));
const projects=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));

test('canonical capability registry references only registered projects',()=>{
  const r=validateCapabilityRegistryReferences(capabilities,projects);
  assert.equal(r.status,'VALID');
  assert.ok(r.capability_count>=20);
});

test('Work Map uses canonical capability ids and unimplemented work is HOLD',()=>{
  const route=routeWork('ERP 상품 상세 고쳐',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.capability_id,'erp.product');
  assert.equal(route.status,'HOLD_CAPABILITY_HOLD');
  const engine=createCapabilityEngine({capabilityRegistry:capabilities,projectRegistry:projects});
  const plan=engine.plan({route});
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'CAPABILITY_NOT_ACTIVE');
});

test('penalty work resolves to the existing AIOps executor capability',async()=>{
  const route=routeWork('과태료 처리해',{workMap,projectRegistry:projects,capabilityRegistry:capabilities});
  assert.equal(route.status,'RESOLVED');
  assert.equal(route.capability_id,'operations.penalty.prepare');
  const engine=createCapabilityEngine({capabilityRegistry:capabilities,projectRegistry:projects});
  const prepared=await engine.run({route});
  assert.equal(prepared.status,'PREPARED');
  assert.equal(prepared.execution.performed,false);
  const blocked=await engine.run({route,perform:true});
  assert.equal(blocked.status,'HOLD');
  assert.ok(blocked.blockers.includes('EXECUTION_CONTEXT_REQUIRED'));
});

test('dirty tracked worktree blocks project execution before command/module invocation',async()=>{
  let commands=0, modules=0;
  const runtime=createProjectRuntime({
    readHead:async()=> 'a'.repeat(40),
    readDirtyPaths:async()=>[' M src/changed.mjs'],
    runProcess:async()=>{commands++;return{exit_code:0,stdout:'',stderr:''};},
    importModule:async()=>{modules++;return{execute:async()=>({status:'SUCCEEDED',evidence:[],artifacts:[],checks:[],blockers:[],external_effect:false})};},
  });
  const project={project_id:'sample',status:'ACTIVE',local_path:resolve('/tmp/sample'),head_revision:'a'.repeat(40),commands:{test:'npm test'}};
  const command={id:'project.verify',title:'verify',mode:'LOCAL_MUTATION',adapter:{kind:'PROJECT_REGISTRY_COMMAND',command_key:'test'}};
  await assert.rejects(runtime.runCommand(command,project),/PROJECT_WORKTREE_DIRTY/);
  const module={id:'x',title:'x',mode:'READ_ONLY',adapter:{kind:'PROJECT_MODULE',entrypoint:'lib/x.mjs',export:'execute'}};
  await assert.rejects(runtime.runModule(module,project,{}),/PROJECT_WORKTREE_DIRTY/);
  assert.equal(commands,0);assert.equal(modules,0);
});

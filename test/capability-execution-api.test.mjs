import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';

const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const baseProjects=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilityRegistry=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));

async function fixture(t,{enabled=true,moduleExecution=false}={}){
  const root=mkdtempSync(join(tmpdir(),'capability-api-'));
  const projectRegistry=structuredClone(baseProjects);
  const runtimeCapabilityRegistry=structuredClone(capabilityRegistry);
  const fp4=projectRegistry.projects.find(p=>p.project_id==='freepasserp4');
  fp4.local_path=join(root,'freepasserp4');
  if(moduleExecution){
    const verify=runtimeCapabilityRegistry.capabilities.find(c=>c.id==='project.verify');
    verify.adapter={kind:'PROJECT_MODULE',module_path:'fake-module.mjs',export:'run'};
  }
  const registryPath=join(root,'projects.json');
  const snapshotPath=join(root,'control-snapshot.json');
  const dbPath=join(root,'orders.sqlite');
  writeFileSync(registryPath,JSON.stringify(projectRegistry,null,2));

  let runs=0;
  let moduleContext=null;
  const fakeResult=capability=>({
    status:'SUCCEEDED',summary:`${capability.id} fake 실행 완료`,data:{secret:'not persisted'},
    evidence:['MEASURED:fake runtime'],artifacts:[],checks:[{name:capability.id,status:'PASS'}],
    blockers:[],external_effect:false,
  });
  const capabilityRuntime={
    prepareCommand:async()=>({kind:'PROJECT_COMMAND',argv:['npm','test']}),
    runCommand:async(capability)=>{
      runs++;
      return fakeResult(capability);
    },
    runModule:async(capability,_project,_input,executionContext)=>{
      if(!moduleExecution) throw new Error('module should not run');
      runs++;
      moduleContext=structuredClone(executionContext);
      return fakeResult(capability);
    },
  };
  const routingConfig={workMap,projectRegistry,capabilityRegistry:runtimeCapabilityRegistry};
  const started=await startServer({
    dbPath,port:0,standalone:true,routingConfig,
    workSources:{registry:registryPath,snapshot:snapshotPath},
    capabilityExecutionEnabled:enabled,
    capabilityRuntime,
    executorIdentity:'codex',
  });
  t.after(async()=>{
    started.server.closeAllConnections();
    await new Promise(r=>started.server.close(r));
    rmSync(root,{recursive:true,force:true});
  });
  const post=(path,body)=>fetch(started.url+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  });
  return{...started,root,projectRegistry,fp4,post,get runs(){return runs;},get moduleContext(){return moduleContext;}};
}

function orderBody(fp4){
  return{
    requestId:randomUUID(),title:'ERP4 검증',intent:'freepasserp4 테스트 돌려',
    project:'freepasserp4',kind:'general',criteria:['정본 테스트 결과가 receipt로 남는다.'],
    routing:{
      status:'ROUTED',work_type_id:'erp-product',capability_id:'project.verify',
      target_project_id:'freepasserp4',target_revision:fp4.head_revision,
      project_status:'ACTIVE',capability_status:'ACTIVE',capability_mode:'LOCAL_MUTATION',
      matched_alias:'테스트',blockers:[],requirement_revision:1,
    },
  };
}

test('capability execution endpoint는 서버 옵션을 켜지 않으면 기본 HOLD다',async t=>{
  const f=await fixture(t,{enabled:false});
  const response=await f.post('/api/orders/ORD-00000000-0000-4000-8000-000000000001/capability/run',{
    requestId:'exec-disabled',perform:true,input:{},
  });
  assert.equal(response.status,423);
  const body=await response.json();
  assert.equal(body.reason,'CAPABILITY_EXECUTION_DISABLED');
  assert.equal(f.runs,0);
});

test('Order→Work 연결 뒤 local capability를 한 번 실행하고 durable receipt로 되돌린다',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderBody(f.fp4))).json();
  const linked=await (await f.post(`/api/orders/${order.id}/work-intake`,{})).json();
  assert.equal(linked.status,'WORK_LINKED');

  const command={requestId:'exec-local-1',perform:true,input:{}};
  const firstResponse=await f.post(`/api/orders/${order.id}/capability/run`,command);
  assert.equal(firstResponse.status,200);
  const first=await firstResponse.json();
  assert.equal(first.schema,'ai-core-work-result/v1');
  assert.equal(first.status,'SUCCEEDED');
  assert.equal(first.capability_id,'project.verify');
  assert.equal(first.work_id,linked.work_id);
  assert.equal(first.execution.performed,true);
  assert.equal(Object.hasOwn(first.outcome,'data'),false,'durable receipt must omit adapter data');
  assert.equal(f.runs,1);

  const retry=await (await f.post(`/api/orders/${order.id}/capability/run`,command)).json();
  assert.deepEqual(retry,first);
  assert.equal(f.runs,1,'same requestId must never execute twice');

  const results=await (await fetch(`${f.url}/api/orders/${order.id}/capability/results`)).json();
  assert.equal(results.length,1);
  assert.equal(results[0].state,'RESULT');
  assert.equal(results[0].result.status,'SUCCEEDED');
});

test('PROJECT_MODULE은 durable 실행 requestId를 같은 호출 문맥으로 받는다',async t=>{
  const f=await fixture(t,{moduleExecution:true});
  const order=await (await f.post('/api/orders',orderBody(f.fp4))).json();
  await f.post(`/api/orders/${order.id}/work-intake`,{});

  const requestId='exec-project-module-identity';
  const response=await f.post(`/api/orders/${order.id}/capability/run`,{requestId,perform:true,input:{}});
  assert.equal(response.status,200);
  assert.equal(f.runs,1);
  assert.equal(f.moduleContext?.requestId,requestId);
  assert.equal(f.moduleContext?.plan?.order_id,order.id);
});

test('완료 뒤 requirement가 바뀌어도 같은 requestId 재시도는 기존 RESULT를 반환하고 재실행하지 않는다',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderBody(f.fp4))).json();
  await f.post(`/api/orders/${order.id}/work-intake`,{});

  const path=`/api/orders/${order.id}/capability/run`;
  const command={requestId:'exec-revision-replay',perform:true,input:{a:1}};
  const firstResponse=await f.post(path,command);
  assert.equal(firstResponse.status,200);
  const first=await firstResponse.json();
  assert.equal(f.runs,1);

  const current=await (await fetch(`${f.url}/api/orders/${order.id}`)).json();
  const reviseResponse=await f.post(`/api/orders/${order.id}`,{
    requestId:'revise-after-execution',version:current.order.version,action:'revise',
    intent:'검증 요구 변경',criteria:['새 revision은 새 실행 ID로 처리한다.'],reason:'완료 뒤 요구 변경',
  });
  assert.equal(reviseResponse.status,200);
  const revised=await reviseResponse.json();
  assert.equal(revised.revision,2);
  assert.equal(revised.routing.requirement_revision,1);

  const replayResponse=await f.post(path,command);
  assert.equal(replayResponse.status,200);
  assert.deepEqual(await replayResponse.json(),first);
  assert.equal(f.runs,1,'historical RESULT replay must not execute again');

  const conflict=await f.post(path,{...command,input:{a:2}});
  assert.equal(conflict.status,409);
  assert.equal((await conflict.json()).error,'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT');
  assert.equal(f.runs,1);
});

test('같은 실행 requestId에 다른 input을 보내면 중복 실행 대신 충돌한다',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderBody(f.fp4))).json();
  await f.post(`/api/orders/${order.id}/work-intake`,{});

  const path=`/api/orders/${order.id}/capability/run`;
  const first=await f.post(path,{requestId:'exec-conflict',perform:true,input:{a:1}});
  assert.equal(first.status,200);
  const second=await f.post(path,{requestId:'exec-conflict',perform:true,input:{a:2}});
  assert.equal(second.status,409);
  const body=await second.json();
  assert.equal(body.error,'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT');
  assert.equal(f.runs,1);
});

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

async function fixture(t,{enabled=true}={}){
  const root=mkdtempSync(join(tmpdir(),'capability-api-'));
  const projectRegistry=structuredClone(baseProjects);
  const fp4=projectRegistry.projects.find(p=>p.project_id==='freepasserp4');
  fp4.local_path=join(root,'freepasserp4');
  const registryPath=join(root,'projects.json');
  const snapshotPath=join(root,'control-snapshot.json');
  const dbPath=join(root,'orders.sqlite');
  writeFileSync(registryPath,JSON.stringify(projectRegistry,null,2));

  let runs=0;
  const capabilityRuntime={
    prepareCommand:async()=>({kind:'PROJECT_COMMAND',argv:['npm','test']}),
    runCommand:async(capability)=>{
      runs++;
      return{
        status:'SUCCEEDED',summary:`${capability.id} fake 실행 완료`,data:{secret:'not persisted'},
        evidence:['MEASURED:fake runtime'],artifacts:[],checks:[{name:capability.id,status:'PASS'}],
        blockers:[],external_effect:false,
      };
    },
    runModule:async()=>{throw new Error('module should not run');},
  };
  const routingConfig={workMap,projectRegistry,capabilityRegistry};
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
  return{...started,root,projectRegistry,fp4,post,get runs(){return runs;}};
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

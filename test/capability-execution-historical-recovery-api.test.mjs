import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';
import { createCapabilityExecutionCoordinator } from '../src/engine/capability-execution-coordinator.mjs';

const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const baseProjects=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const baseCapabilities=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));

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

test('RESERVED recovery는 예약 당시 receipt 계약을 고정해 현재 capability 삭제 뒤에도 재실행 없이 복구한다',async t=>{
  const root=mkdtempSync(join(tmpdir(),'capability-historical-recovery-'));
  const projectRegistry=structuredClone(baseProjects);
  const capabilityRegistry=structuredClone(baseCapabilities);
  const fp4=projectRegistry.projects.find(project=>project.project_id==='freepasserp4');
  const verify=capabilityRegistry.capabilities.find(item=>item.id==='project.verify');
  fp4.local_path=join(root,'freepasserp4');
  verify.receipt={
    kind:'NEW_JSON_TERMINAL_RECEIPT',directory:'tmp/original-receipts',prefix:'run-',suffix:'.json',
    schema_field:'schema',schema_value:'historical-run/v1',state_field:'state',identity_field:'request_id',
    success_states:['COMPLETED'],hold_states:['HOLD'],failure_states:['FAILED'],
  };
  verify.walls=['historical-wall'];

  const registryPath=join(root,'projects.json');
  const snapshotPath=join(root,'control-snapshot.json');
  const dbPath=join(root,'orders.sqlite');
  writeFileSync(registryPath,JSON.stringify(projectRegistry,null,2));

  let runs=0;
  const started=await startServer({
    dbPath,port:0,standalone:true,
    routingConfig:{workMap,projectRegistry,capabilityRegistry},
    workSources:{registry:registryPath,snapshot:snapshotPath},
    capabilityExecutionEnabled:true,
    executorIdentity:'codex',
    capabilityRuntime:{
      prepareCommand:async()=>({kind:'PROJECT_COMMAND',argv:['npm','test']}),
      runCommand:async()=>{
        runs++;
        return{
          status:'SUCCEEDED',summary:'unexpected execution',data:null,evidence:[],artifacts:[],checks:[],blockers:[],external_effect:false,
        };
      },
      runModule:async()=>{throw new Error('module should not run');},
    },
  });
  t.after(async()=>{
    started.server.closeAllConnections();
    await new Promise(resolve=>started.server.close(resolve));
    rmSync(root,{recursive:true,force:true});
  });
  const post=(path,body)=>fetch(started.url+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  });

  const order=await (await post('/api/orders',orderBody(fp4))).json();
  const linked=await (await post(`/api/orders/${order.id}/work-intake`,{})).json();
  assert.equal(linked.status,'WORK_LINKED');

  // Initialize the server's operating coordinator while the live registry is still valid.
  const initialResults=await (await fetch(`${started.url}/api/orders/${order.id}/capability/results`)).json();
  assert.deepEqual(initialResults,[]);

  const execution=createCapabilityExecutionCoordinator({store:started.store,projectRegistry});
  const requestId='exec-historical-receipt-contract';
  const input={a:1};
  const reserved=await execution.reserve({
    requestId,orderId:order.id,workId:linked.work_id,capability:verify,input,perform:true,
  });
  assert.equal(reserved.status,'RESERVED');
  assert.equal(runs,0);

  assert.throws(()=>started.store.db.prepare(
    'UPDATE capability_execution_requests SET before_receipts_json=? WHERE request_id=?'
  ).run('[]',requestId),/CAPABILITY_EXECUTION_RECOVERY_SNAPSHOT_IMMUTABLE/);

  const receiptDir=join(fp4.local_path,'tmp','original-receipts');
  mkdirSync(receiptDir,{recursive:true});
  writeFileSync(join(receiptDir,'run-completed.json'),JSON.stringify({
    schema:'historical-run/v1',state:'COMPLETED',request_id:requestId,
  }));

  const current=started.store.get(order.id);
  const revisedResponse=await post(`/api/orders/${order.id}`,{
    requestId:'revise-after-reserved-effect',version:current.version,action:'revise',
    intent:'검증 요구 변경',criteria:['새 revision은 새 실행 ID로 처리한다.'],reason:'외부 effect 이후 요구 변경',
  });
  assert.equal(revisedResponse.status,200);

  // Simulate a later Core registry revision that removed this capability entirely.
  capabilityRegistry.capabilities=capabilityRegistry.capabilities.filter(item=>item.id!==verify.id);

  const replayResponse=await post(`/api/orders/${order.id}/capability/run`,{requestId,perform:true,input});
  assert.equal(replayResponse.status,200);
  const replayed=await replayResponse.json();
  assert.equal(replayed.status,'SUCCEEDED');
  assert.equal(replayed.mode,'LOCAL_MUTATION');
  assert.deepEqual(replayed.walls,['historical-wall']);
  assert.deepEqual(replayed.artifact_refs,['tmp/original-receipts/run-completed.json']);
  assert.equal(runs,0,'historical receipt recovery must not execute the capability again');

  const results=await (await fetch(`${started.url}/api/orders/${order.id}/capability/results`)).json();
  assert.equal(results.length,1);
  assert.equal(results[0].state,'RESULT');
  assert.equal(results[0].reason,'RECONCILED_FROM_TERMINAL_RECEIPT');
});

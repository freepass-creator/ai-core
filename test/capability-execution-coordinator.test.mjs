import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderStore } from '../src/orders/store.mjs';
import { BINDING_SCHEMA } from '../src/integration/order-work-binder.mjs';
import { createCapabilityExecutionCoordinator } from '../src/engine/capability-execution-coordinator.mjs';

const sha='a'.repeat(40);
const capability={
  id:'operations.penalty.prepare',status:'ACTIVE',projects:['aiops'],mode:'EXTERNAL_MUTATION',
  walls:['관청발송','문서24업로드'],
  receipt:{
    kind:'NEW_JSON_TERMINAL_RECEIPT',directory:'tmp/과태료',prefix:'실행기록-',suffix:'.json',
    schema_field:'schema',schema_value:'gwataeryo-run-manifest/v1',state_field:'state',
    success_states:['COMPLETED'],hold_states:['COMPLETED_WITH_HOLD'],failure_states:['FAILED'],
  },
};
const projectRegistry={schema_version:'1.0',projects:[{project_id:'aiops',local_path:'/project'}]};

function fixture({reconcileResult=null,withBinding=true}={}){
  const store=new OrderStore(':memory:',{now:()=>Date.parse('2026-09-19T03:30:00Z')});
  const order=store.create({
    requestId:'create-1',title:'과태료',intent:'과태료 처리해',project:'aiops',kind:'general',
    criteria:['실행 결과가 receipt로 남는다.'],
    routing:{
      status:'ROUTED',work_type_id:'penalty-processing',capability_id:capability.id,
      target_project_id:'aiops',target_revision:sha,project_status:'ACTIVE',capability_status:'ACTIVE',
      capability_mode:'EXTERNAL_MUTATION',matched_alias:'과태료',blockers:[],requirement_revision:1,
    },
  });
  if(withBinding){
    store.db.exec(BINDING_SCHEMA);
    store.db.prepare(`INSERT INTO coordination_bindings
      (order_id,requirement_revision,work_id,project_id,subject_revision,requirement_digest,created_record_version,command_id,event_id)
      VALUES (?,?,?,?,?,?,?,NULL,NULL)`)
      .run(order.id,1,'WORK-001','aiops',sha,'digest',order.version);
  }

  let snapshots=0;
  const receiptReader={
    snapshot:async()=>{snapshots++;return new Map();},
    reconcile:async()=>reconcileResult??{status:'HOLD',reason:'EXECUTION_RECEIPT_MISSING'},
  };
  const coordinator=createCapabilityExecutionCoordinator({store,projectRegistry,receiptReader,clock:()=>Date.parse('2026-09-19T03:31:00Z')});
  return{store,order,coordinator,get snapshots(){return snapshots;}};
}

function resultFor(order,{status='SUCCEEDED'}={}){
  return{
    schema:'ai-core-work-result/v1',order_id:order.id,work_id:'WORK-001',project_id:'aiops',
    capability_id:capability.id,subject_revision:sha,mode:'EXTERNAL_MUTATION',status,
    summary:'완료',artifact_refs:['tmp/과태료/실행기록-x.json'],evidence_refs:['MEASURED:receipt'],
    checks:[{name:'penalty.manifest',status:'PASS',detail:'COMPLETED'}],
    execution:{performed:true,external_effect:true,started_at:'2026-09-19T03:30:00Z',ended_at:'2026-09-19T03:31:00Z',authorization_source:'DIR-1'},
    outcome:{observed:true,data:{raw:'저장하면 안 되는 상세값'}},blockers:[],next_action:'검증',walls:capability.walls,
  };
}

test('실행 전에 requestId를 durable RESERVED로 기록하고 같은 요청은 재예약하지 않는다',async t=>{
  const f=fixture();t.after(()=>f.store.close());
  const first=await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true});
  assert.equal(first.status,'RESERVED');assert.equal(first.replay,false);assert.equal(f.snapshots,1);
  const second=await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true});
  assert.equal(second.status,'RESERVED');assert.equal(second.replay,true);assert.equal(f.snapshots,1);
});

test('같은 requestId에 다른 입력을 넣으면 실행 전 충돌로 막는다',async t=>{
  const f=fixture();t.after(()=>f.store.close());
  await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{a:1},perform:true});
  await assert.rejects(
    f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{a:2},perform:true}),
    /CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT/
  );
});

test('완료 결과는 민감할 수 있는 outcome.data를 버린 안전 receipt로 영속한다',async t=>{
  const f=fixture();t.after(()=>f.store.close());
  await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true});
  const saved=f.coordinator.complete('exec-1',resultFor(f.order));
  assert.equal(saved.status,'SUCCEEDED');
  assert.deepEqual(saved.outcome,{observed:true});
  assert.equal(Object.hasOwn(saved.outcome,'data'),false);
  const list=f.coordinator.list(f.order.id);
  assert.equal(list.length,1);assert.equal(list[0].state,'RESULT');assert.equal(list[0].result.status,'SUCCEEDED');
  const events=f.store.events(f.order.id).filter(event=>event.type==='CAPABILITY_RESULT');
  assert.equal(events.length,1);
  assert.equal(events[0].detail.request_id,'exec-1');
  assert.equal(events[0].detail.workflow_id,'ai-core.capability-execution');
  assert.equal(events[0].detail.workflow_version,'0.1.0');
  assert.equal(events[0].detail.workflow_transition_id,'capability-execution.complete');
  assert.equal(events[0].detail.workflow_event_type,'ai-core.capability-execution.resulted');
  assert.equal(events[0].detail.status,'SUCCEEDED');
});

test('durable RESULT는 requirement revision이 바뀐 뒤에도 같은 실행 requestId로 복구된다',async t=>{
  const f=fixture();t.after(()=>f.store.close());
  await f.coordinator.reserve({requestId:'exec-replay',orderId:f.order.id,workId:'WORK-001',capability,input:{a:1},perform:true});
  const saved=f.coordinator.complete('exec-replay',resultFor(f.order));
  const current=f.store.get(f.order.id);
  const revised=f.store.mutate(f.order.id,{
    requestId:'revise-after-result',version:current.version,action:'revise',
    intent:'새 요구',criteria:['새 revision은 새 실행 requestId를 사용한다.'],reason:'요구 변경',
  });
  assert.equal(revised.revision,2);
  assert.equal(revised.routing.requirement_revision,1);

  const recovered=f.coordinator.recover({requestId:'exec-replay',orderId:f.order.id,input:{a:1},perform:true});
  assert.equal(recovered.status,'RESULT');
  assert.deepEqual(recovered.result,saved);
  assert.throws(
    ()=>f.coordinator.recover({requestId:'exec-replay',orderId:f.order.id,input:{a:2},perform:true}),
    /CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT/
  );
});

test('응답 유실 뒤 terminal receipt를 찾으면 재실행 없이 결과를 복구한다',async t=>{
  const f=fixture({reconcileResult:{status:'SUCCEEDED',path:'/project/tmp/과태료/실행기록-recovered.json',state:'COMPLETED',receipt:{schema:'gwataeryo-run-manifest/v1',state:'COMPLETED'}}});
  t.after(()=>f.store.close());
  await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true});
  const recovered=await f.coordinator.reconcile('exec-1',capability);
  assert.equal(recovered.status,'RESULT');assert.equal(recovered.reconciled,true);
  assert.equal(recovered.result.status,'SUCCEEDED');
  assert.deepEqual(recovered.result.artifact_refs,['tmp/과태료/실행기록-recovered.json']);
  const event=f.store.events(f.order.id).filter(item=>item.type==='CAPABILITY_RESULT').at(-1);
  assert.equal(event.detail.workflow_id,'ai-core.capability-execution');
  assert.equal(event.detail.workflow_transition_id,'capability-execution.reconcile-terminal');
  assert.equal(event.detail.workflow_event_type,'ai-core.capability-execution.reconciled');
});

test('terminal receipt가 없으면 UNKNOWN으로 닫고 절대 재실행 판정을 하지 않는다',async t=>{
  const f=fixture();t.after(()=>f.store.close());
  await f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true});
  const out=await f.coordinator.reconcile('exec-1',capability);
  assert.deepEqual(out,{status:'HOLD',reason:'EXECUTION_OUTCOME_UNKNOWN',reconciled:false});
});

test('현재 requirement의 immutable binding이 없으면 실행 예약 자체가 안 된다',async t=>{
  const f=fixture({withBinding:false});t.after(()=>f.store.close());
  await assert.rejects(
    f.coordinator.reserve({requestId:'exec-1',orderId:f.order.id,workId:'WORK-001',capability,input:{},perform:true}),
    /WORK_BINDING_REQUIRED/
  );
});

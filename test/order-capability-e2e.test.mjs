import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { startServer } from '../src/orders/server.mjs';

const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const projectRegistry=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilityRegistry=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));
const routingConfig={workMap,projectRegistry,capabilityRegistry};

const input=(extra={})=>({
  requestId:randomUUID(),
  title:'업무 접수',
  intent:'과태료 처리해',
  project:'',
  kind:'general',
  criteria:['업무 경로와 실행 준비 상태가 보인다.'],
  ...extra,
});

test('routed order persists provenance and plans the same canonical capability without rerouting',async(t)=>{
  const {server,store,url}=await startServer({dbPath:':memory:',port:0,standalone:true,routingConfig});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});

  const post=async(body,path='/api/orders')=>fetch(url+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  });

  const response=await post(input());
  assert.equal(response.status,200);
  const order=await response.json();
  assert.equal(order.project,'aiops');
  assert.equal(order.routing.work_type_id,'penalty-processing');
  assert.equal(order.routing.capability_id,'operations.penalty.prepare');

  const plan=await (await fetch(`${url}/api/orders/${order.id}/capability`)).json();
  assert.equal(plan.status,'PLANNED');
  assert.equal(plan.order_id,order.id);
  assert.equal(plan.project_id,'aiops');
  assert.equal(plan.capability_id,'operations.penalty.prepare');
  assert.equal(plan.subject_revision,order.routing.target_revision);

  const event=store.events(order.id)[0];
  assert.equal(event.detail.routing.capability_id,'operations.penalty.prepare');
});

test('known HOLD work is accepted at intake but capability planning stays fail-closed',async(t)=>{
  const {server,url}=await startServer({dbPath:':memory:',port:0,standalone:true,routingConfig});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});

  const response=await fetch(url+'/api/orders',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input({title:'보고서 제작',intent:'보고서 만들어'})),
  });
  assert.equal(response.status,200);
  const order=await response.json();
  assert.equal(order.project,'docshub');
  assert.equal(order.routing.status,'HOLD_PROJECT_HOLD');
  assert.equal(order.routing.capability_id,'docs.production');

  const plan=await (await fetch(`${url}/api/orders/${order.id}/capability`)).json();
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'CAPABILITY_NOT_ACTIVE');
  assert.equal(plan.capability_id,'docs.production');
});

test('manual project order is never silently rerouted into a capability',async(t)=>{
  const {server,url}=await startServer({dbPath:':memory:',port:0,standalone:true,routingConfig});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});

  const response=await fetch(url+'/api/orders',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input({project:'manual-project'})),
  });
  const order=await response.json();
  assert.equal(order.routing,null);

  const plan=await (await fetch(`${url}/api/orders/${order.id}/capability`)).json();
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'ROUTING_PROVENANCE_REQUIRED');
});

test('requirement revision change invalidates stored routing until explicit reroute',async(t)=>{
  const {server,store,url}=await startServer({dbPath:':memory:',port:0,standalone:true,routingConfig});
  t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});

  const response=await fetch(url+'/api/orders',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(input()),
  });
  const order=await response.json();
  const revised=store.mutate(order.id,{
    requestId:randomUUID(),version:order.version,action:'revise',
    intent:'ERP 상품 상세 고쳐',
    criteria:['수정된 요구의 업무 경로를 다시 확정한다.'],
    reason:'업무 목적이 바뀌었다',
  });
  assert.equal(revised.revision,2);
  assert.equal(revised.routing.requirement_revision,1);

  const plan=await (await fetch(`${url}/api/orders/${order.id}/capability`)).json();
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'ROUTING_REQUIREMENT_STALE');
  assert.equal(plan.routed_requirement_revision,1);
  assert.equal(plan.current_requirement_revision,2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';
import { verifyLedgerText } from '../scripts/work-ledger.mjs';

const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const projectRegistry=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilityRegistry=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));
const routingConfig={workMap,projectRegistry,capabilityRegistry};

async function fixture(t){
  const root=mkdtempSync(join(tmpdir(),'order-work-intake-'));
  const registryPath=join(root,'projects.json');
  const snapshotPath=join(root,'control-snapshot.json');
  const dbPath=join(root,'orders.sqlite');
  writeFileSync(registryPath,JSON.stringify(projectRegistry,null,2));
  const started=await startServer({
    dbPath,port:0,standalone:true,routingConfig,
    workSources:{registry:registryPath,snapshot:snapshotPath},
  });
  t.after(async()=>{
    started.server.closeAllConnections();
    await new Promise(r=>started.server.close(r));
    rmSync(root,{recursive:true,force:true});
  });
  return {
    ...started,root,registryPath,snapshotPath,dbPath,
    ledgerPath:join(root,'work-ledger.jsonl'),
    async post(path,body={}){
      return fetch(started.url+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    },
  };
}

const orderInput=(extra={})=>({
  requestId:randomUUID(),title:'과태료 변경부과',intent:'과태료 처리해',project:'',
  kind:'general',criteria:['AI Core 내부 Work에 안전하게 연결된다.'],...extra,
});

test('routed order becomes one durable Work, snapshot item and immutable binding',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderInput())).json();
  assert.equal(order.routing.capability_id,'operations.penalty.prepare');

  const [aResponse,bResponse]=await Promise.all([
    f.post(`/api/orders/${order.id}/work-intake`),
    f.post(`/api/orders/${order.id}/work-intake`),
  ]);
  const [a,b]=await Promise.all([aResponse.json(),bResponse.json()]);
  assert.equal(a.status,'WORK_LINKED');
  assert.equal(b.status,'WORK_LINKED');
  assert.equal(a.work_id,b.work_id);
  assert.equal(a.event_id,b.event_id);
  assert.equal(a.execution_authorized,false);

  const ledger=verifyLedgerText(readFileSync(f.ledgerPath,'utf8'));
  assert.equal(ledger.status,'VALID',JSON.stringify(ledger.errors));
  assert.equal(ledger.event_count,1);
  assert.equal(ledger.work[a.work_id].state,'RECEIVED');
  assert.equal(ledger.work[a.work_id].subject_revision,order.routing.target_revision);

  const snapshot=JSON.parse(readFileSync(f.snapshotPath,'utf8'));
  assert.equal(snapshot.items.length,1);
  assert.equal(snapshot.items[0].id,a.work_id);
  assert.equal(snapshot.items[0].subject_revision,order.routing.target_revision);
  assert.equal(snapshot.items[0].intent.status,'INFERRED');
  assert.equal(snapshot.items[0].authorization.status,'PENDING');

  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM coordination_bindings').get().n,1);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM work_intake_outbox').get().n,1);

  const projection=await (await fetch(`${f.url}/api/orders/${order.id}/work`)).json();
  assert.equal(projection.status,'LINKED',JSON.stringify(projection));
  assert.equal(projection.mapping.work_id,a.work_id);
  assert.equal(projection.canonical_state,'RECEIVED');
  assert.equal(projection.execution_authorized,false);
  assert.equal(projection.control_result.execute.enabled,false);
});

test('an already-bound requirement cannot reroute; revised requirement gets a new Work identity',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderInput())).json();
  const first=await (await f.post(`/api/orders/${order.id}/work-intake`)).json();
  assert.equal(first.status,'WORK_LINKED');

  const sameRevisionReroute=await f.post(`/api/orders/${order.id}/reroute`,{
    requestId:randomUUID(),version:order.version,
  });
  assert.equal(sameRevisionReroute.status,409);
  assert.equal((await sameRevisionReroute.json()).error,'ROUTING_REQUIRES_UNBOUND_REQUIREMENT');

  const revised=await (await f.post(`/api/orders/${order.id}`,{
    requestId:randomUUID(),version:order.version,action:'revise',
    intent:'ERP 상품 상세 고쳐',criteria:['상품 상세 규격을 수정한다.'],reason:'업무 목적 변경',
  })).json();
  assert.equal(revised.revision,2);

  const rerouted=await (await f.post(`/api/orders/${order.id}/reroute`,{
    requestId:randomUUID(),version:revised.version,
  })).json();
  assert.equal(rerouted.routing.requirement_revision,2);
  assert.equal(rerouted.project,'freepasserp4');
  assert.equal(rerouted.routing.capability_id,'erp.product');

  const second=await (await f.post(`/api/orders/${order.id}/work-intake`)).json();
  assert.equal(second.status,'WORK_LINKED');
  assert.notEqual(second.work_id,first.work_id);

  const ledger=verifyLedgerText(readFileSync(f.ledgerPath,'utf8'));
  assert.equal(ledger.event_count,2);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM coordination_bindings').get().n,2);
  const snapshot=JSON.parse(readFileSync(f.snapshotPath,'utf8'));
  assert.equal(snapshot.items.length,2);

  const projection=await (await fetch(`${f.url}/api/orders/${order.id}/work`)).json();
  assert.equal(projection.status,'LINKED',JSON.stringify(projection));
  assert.equal(projection.mapping.work_id,second.work_id);
  assert.equal(projection.mapping.requirement_revision,2);
  assert.equal(projection.control_result.execute.enabled,false);
});

test('known HOLD project is still tracked as Work while execution remains HOLD',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderInput({title:'보고서 제작',intent:'보고서 만들어'}))).json();
  assert.equal(order.project,'docshub');
  assert.equal(order.routing.status,'HOLD_PROJECT_HOLD');

  const linked=await (await f.post(`/api/orders/${order.id}/work-intake`)).json();
  assert.equal(linked.status,'WORK_LINKED');
  assert.equal(linked.execution_authorized,false);

  const projection=await (await fetch(`${f.url}/api/orders/${order.id}/work`)).json();
  assert.equal(projection.status,'HOLD');
  assert.equal(projection.reason,'PROJECT_NOT_ACTIVE');
});

test('project head drift blocks Work creation before binding or ledger write',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderInput())).json();

  const changed=structuredClone(projectRegistry);
  const aiops=changed.projects.find(p=>p.project_id==='aiops');
  aiops.head_revision='a'.repeat(40);
  for(const source of aiops.authoritative_sources??[]) if(source.kind==='GIT') source.revision=aiops.head_revision;
  writeFileSync(f.registryPath,JSON.stringify(changed,null,2));

  const result=await (await f.post(`/api/orders/${order.id}/work-intake`)).json();
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'ROUTE_REVISION_STALE');
  const tables=f.store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('coordination_bindings','work_intake_outbox')").all();
  assert.deepEqual(tables,[],'route validation must fail before producer tables are created');
  assert.equal(existsSync(f.ledgerPath),false);
});

test('revision changed after ledger append is held before snapshot projection',async t=>{
  const f=await fixture(t);
  const order=await (await f.post('/api/orders',orderInput())).json();
  const originalGet=f.store.get.bind(f.store);
  let reads=0;
  f.store.get=(id)=>{
    reads++;
    if(reads===3){
      f.store.get=originalGet;
      const current=originalGet(id);
      const revised=f.store.mutate(id,{
        requestId:randomUUID(),version:current.version,action:'revise',
        intent:'과태료 변경부과 수정',criteria:['수정된 요구만 Work에 연결된다.'],reason:'접수 중 요구 변경',
      });
      f.store.mutate(id,{
        requestId:randomUUID(),version:revised.version,action:'reroute',
        routing:{...order.routing,requirement_revision:revised.revision},
      });
    }
    return originalGet(id);
  };

  const result=await (await f.post(`/api/orders/${order.id}/work-intake`)).json();
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'REQUIREMENT_SUPERSEDED');
  assert.equal(result.requirement_revision,1);
  assert.ok(result.work_id);
  assert.equal(existsSync(f.snapshotPath),false,'superseded requirement must not enter current snapshot');

  const outbox=f.store.db.prepare(
    'SELECT state,reason FROM work_intake_outbox WHERE order_id=? AND requirement_revision=1'
  ).get(order.id);
  assert.equal(outbox.state,'HOLD');
  assert.equal(outbox.reason,'REQUIREMENT_SUPERSEDED');
  const ledger=verifyLedgerText(readFileSync(f.ledgerPath,'utf8'));
  assert.equal(ledger.status,'VALID');
  assert.equal(ledger.event_count,1,'immutable old-revision history remains evidence, not current projection');
});

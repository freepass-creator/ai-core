import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/orders/server.mjs';
import { verifyLedgerText } from '../scripts/work-ledger.mjs';

const workMap=JSON.parse(readFileSync(new URL('../registry/work-map.json',import.meta.url),'utf8'));
const projectRegistry=JSON.parse(readFileSync(new URL('../registry/projects.json',import.meta.url),'utf8'));
const capabilityRegistry=JSON.parse(readFileSync(new URL('../registry/capabilities.json',import.meta.url),'utf8'));
const routingConfig={workMap,projectRegistry,capabilityRegistry};

const orderInput=()=>({
  requestId:randomUUID(),title:'과태료 변경부과',intent:'과태료 처리해',project:'',
  kind:'general',criteria:['AI Core 내부 Work에 안전하게 연결된다.'],
});

test('concurrent distinct routed orders preserve both Work items in the shared snapshot',async t=>{
  const root=mkdtempSync(join(tmpdir(),'order-work-intake-concurrency-'));
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

  const post=(path,body={})=>fetch(started.url+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
  });
  const [orderA,orderB]=await Promise.all([
    post('/api/orders',orderInput()).then(r=>r.json()),
    post('/api/orders',orderInput()).then(r=>r.json()),
  ]);
  assert.notEqual(orderA.id,orderB.id);
  assert.equal(orderA.routing.capability_id,'operations.penalty.prepare');
  assert.equal(orderB.routing.capability_id,'operations.penalty.prepare');

  const [linkedA,linkedB]=await Promise.all([
    post(`/api/orders/${orderA.id}/work-intake`).then(r=>r.json()),
    post(`/api/orders/${orderB.id}/work-intake`).then(r=>r.json()),
  ]);
  assert.equal(linkedA.status,'WORK_LINKED');
  assert.equal(linkedB.status,'WORK_LINKED');
  assert.notEqual(linkedA.work_id,linkedB.work_id);

  const ledgerPath=join(root,'work-ledger.jsonl');
  const ledger=verifyLedgerText(readFileSync(ledgerPath,'utf8'));
  assert.equal(ledger.status,'VALID',JSON.stringify(ledger.errors));
  assert.equal(ledger.event_count,2);
  assert.ok(ledger.work[linkedA.work_id]);
  assert.ok(ledger.work[linkedB.work_id]);
  assert.equal(started.store.db.prepare('SELECT COUNT(*) AS n FROM coordination_bindings').get().n,2);

  const snapshot=JSON.parse(readFileSync(snapshotPath,'utf8'));
  assert.equal(snapshot.items.filter(item=>item.id===linkedA.work_id).length,1);
  assert.equal(snapshot.items.filter(item=>item.id===linkedB.work_id).length,1);
  assert.equal(snapshot.items.length,2);
});

import { createHash } from 'node:crypto';
import { readFile, writeFile, rename, unlink, mkdir, open, lstat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { appendLedgerEvent, verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { resolveWorkSourcePaths } from './order-work-sources.mjs';
import { BINDING_SCHEMA, requirementDigest } from './order-work-binder.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';

const need=(c,code)=>{if(!c) throw new Error(code);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'
  ?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const digest=v=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')}`;
const eventPayload=({previous_hash,event_hash,...event})=>event;
const hold=(reason,extra={})=>({status:'HOLD',reason,execution_authorized:false,completion_authorized:false,...extra});
const iso=clock=>new Date(clock()).toISOString().replace(/\.\d+Z$/,'Z');
const numericId=(prefix,value)=>`${prefix}-${BigInt('0x'+createHash('sha256').update(value).digest('hex')).toString(10)}`;
const RETRYABLE=new Set(['LEDGER_HEAD_CHANGED','LEDGER_LOCKED','SNAPSHOT_LOCKED','LEDGER_APPEND_NOT_OBSERVED','WORK_INTAKE_VERSION_CHANGED']);

const OUTBOX_SCHEMA=`
CREATE TABLE IF NOT EXISTS work_intake_outbox (
  command_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  requirement_revision INTEGER NOT NULL,
  work_id TEXT UNIQUE NOT NULL,
  project_id TEXT NOT NULL,
  subject_revision TEXT NOT NULL,
  event_id TEXT UNIQUE NOT NULL,
  event_json TEXT NOT NULL,
  event_digest TEXT NOT NULL,
  attempt_head TEXT,
  state TEXT NOT NULL CHECK(state IN ('PREPARED','LEDGER_OBSERVED','SNAPSHOT_WRITTEN','HOLD')),
  observed_head TEXT,
  reason TEXT,
  version INTEGER NOT NULL,
  UNIQUE(order_id,requirement_revision)
);
CREATE TABLE IF NOT EXISTS work_intake_history (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  command_id TEXT NOT NULL, state TEXT NOT NULL, head TEXT, reason TEXT, observed_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS work_intake_identity_no_update
BEFORE UPDATE OF command_id,order_id,requirement_revision,work_id,project_id,subject_revision,event_id,event_json,event_digest
ON work_intake_outbox BEGIN SELECT RAISE(ABORT,'WORK_INTAKE_IDENTITY_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS work_intake_no_delete
BEFORE DELETE ON work_intake_outbox BEGIN SELECT RAISE(ABORT,'WORK_INTAKE_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS work_intake_history_no_update
BEFORE UPDATE ON work_intake_history BEGIN SELECT RAISE(ABORT,'WORK_INTAKE_HISTORY_IMMUTABLE'); END;
CREATE TRIGGER IF NOT EXISTS work_intake_history_no_delete
BEFORE DELETE ON work_intake_history BEGIN SELECT RAISE(ABORT,'WORK_INTAKE_HISTORY_IMMUTABLE'); END;
`;

function snapshotItem(order,row,event,project){
  return {
    id:row.work_id, project_id:row.project_id, title:order.title,
    intent:{status:'INFERRED',provenance:'AI_INFERRED'},
    sources:[{ref:project.repository,revision:row.subject_revision,observed_at:event.observed_at,
      valid_until:event.observed_at,status:'CURRENT',severity:'MATERIAL'}],
    commitment:{status:'PROPOSED',accepted:false,owner:null,due_at:null,dependencies:[]},
    allocations:[], authorization:{required:true,status:'PENDING'},
    subject_revision:row.subject_revision,evidence_receipts:[],
    verification:'NOT_RUN',execution:'NOT_STARTED',outcome:'NOT_OBSERVED',
  };
}

export function createOrderWorkIntakeCoordinator({store,workSources,ordersDbPath,clock=Date.now}){
  need(store?.db&&typeof store.get==='function','DEPENDENCY_REQUIRED');
  const resolved=resolveWorkSourcePaths(workSources,{ordersDbPath});
  if(!resolved) return {intake:async()=>hold('WORK_SOURCES_UNCONFIGURED')};
  if(resolved.missing) return {intake:async()=>hold(`WORK_SOURCE_UNCONFIGURED_${String(resolved.missing).toUpperCase()}`)};
  const {paths}=resolved;
  if(paths.mappings!==null) return {intake:async()=>hold('OPERATING_MAPPING_CONVENTION_REQUIRED')};

  let initialized=false;
  const hasTable=name=>Boolean(store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
  const ensureTables=()=>{
    if(initialized) return;
    store.db.exec(BINDING_SCHEMA);
    store.db.exec(OUTBOX_SCHEMA);
    initialized=true;
  };

  const history=(id,state,head,reason)=>store.db.prepare(
    'INSERT INTO work_intake_history(command_id,state,head,reason,observed_at) VALUES (?,?,?,?,?)'
  ).run(id,state,head,reason,iso(clock));

  const rowById=id=>hasTable('work_intake_outbox')
    ? store.db.prepare('SELECT * FROM work_intake_outbox WHERE command_id=?').get(id)
    : null;
  const rowByOrder=(id,revision)=>hasTable('work_intake_outbox')
    ? store.db.prepare('SELECT * FROM work_intake_outbox WHERE order_id=? AND requirement_revision=?').get(id,revision)
    : null;

  function readRow(id){
    const row=rowById(id); need(row,'WORK_INTAKE_COMMAND_MISSING');
    const event=JSON.parse(row.event_json); need(digest(event)===row.event_digest,'WORK_INTAKE_EVENT_DIGEST_MISMATCH');
    need(event.event_id===row.event_id&&event.work_id===row.work_id&&event.project_id===row.project_id
      &&event.subject_revision===row.subject_revision,'WORK_INTAKE_EVENT_IDENTITY_MISMATCH');
    return {...row,event};
  }

  function state(row,next,{head=row.observed_head??null,reason=null,attemptHead=row.attempt_head??null}={}){
    store.db.exec('BEGIN IMMEDIATE');
    try{
      const result=store.db.prepare(
        'UPDATE work_intake_outbox SET state=?,observed_head=?,reason=?,attempt_head=?,version=version+1 WHERE command_id=? AND version=?'
      ).run(next,head,reason,attemptHead,row.command_id,row.version);
      need(result.changes===1,'WORK_INTAKE_VERSION_CHANGED');
      history(row.command_id,next,head,reason);
      store.db.exec('COMMIT');
    }catch(e){if(store.db.isTransaction)store.db.exec('ROLLBACK');throw e;}
    return readRow(row.command_id);
  }

  const receipt=row=>({
    status:row.state==='SNAPSHOT_WRITTEN'?'WORK_LINKED':row.state==='LEDGER_OBSERVED'?'LEDGER_OBSERVED':row.state==='PREPARED'?'PREPARED_NOT_SENT':'HOLD',
    reason:row.reason??null,order_id:row.order_id,requirement_revision:row.requirement_revision,
    work_id:row.work_id,project_id:row.project_id,subject_revision:row.subject_revision,
    command_id:row.command_id,event_id:row.event_id,ledger_observed:['LEDGER_OBSERVED','SNAPSHOT_WRITTEN'].includes(row.state),
    snapshot_written:row.state==='SNAPSHOT_WRITTEN',execution_authorized:false,completion_authorized:false,
  });

  async function registry(){
    try{return JSON.parse(await readFile(paths.registry,'utf8'));}
    catch(e){throw new Error(e?.code==='ENOENT'?'WORK_SOURCE_MISSING_REGISTRY':'WORK_SOURCE_UNREADABLE_REGISTRY');}
  }

  async function ledger(){
    const text=await readFile(paths.ledger,'utf8').catch(e=>e.code==='ENOENT'?'':Promise.reject(e));
    const parsed=verifyLedgerText(text); need(parsed.status==='VALID','LEDGER_INVALID');
    return {...parsed,text,events:text.trim()?text.trim().split(/\r?\n/).map(JSON.parse):[]};
  }

  function currentRoute(order,reg){
    const r=order.routing;
    need(r,'ROUTING_PROVENANCE_REQUIRED');
    need(r.requirement_revision===order.revision,'ROUTING_REQUIREMENT_STALE');
    need(r.target_project_id===order.project,'ROUTING_PROJECT_MISMATCH');
    const project=reg.projects?.find(p=>p.project_id===r.target_project_id);
    need(project,'PROJECT_NOT_REGISTERED');
    need(project.head_revision===r.target_revision,'ROUTE_REVISION_STALE');
    need(/^[0-9a-f]{40}$/.test(r.target_revision),'ROUTE_REVISION_INVALID');
    return {r,project};
  }

  async function prepare(orderId){
    const order=store.get(orderId), reg=await registry();
    const {r}=currentRoute(order,reg);
    /** 서버 시작만으로 mapping inventory를 «생성했다»고 만들지 않는다.
     * 실제 work-intake가 현재 route 검증을 통과한 뒤에만 producer schema를 만든다. */
    ensureTables();
    const commandId=`work-intake:${order.id}:${order.revision}`;
    const existing=rowByOrder(order.id,order.revision);
    if(existing) return readRow(existing.command_id);

    const oldBinding=store.db.prepare(
      'SELECT * FROM coordination_bindings WHERE order_id=? AND requirement_revision=?'
    ).get(order.id,order.revision);
    need(!oldBinding,'EXISTING_BINDING_NOT_OWNED_BY_INTAKE');

    const current=await ledger();
    const workId=numericId('WORK',`${order.id}|${order.revision}`);
    const eventId=numericId('INTAKEEVENT',`${order.id}|${order.revision}|created`);
    need(!current.work[workId],'WORK_ID_ALREADY_REGISTERED');
    const event={
      event_id:eventId,work_id:workId,project_id:r.target_project_id,type:'CREATED',
      from_state:null,to_state:'RECEIVED',actor:'AI_CORE_ROUTER',subject_revision:r.target_revision,
      observed_at:iso(clock),evidence_refs:[
        `RECEIVED:user order ${order.id} requirement ${order.revision} capability ${r.capability_id} @OrderStore`
      ],
    };

    store.db.exec('BEGIN IMMEDIATE');
    try{
      store.db.prepare(`INSERT INTO work_intake_outbox
        (command_id,order_id,requirement_revision,work_id,project_id,subject_revision,event_id,event_json,event_digest,attempt_head,state,observed_head,reason,version)
        VALUES (?,?,?,?,?,?,?,?,?,?,'PREPARED',NULL,NULL,1)`)
        .run(commandId,order.id,order.revision,workId,r.target_project_id,r.target_revision,eventId,JSON.stringify(event),digest(event),current.head);
      store.db.prepare(`INSERT INTO coordination_bindings
        (order_id,requirement_revision,work_id,project_id,subject_revision,requirement_digest,created_record_version,command_id,event_id)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(order.id,order.revision,workId,r.target_project_id,r.target_revision,requirementDigest(order),order.version,commandId,eventId);
      history(commandId,'PREPARED',current.head,null);
      store.db.exec('COMMIT');
    }catch(e){
      if(store.db.isTransaction)store.db.exec('ROLLBACK');
      const raced=rowByOrder(order.id,order.revision);
      if(raced) return readRow(raced.command_id);
      throw e;
    }
    return readRow(commandId);
  }

  async function reconcileLedger(row){
    let current=await ledger();
    const found=current.events.find(e=>e.event_id===row.event_id);
    if(found){
      need(digest(eventPayload(found))===row.event_digest,'EVENT_PAYLOAD_CONFLICT');
      if(!['LEDGER_OBSERVED','SNAPSHOT_WRITTEN'].includes(row.state)) row=state(row,'LEDGER_OBSERVED',{head:current.head});
      return {row,current};
    }
    need(!['LEDGER_OBSERVED','SNAPSHOT_WRITTEN'].includes(row.state),'OBSERVED_LEDGER_HISTORY_MISSING');

    const order=store.get(row.order_id), reg=await registry(); currentRoute(order,reg);
    need(order.revision===row.requirement_revision,'REQUIREMENT_SUPERSEDED');
    need(!current.work[row.work_id],'WORK_ID_ALREADY_REGISTERED');

    if(current.head!==row.attempt_head){
      row=state(row,'PREPARED',{attemptHead:current.head,head:null,reason:'HEAD_REVALIDATED'});
    }
    await appendLedgerEvent(paths.ledger,row.event,current.head);
    current=await ledger();
    const appended=current.events.find(e=>e.event_id===row.event_id);
    need(appended&&digest(eventPayload(appended))===row.event_digest,'LEDGER_APPEND_NOT_OBSERVED');
    row=state(row,'LEDGER_OBSERVED',{head:current.head,reason:null,attemptHead:current.head});
    return {row,current};
  }

  async function readSnapshot(){
    try{return JSON.parse(await readFile(paths.snapshot,'utf8'));}
    catch(e){if(e.code==='ENOENT')return null;throw new Error('WORK_SOURCE_UNREADABLE_SNAPSHOT');}
  }

  async function withSnapshotLock(fn){
    await mkdir(dirname(paths.snapshot),{recursive:true});
    const lockPath=`${paths.snapshot}.intake.lock`; let lock;
    try{lock=await open(lockPath,'wx');}
    catch(e){if(e.code==='EEXIST')throw new Error('SNAPSHOT_LOCKED');throw e;}
    try{
      try{const st=await lstat(paths.snapshot);need(!st.isSymbolicLink(),'SNAPSHOT_SYMLINK_DENIED');}
      catch(e){if(e.code!=='ENOENT')throw e;}
      return await fn();
    }finally{
      await lock?.close();
      await unlink(lockPath).catch(()=>{});
    }
  }

  async function writeSnapshotAtomic(snapshot){
    const tmp=join(dirname(paths.snapshot),`.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.snapshot.tmp`);
    try{
      await writeFile(tmp,JSON.stringify(snapshot,null,2)+'\n','utf8');
      await rename(tmp,paths.snapshot);
    }finally{
      await unlink(tmp).catch(()=>{});
    }
  }

  async function ensureSnapshot(row,current){
    const order=store.get(row.order_id), reg=await registry();
    const {project}=currentRoute(order,reg);
    await withSnapshotLock(async()=>{
      let snapshot=await readSnapshot();
      if(snapshot===null) snapshot={schema_version:'1.0',as_of:row.event.observed_at,capacities:[],items:[]};
      need(snapshot?.schema_version==='1.0'&&Array.isArray(snapshot.items)&&Array.isArray(snapshot.capacities),'WORK_SOURCE_UNREADABLE_SNAPSHOT');

      const found=snapshot.items.find(x=>x.id===row.work_id);
      if(found){
        need(found.project_id===row.project_id&&found.subject_revision===row.subject_revision,'SNAPSHOT_ITEM_CONFLICT');
        return;
      }
      snapshot={...snapshot,as_of:iso(clock),items:[...snapshot.items,snapshotItem(order,row,row.event,project)]};
      const checked=runControlTower({registry:reg,snapshot,ledgerText:current.text});
      need(checked.status!=='INVALID','CONTROL_SNAPSHOT_INVALID');
      await writeSnapshotAtomic(snapshot);
    });
    if(row.state!=='SNAPSHOT_WRITTEN') row=state(row,'SNAPSHOT_WRITTEN',{head:current.head,reason:null,attemptHead:row.attempt_head});
    return row;
  }

  async function intake(orderId){
    for(let attempt=0;attempt<3;attempt++){
      try{
        let row=await prepare(orderId);
        if(row.state==='HOLD') return receipt(row);
        const reconciled=await reconcileLedger(row); row=reconciled.row;
        row=await ensureSnapshot(row,reconciled.current);
        return receipt(row);
      }catch(error){
        const reason=/^[A-Z][A-Z0-9_]+$/.test(error?.message??'')?error.message:'WORK_INTAKE_FAILED';
        const order=(()=>{try{return store.get(orderId);}catch{return null;}})();
        const existing=order?rowByOrder(order.id,order.revision):null;
        if(RETRYABLE.has(reason)&&attempt<2){
          await new Promise(r=>setTimeout(r,10*(attempt+1)));
          continue;
        }
        if(existing&&!RETRYABLE.has(reason)){
          try{state(readRow(existing.command_id),'HOLD',{head:existing.observed_head,reason});}catch{}
        }
        return hold(reason,{order_id:orderId});
      }
    }
    return hold('WORK_INTAKE_RETRY_EXHAUSTED',{order_id:orderId});
  }

  return {intake,receipt,readOutbox:(orderId,revision)=>{const row=rowByOrder(orderId,revision);return row?receipt(readRow(row.command_id)):null;}};
}

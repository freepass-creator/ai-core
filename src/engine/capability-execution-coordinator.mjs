import { createHash } from 'node:crypto';
import { relative, isAbsolute } from 'node:path';
import { createTerminalReceiptReader } from './execution-receipt.mjs';

const need=(condition,code)=>{if(!condition) throw new Error(code);};
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const digest=value=>`sha256:${createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')}`;
const iso=clock=>new Date(clock()).toISOString();

export const CAPABILITY_EXECUTION_SCHEMA=`
  CREATE TABLE IF NOT EXISTS capability_execution_requests (
    request_id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    requirement_revision INTEGER NOT NULL,
    work_id TEXT NOT NULL,
    capability_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    subject_revision TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    input_digest TEXT NOT NULL,
    perform INTEGER NOT NULL,
    before_receipts_json TEXT,
    state TEXT NOT NULL CHECK(state IN ('RESERVED','RESULT')),
    result_json TEXT,
    reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS capability_execution_order
    ON capability_execution_requests(order_id,requirement_revision);
  CREATE TRIGGER IF NOT EXISTS capability_execution_identity_no_update
    BEFORE UPDATE OF request_id,order_id,requirement_revision,work_id,capability_id,project_id,subject_revision,payload_digest,input_digest,perform
    ON capability_execution_requests
    BEGIN SELECT RAISE(ABORT,'CAPABILITY_EXECUTION_IDENTITY_IMMUTABLE'); END;
  CREATE TRIGGER IF NOT EXISTS capability_execution_no_delete
    BEFORE DELETE ON capability_execution_requests
    BEGIN SELECT RAISE(ABORT,'CAPABILITY_EXECUTION_IMMUTABLE'); END;`;

function safeReceipt(result){
  need(result?.schema==='ai-core-work-result/v1','WORK_RESULT_SCHEMA_INVALID');
  const checks=Array.isArray(result.checks)?result.checks:[];
  return {
    schema:result.schema,
    order_id:result.order_id??null,
    work_id:result.work_id??null,
    project_id:result.project_id??null,
    capability_id:result.capability_id??null,
    subject_revision:result.subject_revision??null,
    mode:result.mode??null,
    status:result.status,
    summary:String(result.summary??'').slice(0,4000),
    artifact_refs:[...(result.artifact_refs??[])].map(String),
    evidence_refs:[...(result.evidence_refs??[])].map(String),
    checks:checks.map(item=>({
      name:String(item?.name??''),
      status:String(item?.status??''),
      detail:item?.detail==null?null:String(item.detail).slice(0,2000),
    })),
    execution:{
      performed:result.execution?.performed===true,
      external_effect:result.execution?.external_effect===true,
      started_at:result.execution?.started_at??null,
      ended_at:result.execution?.ended_at??null,
      authorization_source:result.execution?.authorization_source??null,
    },
    outcome:{observed:result.outcome?.observed===true},
    blockers:[...(result.blockers??[])].map(String),
    next_action:result.next_action==null?null:String(result.next_action).slice(0,4000),
    walls:[...(result.walls??[])].map(String),
  };
}

function rowReceipt(row){
  return row?.result_json?JSON.parse(row.result_json):null;
}

function relativeReceiptRef(projectRoot,path){
  const rel=relative(projectRoot,path);
  if(!rel||rel.startsWith('..')||isAbsolute(rel)) return null;
  return rel.replaceAll('\\','/');
}

export function createCapabilityExecutionCoordinator({
  store,
  projectRegistry,
  receiptReader=createTerminalReceiptReader(),
  clock=Date.now,
}={}){
  need(store?.db&&typeof store.get==='function','ORDER_STORE_REQUIRED');
  need(projectRegistry?.schema_version==='1.0'&&Array.isArray(projectRegistry.projects),'PROJECT_REGISTRY_REQUIRED');
  const projects=new Map(projectRegistry.projects.map(project=>[project.project_id,project]));
  store.db.exec(CAPABILITY_EXECUTION_SCHEMA);

  function getRow(requestId){
    return store.db.prepare('SELECT * FROM capability_execution_requests WHERE request_id=?').get(requestId)??null;
  }

  function currentBinding(order,workId){
    const table=store.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='coordination_bindings'").get();
    need(table,'WORK_BINDING_REQUIRED');
    const row=store.db.prepare(
      'SELECT * FROM coordination_bindings WHERE order_id=? AND requirement_revision=? AND work_id=?'
    ).get(order.id,order.revision,workId);
    need(row,'WORK_BINDING_REQUIRED');
    return row;
  }

  function validateOrderContext(order,workId,capability){
    need(order?.routing&&order.routing.requirement_revision===order.revision,'ROUTING_REQUIREMENT_STALE');
    need(order.routing.capability_id===capability.id,'CAPABILITY_ROUTE_MISMATCH');
    need(order.routing.target_project_id===capability.projects.find(id=>id===order.project)||capability.projects.includes('*'),'CAPABILITY_PROJECT_MISMATCH');
    need(order.routing.target_revision&&order.routing.target_revision.length===40,'ROUTE_REVISION_INVALID');
    const binding=currentBinding(order,workId);
    need(binding.project_id===order.routing.target_project_id,'WORK_BINDING_PROJECT_MISMATCH');
    need(binding.subject_revision===order.routing.target_revision,'WORK_BINDING_REVISION_STALE');
    return binding;
  }

  async function snapshotBefore(capability,project){
    if(!capability.receipt) return null;
    need(text(project?.local_path),'PROJECT_LOCAL_PATH_REQUIRED');
    const snap=await receiptReader.snapshot(project.local_path,capability.receipt);
    return [...snap.entries()];
  }

  function requestShape({requestId,order,workId,capability,input,perform}){
    const inputDigest=digest(input??{});
    const body={
      request_id:requestId,
      order_id:order.id,
      requirement_revision:order.revision,
      work_id:workId,
      capability_id:capability.id,
      project_id:order.routing.target_project_id,
      subject_revision:order.routing.target_revision,
      input_digest:inputDigest,
      perform:perform===true,
    };
    return {...body,payload_digest:digest(body)};
  }

  async function reserve({requestId,orderId,workId,capability,input={},perform=true}){
    need(text(requestId)&&requestId.length<=200,'EXECUTION_REQUEST_ID_INVALID');
    need(text(orderId)&&text(workId),'EXECUTION_CONTEXT_REQUIRED');
    need(capability?.status==='ACTIVE','CAPABILITY_NOT_ACTIVE');
    const order=store.get(orderId);
    validateOrderContext(order,workId,capability);
    const shape=requestShape({requestId,order,workId,capability,input,perform});

    const existing=getRow(requestId);
    if(existing){
      need(existing.payload_digest===shape.payload_digest,'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT');
      return {status:existing.state,replay:true,row:existing,result:rowReceipt(existing)};
    }

    const project=projects.get(shape.project_id);
    need(project,'PROJECT_NOT_REGISTERED');
    const before=await snapshotBefore(capability,project);
    const at=iso(clock);

    store.db.exec('BEGIN IMMEDIATE');
    try{
      const raced=getRow(requestId);
      if(raced){
        need(raced.payload_digest===shape.payload_digest,'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT');
        store.db.exec('COMMIT');
        return {status:raced.state,replay:true,row:raced,result:rowReceipt(raced)};
      }
      store.db.prepare(`INSERT INTO capability_execution_requests
        (request_id,order_id,requirement_revision,work_id,capability_id,project_id,subject_revision,payload_digest,input_digest,perform,before_receipts_json,state,result_json,reason,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(requestId,shape.order_id,shape.requirement_revision,shape.work_id,shape.capability_id,shape.project_id,
          shape.subject_revision,shape.payload_digest,shape.input_digest,shape.perform?1:0,
          before===null?null:JSON.stringify(before),'RESERVED',null,null,at,at);
      store.db.exec('COMMIT');
    }catch(error){
      if(store.db.isTransaction) store.db.exec('ROLLBACK');
      throw error;
    }
    return {status:'RESERVED',replay:false,row:getRow(requestId),result:null};
  }

  function complete(requestId,result,{reason=null}={}){
    const row=getRow(requestId);
    need(row,'CAPABILITY_EXECUTION_REQUEST_MISSING');
    const receipt=safeReceipt(result);
    need(receipt.order_id===row.order_id&&receipt.work_id===row.work_id,'WORK_RESULT_CONTEXT_MISMATCH');
    need(receipt.capability_id===row.capability_id&&receipt.project_id===row.project_id,'WORK_RESULT_CAPABILITY_MISMATCH');
    need(receipt.subject_revision===row.subject_revision,'WORK_RESULT_REVISION_STALE');

    if(row.state==='RESULT'){
      const prior=rowReceipt(row);
      need(digest(prior)===digest(receipt),'CAPABILITY_EXECUTION_RESULT_CONFLICT');
      return prior;
    }
    const at=iso(clock);
    store.db.prepare('UPDATE capability_execution_requests SET state=?,result_json=?,reason=?,updated_at=? WHERE request_id=? AND state=?')
      .run('RESULT',JSON.stringify(receipt),reason,at,requestId,'RESERVED');
    return rowReceipt(getRow(requestId));
  }

  async function reconcile(requestId,capability){
    const row=getRow(requestId);
    need(row,'CAPABILITY_EXECUTION_REQUEST_MISSING');
    if(row.state==='RESULT') return {status:'RESULT',result:rowReceipt(row),reconciled:true};
    if(!capability?.receipt) return {status:'HOLD',reason:'EXECUTION_OUTCOME_UNKNOWN',reconciled:false};

    const project=projects.get(row.project_id);
    need(project&&text(project.local_path),'PROJECT_LOCAL_PATH_REQUIRED');
    const before=new Map(JSON.parse(row.before_receipts_json??'[]'));
    const observed=await receiptReader.reconcile(project.local_path,capability.receipt,before);
    if(observed.status==='HOLD'&&observed.reason==='EXECUTION_RECEIPT_MISSING'){
      return {status:'HOLD',reason:'EXECUTION_OUTCOME_UNKNOWN',reconciled:false};
    }

    const ref=observed.path?relativeReceiptRef(project.local_path,observed.path):null;
    const mapped=observed.status==='SUCCEEDED'?'SUCCEEDED':observed.status==='FAILED'?'FAILED':'HOLD';
    const result={
      schema:'ai-core-work-result/v1',
      order_id:row.order_id,work_id:row.work_id,project_id:row.project_id,capability_id:row.capability_id,
      subject_revision:row.subject_revision,mode:capability.mode,status:mapped,
      summary:mapped==='SUCCEEDED'?'응답 유실 뒤 terminal execution receipt로 성공을 재확인했습니다.'
        :mapped==='FAILED'?'응답 유실 뒤 terminal execution receipt에서 실패를 확인했습니다.'
          :'응답 유실 뒤 terminal execution receipt가 HOLD 상태입니다.',
      artifact_refs:ref?[ref]:[],
      evidence_refs:ref?[`MEASURED:${ref} state=${observed.state??'unknown'}`]:[],
      checks:[{name:'execution.receipt.reconcile',status:mapped==='SUCCEEDED'?'PASS':'FAIL',detail:observed.state??observed.reason??null}],
      execution:{performed:true,external_effect:capability.mode==='EXTERNAL_MUTATION',started_at:null,ended_at:iso(clock),authorization_source:null},
      outcome:{observed:mapped==='SUCCEEDED',data:null},
      blockers:mapped==='SUCCEEDED'?[]:[observed.reason??'EXECUTION_RECEIPT_HOLD'],
      next_action:mapped==='SUCCEEDED'?'정본 상태 전이는 기존 Control Tower/Work Ledger 규칙으로 계속합니다.':'terminal receipt 내용을 확인합니다.',
      walls:[...(capability.walls??[])],
    };
    const saved=complete(requestId,result,{reason:'RECONCILED_FROM_TERMINAL_RECEIPT'});
    return {status:'RESULT',result:saved,reconciled:true};
  }

  function list(orderId){
    need(text(orderId),'ORDER_ID_REQUIRED');
    return store.db.prepare('SELECT * FROM capability_execution_requests WHERE order_id=? ORDER BY created_at,request_id')
      .all(orderId).map(row=>({
        request_id:row.request_id,requirement_revision:row.requirement_revision,work_id:row.work_id,
        capability_id:row.capability_id,project_id:row.project_id,subject_revision:row.subject_revision,
        state:row.state,reason:row.reason,created_at:row.created_at,updated_at:row.updated_at,
        result:rowReceipt(row),
      }));
  }

  return Object.freeze({reserve,complete,reconcile,list,get:(requestId)=>getRow(requestId)});
}

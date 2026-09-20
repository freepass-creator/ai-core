import { randomUUID } from 'node:crypto';
import { executionLeaseKey, validateExecutionLease, leaseMatchesExecution } from '../contracts/execution-lease.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const iso=value=>new Date(value).toISOString();

function active(lease,nowMs){
  return lease?.state==='ACTIVE'&&Date.parse(lease.lease_until)>nowMs;
}

function expired(lease,nowMs){
  return lease?.state==='ACTIVE'&&Date.parse(lease.lease_until)<=nowMs;
}

function nextState(current,lease){
  return {
    max_fencing_token:Math.max(current?.max_fencing_token??0,lease?.fencing_token??0),
    lease:lease??null
  };
}

export function createMemoryExecutionLeaseStore(){
  const rows=new Map();
  return {
    async read(key){
      const row=rows.get(key);
      return row?structuredClone(row):null;
    },
    async compareAndSwap(key,expectedVersion,state){
      const current=rows.get(key)??null;
      const actualVersion=current?.version??0;
      if(actualVersion!==expectedVersion) return {ok:false,version:actualVersion};
      const version=actualVersion+1;
      rows.set(key,{version,state:structuredClone(state)});
      return {ok:true,version};
    },
    async inspect(key){
      return this.read(key);
    }
  };
}

export function createExecutionLeaseRuntime({
  store,
  clock=Date.now,
  defaultLeaseMs=30_000,
  maxCasAttempts=5,
  idFactory=()=>randomUUID(),
}={}){
  need(store&&typeof store.read==='function'&&typeof store.compareAndSwap==='function','EXECUTION_LEASE_CAS_STORE_REQUIRED');
  need(Number.isInteger(defaultLeaseMs)&&defaultLeaseMs>0,'EXECUTION_LEASE_DURATION_INVALID');

  async function acquire({execution,owner_id,lease_ms=defaultLeaseMs}={}){
    need(execution&&text(execution.logical_execution_id)&&text(execution.identity_digest)&&text(execution.attempt_id),'EXECUTION_LEASE_EXECUTION_REQUIRED');
    need(text(owner_id),'EXECUTION_LEASE_OWNER_REQUIRED');
    need(Number.isInteger(lease_ms)&&lease_ms>0,'EXECUTION_LEASE_DURATION_INVALID');
    const key=executionLeaseKey(execution);

    for(let i=0;i<maxCasAttempts;i++){
      const row=await store.read(key);
      const version=row?.version??0;
      const state=row?.state??{max_fencing_token:0,lease:null};
      const current=state.lease;
      if(current) validateExecutionLease(current);
      const nowMs=Number(clock());

      if(active(current,nowMs)){
        if(leaseMatchesExecution(current,execution)&&current.owner_id===owner_id){
          return {action:'ALREADY_OWNED',key,version,lease:current};
        }
        return {
          action:'BUSY',
          key,
          version,
          lease:current,
          reason:'LIVE_LEASE_PRESENT'
        };
      }

      const maxToken=Math.max(state.max_fencing_token??0,current?.fencing_token??0);
      need(Number.isSafeInteger(maxToken)&&maxToken<Number.MAX_SAFE_INTEGER,'EXECUTION_LEASE_FENCE_EXHAUSTED');
      const token=maxToken+1;
      const lease={
        schema_version:'core-execution-lease/v1',
        lease_id:'lease.'+idFactory(),
        logical_execution_id:execution.logical_execution_id,
        identity_digest:execution.identity_digest,
        attempt_id:execution.attempt_id,
        owner_id,
        fencing_token:token,
        state:'ACTIVE',
        claimed_at:iso(nowMs),
        lease_until:iso(nowMs+lease_ms),
        heartbeat_at:null,
        released_at:null
      };
      validateExecutionLease(lease);
      const next=nextState(state,lease);
      const cas=await store.compareAndSwap(key,version,next);
      if(cas.ok){
        return {
          action:expired(current,nowMs)?'ACQUIRED_AFTER_EXPIRY':'ACQUIRED',
          key,
          version:cas.version,
          lease,
          superseded_lease:expired(current,nowMs)?current:null
        };
      }
    }
    return {action:'HOLD',reason:'EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED',lease:null};
  }

  async function renew({lease,lease_ms=defaultLeaseMs}={}){
    validateExecutionLease(lease);
    need(lease.state==='ACTIVE','EXECUTION_LEASE_NOT_ACTIVE');
    const key=executionLeaseKey(lease);

    for(let i=0;i<maxCasAttempts;i++){
      const row=await store.read(key);
      const version=row?.version??0;
      const state=row?.state??{max_fencing_token:0,lease:null};
      const current=state.lease;
      const nowMs=Number(clock());
      need(current,'EXECUTION_LEASE_NOT_FOUND');
      need(current.fencing_token===lease.fencing_token,'STALE_FENCING_TOKEN');
      need(current.lease_id===lease.lease_id,'EXECUTION_LEASE_ID_MISMATCH');
      need(current.owner_id===lease.owner_id&&current.attempt_id===lease.attempt_id,'EXECUTION_LEASE_OWNER_MISMATCH');
      need(active(current,nowMs),'EXECUTION_LEASE_EXPIRED');

      const renewed={
        ...current,
        lease_until:iso(nowMs+lease_ms),
        heartbeat_at:iso(nowMs)
      };
      const cas=await store.compareAndSwap(key,version,nextState(state,renewed));
      if(cas.ok) return {action:'RENEWED',key,version:cas.version,lease:renewed};
    }
    throw Object.assign(new Error('EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED'),{code:'EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED'});
  }

  async function assertFence({lease}={}){
    validateExecutionLease(lease);
    const key=executionLeaseKey(lease);
    const row=await store.read(key);
    const current=row?.state?.lease??null;
    const nowMs=Number(clock());
    need(current,'EXECUTION_LEASE_NOT_FOUND');
    need(current.state==='ACTIVE','EXECUTION_LEASE_NOT_ACTIVE');
    need(Date.parse(current.lease_until)>nowMs,'EXECUTION_LEASE_EXPIRED');
    need(current.fencing_token===lease.fencing_token,'STALE_FENCING_TOKEN',{
      expected:current.fencing_token,
      actual:lease.fencing_token
    });
    need(current.lease_id===lease.lease_id,'EXECUTION_LEASE_ID_MISMATCH');
    need(current.owner_id===lease.owner_id&&current.attempt_id===lease.attempt_id,'EXECUTION_LEASE_OWNER_MISMATCH');
    return {status:'CURRENT',key,version:row.version,lease:current};
  }

  async function release({lease}={}){
    validateExecutionLease(lease);
    const key=executionLeaseKey(lease);

    for(let i=0;i<maxCasAttempts;i++){
      const row=await store.read(key);
      const version=row?.version??0;
      const state=row?.state??{max_fencing_token:0,lease:null};
      const current=state.lease;
      need(current,'EXECUTION_LEASE_NOT_FOUND');
      need(current.fencing_token===lease.fencing_token,'STALE_FENCING_TOKEN');
      need(current.lease_id===lease.lease_id,'EXECUTION_LEASE_ID_MISMATCH');
      need(current.owner_id===lease.owner_id&&current.attempt_id===lease.attempt_id,'EXECUTION_LEASE_OWNER_MISMATCH');

      const released={
        ...current,
        state:'RELEASED',
        released_at:iso(Number(clock()))
      };
      const cas=await store.compareAndSwap(key,version,nextState(state,released));
      if(cas.ok) return {action:'RELEASED',key,version:cas.version,lease:released};
    }
    throw Object.assign(new Error('EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED'),{code:'EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED'});
  }

  return Object.freeze({acquire,renew,assertFence,release});
}

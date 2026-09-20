import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createExecutionLeaseRuntime, createMemoryExecutionLeaseStore } from '../src/workflow/execution-lease-runtime.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const leaseSchema=JSON.parse(await readFile(new URL('../contracts/core-execution-lease.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv); ajv.addSchema(types); ajv.addSchema(leaseSchema);
const validateLease=ajv.getSchema('https://schemas.freepass.ai/core/execution-lease/v1');

const execution=(attemptId='attempt-1')=>({
  logical_execution_id:'logical.execution.1',
  identity_digest:'sha256:'+'a'.repeat(64),
  attempt_id:attemptId,
  attempt_sequence:attemptId==='attempt-1'?1:2,
  execution_path:attemptId==='attempt-1'?'NATIVE':'FALLBACK',
  parent_attempt_id:attemptId==='attempt-1'?null:'attempt-1'
});

test('first acquire creates schema-valid active lease with fencing token 1',async()=>{
  let now=Date.parse('2026-09-20T10:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({store,clock:()=>now,defaultLeaseMs:1000,idFactory:()=> 'lease-1'});
  const result=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  assert.equal(result.action,'ACQUIRED');
  assert.equal(result.lease.fencing_token,1);
  assert.equal(result.lease.state,'ACTIVE');
  assert.equal(validateLease(result.lease),true,JSON.stringify(validateLease.errors));
  assert.equal((await runtime.assertFence({lease:result.lease})).status,'CURRENT');
});

test('live lease excludes another worker and duplicate same-owner invocation does not piggyback',async()=>{
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>Date.parse('2026-09-20T10:00:00Z'),defaultLeaseMs:1000,
    idFactory:()=> 'lease-1'
  });
  const first=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  const busy=await runtime.acquire({execution:execution('attempt-2'),owner_id:'worker-b'});
  const duplicate=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  assert.equal(first.action,'ACQUIRED');
  assert.equal(busy.action,'BUSY');
  assert.equal(duplicate.action,'ALREADY_OWNED');
  assert.equal(duplicate.lease.fencing_token,1);
});

test('expired lease can be reacquired only with a higher fencing token',async()=>{
  let now=Date.parse('2026-09-20T10:00:00Z');
  let ids=0;
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,
    idFactory:()=> 'lease-'+(++ids)
  });
  const first=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  now+=1001;
  const second=await runtime.acquire({execution:execution('attempt-2'),owner_id:'worker-b'});
  assert.equal(second.action,'ACQUIRED_AFTER_EXPIRY');
  assert.equal(second.lease.fencing_token,2);
  await assert.rejects(()=>runtime.assertFence({lease:first.lease}),/STALE_FENCING_TOKEN/);
  await assert.rejects(()=>runtime.release({lease:first.lease}),/STALE_FENCING_TOKEN/);
  assert.equal((await runtime.assertFence({lease:second.lease})).status,'CURRENT');
});

test('release followed by reacquire still increments fencing token',async()=>{
  let now=Date.parse('2026-09-20T10:00:00Z');
  let ids=0;
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,
    idFactory:()=> 'lease-'+(++ids)
  });
  const first=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  const released=await runtime.release({lease:first.lease});
  assert.equal(released.action,'RELEASED');
  const second=await runtime.acquire({execution:execution('attempt-2'),owner_id:'worker-b'});
  assert.equal(second.action,'ACQUIRED');
  assert.equal(second.lease.fencing_token,2);
});

test('expired lease cannot be renewed back into ownership',async()=>{
  let now=Date.parse('2026-09-20T10:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,idFactory:()=> 'lease-1'
  });
  const first=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  now+=1001;
  await assert.rejects(()=>runtime.renew({lease:first.lease}),/EXECUTION_LEASE_EXPIRED/);
});

test('renew keeps fencing token stable while extending lease',async()=>{
  let now=Date.parse('2026-09-20T10:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,idFactory:()=> 'lease-1'
  });
  const first=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  now+=500;
  const renewed=await runtime.renew({lease:first.lease,lease_ms:2000});
  assert.equal(renewed.action,'RENEWED');
  assert.equal(renewed.lease.fencing_token,1);
  assert.equal(renewed.lease.heartbeat_at,new Date(now).toISOString());
  assert.equal(renewed.lease.lease_until,new Date(now+2000).toISOString());
});

test('compare-and-swap conflict is retried rather than creating two token-1 leases',async()=>{
  const base=createMemoryExecutionLeaseStore();
  let injected=false;
  const store={
    read:key=>base.read(key),
    inspect:key=>base.inspect(key),
    async compareAndSwap(key,expected,state){
      if(!injected){
        injected=true;
        return {ok:false,version:expected+1};
      }
      return base.compareAndSwap(key,expected,state);
    }
  };
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>Date.parse('2026-09-20T10:00:00Z'),defaultLeaseMs:1000,
    maxCasAttempts:3,idFactory:()=> 'lease-1'
  });
  const result=await runtime.acquire({execution:execution(),owner_id:'worker-a'});
  assert.equal(result.action,'ACQUIRED');
  assert.equal(result.lease.fencing_token,1);
});

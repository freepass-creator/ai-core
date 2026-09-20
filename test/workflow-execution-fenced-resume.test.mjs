import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { createExecutionLeaseRuntime, createMemoryExecutionLeaseStore } from '../src/workflow/execution-lease-runtime.mjs';
import { prepareEffectResumeFromReceipts } from '../src/workflow/effect-receipt-resume-runtime.mjs';
import { executeFencedPreparedEffectResume } from '../src/workflow/execution-fenced-resume-runtime.mjs';

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.fenced.resume',
  dimensions:{
    operation_kind:'workflow.effect-resume',
    logical_slot:'slot-1',
    subject_scope:{scope_type:'test',scope_key:'subject-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T14:00:00Z'
});
const attempt1=bindExecutionAttempt(identity,{
  attemptId:'attempt-fence-1',attemptSequence:1,executionPath:'FALLBACK'
});
const attempt2=bindExecutionAttempt(identity,{
  attemptId:'attempt-fence-2',attemptSequence:2,executionPath:'FALLBACK',parentAttemptId:'attempt-fence-1'
});

const baseEffects=()=>[
  {effect_id:'a',compensation_mode:'REQUIRED',compensation_action:'undo.a'},
  {effect_id:'b',compensation_mode:'REQUIRED',compensation_action:'undo.b'}
];

const bindings=[{
  schema_version:'workflow-effect-receipt-binding/v1',
  binding_id:'bridge.unused-a',
  effect_id:'a',
  phase:'EFFECT',
  selector:{operation_kind:'unused.a',executor:'unused.executor'},
  child_relation:'OTHER',
  require_execution_binding:true,
  partial_policy:'HOLD',
  proof_policy:'PRESERVE_AND_REVERIFY'
}];

const receiptOptions=(id)=>({
  receipt_id:id,
  actor:'system:test',
  executor:'workflow.effect-resume',
  source_revision:'git:fence',
  reproducibility:{
    deterministic:false,
    executor_version:'1.0.0',
    environment_revision:'env:test',
    command_ref:'effect-resume'
  },
  execution:attempt1
});

function prepared(effects=baseEffects()){
  return prepareEffectResumeFromReceipts({
    effects,
    bindings,
    receipts:[],
    target_execution:attempt1,
    prepared_at:'2026-09-20T14:00:00Z'
  });
}

test('competing live lease blocks second worker before any effect executes',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({store,clock:()=>now,defaultLeaseMs:5000,idFactory:()=> 'owner-a'});
  const held=await runtime.acquire({execution:attempt1,owner_id:'worker-a'});
  assert.equal(held.action,'ACQUIRED');

  let calls=0;
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-b',
    prepared_plan:prepared(),
    effects:baseEffects(),
    bindings,
    receipts:[],
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-busy',
    receipt:receiptOptions('receipt.fence.busy'),
    execute_effect:async()=>{calls++;return{status:'SUCCEEDED'};},
    execute_compensation:async()=>{calls++;return{status:'SUCCEEDED'};},
    clock:()=>now
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_LEASE_BUSY');
  assert.equal(out.executed,false);
  assert.equal(calls,0);
});

test('same owner duplicate invocation cannot piggyback an already-owned lease',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({store,clock:()=>now,defaultLeaseMs:5000,idFactory:()=> 'same-owner'});
  await runtime.acquire({execution:attempt1,owner_id:'worker-a'});
  let calls=0;
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-a',
    prepared_plan:prepared(),
    effects:baseEffects(),
    bindings,
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-same-owner',
    receipt:receiptOptions('receipt.fence.same-owner'),
    execute_effect:async()=>{calls++;return{status:'SUCCEEDED'};},
    execute_compensation:async()=>{calls++;return{status:'SUCCEEDED'};},
    clock:()=>now
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'EXECUTION_LEASE_ALREADY_OWNED');
  assert.equal(calls,0);
});

test('happy path renews the same fencing token before every effect and releases lease',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  let ids=0;
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:5000,idFactory:()=> 'lease-'+(++ids)
  });
  const tokens=[];
  const calls=[];
  const effects=baseEffects();
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-a',
    lease_ms:5000,
    prepared_plan:prepared(effects),
    effects,
    bindings,
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-happy',
    receipt:receiptOptions('receipt.fence.happy'),
    execute_effect:async(effect,context)=>{
      calls.push('do:'+effect.effect_id);
      tokens.push(context.fencing_token);
      now+=100;
      return {status:'SUCCEEDED',data:{effect:effect.effect_id}};
    },
    execute_compensation:async()=>{throw new Error('must not run');},
    clock:()=>now
  });
  assert.equal(out.status,'SUCCEEDED');
  assert.deepEqual(calls,['do:a','do:b']);
  assert.deepEqual(tokens,[1,1]);
  assert.equal(out.lease.fencing_token,1);
  assert.equal(out.lease_release.action,'RELEASED');
  assert.equal(out.coordination_warning,null);
});

test('plan changed during lease acquisition is rechecked and blocks execution',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  const store=createMemoryExecutionLeaseStore();
  const baseRuntime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:5000,idFactory:()=> 'plan-change'
  });
  const effects=baseEffects();
  const preparedPlan=prepared(effects);
  const runtime={
    ...baseRuntime,
    async acquire(args){
      const result=await baseRuntime.acquire(args);
      effects[0].compensation_action='undo.a.v2';
      return result;
    }
  };
  let calls=0;
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-a',
    prepared_plan:preparedPlan,
    effects,
    bindings,
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-plan-change',
    receipt:receiptOptions('receipt.fence.plan-change'),
    execute_effect:async()=>{calls++;return{status:'SUCCEEDED'};},
    execute_compensation:async()=>{calls++;return{status:'SUCCEEDED'};},
    clock:()=>now
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'STALE_RESUME_PLAN_AFTER_LEASE');
  assert.equal(out.executed,false);
  assert.equal(calls,0);
  assert.equal(out.lease_release.action,'RELEASED');
});

test('lease superseded between effects preserves first effect receipt and blocks second effect',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  let ids=0;
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,idFactory:()=> 'lease-'+(++ids)
  });
  const calls=[];
  const effects=baseEffects();
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-a',
    lease_ms:1000,
    prepared_plan:prepared(effects),
    effects,
    bindings,
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-stolen-between',
    receipt:receiptOptions('receipt.fence.stolen-between'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      if(effect.effect_id==='a'){
        now+=1001;
        const takeover=await runtime.acquire({execution:attempt2,owner_id:'worker-b',lease_ms:1000});
        assert.equal(takeover.action,'ACQUIRED_AFTER_EXPIRY');
        assert.equal(takeover.lease.fencing_token,2);
      }
      return {status:'SUCCEEDED',data:{effect:effect.effect_id}};
    },
    execute_compensation:async(step)=>{
      calls.push('undo:'+step.effect_id);
      return {status:'SUCCEEDED'};
    },
    clock:()=>now
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.executed,true);
  assert.deepEqual(calls,['do:a']);
  assert.equal(out.result.status,'HOLD');
  assert.equal(out.result.reason,'STALE_FENCING_TOKEN');
  assert.equal(out.result.action_receipts.length,1);
  assert.equal(out.result.action_receipts[0].metrics.effect_id,'a');
  assert.equal(out.result.receipt.status,'HOLD');
  assert.equal(out.lease_release.action,'RELEASE_FAILED');
  assert.equal(out.coordination_warning,'EXECUTION_LEASE_RELEASE_FAILED');
});

test('lease superseded before compensation yields PARTIAL and does not compensate under stale fence',async()=>{
  let now=Date.parse('2026-09-20T14:00:00Z');
  let ids=0;
  const store=createMemoryExecutionLeaseStore();
  const runtime=createExecutionLeaseRuntime({
    store,clock:()=>now,defaultLeaseMs:1000,idFactory:()=> 'lease-'+(++ids)
  });
  const calls=[];
  const effects=baseEffects();
  const out=await executeFencedPreparedEffectResume({
    lease_runtime:runtime,
    owner_id:'worker-a',
    lease_ms:1000,
    prepared_plan:prepared(effects),
    effects,
    bindings,
    target_execution:attempt1,
    current_attempt:attempt1,
    correlation_id:'corr-stolen-comp',
    receipt:receiptOptions('receipt.fence.stolen-comp'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      if(effect.effect_id==='b'){
        now+=1001;
        const takeover=await runtime.acquire({execution:attempt2,owner_id:'worker-b',lease_ms:1000});
        assert.equal(takeover.action,'ACQUIRED_AFTER_EXPIRY');
        return {status:'FAILED',error_code:'B_FAILED'};
      }
      return {status:'SUCCEEDED'};
    },
    execute_compensation:async(step)=>{
      calls.push('undo:'+step.effect_id);
      return {status:'SUCCEEDED'};
    },
    clock:()=>now
  });
  assert.equal(out.status,'PARTIAL_STATE');
  assert.equal(out.executed,true);
  assert.deepEqual(calls,['do:a','do:b']);
  assert.equal(out.result.status,'PARTIAL_STATE');
  assert.equal(out.result.execution_result.action,'ESCALATE');
  assert.equal(out.result.execution_result.gate_error_code,'STALE_FENCING_TOKEN');
  assert.equal(out.result.receipt.status,'PARTIAL');
  assert.equal(out.lease_release.action,'RELEASE_FAILED');
});

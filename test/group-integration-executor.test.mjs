import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroupIntegrationExecutor } from '../src/engine/group-integration-executor.mjs';

const packet=(overrides={})=>({
  schema:'ai-core-integration-work-packet/v1',
  packet_id:'INT-WP-001-sales',
  plan_id:'AI-CORE-MERGE-P0',
  asset_id:'sales',
  project_id:'freepass-sales',
  repository:'freepass-creator/freepass-sales',
  expected_revision:'a'.repeat(40),
  classification:'KEEP_SEPARATE',
  action_kind:'METADATA_ONLY',
  current_path:'C:/dev/sales',
  planned_steps:['PIN_SOURCE_REVISION'],
  preconditions:{dirty_state:'CLEAN',reviewer_consensus:['CONSENSUS'],evidence_refs:['GIT:x'],required_approvals:[],approval_refs:[],unknowns_must_be_empty:true},
  authority:{required:true,status:'PENDING',execution_authorized:false,scope:['repository:freepass-creator/freepass-sales']},
  revalidation:{immediately_before_execution:true,required_checks:['SOURCE_REVISION_UNCHANGED','DIRTY_STATE_RECHECK','PLAN_ITEM_STILL_READY','PROJECT_AUTHORITY_UNCHANGED']},
  verification:{required:true,checks:['SOURCE_REVISION_UNCHANGED','DIRTY_STATE_RECHECK','PLAN_ITEM_STILL_READY','PROJECT_AUTHORITY_UNCHANGED'],evidence_must_bind_revision:true},
  rollback:{required:false,ready:true},
  forbidden_actions:['MERGE_GIT_HISTORY'],
  completion:{auto_complete:false,requires_verification_evidence:true,requires_work_ledger_result:true},
  ...overrides,
});

const observation=(overrides={})=>({
  repository:'freepass-creator/freepass-sales',
  revision:'a'.repeat(40),
  dirty_state:'CLEAN',
  observed_at:'2026-09-20T09:40:00Z',
  checks:[{name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS'}],
  ...overrides,
});

const verification=()=>[
  {name:'SOURCE_REVISION_UNCHANGED',status:'PASS',evidence_ref:'check:revision'},
  {name:'DIRTY_STATE_RECHECK',status:'PASS',evidence_ref:'check:dirty'},
  {name:'PLAN_ITEM_STILL_READY',status:'PASS',evidence_ref:'check:plan'},
  {name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS',evidence_ref:'check:authority'},
];

function executor(overrides={}){
  let observations=0;
  return createGroupIntegrationExecutor({
    observeRepository:async()=>{observations+=1; return observation({observed_at:`2026-09-20T09:40:0${observations}Z`});},
    verifyAuthority:async()=>({ok:true,ref:'work-ledger:event-123'}),
    adapters:new Map([['KEEP_SEPARATE',{
      execute:async()=>({
        status:'SUCCEEDED',
        performed:true,
        output_refs:['artifact:result'],
        output_digest:'sha256:'+'b'.repeat(64),
        evidence_refs:['commit:result'],
        deterministic:true,
        executor_version:'integration-adapter/v1',
        environment_revision:'env-1',
        command_ref:'metadata-update/v1',
      }),
    }]]),
    verifyExecution:async()=>verification(),
    clock:(()=>{let t=Date.parse('2026-09-20T09:41:00Z');return()=>{const out=t;t+=1000;return out;};})(),
    ...overrides,
  });
}

test('default executor cannot prepare without a registered classification adapter',async()=>{
  const e=createGroupIntegrationExecutor({
    observeRepository:async()=>observation(),
    verifyAuthority:async()=>({ok:true,ref:'x'}),
    adapters:new Map(),
    verifyExecution:async()=>verification(),
  });
  const result=await e.prepare({packet:packet()});
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'INTEGRATION_EXECUTION_ADAPTER_MISSING');
});

test('perform=false prepares only and never observes or executes',async()=>{
  let observed=0,executed=0;
  const e=createGroupIntegrationExecutor({
    observeRepository:async()=>{observed+=1;return observation();},
    verifyAuthority:async()=>({ok:true,ref:'x'}),
    adapters:new Map([['KEEP_SEPARATE',{execute:async()=>{executed+=1;return{};}}]]),
    verifyExecution:async()=>verification(),
  });
  const result=await e.run({packet:packet(),perform:false});
  assert.equal(result.status,'PREPARED');
  assert.equal(observed,0);
  assert.equal(executed,0);
});

test('perform=true requires verified authority with a reference',async()=>{
  const e=executor({verifyAuthority:async()=>({ok:false,reason:'CANONICAL_AUTHORITY_NOT_GRANTED'})});
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'CANONICAL_AUTHORITY_NOT_GRANTED');
});

test('executor re-observes after authority verification before adapter execution',async()=>{
  let calls=0,executed=0;
  const e=executor({
    observeRepository:async()=>{
      calls+=1;
      return calls===1?observation():observation({revision:'c'.repeat(40)});
    },
    adapters:new Map([['KEEP_SEPARATE',{execute:async()=>{executed+=1;return{};}}]]),
  });
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.match(result.reason,/REVISION_STALE/);
  assert.equal(calls,2);
  assert.equal(executed,0);
});

test('adapter cannot grant its own authority or completion',async()=>{
  const e=executor({
    adapters:new Map([['KEEP_SEPARATE',{execute:async()=>({
      status:'SUCCEEDED',performed:true,execution_authorized:true,
    })}]]),
  });
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'INTEGRATION_EXECUTION_OUTCOME_UNKNOWN');
});

test('successful execution requires independent verification and produces core receipt',async()=>{
  const e=executor();
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'SUCCEEDED');
  assert.equal(result.performed,true);
  assert.equal(result.receipt.schema_version,'core-receipt/v1');
  assert.equal(result.receipt.source_revision,'a'.repeat(40));
  assert.ok(result.receipt.evidence_refs.includes('AUTHORITY:work-ledger:event-123'));
});

test('verification failure prevents SUCCEEDED receipt from being represented',async()=>{
  const e=executor({
    verifyExecution:async()=>[
      {name:'SOURCE_REVISION_UNCHANGED',status:'PASS',evidence_ref:'check:revision'},
      {name:'DIRTY_STATE_RECHECK',status:'FAIL',evidence_ref:'check:dirty'},
      {name:'PLAN_ITEM_STILL_READY',status:'PASS',evidence_ref:'check:plan'},
      {name:'PROJECT_AUTHORITY_UNCHANGED',status:'PASS',evidence_ref:'check:authority'},
    ],
  });
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'INTEGRATION_SUCCESS_VERIFICATION_FAILED');
  assert.equal(result.receipt,null);
});

test('adapter exception after authority is treated as unknown effect, never as not-performed',async()=>{
  const e=executor({
    adapters:new Map([['KEEP_SEPARATE',{execute:async()=>{throw new Error('connection lost after write');}}]]),
  });
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'INTEGRATION_EXECUTION_OUTCOME_UNKNOWN');
  assert.equal(result.effect_state,'UNKNOWN');
  assert.equal(result.performed,null);
  assert.equal(result.outcome_known,false);
});

test('post-execution verification failure preserves performed effect state',async()=>{
  const e=executor({
    verifyExecution:async()=>{throw new Error('verifier unavailable');},
  });
  const result=await e.run({
    packet:packet(),authority:{},perform:true,attempt_id:'attempt-1',actor:'worker',correlation_id:'corr-1',
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.reason,'INTEGRATION_POST_EXECUTION_VERIFICATION_UNAVAILABLE');
  assert.equal(result.effect_state,'PERFORMED');
  assert.equal(result.performed,true);
  assert.equal(result.external_effect,true);
  assert.equal(result.outcome_known,true);
});

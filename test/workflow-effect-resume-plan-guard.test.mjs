import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { buildRepositoryReceipt } from '../src/contracts/repository-receipt.mjs';
import { prepareEffectResumePlan, verifyEffectResumePlan } from '../src/workflow/effect-resume-plan-guard.mjs';
import {
  prepareEffectResumeFromReceipts,
  executePreparedEffectResumeFromReceipts
} from '../src/workflow/effect-receipt-resume-runtime.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const executionSchema=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const planSchema=JSON.parse(await readFile(new URL('../contracts/workflow-effect-resume-plan.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
ajv.addSchema(types); ajv.addSchema(executionSchema); ajv.addSchema(planSchema);
const validatePlan=ajv.getSchema('https://freepass.local/contracts/workflow-effect-resume-plan/v1');

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.resume-plan.test',
  dimensions:{
    operation_kind:'workflow.resume-plan',
    logical_slot:'slot-1',
    subject_scope:{scope_type:'entity',scope_key:'entity-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T13:00:00Z'
});
const attempt1=bindExecutionAttempt(identity,{
  attemptId:'attempt-plan-1',attemptSequence:1,executionPath:'NATIVE'
});
const attempt2=bindExecutionAttempt(identity,{
  attemptId:'attempt-plan-2',attemptSequence:2,executionPath:'FALLBACK',parentAttemptId:'attempt-plan-1'
});

const otherIdentity=createExecutionIdentity({
  logicalExecutionId:'logical.resume-plan.other',
  dimensions:{
    operation_kind:'workflow.resume-plan',
    logical_slot:'slot-2',
    subject_scope:{scope_type:'entity',scope_key:'entity-1'},
    semantic_input_digest:'sha256:'+'2'.repeat(64)
  },
  createdAt:'2026-09-20T13:00:00Z'
});
const otherAttempt=bindExecutionAttempt(otherIdentity,{
  attemptId:'attempt-plan-other',attemptSequence:1,executionPath:'FALLBACK'
});

const effects=[
  {effect_id:'write',compensation_mode:'REQUIRED',compensation_action:'undo.write'},
  {effect_id:'notify',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'append-only'}
];

const bindings=[{
  schema_version:'workflow-effect-receipt-binding/v1',
  binding_id:'bridge.write',
  effect_id:'write',
  phase:'EFFECT',
  selector:{operation_kind:'entity.create',executor:'demo.repository'},
  child_relation:'REPOSITORY',
  require_execution_binding:true,
  partial_policy:'HOLD',
  proof_policy:'PRESERVE_AND_REVERIFY'
}];

const proofInputs=[
  {role:'SOURCE',ref:'repository-source',digest:'sha256:'+'a'.repeat(64),revision:'git:r1'}
];

function sourceReceipt({id='receipt.plan.source',status='SUCCEEDED',proof=true,data={saved:'entity-1'}}={}){
  return buildRepositoryReceipt({
    receipt_id:id,
    operation_id:id+'.op',
    operation_kind:'entity.create',
    actor:'system:test',
    executor:'demo.repository',
    repository_result:{
      schema_version:'core-repository-result/v1',
      repository_id:'demo.repository',
      repository_version:'1.0.0',
      operation_id:'entity.create',
      correlation_id:'corr-plan',
      status,
      error_code:status==='SUCCEEDED'?null:'PERSISTENCE_ERROR',
      data:status==='SUCCEEDED'?data:null,
      revision:'r1',
      evidence_refs:['repo:evidence'],
      started_at:'2026-09-20T13:00:00Z',
      ended_at:'2026-09-20T13:00:01Z'
    },
    input:{id:'entity-1'},
    proof_inputs:proof?proofInputs:null,
    reproducibility:{
      deterministic:true,
      executor_version:'1.0.0',
      environment_revision:'git:r1',
      command_ref:'entity.create'
    },
    source_revision:'git:r1',
    execution:attempt1
  });
}

const resumeReceipt=(id)=>({
  receipt_id:id,
  actor:'system:test',
  executor:'workflow.effect-resume',
  source_revision:'git:resume',
  reproducibility:{
    deterministic:false,
    executor_version:'1.0.0',
    environment_revision:'env:test',
    command_ref:'effect-resume'
  },
  execution:attempt2
});

test('prepared resume plan is schema-valid and deterministic for the same input set',()=>{
  const source=sourceReceipt();
  const args={
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:01:00Z'
  };
  const a=prepareEffectResumePlan(args);
  const b=prepareEffectResumePlan(args);
  assert.equal(validatePlan(a),true,JSON.stringify(validatePlan.errors));
  assert.equal(a.plan_digest,b.plan_digest);
  assert.equal(a.plan_id,b.plan_id);
  assert.equal(a.planner_result.status,'RESUMABLE');
});

test('receipt and binding array order do not change plan digest',()=>{
  const sourceA=sourceReceipt({id:'receipt.plan.a'});
  const sourceB=buildRepositoryReceipt({
    ...sourceReceipt({id:'receipt.plan.b',proof:false}),
    receipt_id:'receipt.plan.b'
  });
  const unusedBinding={
    ...bindings[0],
    binding_id:'bridge.unused',
    effect_id:'unused',
    selector:{operation_kind:'unused.operation',executor:'unused.executor'}
  };
  const effects2=[...effects,{effect_id:'unused',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'not observed'}];

  const a=prepareEffectResumePlan({
    effects:effects2,
    bindings:[bindings[0],unusedBinding],
    receipts:[sourceA,sourceB],
    target_execution:attempt2,
    current_proof_inputs_by_receipt:{[sourceA.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:01:00Z'
  });
  const b=prepareEffectResumePlan({
    effects:effects2,
    bindings:[unusedBinding,bindings[0]],
    receipts:[sourceB,sourceA],
    target_execution:attempt2,
    current_proof_inputs_by_receipt:{[sourceA.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:01:00Z'
  });
  assert.equal(a.plan_digest,b.plan_digest);
});

test('unchanged current inputs verify prepared plan as CURRENT',()=>{
  const source=sourceReceipt();
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:02:00Z'
  });
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs}
  });
  assert.equal(verified.status,'CURRENT');
  assert.deepEqual(verified.changes,[]);
});

test('new receipt arriving after preparation makes plan stale',()=>{
  const source=sourceReceipt();
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:03:00Z'
  });
  const later=sourceReceipt({id:'receipt.plan.later',proof:false});
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings,receipts:[source,later],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs}
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('RECEIPTS_CHANGED'));
  assert.ok(verified.changes.includes('PLAN_DIGEST_CHANGED'));
});

test('changed current proof inputs make prepared plan stale',()=>{
  const source=sourceReceipt();
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs},
    prepared_at:'2026-09-20T13:04:00Z'
  });
  const changed=[{role:'SOURCE',ref:'repository-source',digest:'sha256:'+'b'.repeat(64),revision:'git:r2'}];
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:changed}
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('PROOF_INPUTS_CHANGED'));
  assert.ok(verified.changes.includes('PLANNER_RESULT_CHANGED'));
});

test('effect definition change makes prepared plan stale',()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:05:00Z'
  });
  const changedEffects=[
    {...effects[0],compensation_action:'undo.write.v2'},
    effects[1]
  ];
  const verified=verifyEffectResumePlan(prepared,{
    effects:changedEffects,bindings,receipts:[source],target_execution:attempt2
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('EFFECTS_CHANGED'));
});

test('binding selector change makes prepared plan stale',()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:06:00Z'
  });
  const changedBindings=[{
    ...bindings[0],
    selector:{...bindings[0].selector,source_revision:'git:r2'}
  }];
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings:changedBindings,receipts:[source],target_execution:attempt2
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('BINDINGS_CHANGED'));
});

test('target logical execution change makes prepared plan stale',()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:07:00Z'
  });
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings,receipts:[source],target_execution:otherAttempt
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('TARGET_EXECUTION_CHANGED'));
});

test('receipt content change under the same receipt id makes prepared plan stale',()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:08:00Z'
  });
  const mutated=sourceReceipt({id:source.receipt_id,proof:false,data:{saved:'changed'}});
  const verified=verifyEffectResumePlan(prepared,{
    effects,bindings,receipts:[mutated],target_execution:attempt2
  });
  assert.equal(verified.status,'STALE');
  assert.ok(verified.changes.includes('RECEIPTS_CHANGED'));
});

test('stale prepared plan blocks execution with zero executor calls',async()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:09:00Z'
  });
  const later=sourceReceipt({id:'receipt.plan.newer',proof:false});
  let calls=0;
  const out=await executePreparedEffectResumeFromReceipts({
    prepared_plan:prepared,
    effects,
    bindings,
    receipts:[source,later],
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-stale-plan',
    receipt:resumeReceipt('receipt.stale.plan'),
    execute_effect:async()=>{calls++;return{status:'SUCCEEDED'};},
    execute_compensation:async()=>{calls++;return{status:'SUCCEEDED'};}
  });
  assert.equal(out.status,'HOLD');
  assert.equal(out.reason,'STALE_RESUME_PLAN');
  assert.equal(out.executed,false);
  assert.equal(out.freshness.status,'STALE');
  assert.equal(calls,0);
});

test('current prepared plan executes normally',async()=>{
  const source=sourceReceipt({proof:false});
  const prepared=prepareEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    prepared_at:'2026-09-20T13:10:00Z'
  });
  const calls=[];
  const out=await executePreparedEffectResumeFromReceipts({
    prepared_plan:prepared,
    effects,
    bindings,
    receipts:[source],
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-current-plan',
    receipt:resumeReceipt('receipt.current.plan'),
    execute_effect:async(effect)=>{calls.push(effect.effect_id);return{status:'SUCCEEDED'};},
    execute_compensation:async()=>({status:'SUCCEEDED'})
  });
  assert.equal(out.freshness.status,'CURRENT');
  assert.equal(out.status,'SUCCEEDED');
  assert.deepEqual(calls,['notify']);
});

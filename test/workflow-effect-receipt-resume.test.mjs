import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { buildRepositoryReceipt } from '../src/contracts/repository-receipt.mjs';
import { planEffectResumeFromReceipts, executeEffectResumeFromReceipts } from '../src/workflow/effect-receipt-resume-runtime.mjs';

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.auto-bridge.test',
  dimensions:{
    operation_kind:'workflow.auto-bridge',
    logical_slot:'slot-1',
    subject_scope:{scope_type:'entity',scope_key:'entity-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T12:00:00Z'
});
const attempt1=bindExecutionAttempt(identity,{
  attemptId:'attempt-auto-1',attemptSequence:1,executionPath:'NATIVE'
});
const attempt2=bindExecutionAttempt(identity,{
  attemptId:'attempt-auto-2',attemptSequence:2,executionPath:'FALLBACK',parentAttemptId:'attempt-auto-1'
});

const effects=[
  {effect_id:'write-entity',compensation_mode:'REQUIRED',compensation_action:'undo.write-entity'},
  {effect_id:'notify',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'notification is append-only'}
];

const bindings=[{
  schema_version:'workflow-effect-receipt-binding/v1',
  binding_id:'bridge.write-entity',
  effect_id:'write-entity',
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

function repositoryReceipt({id='receipt.repo.1',status='SUCCEEDED',proof=true}={}){
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
      correlation_id:'corr-auto',
      status,
      error_code:status==='SUCCEEDED'?null:'PERSISTENCE_ERROR',
      data:status==='SUCCEEDED'?{saved:'entity-1'}:null,
      revision:'r1',
      evidence_refs:['repo:'+status.toLowerCase()],
      started_at:'2026-09-20T12:00:00Z',
      ended_at:'2026-09-20T12:00:01Z'
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

test('raw Repository success receipt automatically becomes SKIP effect evidence',()=>{
  const source=repositoryReceipt();
  const planned=planEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:proofInputs}
  });
  assert.equal(planned.status,'RESUMABLE');
  assert.equal(planned.bridge.status,'READY');
  assert.equal(planned.bridge.evidence_records.length,1);
  assert.equal(planned.resume_plan.actions[0].effect_id,'write-entity');
  assert.equal(planned.resume_plan.actions[0].action,'SKIP_ALREADY_APPLIED');
  assert.equal(planned.resume_plan.resume_from_effect_id,'notify');
});

test('proof-bound Repository receipt with changed proof inputs blocks automatic resume',()=>{
  const source=repositoryReceipt();
  const changed=[
    {role:'SOURCE',ref:'repository-source',digest:'sha256:'+'b'.repeat(64),revision:'git:r2'}
  ];
  const planned=planEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2,
    current_proof_inputs_by_receipt:{[source.receipt_id]:changed}
  });
  assert.equal(planned.status,'HOLD');
  assert.equal(planned.resume_plan.reason,'EFFECT_EVIDENCE_STALE');
});

test('proof-bound Repository receipt without current proof inputs is unverified and held',()=>{
  const source=repositoryReceipt();
  const planned=planEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2
  });
  assert.equal(planned.status,'HOLD');
  assert.equal(planned.resume_plan.reason,'EFFECT_EVIDENCE_UNVERIFIED');
});

test('integrated executor skips already-applied Repository write and executes only remaining effect',async()=>{
  const source=repositoryReceipt({proof:false});
  const calls=[];
  const out=await executeEffectResumeFromReceipts({
    effects,
    bindings,
    receipts:[source],
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-auto-resume',
    receipt:resumeReceipt('receipt.auto.resume'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      return {status:'SUCCEEDED',data:{effect:effect.effect_id}};
    },
    execute_compensation:async(step)=>{
      calls.push('undo:'+step.effect_id);
      return {status:'SUCCEEDED'};
    },
    clock:()=>Date.parse('2026-09-20T12:10:00Z')
  });

  assert.equal(out.status,'SUCCEEDED');
  assert.deepEqual(calls,['do:notify']);
  assert.equal(out.bridge.projections[0].source_receipt_ref,source.receipt_id);
  assert.equal(out.execution_result.applied_effect_ids.includes('write-entity'),true);
  assert.equal(out.execution_result.applied_effect_ids.includes('notify'),true);
});

test('all mapped effects already applied returns COMPLETE and never calls executor',async()=>{
  const singleEffects=[effects[0]];
  const source=repositoryReceipt({proof:false});
  let calls=0;
  const out=await executeEffectResumeFromReceipts({
    effects:singleEffects,
    bindings,
    receipts:[source],
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-auto-complete',
    receipt:resumeReceipt('receipt.auto.complete'),
    execute_effect:async()=>{calls++;return{status:'SUCCEEDED'};},
    execute_compensation:async()=>{calls++;return{status:'SUCCEEDED'};}
  });
  assert.equal(out.status,'COMPLETE');
  assert.equal(out.executed,false);
  assert.equal(calls,0);
});

test('failed Repository receipt remains runnable rather than being treated as applied',()=>{
  const source=repositoryReceipt({status:'FAILED',proof:false});
  const planned=planEffectResumeFromReceipts({
    effects,bindings,receipts:[source],target_execution:attempt2
  });
  assert.equal(planned.status,'RESUMABLE');
  assert.equal(planned.resume_plan.resume_from_effect_id,'write-entity');
  assert.equal(planned.resume_plan.actions[0].reason,'PRIOR_EFFECT_FAILED');
});

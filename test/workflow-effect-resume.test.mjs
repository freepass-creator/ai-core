import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { buildWorkflowActionReceipt } from '../src/contracts/workflow-execution-receipt.mjs';
import { planEffectResume } from '../src/workflow/effect-resume-planner.mjs';
import { executeEffectResume } from '../src/workflow/effect-resume-runtime.mjs';

const types=JSON.parse(await readFile(new URL('../contracts/core-types.schema.json',import.meta.url),'utf8'));
const executionSchema=JSON.parse(await readFile(new URL('../contracts/core-execution-identity.schema.json',import.meta.url),'utf8'));
const proof=JSON.parse(await readFile(new URL('../contracts/core-proof-input-binding.schema.json',import.meta.url),'utf8'));
const receiptSchema=JSON.parse(await readFile(new URL('../contracts/core-receipt.schema.json',import.meta.url),'utf8'));
const ajv=new Ajv2020({allErrors:true,strict:false}); addFormats(ajv);
for(const schema of [types,executionSchema,proof,receiptSchema]) ajv.addSchema(schema);
const validateReceipt=ajv.getSchema('https://schemas.freepass.ai/core/receipt/v1');

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.effect-resume.test',
  dimensions:{
    operation_kind:'workflow.effect-resume',
    logical_slot:'slot-1',
    subject_scope:{scope_type:'test',scope_key:'subject-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T10:00:00Z'
});

const attempt1=bindExecutionAttempt(identity,{
  attemptId:'attempt-1',attemptSequence:1,executionPath:'NATIVE'
});
const attempt2=bindExecutionAttempt(identity,{
  attemptId:'attempt-2',attemptSequence:2,executionPath:'FALLBACK',parentAttemptId:'attempt-1'
});

const otherIdentity=createExecutionIdentity({
  logicalExecutionId:'logical.effect-resume.other',
  dimensions:{
    operation_kind:'workflow.effect-resume',
    logical_slot:'slot-other',
    subject_scope:{scope_type:'test',scope_key:'subject-1'},
    semantic_input_digest:'sha256:'+'2'.repeat(64)
  },
  createdAt:'2026-09-20T10:00:00Z'
});
const otherAttempt=bindExecutionAttempt(otherIdentity,{
  attemptId:'attempt-other',attemptSequence:1,executionPath:'NATIVE'
});

const effects=[
  {effect_id:'a',compensation_mode:'REQUIRED',compensation_action:'undo.a'},
  {effect_id:'b',compensation_mode:'REQUIRED',compensation_action:'undo.b'},
  {effect_id:'c',compensation_mode:'REQUIRED',compensation_action:'undo.c'}
];

function actionReceipt({
  id,
  effectId,
  phase='EFFECT',
  status='SUCCEEDED',
  errorCode=null,
  execution=attempt1,
  endedAt='2026-09-20T10:00:01Z',
  proofInputs=null,
}){
  return buildWorkflowActionReceipt({
    phase,
    receipt_id:id,
    actor:'system:test',
    executor:'test.executor',
    correlation_id:'corr-history',
    effect_id:effectId,
    action:phase==='COMPENSATION'?('undo.'+effectId):null,
    result:{
      status,
      ...(errorCode?{error_code:errorCode}:{}),
      data:status==='SUCCEEDED'?{ok:true}:null
    },
    reproducibility:{
      deterministic:false,
      executor_version:'1.0.0',
      environment_revision:'env:test',
      command_ref:phase==='COMPENSATION'?('undo.'+effectId):effectId
    },
    proof_inputs:proofInputs,
    started_at:'2026-09-20T10:00:00Z',
    ended_at:endedAt,
    execution,
  });
}

function record(receipt,currentProofInputs=null){
  return {
    receipt,
    ...(currentProofInputs?{current_proof_inputs:currentProofInputs}:{})
  };
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

test('planner skips already-applied prefix and resumes from first unfinished effect',()=>{
  const evidence=[
    record(actionReceipt({id:'receipt.a.success',effectId:'a'})),
    record(actionReceipt({id:'receipt.b.failed',effectId:'b',status:'FAILED',errorCode:'B_FAILED',endedAt:'2026-09-20T10:00:02Z'}))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'RESUMABLE');
  assert.equal(plan.resume_from_effect_id,'b');
  assert.deepEqual(plan.actions.map(x=>[x.effect_id,x.action]),[
    ['a','SKIP_ALREADY_APPLIED'],
    ['b','RUN'],
    ['c','RUN']
  ]);
});

test('successfully compensated prior effect becomes runnable again',()=>{
  const evidence=[
    record(actionReceipt({id:'receipt.a.success',effectId:'a'})),
    record(actionReceipt({
      id:'receipt.a.compensated',effectId:'a',phase:'COMPENSATION',
      endedAt:'2026-09-20T10:00:03Z'
    }))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'RESUMABLE');
  assert.equal(plan.resume_from_effect_id,'a');
  assert.equal(plan.actions[0].reason,'PRIOR_EFFECT_COMPENSATED');
});

test('failed compensation blocks resume',()=>{
  const evidence=[
    record(actionReceipt({id:'receipt.a.success',effectId:'a'})),
    record(actionReceipt({
      id:'receipt.a.comp-failed',effectId:'a',phase:'COMPENSATION',
      status:'FAILED',errorCode:'UNDO_FAILED',endedAt:'2026-09-20T10:00:03Z'
    }))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'COMPENSATION_EVIDENCE_FAILED');
  assert.equal(plan.blocking_effect_id,'a');
});

test('foreign logical execution evidence is ignored by planner',()=>{
  const evidence=[
    record(actionReceipt({id:'receipt.foreign.a',effectId:'a',execution:otherAttempt}))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'RESUMABLE');
  assert.equal(plan.resume_from_effect_id,'a');
  assert.equal(plan.foreign_receipt_count,1);
});

test('out-of-order later success while earlier effect is runnable holds',()=>{
  const evidence=[
    record(actionReceipt({id:'receipt.b.success',effectId:'b'}))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'OUT_OF_ORDER_EFFECT_SUCCESS');
  assert.equal(plan.blocking_effect_id,'b');
});

test('unverified proof-bound effect evidence blocks resume',()=>{
  const proofInputs=[
    {role:'SOURCE',ref:'effect-a',digest:'sha256:'+'3'.repeat(64),revision:'git:a'}
  ];
  const evidence=[
    record(actionReceipt({id:'receipt.a.proof',effectId:'a',proofInputs}))
  ];
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'HOLD');
  assert.equal(plan.reason,'EFFECT_EVIDENCE_UNVERIFIED');
});

test('all prior effect successes produce COMPLETE with zero execution need',()=>{
  const evidence=effects.map(effect=>record(actionReceipt({
    id:'receipt.'+effect.effect_id+'.success',
    effectId:effect.effect_id
  })));
  const plan=planEffectResume({effects,target_execution:attempt2,evidence_records:evidence});
  assert.equal(plan.status,'COMPLETE');
  assert.equal(plan.resume_from_effect_id,null);
  assert.ok(plan.actions.every(x=>x.action==='SKIP_ALREADY_APPLIED'));
});

test('resume executor never re-executes already-applied effects',async()=>{
  const calls=[];
  const evidence=[
    record(actionReceipt({id:'receipt.a.success',effectId:'a'})),
    record(actionReceipt({id:'receipt.b.failed',effectId:'b',status:'FAILED',errorCode:'B_FAILED',endedAt:'2026-09-20T10:00:02Z'}))
  ];
  const out=await executeEffectResume({
    effects,
    evidence_records:evidence,
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-resume-1',
    receipt:resumeReceipt('receipt.resume.1'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      return {status:'SUCCEEDED',data:{effect:effect.effect_id}};
    },
    execute_compensation:async()=>({status:'SUCCEEDED'}),
    clock:()=>Date.parse('2026-09-20T10:10:00Z')
  });

  assert.equal(out.status,'SUCCEEDED');
  assert.deepEqual(calls,['do:b','do:c']);
  assert.deepEqual(out.execution_result.applied_effect_ids,['a','b','c']);
  assert.equal(out.receipt.child_receipts[0].receipt_ref,'receipt.a.success');
  assert.deepEqual(out.receipt.child_receipts.map(x=>x.relation),['EFFECT','EFFECT','EFFECT']);
  assert.equal(validateReceipt(out.receipt),true,JSON.stringify(validateReceipt.errors));
  out.action_receipts.forEach(r=>assert.equal(validateReceipt(r),true,JSON.stringify(validateReceipt.errors)));
});

test('resume failure compensates newly applied and prior applied effects in reverse global order',async()=>{
  const calls=[];
  const evidence=[
    record(actionReceipt({id:'receipt.a.success',effectId:'a'})),
    record(actionReceipt({id:'receipt.b.failed',effectId:'b',status:'FAILED',errorCode:'B_FAILED',endedAt:'2026-09-20T10:00:02Z'}))
  ];
  const out=await executeEffectResume({
    effects,
    evidence_records:evidence,
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-resume-2',
    receipt:resumeReceipt('receipt.resume.2'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      return effect.effect_id==='c'
        ? {status:'FAILED',error_code:'C_FAILED'}
        : {status:'SUCCEEDED',data:{effect:effect.effect_id}};
    },
    execute_compensation:async(step)=>{
      calls.push('undo:'+step.effect_id);
      return {status:'SUCCEEDED',data:{undone:step.effect_id}};
    },
    clock:()=>Date.parse('2026-09-20T10:11:00Z')
  });

  assert.equal(out.status,'FAILED');
  assert.deepEqual(calls,['do:b','do:c','undo:b','undo:a']);
  assert.deepEqual(out.execution_result.applied_effect_ids,['a','b']);
  assert.deepEqual(out.execution_result.compensation_plan.steps,[
    {effect_id:'b',action:'undo.b'},
    {effect_id:'a',action:'undo.a'}
  ]);
  assert.equal(out.receipt.status,'FAILED');
  assert.deepEqual(out.receipt.child_receipts.map(x=>x.relation),[
    'EFFECT','EFFECT','EFFECT','COMPENSATION','COMPENSATION'
  ]);
});

test('retained non-compensatable prior effect is skipped but not undone on later failure',async()=>{
  const specialEffects=[
    {effect_id:'audit',compensation_mode:'NOT_REQUIRED',non_compensated_reason:'append-only audit stays'},
    {effect_id:'write-b',compensation_mode:'REQUIRED',compensation_action:'undo.b'},
    {effect_id:'write-c',compensation_mode:'REQUIRED',compensation_action:'undo.c'}
  ];
  const calls=[];
  const evidence=[
    record(actionReceipt({id:'receipt.audit.success',effectId:'audit'}))
  ];
  const out=await executeEffectResume({
    effects:specialEffects,
    evidence_records:evidence,
    target_execution:attempt2,
    current_attempt:attempt2,
    correlation_id:'corr-resume-3',
    receipt:resumeReceipt('receipt.resume.3'),
    execute_effect:async(effect)=>{
      calls.push('do:'+effect.effect_id);
      return effect.effect_id==='write-c'
        ? {status:'FAILED',error_code:'C_FAILED'}
        : {status:'SUCCEEDED'};
    },
    execute_compensation:async(step)=>{
      calls.push('undo:'+step.effect_id);
      return {status:'SUCCEEDED'};
    },
    clock:()=>Date.parse('2026-09-20T10:12:00Z')
  });

  assert.equal(out.status,'FAILED');
  assert.deepEqual(calls,['do:write-b','do:write-c','undo:write-b']);
  assert.deepEqual(out.execution_result.compensation_plan.retained_effects,[{
    effect_id:'audit',
    mode:'NOT_REQUIRED',
    reason:'append-only audit stays'
  }]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createExecutionIdentity, bindExecutionAttempt } from '../src/contracts/execution-identity.mjs';
import { buildProofInputBinding } from '../src/contracts/proof-input-binding.mjs';
import { reconcileRecoveryReceipts } from '../src/workflow/recovery-receipt-reconciler.mjs';
import { executeWithRecoveryGuard } from '../src/workflow/recovery-execution-guard.mjs';
import { guardRetryDecisionWithReceipts } from '../src/workflow/retry-receipt-guard.mjs';

const identity=createExecutionIdentity({
  logicalExecutionId:'logical.quote.slot-1',
  dimensions:{
    operation_kind:'quote.refresh',
    logical_slot:'2026-09-20T09:00:00Z',
    subject_scope:{scope_type:'quote',scope_key:'quote-1'},
    semantic_input_digest:'sha256:'+'1'.repeat(64)
  },
  createdAt:'2026-09-20T08:59:00Z'
});

const otherIdentity=createExecutionIdentity({
  logicalExecutionId:'logical.quote.slot-2',
  dimensions:{
    operation_kind:'quote.refresh',
    logical_slot:'2026-09-20T10:00:00Z',
    subject_scope:{scope_type:'quote',scope_key:'quote-1'},
    semantic_input_digest:'sha256:'+'2'.repeat(64)
  },
  createdAt:'2026-09-20T09:59:00Z'
});

function receipt({
  id,
  status='SUCCEEDED',
  executionPath='NATIVE',
  attemptId=id+'.attempt',
  attemptSequence=1,
  identityValue=identity,
  operationKind='quote.refresh',
  proofBinding=null,
}){
  return {
    schema_version:'core-receipt/v1',
    receipt_id:id,
    operation_id:id+'.op',
    operation_kind:operationKind,
    actor:'system:test',
    executor:'test.executor',
    correlation_id:'corr-1',
    status,
    reason_code:status==='SUCCEEDED'?null:(status==='PARTIAL'?'PARTIAL_EXECUTION':'UPSTREAM_UNAVAILABLE'),
    input:{digest:'sha256:'+'a'.repeat(64),refs:[]},
    output:{digest:status==='SUCCEEDED'?'sha256:'+'b'.repeat(64):null,refs:[]},
    source_revision:'git:test',
    started_at:'2026-09-20T09:00:00Z',
    ended_at:'2026-09-20T09:00:01Z',
    evidence_refs:[],
    reproducibility:{
      deterministic:false,
      executor_version:'1.0.0',
      environment_revision:'env:test',
      command_ref:'quote.refresh'
    },
    execution:bindExecutionAttempt(identityValue,{
      attemptId,
      attemptSequence,
      executionPath
    }),
    ...(proofBinding?{proof_input_binding:proofBinding}:{})
  };
}

const target=bindExecutionAttempt(identity,{
  attemptId:'target-attempt',
  attemptSequence:2,
  executionPath:'FALLBACK'
});

test('authoritative native success suppresses fallback replay',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.native.success'})
    }]
  });
  assert.equal(result.action,'SUPPRESS_REPLAY');
  assert.equal(result.reason,'SUCCESS_EVIDENCE_PRESENT');
  assert.deepEqual(result.success_receipt_refs,['receipt.native.success']);
});

test('successful prior fallback recovery suppresses another recovery',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'RECOVERY_HISTORY',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.fallback.success',executionPath:'FALLBACK'})
    }]
  });
  assert.equal(result.action,'SUPPRESS_REPLAY');
  assert.equal(result.reason,'SUCCESSFUL_PRIOR_RECOVERY');
  assert.equal(result.successful_recovery_receipt_ref,'receipt.fallback.success');
});

test('non-terminal EFFECT success does not suppress whole logical execution recovery',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'DOWNSTREAM_TERMINAL_EVIDENCE',
      terminal_authority:false,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.effect.success',operationKind:'workflow.effect'})
    }]
  });
  assert.equal(result.action,'ALLOW_RECOVERY');
  assert.equal(result.reason,'NO_SUCCESS_EVIDENCE');
});

test('authoritative PARTIAL or HOLD evidence blocks blind retry',()=>{
  for(const status of ['PARTIAL','HOLD']){
    const result=reconcileRecoveryReceipts({
      target_execution:target,
      evidence_records:[{
        source:'DOWNSTREAM_TERMINAL_EVIDENCE',
        terminal_authority:true,
        proof_status:'CURRENT',
        receipt:receipt({id:'receipt.'+status.toLowerCase(),status})
      }]
    });
    assert.equal(result.action,'HOLD');
    assert.equal(result.reason,'AMBIGUOUS_OR_PARTIAL_OUTCOME');
  }
});

test('stale authoritative success evidence becomes HOLD rather than replay or suppression',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'STALE',
      receipt:receipt({id:'receipt.stale.success'})
    }]
  });
  assert.equal(result.action,'HOLD');
  assert.equal(result.reason,'AUTHORITATIVE_EVIDENCE_STALE');
});

test('foreign logical execution evidence is ignored',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.foreign',identityValue:otherIdentity})
    }]
  });
  assert.equal(result.action,'ALLOW_RECOVERY');
  assert.equal(result.foreign_receipt_count,1);
});

test('same current attempt already observed is held before duplicate execution',()=>{
  const current=bindExecutionAttempt(identity,{
    attemptId:'same-attempt',
    attemptSequence:2,
    executionPath:'FALLBACK'
  });
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    current_attempt:current,
    evidence_records:[{
      source:'RECOVERY_HISTORY',
      terminal_authority:false,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.same.attempt',attemptId:'same-attempt',attemptSequence:2,executionPath:'FALLBACK'})
    }]
  });
  assert.equal(result.action,'HOLD');
  assert.equal(result.reason,'CURRENT_ATTEMPT_ALREADY_OBSERVED');
});

test('terminal failure evidence permits recovery when no success/partial evidence exists',()=>{
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.failed',status:'FAILED'})
    }]
  });
  assert.equal(result.action,'ALLOW_RECOVERY');
  assert.equal(result.reason,'ONLY_TERMINAL_FAILURE_EVIDENCE');
});

test('execution guard never invokes executor when replay is suppressed',async()=>{
  let calls=0;
  const result=await executeWithRecoveryGuard({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.guard.success'})
    }],
    execute:async()=>{calls++;return{ok:true};}
  });
  assert.equal(result.status,'SUPPRESSED');
  assert.equal(result.executed,false);
  assert.equal(calls,0);
});

test('execution guard never invokes executor on ambiguous evidence',async()=>{
  let calls=0;
  const result=await executeWithRecoveryGuard({
    target_execution:target,
    evidence_records:[{
      source:'DOWNSTREAM_TERMINAL_EVIDENCE',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.guard.partial',status:'PARTIAL'})
    }],
    execute:async()=>{calls++;return{ok:true};}
  });
  assert.equal(result.status,'HOLD');
  assert.equal(result.executed,false);
  assert.equal(calls,0);
});

test('execution guard calls executor exactly once only after ALLOW_RECOVERY',async()=>{
  let calls=0;
  const result=await executeWithRecoveryGuard({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.guard.failed',status:'FAILED'})
    }],
    execute:async({reconciliation})=>{
      calls++;
      assert.equal(reconciliation.action,'ALLOW_RECOVERY');
      return{status:'SUCCEEDED'};
    }
  });
  assert.equal(result.status,'EXECUTED');
  assert.equal(result.executed,true);
  assert.equal(calls,1);
});


test('proof-bound authoritative success without freshness inputs is held',()=>{
  const proofBinding=buildProofInputBinding([
    {role:'SOURCE',ref:'source',digest:'sha256:'+'3'.repeat(64),revision:'git:source'}
  ]);
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      receipt:receipt({id:'receipt.unverified.proof',proofBinding})
    }]
  });
  assert.equal(result.action,'HOLD');
  assert.equal(result.reason,'AUTHORITATIVE_EVIDENCE_UNVERIFIED');
});

test('proof-bound success is accepted only when current inputs verify CURRENT',()=>{
  const inputs=[
    {role:'SOURCE',ref:'source',digest:'sha256:'+'4'.repeat(64),revision:'git:source'}
  ];
  const proofBinding=buildProofInputBinding(inputs);
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      current_proof_inputs:inputs,
      receipt:receipt({id:'receipt.verified.proof',proofBinding})
    }]
  });
  assert.equal(result.action,'SUPPRESS_REPLAY');
  assert.equal(result.reason,'SUCCESS_EVIDENCE_PRESENT');
});

test('same attempt conflicting terminal receipts are held',()=>{
  const sameAttempt='attempt-conflict';
  const result=reconcileRecoveryReceipts({
    target_execution:target,
    evidence_records:[
      {
        source:'NATIVE_EXECUTION',
        terminal_authority:true,
        proof_status:'CURRENT',
        receipt:receipt({id:'receipt.conflict.success',attemptId:sameAttempt,status:'SUCCEEDED'})
      },
      {
        source:'DOWNSTREAM_TERMINAL_EVIDENCE',
        terminal_authority:true,
        proof_status:'CURRENT',
        receipt:receipt({id:'receipt.conflict.failed',attemptId:sameAttempt,status:'FAILED'})
      }
    ]
  });
  assert.equal(result.action,'HOLD');
  assert.equal(result.reason,'CONFLICTING_TERMINAL_EVIDENCE');
  assert.equal(result.conflicts[0].attempt_id,sameAttempt);
});

test('retry decision is suppressed by authoritative success evidence',()=>{
  const guarded=guardRetryDecisionWithReceipts({
    retry_decision:{action:'RETRY',error_code:'UPSTREAM_UNAVAILABLE',next_attempt:2,retry_after_ms:1000},
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.retry.success'})
    }]
  });
  assert.equal(guarded.action,'SUPPRESS_RETRY');
  assert.equal(guarded.original_retry_action,'RETRY');
  assert.equal(guarded.replay_guard,'SUPPRESSED');
});

test('retry decision becomes HOLD on partial or ambiguous evidence',()=>{
  const guarded=guardRetryDecisionWithReceipts({
    retry_decision:{action:'RETRY',error_code:'UPSTREAM_UNAVAILABLE',next_attempt:2,retry_after_ms:1000},
    target_execution:target,
    evidence_records:[{
      source:'DOWNSTREAM_TERMINAL_EVIDENCE',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.retry.partial',status:'PARTIAL'})
    }]
  });
  assert.equal(guarded.action,'HOLD');
  assert.equal(guarded.replay_guard,'HOLD');
});

test('retry decision is preserved only when reconciliation allows recovery',()=>{
  const guarded=guardRetryDecisionWithReceipts({
    retry_decision:{action:'RETRY',error_code:'UPSTREAM_UNAVAILABLE',next_attempt:2,retry_after_ms:1000},
    target_execution:target,
    evidence_records:[{
      source:'NATIVE_EXECUTION',
      terminal_authority:true,
      proof_status:'CURRENT',
      receipt:receipt({id:'receipt.retry.failed',status:'FAILED'})
    }]
  });
  assert.equal(guarded.action,'RETRY');
  assert.equal(guarded.replay_guard,'ALLOWED');
  assert.equal(guarded.reconciliation.action,'ALLOW_RECOVERY');
});

test('non-retry workflow decision bypasses replay guard unchanged',()=>{
  const guarded=guardRetryDecisionWithReceipts({
    retry_decision:{action:'ESCALATE',error_code:'FINAL_FAILURE'},
    target_execution:target,
    evidence_records:[]
  });
  assert.equal(guarded.action,'ESCALATE');
  assert.equal(guarded.replay_guard,'NOT_APPLICABLE');
});

import { verifyEffectResumePlan } from './effect-resume-plan-guard.mjs';
import { executePreparedEffectResumeFromReceipts } from './effect-receipt-resume-runtime.mjs';

const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;
const need=(condition,code)=>{if(!condition){const error=new Error(code);error.code=code;throw error;}};
const FENCE_ERRORS=new Set([
  'STALE_FENCING_TOKEN',
  'EXECUTION_LEASE_EXPIRED',
  'EXECUTION_LEASE_NOT_FOUND',
  'EXECUTION_LEASE_NOT_ACTIVE',
  'EXECUTION_LEASE_ID_MISMATCH',
  'EXECUTION_LEASE_OWNER_MISMATCH',
  'EXECUTION_LEASE_CAS_CONFLICT_EXHAUSTED'
]);

function sameAttempt(target,current){
  return Boolean(
    target &&
    current &&
    target.logical_execution_id===current.logical_execution_id &&
    target.identity_digest===current.identity_digest &&
    target.attempt_id===current.attempt_id
  );
}

export async function executeFencedPreparedEffectResume({
  lease_runtime,
  owner_id,
  lease_ms,
  prepared_plan,
  effects,
  bindings,
  receipts=[],
  target_execution,
  current_attempt,
  current_proof_inputs_by_receipt=null,
  correlation_id,
  receipt,
  execute_effect,
  execute_compensation,
  clock=Date.now,
}={}){
  need(lease_runtime&&typeof lease_runtime.acquire==='function'
    &&typeof lease_runtime.renew==='function'
    &&typeof lease_runtime.assertFence==='function'
    &&typeof lease_runtime.release==='function','EXECUTION_LEASE_RUNTIME_REQUIRED');
  need(text(owner_id),'EXECUTION_LEASE_OWNER_REQUIRED');
  need(sameAttempt(target_execution,current_attempt),'RESUME_TARGET_ATTEMPT_MISMATCH');
  need(typeof execute_effect==='function','EFFECT_EXECUTOR_REQUIRED');
  need(typeof execute_compensation==='function','COMPENSATION_EXECUTOR_REQUIRED');

  const initialFreshness=verifyEffectResumePlan(prepared_plan,{
    effects,
    bindings,
    receipts,
    target_execution,
    current_proof_inputs_by_receipt,
  });
  if(initialFreshness.status!=='CURRENT'){
    return {
      status:'HOLD',
      reason:'STALE_RESUME_PLAN',
      executed:false,
      lease_action:'NOT_ACQUIRED',
      lease:null,
      lease_release:null,
      freshness:initialFreshness,
      result:null,
    };
  }

  const claim=await lease_runtime.acquire({
    execution:current_attempt,
    owner_id,
    ...(lease_ms?{lease_ms}:{})
  });

  if(!['ACQUIRED','ACQUIRED_AFTER_EXPIRY'].includes(claim.action)){
    return {
      status:'HOLD',
      reason:claim.action==='BUSY'
        ? 'EXECUTION_LEASE_BUSY'
        : claim.action==='ALREADY_OWNED'
          ? 'EXECUTION_LEASE_ALREADY_OWNED'
          : (claim.reason??'EXECUTION_LEASE_NOT_ACQUIRED'),
      executed:false,
      lease_action:claim.action,
      lease:claim.lease??null,
      lease_release:null,
      freshness:initialFreshness,
      result:null,
    };
  }

  let activeLease=claim.lease;
  let releaseResult=null;
  let outcome=null;

  try{
    const afterClaimFreshness=verifyEffectResumePlan(prepared_plan,{
      effects,
      bindings,
      receipts,
      target_execution,
      current_proof_inputs_by_receipt,
    });
    if(afterClaimFreshness.status!=='CURRENT'){
      outcome={
        status:'HOLD',
        reason:'STALE_RESUME_PLAN_AFTER_LEASE',
        executed:false,
        lease_action:claim.action,
        lease:activeLease,
        freshness:afterClaimFreshness,
        result:null,
      };
    }else{
      await lease_runtime.assertFence({lease:activeLease});

      const ensureLease=async()=>{
        const checked=await lease_runtime.assertFence({lease:activeLease});
        const renewed=await lease_runtime.renew({
          lease:checked.lease,
          ...(lease_ms?{lease_ms}:{})
        });
        activeLease=renewed.lease;
        return activeLease;
      };
      const beforeEffect=async()=>ensureLease();
      const beforeCompensation=async()=>ensureLease();

      const guardedEffect=async(effect,context)=>execute_effect(effect,{
        ...context,
        execution_lease:activeLease,
        fencing_token:activeLease.fencing_token,
      });
      const guardedCompensation=async(step,context)=>execute_compensation(step,{
        ...context,
        execution_lease:activeLease,
        fencing_token:activeLease.fencing_token,
      });

      const result=await executePreparedEffectResumeFromReceipts({
        prepared_plan,
        effects,
        bindings,
        receipts,
        target_execution,
        current_attempt,
        current_proof_inputs_by_receipt,
        correlation_id,
        receipt,
        execute_effect:guardedEffect,
        execute_compensation:guardedCompensation,
        before_effect:beforeEffect,
        before_compensation:beforeCompensation,
        clock,
      });

      outcome={
        status:result.status,
        reason:result.reason??null,
        executed:result.executed,
        lease_action:claim.action,
        lease:activeLease,
        freshness:result.freshness??afterClaimFreshness,
        result,
      };
    }
  }catch(error){
    if(FENCE_ERRORS.has(error?.code??error?.message)){
      outcome={
        status:'HOLD',
        reason:'EXECUTION_FENCE_LOST',
        gate_error_code:error?.code??error?.message,
        executed:false,
        lease_action:claim.action,
        lease:activeLease,
        freshness:initialFreshness,
        result:null,
      };
    }else{
      throw error;
    }
  }finally{
    try{
      releaseResult=await lease_runtime.release({lease:activeLease});
    }catch(error){
      releaseResult={
        action:'RELEASE_FAILED',
        error_code:error?.code??error?.message??'EXECUTION_LEASE_RELEASE_FAILED'
      };
    }
  }

  return {
    ...outcome,
    lease_release:releaseResult,
    coordination_warning:releaseResult?.action==='RELEASE_FAILED'
      ? 'EXECUTION_LEASE_RELEASE_FAILED'
      : null,
  };
}

import { verifyProofInputBinding } from '../contracts/proof-input-binding.mjs';
import { sameLogicalExecution } from '../contracts/execution-identity.mjs';

const SOURCES=new Set(['NATIVE_EXECUTION','RECOVERY_HISTORY','DOWNSTREAM_TERMINAL_EVIDENCE','EXTERNAL_AUTHORITY']);
const PROOF=new Set(['CURRENT','UNBOUND','UNVERIFIED','STALE','INVALID']);
const need=(condition,code,details={})=>{if(!condition){const error=new Error(code);error.code=code;error.details=details;throw error;}};

function recordShape(record,index){
  need(record&&typeof record==='object','RECOVERY_EVIDENCE_RECORD_INVALID',{index});
  need(SOURCES.has(record.source),'RECOVERY_EVIDENCE_SOURCE_INVALID',{index});
  need(typeof record.terminal_authority==='boolean','RECOVERY_TERMINAL_AUTHORITY_REQUIRED',{index});
  const receipt=record.receipt;
  need(receipt?.schema_version==='core-receipt/v1','RECOVERY_RECEIPT_SCHEMA_INVALID',{index});
  need(['SUCCEEDED','HOLD','FAILED','PARTIAL'].includes(receipt.status),'RECOVERY_RECEIPT_STATUS_INVALID',{index});

  let proofStatus='UNBOUND';
  if(receipt.proof_input_binding){
    if(Array.isArray(record.current_proof_inputs)&&record.current_proof_inputs.length){
      proofStatus=verifyProofInputBinding(receipt.proof_input_binding,record.current_proof_inputs).status;
    }else{
      proofStatus='UNVERIFIED';
    }
  }else if(record.proof_status!=null){
    proofStatus=record.proof_status;
  }
  need(PROOF.has(proofStatus),'RECOVERY_PROOF_STATUS_INVALID',{index});

  return {
    source:record.source,
    terminal_authority:record.terminal_authority,
    proof_status:proofStatus,
    receipt
  };
}

function sameAttempt(left,right){
  return Boolean(
    left?.attempt_id &&
    right?.attempt_id &&
    left.attempt_id===right.attempt_id
  );
}

export function reconcileRecoveryReceipts({
  target_execution,
  evidence_records=[],
  current_attempt=null,
}={}){
  need(target_execution&&typeof target_execution==='object','RECOVERY_TARGET_EXECUTION_REQUIRED');
  need(typeof target_execution.logical_execution_id==='string'&&target_execution.logical_execution_id.length>0,'RECOVERY_LOGICAL_EXECUTION_ID_REQUIRED');
  need(typeof target_execution.identity_digest==='string'&&target_execution.identity_digest.length>0,'RECOVERY_IDENTITY_DIGEST_REQUIRED');
  need(Array.isArray(evidence_records),'RECOVERY_EVIDENCE_RECORDS_REQUIRED');

  const normalized=evidence_records.map(recordShape);
  const matching=[];
  const foreign=[];
  for(const record of normalized){
    const binding=record.receipt.execution;
    if(!binding){
      foreign.push({...record,reason:'EXECUTION_BINDING_MISSING'});
      continue;
    }
    if(!sameLogicalExecution(binding,target_execution)){
      foreign.push({...record,reason:'LOGICAL_EXECUTION_MISMATCH'});
      continue;
    }
    matching.push(record);
  }

  const authoritative=matching.filter(record=>record.terminal_authority===true);
  const staleAuthoritative=authoritative.filter(record=>['STALE','INVALID','UNVERIFIED'].includes(record.proof_status));
  const currentAuthoritative=authoritative.filter(record=>!['STALE','INVALID','UNVERIFIED'].includes(record.proof_status));

  const byAttempt=new Map();
  for(const record of currentAuthoritative){
    const attemptId=record.receipt.execution?.attempt_id;
    if(!attemptId) continue;
    if(!byAttempt.has(attemptId)) byAttempt.set(attemptId,[]);
    byAttempt.get(attemptId).push(record);
  }
  const conflictingAttempts=[];
  for(const [attemptId,records] of byAttempt.entries()){
    const statuses=new Set(records.map(record=>record.receipt.status));
    if(statuses.has('SUCCEEDED')&&[...statuses].some(status=>status!=='SUCCEEDED')){
      conflictingAttempts.push({
        attempt_id:attemptId,
        receipt_refs:records.map(record=>record.receipt.receipt_id),
        statuses:[...statuses].sort(),
      });
    }
  }
  if(conflictingAttempts.length){
    return {
      action:'HOLD',
      reason:'CONFLICTING_TERMINAL_EVIDENCE',
      logical_execution_id:target_execution.logical_execution_id,
      conflicts:conflictingAttempts,
      matching_receipt_count:matching.length,
      foreign_receipt_count:foreign.length,
    };
  }

  const successes=currentAuthoritative.filter(record=>record.receipt.status==='SUCCEEDED');
  const partialOrHold=currentAuthoritative.filter(record=>['PARTIAL','HOLD'].includes(record.receipt.status));
  const failures=currentAuthoritative.filter(record=>record.receipt.status==='FAILED');

  if(successes.length){
    const successfulRecovery=successes.find(record=>
      ['FALLBACK','MANUAL_RECOVERY'].includes(record.receipt.execution?.execution_path)
    )??null;
    return {
      action:'SUPPRESS_REPLAY',
      reason:successfulRecovery?'SUCCESSFUL_PRIOR_RECOVERY':'SUCCESS_EVIDENCE_PRESENT',
      logical_execution_id:target_execution.logical_execution_id,
      success_receipt_refs:successes.map(record=>record.receipt.receipt_id),
      successful_recovery_receipt_ref:successfulRecovery?.receipt.receipt_id??null,
      matching_receipt_count:matching.length,
      foreign_receipt_count:foreign.length,
    };
  }

  if(partialOrHold.length){
    return {
      action:'HOLD',
      reason:'AMBIGUOUS_OR_PARTIAL_OUTCOME',
      logical_execution_id:target_execution.logical_execution_id,
      blocking_receipt_refs:partialOrHold.map(record=>record.receipt.receipt_id),
      matching_receipt_count:matching.length,
      foreign_receipt_count:foreign.length,
    };
  }

  if(staleAuthoritative.length){
    return {
      action:'HOLD',
      reason:staleAuthoritative.some(record=>record.proof_status==='UNVERIFIED')?'AUTHORITATIVE_EVIDENCE_UNVERIFIED':'AUTHORITATIVE_EVIDENCE_STALE',
      logical_execution_id:target_execution.logical_execution_id,
      blocking_receipt_refs:staleAuthoritative.map(record=>record.receipt.receipt_id),
      matching_receipt_count:matching.length,
      foreign_receipt_count:foreign.length,
    };
  }

  if(current_attempt){
    const duplicateAttempt=matching.find(record=>sameAttempt(record.receipt.execution,current_attempt));
    if(duplicateAttempt){
      return {
        action:'HOLD',
        reason:'CURRENT_ATTEMPT_ALREADY_OBSERVED',
        logical_execution_id:target_execution.logical_execution_id,
        blocking_receipt_refs:[duplicateAttempt.receipt.receipt_id],
        matching_receipt_count:matching.length,
        foreign_receipt_count:foreign.length,
      };
    }
  }

  return {
    action:'ALLOW_RECOVERY',
    reason:failures.length?'ONLY_TERMINAL_FAILURE_EVIDENCE':'NO_SUCCESS_EVIDENCE',
    logical_execution_id:target_execution.logical_execution_id,
    failure_receipt_refs:failures.map(record=>record.receipt.receipt_id),
    matching_receipt_count:matching.length,
    foreign_receipt_count:foreign.length,
  };
}

import { verifyProofInputBinding } from '../contracts/proof-input-binding.mjs';
import { sameLogicalExecution } from '../contracts/execution-identity.mjs';

const need=(condition,code,details={})=>{if(!condition){const e=new Error(code);e.code=code;e.details=details;throw e;}};
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

function normalizeEvidence(record,index){
  need(record&&typeof record==='object','EFFECT_RESUME_EVIDENCE_INVALID',{index});
  const receipt=record.receipt;
  need(receipt?.schema_version==='core-receipt/v1','EFFECT_RESUME_RECEIPT_INVALID',{index});
  need(['workflow.effect','workflow.compensation'].includes(receipt.operation_kind),'EFFECT_RESUME_RECEIPT_KIND_INVALID',{index});
  need(text(receipt.metrics?.effect_id),'EFFECT_RESUME_EFFECT_ID_REQUIRED',{index});

  let proofStatus='UNBOUND';
  if(receipt.proof_input_binding){
    if(Array.isArray(record.current_proof_inputs)&&record.current_proof_inputs.length){
      proofStatus=verifyProofInputBinding(receipt.proof_input_binding,record.current_proof_inputs).status;
    }else{
      proofStatus='UNVERIFIED';
    }
  }
  return {receipt,proof_status:proofStatus};
}

function receiptTime(receipt){
  const value=Date.parse(receipt.ended_at??receipt.started_at??'');
  return Number.isFinite(value)?value:0;
}

function latest(records){
  return [...records].sort((a,b)=>receiptTime(b.receipt)-receiptTime(a.receipt))[0]??null;
}

export function planEffectResume({
  effects,
  target_execution,
  evidence_records=[],
}={}){
  need(Array.isArray(effects)&&effects.length>0,'EFFECT_RESUME_EFFECTS_REQUIRED');
  need(target_execution&&text(target_execution.logical_execution_id)&&text(target_execution.identity_digest),'EFFECT_RESUME_EXECUTION_REQUIRED');
  need(Array.isArray(evidence_records),'EFFECT_RESUME_EVIDENCE_REQUIRED');

  const ids=effects.map(x=>x?.effect_id);
  need(ids.every(text),'EFFECT_RESUME_EFFECT_ID_REQUIRED');
  need(new Set(ids).size===ids.length,'EFFECT_RESUME_EFFECT_ID_DUPLICATE');

  const normalized=evidence_records.map(normalizeEvidence);
  const matching=normalized.filter(record=>
    record.receipt.execution&&sameLogicalExecution(record.receipt.execution,target_execution)
  );
  const foreign_count=normalized.length-matching.length;

  const stale=matching.filter(record=>['STALE','INVALID','UNVERIFIED'].includes(record.proof_status));
  if(stale.length){
    return {
      status:'HOLD',
      reason:stale.some(x=>x.proof_status==='UNVERIFIED')?'EFFECT_EVIDENCE_UNVERIFIED':'EFFECT_EVIDENCE_STALE',
      actions:[],
      blocking_receipt_refs:stale.map(x=>x.receipt.receipt_id),
      foreign_receipt_count:foreign_count,
    };
  }

  const unknownEffects=matching.filter(record=>!ids.includes(record.receipt.metrics.effect_id));
  if(unknownEffects.length){
    return {
      status:'HOLD',
      reason:'UNKNOWN_EFFECT_EVIDENCE',
      actions:[],
      blocking_receipt_refs:unknownEffects.map(x=>x.receipt.receipt_id),
      foreign_receipt_count:foreign_count,
    };
  }

  const actions=[];
  let encounteredRunnable=false;

  for(const effect of effects){
    const records=matching.filter(record=>record.receipt.metrics.effect_id===effect.effect_id);
    const effectReceipts=records.filter(record=>record.receipt.operation_kind==='workflow.effect');
    const compensationReceipts=records.filter(record=>record.receipt.operation_kind==='workflow.compensation');

    const effectSuccesses=effectReceipts.filter(record=>record.receipt.status==='SUCCEEDED');
    const effectBlocks=effectReceipts.filter(record=>['HOLD','PARTIAL'].includes(record.receipt.status));
    const effectFailures=effectReceipts.filter(record=>record.receipt.status==='FAILED');
    const compensationSuccesses=compensationReceipts.filter(record=>record.receipt.status==='SUCCEEDED');
    const compensationFailures=compensationReceipts.filter(record=>record.receipt.status!=='SUCCEEDED');

    if(compensationSuccesses.length&&!effectSuccesses.length){
      return {
        status:'HOLD',
        reason:'COMPENSATION_WITHOUT_EFFECT_SUCCESS',
        actions,
        blocking_effect_id:effect.effect_id,
        blocking_receipt_refs:compensationSuccesses.map(x=>x.receipt.receipt_id),
        foreign_receipt_count:foreign_count,
      };
    }

    if(compensationSuccesses.length&&effect.compensation_mode!=='REQUIRED'){
      return {
        status:'HOLD',
        reason:'UNEXPECTED_COMPENSATION_EVIDENCE',
        actions,
        blocking_effect_id:effect.effect_id,
        blocking_receipt_refs:compensationSuccesses.map(x=>x.receipt.receipt_id),
        foreign_receipt_count:foreign_count,
      };
    }

    if(effectBlocks.length||compensationFailures.length){
      return {
        status:'HOLD',
        reason:compensationFailures.length?'COMPENSATION_EVIDENCE_FAILED':'EFFECT_EVIDENCE_AMBIGUOUS',
        actions,
        blocking_effect_id:effect.effect_id,
        blocking_receipt_refs:[
          ...effectBlocks.map(x=>x.receipt.receipt_id),
          ...compensationFailures.map(x=>x.receipt.receipt_id),
        ],
        foreign_receipt_count:foreign_count,
      };
    }

    const latestEffectSuccess=latest(effectSuccesses);
    const latestCompensationSuccess=latest(compensationSuccesses);
    const compensated=Boolean(
      latestEffectSuccess&&
      latestCompensationSuccess&&
      receiptTime(latestCompensationSuccess.receipt)>=receiptTime(latestEffectSuccess.receipt)
    );

    const uncompensatedSuccesses=effectSuccesses.filter(success=>{
      const successTime=receiptTime(success.receipt);
      return !compensationSuccesses.some(comp=>receiptTime(comp.receipt)>=successTime);
    });
    const successAttempts=new Set(
      uncompensatedSuccesses
        .map(record=>record.receipt.execution?.attempt_id)
        .filter(text)
    );
    if(uncompensatedSuccesses.length>1&&successAttempts.size>1){
      return {
        status:'HOLD',
        reason:'DUPLICATE_EFFECT_SUCCESS_EVIDENCE',
        actions,
        blocking_effect_id:effect.effect_id,
        blocking_receipt_refs:uncompensatedSuccesses.map(x=>x.receipt.receipt_id),
        foreign_receipt_count:foreign_count,
      };
    }

    if(effectSuccesses.length&&effectFailures.length&&!compensated){
      const latestEffect=latest(effectReceipts);
      const status=latestEffect?.receipt.status;
      if(status!=='SUCCEEDED'){
        return {
          status:'HOLD',
          reason:'CONFLICTING_EFFECT_EVIDENCE',
          actions,
          blocking_effect_id:effect.effect_id,
          blocking_receipt_refs:effectReceipts.map(x=>x.receipt.receipt_id),
          foreign_receipt_count:foreign_count,
        };
      }
    }

    if(latestEffectSuccess&&!compensated){
      if(encounteredRunnable){
        return {
          status:'HOLD',
          reason:'OUT_OF_ORDER_EFFECT_SUCCESS',
          actions,
          blocking_effect_id:effect.effect_id,
          blocking_receipt_refs:[latestEffectSuccess.receipt.receipt_id],
          foreign_receipt_count:foreign_count,
        };
      }
      actions.push({
        effect_id:effect.effect_id,
        action:'SKIP_ALREADY_APPLIED',
        receipt_ref:latestEffectSuccess.receipt.receipt_id,
        compensation_mode:effect.compensation_mode,
      });
      continue;
    }

    encounteredRunnable=true;
    actions.push({
      effect_id:effect.effect_id,
      action:'RUN',
      reason:compensated
        ? 'PRIOR_EFFECT_COMPENSATED'
        : (effectFailures.length?'PRIOR_EFFECT_FAILED':'NOT_YET_OBSERVED'),
      prior_effect_receipt_ref:latest(effectReceipts)?.receipt.receipt_id??null,
      prior_compensation_receipt_ref:latestCompensationSuccess?.receipt.receipt_id??null,
      compensation_mode:effect.compensation_mode,
    });
  }

  const runnable=actions.filter(x=>x.action==='RUN');
  if(!runnable.length){
    return {
      status:'COMPLETE',
      reason:'ALL_EFFECTS_ALREADY_APPLIED',
      actions,
      resume_from_effect_id:null,
      foreign_receipt_count:foreign_count,
    };
  }

  return {
    status:'RESUMABLE',
    reason:'EFFECT_RESUME_PLAN_READY',
    actions,
    resume_from_effect_id:runnable[0].effect_id,
    foreign_receipt_count:foreign_count,
  };
}

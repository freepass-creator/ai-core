import { reconcileRecoveryReceipts } from './recovery-receipt-reconciler.mjs';

const need=(condition,code)=>{if(!condition){const error=new Error(code);error.code=code;throw error;}};

export async function executeWithRecoveryGuard({
  target_execution,
  evidence_records=[],
  current_attempt=null,
  execute,
}={}){
  need(typeof execute==='function','RECOVERY_EXECUTOR_REQUIRED');
  const reconciliation=reconcileRecoveryReceipts({
    target_execution,
    evidence_records,
    current_attempt,
  });

  if(reconciliation.action==='SUPPRESS_REPLAY'){
    return {
      status:'SUPPRESSED',
      action:'NO_REPLAY',
      executed:false,
      reconciliation,
      result:null,
    };
  }

  if(reconciliation.action==='HOLD'){
    return {
      status:'HOLD',
      action:'HOLD',
      executed:false,
      reconciliation,
      result:null,
    };
  }

  const result=await execute({target_execution,current_attempt,reconciliation});
  return {
    status:'EXECUTED',
    action:'EXECUTED',
    executed:true,
    reconciliation,
    result:result??null,
  };
}

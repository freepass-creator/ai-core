import { reconcileRecoveryReceipts } from './recovery-receipt-reconciler.mjs';

const need=(condition,code)=>{if(!condition){const error=new Error(code);error.code=code;throw error;}};
const RETRY_ACTIONS=new Set(['RETRY','WAIT_MANUAL_RETRY']);

export function guardRetryDecisionWithReceipts({
  retry_decision,
  target_execution,
  evidence_records=[],
  current_attempt=null,
}={}){
  need(retry_decision&&typeof retry_decision==='object','RETRY_DECISION_REQUIRED');
  need(typeof retry_decision.action==='string','RETRY_DECISION_ACTION_REQUIRED');

  if(!RETRY_ACTIONS.has(retry_decision.action)){
    return {
      ...retry_decision,
      replay_guard:'NOT_APPLICABLE',
      reconciliation:null,
    };
  }

  const reconciliation=reconcileRecoveryReceipts({
    target_execution,
    evidence_records,
    current_attempt,
  });

  if(reconciliation.action==='SUPPRESS_REPLAY'){
    return {
      action:'SUPPRESS_RETRY',
      reason:reconciliation.reason,
      original_retry_action:retry_decision.action,
      error_code:retry_decision.error_code??null,
      replay_guard:'SUPPRESSED',
      reconciliation,
    };
  }

  if(reconciliation.action==='HOLD'){
    return {
      action:'HOLD',
      reason:reconciliation.reason,
      original_retry_action:retry_decision.action,
      error_code:retry_decision.error_code??null,
      replay_guard:'HOLD',
      reconciliation,
    };
  }

  return {
    ...retry_decision,
    replay_guard:'ALLOWED',
    reconciliation,
  };
}

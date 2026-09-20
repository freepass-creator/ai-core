const ACTIONS=new Set(['CONTINUE','HOLD','RETRY','WAIT_MANUAL_RETRY','ESCALATE','FAIL','CANCEL','PARTIAL_STATE']);

function need(condition,code){if(!condition) throw new Error(code);}
const text=value=>typeof value==='string'&&value.trim()===value&&value.length>0;

export function projectOperationFeedback({
  workflow_decision,
  completion={status:'PENDING',receipt_ref:null},
  allowed_actions=[],
  last_verified_at=null,
}={}){
  need(workflow_decision&&ACTIONS.has(workflow_decision.action),'UI_OPERATION_WORKFLOW_DECISION_INVALID');
  need(['PENDING','VERIFIED','FAILED','NONE'].includes(completion?.status),'UI_OPERATION_COMPLETION_STATUS_INVALID');
  need(Array.isArray(allowed_actions),'UI_OPERATION_ALLOWED_ACTIONS_INVALID');

  const base={
    workflow_action:workflow_decision.action,
    presentation_state:null,
    feature_refs:[],
    primary_action:null,
    secondary_actions:[],
    blocking:true,
    announce:'POLITE',
    completion_verified:completion.status==='VERIFIED',
    receipt_ref:text(completion.receipt_ref)?completion.receipt_ref:null,
    last_verified_at:text(last_verified_at)?last_verified_at:null,
  };

  if(workflow_decision.action==='CONTINUE'){
    if(completion.status==='VERIFIED'){
      return {
        ...base,
        presentation_state:'COMPLETED',
        feature_refs:['feedback.toast'],
        blocking:false,
        announce:'POLITE',
      };
    }
    return {
      ...base,
      presentation_state:'COMPLETION_PENDING',
      feature_refs:['feedback.progress'],
      blocking:true,
      announce:'POLITE',
    };
  }

  if(workflow_decision.action==='HOLD'){
    return {
      ...base,
      presentation_state:'BLOCKED',
      feature_refs:['feedback.alert'],
      secondary_actions:[...allowed_actions],
      blocking:true,
      announce:'ASSERTIVE',
    };
  }

  if(workflow_decision.action==='RETRY'){
    return {
      ...base,
      presentation_state:'RETRY_SCHEDULED',
      feature_refs:['feedback.progress','feedback.retry'],
      blocking:true,
      announce:'POLITE',
    };
  }

  if(workflow_decision.action==='WAIT_MANUAL_RETRY'){
    const retry=allowed_actions.find(x=>x?.kind==='RETRY')??null;
    return {
      ...base,
      presentation_state:'RETRY_AVAILABLE',
      feature_refs:['feedback.retry','feedback.inline-error'],
      primary_action:retry,
      secondary_actions:allowed_actions.filter(x=>x!==retry),
      blocking:true,
      announce:'POLITE',
    };
  }

  return {
    ...base,
    presentation_state:workflow_decision.action==='PARTIAL_STATE'?'PARTIAL_STATE':'FAILED',
    feature_refs:['feedback.alert','feedback.inline-error'],
    secondary_actions:[...allowed_actions],
    blocking:true,
    announce:'ASSERTIVE',
  };
}

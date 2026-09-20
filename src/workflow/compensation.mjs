function need(condition, code, details={}) {
  if (!condition) { const error=new Error(code); error.code=code; error.details=details; throw error; }
}

function normalizeEffect(effect, index) {
  need(effect && typeof effect==='object','COMPENSATION_EFFECT_INVALID',{index});
  need(typeof effect.effect_id==='string' && effect.effect_id.length>0,'COMPENSATION_EFFECT_ID_REQUIRED',{index});
  need(['REQUIRED','NOT_REQUIRED','FORBIDDEN'].includes(effect.compensation_mode),'COMPENSATION_MODE_INVALID',{effect_id:effect.effect_id});
  if (effect.compensation_mode==='REQUIRED') {
    need(typeof effect.compensation_action==='string' && effect.compensation_action.length>0,'COMPENSATION_ACTION_REQUIRED',{effect_id:effect.effect_id});
  } else {
    need(typeof effect.non_compensated_reason==='string' && effect.non_compensated_reason.trim().length>0,'NON_COMPENSATED_REASON_REQUIRED',{effect_id:effect.effect_id});
  }
  return {
    effect_id:effect.effect_id,
    compensation_mode:effect.compensation_mode,
    compensation_action:effect.compensation_action ?? null,
    non_compensated_reason:effect.non_compensated_reason ?? null
  };
}

export function planReverseCompensation({ effects, applied_effect_ids }) {
  need(Array.isArray(effects),'COMPENSATION_EFFECTS_REQUIRED');
  need(Array.isArray(applied_effect_ids),'APPLIED_EFFECT_IDS_REQUIRED');
  const normalized=effects.map(normalizeEffect);
  const byId=new Map(normalized.map(effect=>[effect.effect_id,effect]));
  need(byId.size===normalized.length,'COMPENSATION_EFFECT_ID_DUPLICATE');
  const seen=new Set();
  for (const id of applied_effect_ids) {
    need(byId.has(id),'APPLIED_EFFECT_UNKNOWN',{effect_id:id});
    need(!seen.has(id),'APPLIED_EFFECT_DUPLICATE',{effect_id:id});
    seen.add(id);
  }
  const applied=applied_effect_ids.map(id=>byId.get(id));
  const steps=[];
  const retained=[];
  for (const effect of [...applied].reverse()) {
    if (effect.compensation_mode==='REQUIRED') {
      steps.push({effect_id:effect.effect_id,action:effect.compensation_action});
    } else {
      retained.push({effect_id:effect.effect_id,mode:effect.compensation_mode,reason:effect.non_compensated_reason});
    }
  }
  return {order:'REVERSE_APPLIED_ONLY',steps,retained_effects:retained};
}

export function resolveCompensationOutcome({ original_error_code, plan, compensation_results }) {
  need(typeof original_error_code==='string' && original_error_code.length>0,'ORIGINAL_ERROR_REQUIRED');
  need(plan && Array.isArray(plan.steps),'COMPENSATION_PLAN_REQUIRED');
  need(Array.isArray(compensation_results),'COMPENSATION_RESULTS_REQUIRED');
  const resultByEffect=new Map(compensation_results.map(item=>[item.effect_id,item]));
  const missing=[];
  const failed=[];
  for (const step of plan.steps) {
    const result=resultByEffect.get(step.effect_id);
    if (!result) missing.push(step.effect_id);
    else if (result.status!=='SUCCEEDED') failed.push({effect_id:step.effect_id,error_code:result.error_code ?? 'COMPENSATION_FAILED'});
  }
  if (missing.length || failed.length) {
    return {
      status:'PARTIAL_STATE',
      action:'ESCALATE',
      original_error_code,
      missing_compensations:missing,
      failed_compensations:failed,
      retained_effects:plan.retained_effects ?? []
    };
  }
  return {
    status:'COMPENSATED',
    action:'RETHROW_ORIGINAL_FAILURE',
    original_error_code,
    retained_effects:plan.retained_effects ?? []
  };
}

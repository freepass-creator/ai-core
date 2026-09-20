const need=(condition,code)=>{if(!condition) throw new Error(code);};
const digest=value=>typeof value==='string'&&/^sha256:[0-9a-f]{64}$/.test(value);
const ts=value=>Number.isFinite(Date.parse(value));

export function assertApprovalSubjectMatches(actual, expected={}) {
  need(actual && typeof actual==='object','SECURITY_APPROVAL_SUBJECT_REQUIRED');
  for (const key of ['plan_digest','target_digest']) {
    need(digest(actual[key]), `SECURITY_APPROVAL_${key.toUpperCase()}_INVALID`);
    if (expected[key] !== undefined) need(actual[key]===expected[key], `SECURITY_APPROVAL_${key.toUpperCase()}_MISMATCH`);
  }
  for (const key of ['artifact_digest','command_digest']) {
    need(actual[key]===null || digest(actual[key]), `SECURITY_APPROVAL_${key.toUpperCase()}_INVALID`);
    if (expected[key] !== undefined) need(actual[key]===expected[key], `SECURITY_APPROVAL_${key.toUpperCase()}_MISMATCH`);
  }
  if (expected.subject_revision !== undefined) need(actual.subject_revision===expected.subject_revision,'SECURITY_APPROVAL_SUBJECT_REVISION_MISMATCH');
  if (expected.target_count !== undefined) need(actual.target_count===expected.target_count,'SECURITY_APPROVAL_TARGET_COUNT_MISMATCH');
  return true;
}

function alive(record, now) {
  return record && ts(record.expires_at) && Date.parse(record.expires_at)>now;
}

export function evaluateApprovalBundle({bundle,policy,expectedSubject={},now=Date.now()}={}) {
  need(bundle && typeof bundle==='object','SECURITY_APPROVAL_BUNDLE_REQUIRED');
  need(policy && typeof policy==='object','SECURITY_ACTION_POLICY_REQUIRED');
  need(bundle.policy_id===policy.policy_id,'SECURITY_APPROVAL_POLICY_MISMATCH');
  need(bundle.risk_class===policy.risk_class,'SECURITY_APPROVAL_RISK_CLASS_MISMATCH');
  assertApprovalSubjectMatches(bundle.subject,expectedSubject);

  const reviews=Array.isArray(bundle.reviews)?bundle.reviews:[];
  const validReviews=reviews.filter(r=>alive(r,now));
  const blocker=validReviews.find(r=>r.decision==='BLOCK');
  if (blocker) return {allowed:false,reason:'SECURITY_REVIEW_BLOCKED',reviewer_id:blocker.reviewer_id};

  const emergency=bundle.emergency_approval;
  if (emergency && alive(emergency,now)) {
    if (!policy.emergency_override.allowed) return {allowed:false,reason:'SECURITY_EMERGENCY_OVERRIDE_FORBIDDEN'};
    const ttl=(Date.parse(emergency.expires_at)-Date.parse(emergency.approved_at))/1000;
    if (!Number.isFinite(ttl)||ttl<0||ttl>policy.emergency_override.max_ttl_seconds) {
      return {allowed:false,reason:'SECURITY_EMERGENCY_TTL_INVALID'};
    }
    if (policy.emergency_override.command_binding_required && !bundle.subject.command_digest) {
      return {allowed:false,reason:'SECURITY_EMERGENCY_COMMAND_BINDING_REQUIRED'};
    }
    if (policy.human_approval_required && !emergency.approver_id) {
      return {allowed:false,reason:'SECURITY_HUMAN_APPROVAL_REQUIRED'};
    }
    if (policy.emergency_override.bypass_independent_review) {
      return {allowed:true,path:'EMERGENCY',reason:'SECURITY_EMERGENCY_APPROVED'};
    }
  }

  const independent=validReviews.filter(r=>r.decision==='APPROVE'&&r.reviewer_id!==bundle.executor_id);
  if (independent.length<policy.independent_review_count) {
    return {allowed:false,reason:'SECURITY_INDEPENDENT_REVIEW_REQUIRED',required:policy.independent_review_count,actual:independent.length};
  }
  if (policy.human_approval_required && !alive(bundle.owner_approval,now)) {
    return {allowed:false,reason:'SECURITY_OWNER_APPROVAL_REQUIRED'};
  }
  return {allowed:true,path:'STANDARD',reason:'SECURITY_POLICY_SATISFIED'};
}

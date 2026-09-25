import { createHash } from 'node:crypto';
import { 행위등급 } from './seungin.mjs';

export const AI_CORE_SECURITY_CANDIDATE_REVISION = '791d0e1963cd46f937329491b44c655ddce39ea3';

const POLICY = Object.freeze({
  local: Object.freeze({
    policy_id: 'security.local-mutation',
    risk_class: 'LOCAL_MUTATION',
    external_effect: false,
    reversible: true,
    independent_review_count: 0,
    human_approval_required: false,
    emergency_override: Object.freeze({
      allowed: false,
      bypass_independent_review: false,
      command_binding_required: false,
      max_ttl_seconds: 0,
    }),
  }),
  'drive-add': Object.freeze({
    policy_id: 'security.reversible-external',
    risk_class: 'REVERSIBLE_EXTERNAL_MUTATION',
    external_effect: true,
    reversible: true,
    independent_review_count: 1,
    human_approval_required: true,
    emergency_override: Object.freeze({
      allowed: true,
      bypass_independent_review: true,
      command_binding_required: true,
      max_ttl_seconds: 900,
    }),
  }),
  protected: Object.freeze({
    policy_id: 'security.irreversible-external',
    risk_class: 'IRREVERSIBLE_EXTERNAL_ACTION',
    external_effect: true,
    reversible: false,
    independent_review_count: 1,
    human_approval_required: true,
    emergency_override: Object.freeze({
      allowed: false,
      bypass_independent_review: false,
      command_binding_required: true,
      max_ttl_seconds: 0,
    }),
  }),
});

const sha256 = value => 'sha256:' + createHash('sha256').update(String(value)).digest('hex');
const prefixed = value => {
  const text = String(value ?? '').trim();
  if (/^sha256:[0-9a-f]{64}$/.test(text)) return text;
  if (/^[0-9a-f]{64}$/.test(text)) return 'sha256:' + text;
  throw new Error('AI_CORE_SECURITY_SHADOW_DIGEST_INVALID');
};
const alive = (record, now) => record && Number.isFinite(Date.parse(record.expires_at)) && Date.parse(record.expires_at) > now;

export function shadowPolicyForGrade(grade) {
  const policy = POLICY[grade];
  if (!policy) throw new Error('AI_CORE_SECURITY_SHADOW_GRADE_UNKNOWN');
  return policy;
}

export function shadowSubject({ subjectRevision, planSHA, templateSHA, targetSHA, targetCount, command = null }) {
  return Object.freeze({
    subject_revision: String(subjectRevision || 'aiops-runtime'),
    plan_digest: prefixed(planSHA),
    target_digest: prefixed(targetSHA),
    artifact_digest: templateSHA ? prefixed(templateSHA) : null,
    command_digest: command ? sha256(Array.isArray(command) ? command.join(' ') : String(command)) : null,
    target_count: Number(targetCount) || 0,
  });
}

export function evaluateShadowApproval({
  grade,
  executorId,
  reviews = [],
  ownerApproval = null,
  emergencyApproval = null,
  subject,
  now = Date.now(),
} = {}) {
  const policy = shadowPolicyForGrade(grade);
  if (!subject?.plan_digest || !subject?.target_digest) {
    return { allowed: false, reason: 'SECURITY_APPROVAL_SUBJECT_REQUIRED' };
  }

  const liveReviews = reviews.filter(r => alive(r, now));
  const blocker = liveReviews.find(r => r.decision === 'BLOCK');
  if (blocker) return { allowed: false, reason: 'SECURITY_REVIEW_BLOCKED' };

  if (emergencyApproval && alive(emergencyApproval, now)) {
    if (!policy.emergency_override.allowed) {
      return { allowed: false, reason: 'SECURITY_EMERGENCY_OVERRIDE_FORBIDDEN' };
    }
    const ttl = (Date.parse(emergencyApproval.expires_at) - Date.parse(emergencyApproval.approved_at)) / 1000;
    if (!Number.isFinite(ttl) || ttl < 0 || ttl > policy.emergency_override.max_ttl_seconds) {
      return { allowed: false, reason: 'SECURITY_EMERGENCY_TTL_INVALID' };
    }
    if (policy.emergency_override.command_binding_required && !subject.command_digest) {
      return { allowed: false, reason: 'SECURITY_EMERGENCY_COMMAND_BINDING_REQUIRED' };
    }
    if (policy.emergency_override.bypass_independent_review) {
      return { allowed: true, path: 'EMERGENCY', reason: 'SECURITY_EMERGENCY_APPROVED' };
    }
  }

  const independent = liveReviews.filter(r => r.decision === 'APPROVE' && r.reviewer_id !== executorId);
  if (independent.length < policy.independent_review_count) {
    return { allowed: false, reason: 'SECURITY_INDEPENDENT_REVIEW_REQUIRED' };
  }
  if (policy.human_approval_required && !alive(ownerApproval, now)) {
    return { allowed: false, reason: 'SECURITY_OWNER_APPROVAL_REQUIRED' };
  }
  return { allowed: true, path: 'STANDARD', reason: 'SECURITY_POLICY_SATISFIED' };
}

export function assertGradeParity() {
  const local = 행위등급.local;
  const drive = 행위등급['drive-add'];
  const protectedGrade = 행위등급.protected;
  if (local.검토자수 !== 0 || local.대표승인 !== false) throw new Error('AI_CORE_SECURITY_SHADOW_LOCAL_DRIFT');
  if (drive.검토자수 !== 1 || drive.대표승인 !== true || drive.긴급우회 !== true) throw new Error('AI_CORE_SECURITY_SHADOW_DRIVE_ADD_DRIFT');
  if (protectedGrade.검토자수 !== 1 || protectedGrade.대표승인 !== true || protectedGrade.긴급우회 !== false) throw new Error('AI_CORE_SECURITY_SHADOW_PROTECTED_DRIFT');
  return true;
}

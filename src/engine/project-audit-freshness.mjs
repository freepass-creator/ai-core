import { validateProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

function validateCapsule(capsule) {
  need(capsule && typeof capsule === 'object' && !Array.isArray(capsule), 'AUDIT_FRESHNESS_CAPSULE_REQUIRED');
  need(capsule.schema === 'ai-core-project-capsule/v1', 'AUDIT_FRESHNESS_CAPSULE_SCHEMA_INVALID');
  need(typeof capsule.project_id === 'string' && capsule.project_id.length > 0, 'AUDIT_FRESHNESS_PROJECT_ID_REQUIRED');
  need(typeof capsule.repository === 'string' && capsule.repository.length > 0, 'AUDIT_FRESHNESS_REPOSITORY_REQUIRED');
  need(typeof capsule.default_branch === 'string' && capsule.default_branch.length > 0, 'AUDIT_FRESHNESS_DEFAULT_BRANCH_REQUIRED');
  need(sha(capsule.subject_revision), 'AUDIT_FRESHNESS_LIVE_REVISION_INVALID');
  return capsule;
}

function registryObservation(registryProject, capsule) {
  if (!registryProject) {
    return {
      status: 'UNKNOWN',
      head_revision: null,
      reason: 'PROJECT_NOT_IN_REGISTRY',
    };
  }

  if (
    registryProject.project_id !== capsule.project_id ||
    registryProject.repository !== capsule.repository ||
    registryProject.default_branch !== capsule.default_branch
  ) {
    return {
      status: 'MISMATCH',
      head_revision: registryProject.head_revision ?? null,
      reason: 'PROJECT_REGISTRY_IDENTITY_MISMATCH',
    };
  }

  if (!sha(registryProject.head_revision)) {
    return {
      status: 'UNKNOWN',
      head_revision: registryProject.head_revision ?? null,
      reason: 'PROJECT_REGISTRY_HEAD_INVALID',
    };
  }

  return registryProject.head_revision === capsule.subject_revision
    ? {
        status: 'CURRENT',
        head_revision: registryProject.head_revision,
        reason: null,
      }
    : {
        status: 'STALE',
        head_revision: registryProject.head_revision,
        reason: 'PROJECT_REGISTRY_HEAD_BEHIND_LIVE',
      };
}

export function assessProjectAuditFreshness({
  result,
  readinessRegistry,
  capsule,
  registryProject = null,
}) {
  validateProjectAuditResult(result, readinessRegistry);
  validateCapsule(capsule);

  const identityBlockers = [];
  if (result.project_id !== capsule.project_id) identityBlockers.push('PROJECT_ID_MISMATCH');
  if (result.repository !== capsule.repository) identityBlockers.push('REPOSITORY_MISMATCH');
  if (result.source_proof.default_branch !== capsule.default_branch) identityBlockers.push('DEFAULT_BRANCH_MISMATCH');

  const registry = registryObservation(registryProject, capsule);
  if (registry.status === 'MISMATCH') identityBlockers.push(registry.reason);

  const auditedRevision = result.subject_revision;
  const liveRevision = capsule.subject_revision;
  const moved = auditedRevision !== liveRevision;

  const status = identityBlockers.length
    ? 'HOLD'
    : moved
      ? 'STALE'
      : 'CURRENT';

  const reasons = [];
  if (moved) reasons.push('SUBJECT_REVISION_MOVED');
  if (registry.status === 'STALE') reasons.push('PROJECT_REGISTRY_OBSERVATION_STALE');
  if (registry.status === 'UNKNOWN') reasons.push(registry.reason);
  if (capsule.readiness?.status !== 'READY_FOR_REGISTRY_REVIEW') reasons.push('LIVE_PROJECT_CAPSULE_HOLD');

  return {
    schema: 'ai-core-project-audit-freshness/v1',
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    status,
    audited_revision: auditedRevision,
    live_revision: liveRevision,
    moved,
    re_audit_required: status !== 'CURRENT',
    audit_usable_as_current: status === 'CURRENT',
    registry_observation: registry,
    live_capsule: {
      status: capsule.readiness?.status ?? 'UNKNOWN',
      blockers: Array.isArray(capsule.readiness?.blockers) ? [...capsule.readiness.blockers] : [],
      observed_at: capsule.observed_at ?? null,
    },
    blockers: identityBlockers,
    reasons,
    rule: 'Only an audit bound to the currently observed project revision may be presented as current. Registry observations are advisory freshness evidence; live revision inspection wins when the registry lags.',
  };
}

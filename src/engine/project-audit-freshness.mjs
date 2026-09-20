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

function standardObservation(result, readinessRegistry) {
  if (result.schema === 'ai-core-project-audit-result/v1') {
    return {
      status: 'UNKNOWN_LEGACY',
      audited_baseline_revision: null,
      current_baseline_revision: readinessRegistry.baseline_revision,
      reason: 'STANDARD_BASELINE_UNBOUND_LEGACY',
    };
  }

  return result.standard_baseline_revision === readinessRegistry.baseline_revision
    ? {
        status: 'CURRENT',
        audited_baseline_revision: result.standard_baseline_revision,
        current_baseline_revision: readinessRegistry.baseline_revision,
        reason: null,
      }
    : {
        status: 'STALE',
        audited_baseline_revision: result.standard_baseline_revision,
        current_baseline_revision: readinessRegistry.baseline_revision,
        reason: 'STANDARD_BASELINE_MOVED',
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

  const standard = standardObservation(result, readinessRegistry);
  const auditedRevision = result.subject_revision;
  const liveRevision = capsule.subject_revision;
  const projectMoved = auditedRevision !== liveRevision;
  const standardMoved = standard.status !== 'CURRENT';

  const status = identityBlockers.length
    ? 'HOLD'
    : projectMoved || standardMoved
      ? 'STALE'
      : 'CURRENT';

  const reasons = [];
  if (projectMoved) reasons.push('SUBJECT_REVISION_MOVED');
  if (standard.reason) reasons.push(standard.reason);
  if (registry.status === 'STALE') reasons.push('PROJECT_REGISTRY_OBSERVATION_STALE');
  if (registry.status === 'UNKNOWN') reasons.push(registry.reason);
  if (capsule.readiness?.status !== 'READY_FOR_REGISTRY_REVIEW') reasons.push('LIVE_PROJECT_CAPSULE_HOLD');

  return {
    schema: 'ai-core-project-audit-freshness/v2',
    audit_result_schema: result.schema,
    project_id: result.project_id,
    repository: result.repository,
    default_branch: result.source_proof.default_branch,
    status,
    project_revision: {
      audited: auditedRevision,
      live: liveRevision,
      moved: projectMoved,
    },
    standard_baseline: standard,
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
    rule: 'An audit is current only when both the live project revision and the AI Core audit-standard baseline match the revisions bound into the audit result. Legacy v1 results have no standard-baseline binding and therefore require re-audit.',
  };
}

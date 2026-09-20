import { validateProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

function projectMap(projectRegistry) {
  need(projectRegistry && typeof projectRegistry === 'object', 'AUDIT_QUEUE_PROJECT_REGISTRY_REQUIRED');
  need(Array.isArray(projectRegistry.projects), 'AUDIT_QUEUE_PROJECTS_REQUIRED');
  return new Map(projectRegistry.projects.map(project => [project.project_id, project]));
}

function standardStatus(result, readinessRegistry) {
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

export function buildProjectAuditRefreshQueue({
  readinessRegistry,
  projectRegistry,
  auditResults,
}) {
  need(Array.isArray(auditResults), 'AUDIT_QUEUE_RESULTS_REQUIRED');
  const projects = projectMap(projectRegistry);
  const items = [];

  for (const result of auditResults) {
    validateProjectAuditResult(result, readinessRegistry);
    const project = projects.get(result.project_id) ?? null;
    const standard = standardStatus(result, readinessRegistry);

    if (!project) {
      items.push({
        project_id: result.project_id,
        repository: result.repository,
        audit_result_schema: result.schema,
        audited_revision: result.subject_revision,
        registry_revision: null,
        registry_status: 'UNKNOWN',
        standard_baseline: standard,
        live_check_required: true,
        re_audit_candidate: true,
        priority: 1,
        reasons: ['PROJECT_NOT_REGISTERED', ...(standard.reason ? [standard.reason] : [])],
      });
      continue;
    }

    const reasons = [];
    if (project.repository !== result.repository) reasons.push('REPOSITORY_IDENTITY_MISMATCH');
    if (project.default_branch !== result.source_proof.default_branch) reasons.push('DEFAULT_BRANCH_IDENTITY_MISMATCH');

    const registryRevision = sha(project.head_revision) ? project.head_revision : null;
    if (!registryRevision) reasons.push('REGISTRY_HEAD_INVALID_OR_MISSING');

    const revisionMatches = registryRevision !== null && registryRevision === result.subject_revision;
    if (registryRevision !== null && !revisionMatches) reasons.push('REGISTRY_REVISION_MOVED');
    if (standard.reason) reasons.push(standard.reason);

    const registryStatus = reasons.some(reason => reason.endsWith('IDENTITY_MISMATCH'))
      ? 'HOLD'
      : registryRevision === null
        ? 'UNKNOWN'
        : revisionMatches
          ? 'REGISTRY_MATCH'
          : 'REGISTRY_DRIFT';

    const lifecycleStatus = project.repository_lifecycle_status ?? null;
    const executionReadiness = project.execution_readiness_status ?? null;
    if (lifecycleStatus === 'RETIRE') reasons.push('PROJECT_RETIRED');
    if (executionReadiness === 'DISABLED') reasons.push('PROJECT_EXECUTION_DISABLED');

    const reAuditCandidate =
      registryStatus !== 'REGISTRY_MATCH' ||
      standard.status !== 'CURRENT';

    const priority = registryStatus === 'HOLD'
      ? 0
      : registryStatus === 'REGISTRY_DRIFT'
        ? 1
        : standard.status !== 'CURRENT'
          ? 1
          : registryStatus === 'UNKNOWN'
            ? 2
            : 3;

    items.push({
      project_id: result.project_id,
      repository: result.repository,
      audit_result_schema: result.schema,
      audited_revision: result.subject_revision,
      registry_revision: registryRevision,
      registry_status: registryStatus,
      standard_baseline: standard,
      repository_lifecycle_status: lifecycleStatus,
      execution_readiness_status: executionReadiness,
      live_check_required: true,
      re_audit_candidate: reAuditCandidate,
      priority,
      reasons,
    });
  }

  items.sort((a, b) =>
    a.priority - b.priority ||
    a.project_id.localeCompare(b.project_id),
  );

  return {
    schema: 'ai-core-project-audit-refresh-queue/v2',
    observed_registry_at: projectRegistry.observed_at ?? null,
    standard_baseline_revision: readinessRegistry.baseline_revision,
    totals: {
      audits: items.length,
      registry_drift: items.filter(item => item.registry_status === 'REGISTRY_DRIFT').length,
      registry_match: items.filter(item => item.registry_status === 'REGISTRY_MATCH').length,
      standard_stale: items.filter(item => item.standard_baseline.status === 'STALE').length,
      standard_unbound_legacy: items.filter(item => item.standard_baseline.status === 'UNKNOWN_LEGACY').length,
      hold: items.filter(item => item.registry_status === 'HOLD').length,
      unknown: items.filter(item => item.registry_status === 'UNKNOWN').length,
      re_audit_candidates: items.filter(item => item.re_audit_candidate).length,
    },
    items,
    rule: 'Registry comparison only prioritizes refresh work. A registry match is not proof that an audit is current, and legacy v1 audits cannot prove which AI Core standard baseline they used. Live project HEAD plus standard-baseline freshness must both pass.',
  };
}

import { validateProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

function projectMap(projectRegistry) {
  need(projectRegistry && typeof projectRegistry === 'object', 'AUDIT_QUEUE_PROJECT_REGISTRY_REQUIRED');
  need(Array.isArray(projectRegistry.projects), 'AUDIT_QUEUE_PROJECTS_REQUIRED');
  return new Map(projectRegistry.projects.map(project => [project.project_id, project]));
}

function auditRank(result) {
  const schemaRank = result.schema === 'ai-core-project-audit-result/v2' ? 2 : 1;
  const timeRank = result.schema === 'ai-core-project-audit-result/v2'
    ? Date.parse(result.audited_at)
    : 0;
  return { schemaRank, timeRank: Number.isFinite(timeRank) ? timeRank : 0 };
}

function selectActiveAuditResults(auditResults, readinessRegistry) {
  const grouped = new Map();
  for (const result of auditResults) {
    validateProjectAuditResult(result, readinessRegistry);
    const key = result.project_id;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, result);
      continue;
    }
    const a = auditRank(existing);
    const b = auditRank(result);
    if (b.schemaRank > a.schemaRank || (b.schemaRank === a.schemaRank && b.timeRank > a.timeRank)) {
      grouped.set(key, result);
    }
  }

  const active = [...grouped.values()];
  const activeSet = new Set(active);
  const superseded = auditResults.filter(result => !activeSet.has(result));
  return { active, superseded };
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
  const { active, superseded } = selectActiveAuditResults(auditResults, readinessRegistry);
  const items = [];

  for (const result of active) {
    const project = projects.get(result.project_id) ?? null;
    const standard = standardStatus(result, readinessRegistry);

    if (!project) {
      items.push({
        project_id: result.project_id,
        repository: result.repository,
        audit_result_schema: result.schema,
        audited_at: result.audited_at ?? null,
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

    // A registry revision mismatch is ambiguous: the registry may be stale, or the
    // saved audit may be stale. Only live project inspection can decide. Do not turn
    // a registry mismatch into a re-audit claim.
    const reAuditCandidate = standard.status !== 'CURRENT';
    const freshnessReviewRequired =
      registryStatus !== 'REGISTRY_MATCH' ||
      standard.status !== 'CURRENT';

    const priority = registryStatus === 'HOLD'
      ? 0
      : standard.status !== 'CURRENT'
        ? 1
        : registryStatus === 'REGISTRY_DRIFT' || registryStatus === 'UNKNOWN'
          ? 2
          : 3;

    items.push({
      project_id: result.project_id,
      repository: result.repository,
      audit_result_schema: result.schema,
      audited_at: result.audited_at ?? null,
      audited_revision: result.subject_revision,
      registry_revision: registryRevision,
      registry_status: registryStatus,
      standard_baseline: standard,
      repository_lifecycle_status: lifecycleStatus,
      execution_readiness_status: executionReadiness,
      live_check_required: true,
      freshness_review_required: freshnessReviewRequired,
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
    schema: 'ai-core-project-audit-refresh-queue/v3',
    observed_registry_at: projectRegistry.observed_at ?? null,
    standard_baseline_revision: readinessRegistry.baseline_revision,
    totals: {
      audit_records: auditResults.length,
      active_audits: items.length,
      superseded_history: superseded.length,
      registry_drift: items.filter(item => item.registry_status === 'REGISTRY_DRIFT').length,
      registry_match: items.filter(item => item.registry_status === 'REGISTRY_MATCH').length,
      standard_stale: items.filter(item => item.standard_baseline.status === 'STALE').length,
      standard_unbound_legacy: items.filter(item => item.standard_baseline.status === 'UNKNOWN_LEGACY').length,
      hold: items.filter(item => item.registry_status === 'HOLD').length,
      unknown: items.filter(item => item.registry_status === 'UNKNOWN').length,
      freshness_review_required: items.filter(item => item.freshness_review_required).length,
      re_audit_candidates: items.filter(item => item.re_audit_candidate).length,
      action_required: items.filter(item =>
        item.registry_status === 'HOLD' ||
        item.freshness_review_required ||
        item.re_audit_candidate
      ).length,
    },
    items,
    superseded_history: superseded.map(result => ({
      project_id: result.project_id,
      repository: result.repository,
      audit_result_schema: result.schema,
      audited_at: result.audited_at ?? null,
      audited_revision: result.subject_revision,
      reason: 'SUPERSEDED_BY_HIGHER_QUALITY_OR_NEWER_AUDIT',
    })),
    rule: 'One active audit is selected per project: v2 supersedes v1, and newer v2 audited_at supersedes older v2. Historical audits remain visible but cannot keep a project in the re-audit queue. Registry revision drift is ambiguous and triggers live freshness review, not an automatic re-audit claim. Only a stale/unbound standard baseline is a definite re-audit candidate before live project inspection.',
  };
}

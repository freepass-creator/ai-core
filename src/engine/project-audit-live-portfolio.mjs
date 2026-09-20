import { buildProjectAuditPortfolio } from './project-audit-portfolio.mjs';
import { assessProjectAuditFreshness } from './project-audit-freshness.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };

function findActiveResult(auditResults, project) {
  return auditResults.find(result =>
    result.project_id === project.project_id &&
    result.repository === project.repository &&
    result.schema === project.audit_result_schema &&
    result.subject_revision === project.subject_revision &&
    (result.audited_at ?? null) === (project.audited_at ?? null)
  ) ?? null;
}

export async function buildLiveProjectAuditPortfolio({
  readinessRegistry,
  projectRegistry,
  auditResults,
  inspectProject,
}) {
  need(typeof inspectProject === 'function', 'AUDIT_LIVE_PORTFOLIO_INSPECTOR_REQUIRED');

  const portfolio = buildProjectAuditPortfolio({
    readinessRegistry,
    projectRegistry,
    auditResults,
  });

  const liveProjects = [];
  for (const project of portfolio.projects) {
    const result = findActiveResult(auditResults, project);
    need(result, `AUDIT_LIVE_PORTFOLIO_RESULT_MISSING:${project.project_id}`);

    const registryProject = projectRegistry.projects.find(item => item.project_id === project.project_id) ?? null;

    try {
      const capsule = await inspectProject({
        project_id: project.project_id,
        repository: project.repository,
        default_branch: result.source_proof.default_branch,
      });

      const freshness = assessProjectAuditFreshness({
        result,
        readinessRegistry,
        capsule,
        registryProject,
      });

      liveProjects.push({
        ...project,
        live_status: freshness.status,
        live_revision: freshness.project_revision.live,
        project_revision_moved: freshness.project_revision.moved,
        standard_status: freshness.standard_baseline.status,
        registry_observation_status: freshness.registry_observation.status,
        audit_usable_as_current: freshness.audit_usable_as_current,
        re_audit_required: freshness.re_audit_required,
        live_reasons: [...freshness.reasons],
        live_blockers: [...freshness.blockers],
      });
    } catch (error) {
      liveProjects.push({
        ...project,
        live_status: 'HOLD',
        live_revision: null,
        project_revision_moved: null,
        registry_observation_status: 'UNKNOWN',
        audit_usable_as_current: false,
        re_audit_required: true,
        live_reasons: ['LIVE_PROJECT_INSPECTION_FAILED'],
        live_blockers: [error?.message ?? 'LIVE_PROJECT_INSPECTION_FAILED'],
      });
    }
  }

  const totals = {
    ...portfolio.totals,
    live_current: liveProjects.filter(item => item.live_status === 'CURRENT').length,
    live_stale: liveProjects.filter(item => item.live_status === 'STALE').length,
    live_hold: liveProjects.filter(item => item.live_status === 'HOLD').length,
    live_re_audit_required: liveProjects.filter(item => item.re_audit_required).length,
    live_registry_stale: liveProjects.filter(item => item.registry_observation_status === 'STALE').length,
  };

  return {
    schema: 'ai-core-project-audit-live-portfolio/v1',
    standard_baseline_revision: readinessRegistry.baseline_revision,
    generated_from: portfolio.schema,
    totals,
    aggregate_verdicts: portfolio.aggregate_verdicts,
    projects: liveProjects,
    superseded_history: portfolio.superseded_history,
    permissions: portfolio.permissions,
    rule: 'Live portfolio re-observes each active audited repository at its current default-branch HEAD. A registry mismatch cannot override live HEAD. Inspection failure is HOLD and never treated as CURRENT.',
  };
}

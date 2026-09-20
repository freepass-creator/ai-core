import { buildProjectAuditRefreshQueue } from './project-audit-refresh-queue.mjs';
import { summarizeProjectAuditResult } from './project-audit-result.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };

export function buildProjectAuditPortfolio({
  readinessRegistry,
  projectRegistry,
  auditResults,
}) {
  need(Array.isArray(auditResults), 'AUDIT_PORTFOLIO_RESULTS_REQUIRED');

  const queue = buildProjectAuditRefreshQueue({
    readinessRegistry,
    projectRegistry,
    auditResults,
  });

  const active = queue.items.map(item => {
    const result = auditResults.find(candidate =>
      candidate.project_id === item.project_id &&
      candidate.repository === item.repository &&
      candidate.schema === item.audit_result_schema &&
      candidate.subject_revision === item.audited_revision &&
      (candidate.audited_at ?? null) === (item.audited_at ?? null)
    );
    need(result, `AUDIT_PORTFOLIO_ACTIVE_RESULT_MISSING:${item.project_id}`);

    const summary = summarizeProjectAuditResult(result, readinessRegistry);
    return {
      project_id: item.project_id,
      repository: item.repository,
      audit_result_schema: item.audit_result_schema,
      audited_at: item.audited_at,
      subject_revision: item.audited_revision,
      standard_baseline_revision: summary.standard_binding.audited_baseline_revision,
      standard_status: summary.standard_binding.status,
      registry_status: item.registry_status,
      freshness_review_required: item.freshness_review_required,
      re_audit_candidate: item.re_audit_candidate,
      ci: {
        status: summary.source_proof.ci_status,
        run_id: summary.source_proof.ci_run_id,
        revision_match: summary.source_proof.ci_revision_match,
      },
      branch_protected: summary.source_proof.branch_protected,
      verdicts: { ...summary.counts },
      finding_gap_count: summary.finding_gap_count,
      full_conformance_eligible: summary.full_conformance_eligible,
    };
  });

  const aggregateVerdicts = {
    core_match: 0,
    project_ahead: 0,
    migration_gap: 0,
    research_advisory: 0,
    unknown: 0,
  };
  for (const project of active) {
    for (const key of Object.keys(aggregateVerdicts)) {
      aggregateVerdicts[key] += project.verdicts[key] ?? 0;
    }
  }

  const statuses = {
    ci_pass: active.filter(item => item.ci.status === 'PASS').length,
    ci_fail: active.filter(item => item.ci.status === 'FAIL').length,
    ci_unknown: active.filter(item => item.ci.status === 'UNKNOWN').length,
    registry_match: active.filter(item => item.registry_status === 'REGISTRY_MATCH').length,
    registry_drift: active.filter(item => item.registry_status === 'REGISTRY_DRIFT').length,
    freshness_review_required: active.filter(item => item.freshness_review_required).length,
    re_audit_candidate: active.filter(item => item.re_audit_candidate).length,
    branch_unprotected: active.filter(item => item.branch_protected === false).length,
  };

  return {
    schema: 'ai-core-project-audit-portfolio/v1',
    standard_baseline_revision: readinessRegistry.baseline_revision,
    observed_registry_at: projectRegistry.observed_at ?? null,
    totals: {
      active_projects: active.length,
      audit_records: queue.totals.audit_records,
      superseded_history: queue.totals.superseded_history,
      axis_observations: active.length * 8,
      ...statuses,
    },
    aggregate_verdicts: aggregateVerdicts,
    projects: active,
    superseded_history: queue.superseded_history,
    permissions: {
      auto_remediation: false,
      canonical_promotion: false,
      production_mutation: false,
    },
    rule: 'Portfolio is a read-only rollup of the active revision-bound audit per project. Registry drift requests live freshness review and does not override live project evidence. CI status is not production proof.',
  };
}

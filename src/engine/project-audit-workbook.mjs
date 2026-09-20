const need = (condition, code) => { if (!condition) throw new Error(code); };

export function buildProjectAuditWorkbook(plan, { generatedAt = new Date().toISOString() } = {}) {
  need(plan && typeof plan === 'object' && !Array.isArray(plan), 'AUDIT_WORKBOOK_PLAN_REQUIRED');
  need(plan.schema === 'ai-core-project-audit-plan/v1', 'AUDIT_WORKBOOK_PLAN_SCHEMA_INVALID');
  need(plan.project && typeof plan.project === 'object', 'AUDIT_WORKBOOK_PROJECT_REQUIRED');
  need(Array.isArray(plan.axes) && plan.axes.length === 8, 'AUDIT_WORKBOOK_AXES_INVALID');
  need(
    typeof generatedAt === 'string' && Number.isFinite(Date.parse(generatedAt)),
    'AUDIT_WORKBOOK_GENERATED_AT_INVALID',
  );

  const ready = plan.status === 'READY_FOR_READ_ONLY_AUDIT';

  return {
    schema: 'ai-core-project-audit-workbook/v1',
    final_result_schema: 'ai-core-project-audit-result/v2',
    generated_at: generatedAt,
    status: ready ? 'READY_FOR_REVIEW' : 'HOLD',
    project: {
      project_id: plan.project.project_id,
      repository: plan.project.repository,
      default_branch: plan.project.default_branch,
      subject_revision: plan.project.subject_revision,
      observed_at: plan.project.observed_at,
    },
    standard_baseline_revision: plan.standard_baseline_revision,
    source_proof_template: {
      default_branch: plan.project.default_branch,
      ci: {
        status: 'UNKNOWN',
        run_id: null,
        revision: plan.project.subject_revision,
      },
      branch_protected: null,
    },
    axes: plan.axes.map(axis => ({
      id: axis.id,
      standard_maturity: axis.standard_maturity,
      assessment_mode: axis.assessment_mode,
      conformance_pass_allowed: axis.conformance_pass_allowed,
      canonical_sources: [...axis.canonical_sources],
      machine_checks: [...axis.machine_checks],
      declared_standard_gaps: [...axis.declared_gaps],
      finding: {
        verdict: 'UNKNOWN',
        evidence: [],
        gaps: [...axis.declared_gaps],
        next_action: `Review ${axis.id} against the exact subject revision and record revision-bound evidence before finalizing.`,
      },
    })),
    permissions: {
      read_only: true,
      write_project_files: false,
      auto_remediation: false,
      canonical_promotion: false,
      production_mutation: false,
    },
    blockers: [...plan.blockers],
    limitations: plan.limitations.map(item => structuredClone(item)),
    finalization_requirements: [
      'Keep project_id/repository/default_branch/subject_revision unchanged.',
      'Keep standard_baseline_revision unchanged.',
      'Replace UNKNOWN verdicts only with evidence supported by the exact subject revision.',
      'Bind CI proof revision to subject_revision; UNKNOWN is allowed when CI cannot be observed.',
      'Preserve declared standard gaps for CANONICAL_PARTIAL axes.',
      'Serialize the completed review as ai-core-project-audit-result/v2 and run project-audit validation.',
    ],
  };
}

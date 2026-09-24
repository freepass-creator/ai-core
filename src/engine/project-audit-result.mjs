const VERDICTS = new Set(['CORE_MATCH','PROJECT_AHEAD','MIGRATION_GAP','RESEARCH_ADVISORY','UNKNOWN']);
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const need = (condition, code) => { if (!condition) throw new Error(code); };

export function validateProjectAuditResult(result, readinessRegistry) {
  need(result && typeof result === 'object' && !Array.isArray(result), 'PROJECT_AUDIT_RESULT_REQUIRED');
  need(result.schema === 'ai-core-project-audit-result/v1', 'PROJECT_AUDIT_RESULT_SCHEMA_INVALID');
  need(nonempty(result.project_id), 'PROJECT_AUDIT_PROJECT_ID_REQUIRED');
  need(nonempty(result.repository), 'PROJECT_AUDIT_REPOSITORY_REQUIRED');
  need(/^[0-9a-f]{40}$/.test(result.subject_revision ?? ''), 'PROJECT_AUDIT_SUBJECT_REVISION_INVALID');
  need(Array.isArray(result.findings), 'PROJECT_AUDIT_FINDINGS_REQUIRED');

  const maturityByAxis = new Map((readinessRegistry?.axes ?? []).map(axis => [axis.id, axis.maturity]));
  need(maturityByAxis.size > 0, 'PROJECT_AUDIT_READINESS_REQUIRED');

  const seen = new Set();
  for (const finding of result.findings) {
    need(nonempty(finding.axis), 'PROJECT_AUDIT_AXIS_REQUIRED');
    need(maturityByAxis.has(finding.axis), `PROJECT_AUDIT_AXIS_UNKNOWN:${finding.axis}`);
    need(!seen.has(finding.axis), `PROJECT_AUDIT_AXIS_DUPLICATE:${finding.axis}`);
    seen.add(finding.axis);
    need(VERDICTS.has(finding.verdict), `PROJECT_AUDIT_VERDICT_INVALID:${finding.axis}`);
    need(Array.isArray(finding.evidence) && finding.evidence.every(nonempty), `PROJECT_AUDIT_EVIDENCE_INVALID:${finding.axis}`);
    need(Array.isArray(finding.gaps) && finding.gaps.every(nonempty), `PROJECT_AUDIT_GAPS_INVALID:${finding.axis}`);

    const maturity = maturityByAxis.get(finding.axis);
    if (maturity === 'RESEARCH_ONLY') {
      need(
        finding.verdict === 'RESEARCH_ADVISORY' || finding.verdict === 'UNKNOWN',
        `PROJECT_AUDIT_RESEARCH_AXIS_NORMATIVE_VERDICT_FORBIDDEN:${finding.axis}`,
      );
    }
    if (maturity === 'MISSING') {
      need(finding.verdict === 'UNKNOWN', `PROJECT_AUDIT_MISSING_AXIS_VERDICT_FORBIDDEN:${finding.axis}`);
    }
  }
  need(seen.size === maturityByAxis.size, 'PROJECT_AUDIT_AXES_INCOMPLETE');
  return result;
}

export function summarizeProjectAuditResult(result, readinessRegistry) {
  validateProjectAuditResult(result, readinessRegistry);
  const counts = Object.fromEntries([...VERDICTS].map(key => [key.toLowerCase(), 0]));
  for (const finding of result.findings) counts[finding.verdict.toLowerCase()] += 1;

  return {
    schema: 'ai-core-project-audit-summary/v1',
    project_id: result.project_id,
    repository: result.repository,
    subject_revision: result.subject_revision,
    status: counts.migration_gap > 0 || counts.research_advisory > 0 || counts.unknown > 0
      ? 'READ_ONLY_AUDIT_COMPLETE_WITH_GAPS'
      : 'READ_ONLY_AUDIT_COMPLETE',
    counts,
    auto_remediation_allowed: false,
    canonical_promotion_allowed: false,
    production_mutation_allowed: false,
  };
}

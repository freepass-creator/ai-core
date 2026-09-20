import { REQUIRED_AUDIT_AXES, validateProjectAuditReadinessRegistry } from './project-audit-readiness.mjs';

const RESULT_SCHEMAS = new Set(['ai-core-project-audit-result/v1', 'ai-core-project-audit-result/v2']);
const VERDICTS = new Set(['CORE_MATCH','PROJECT_AHEAD','MIGRATION_GAP','RESEARCH_ADVISORY','UNKNOWN']);
const CI_STATUSES = new Set(['PASS','FAIL','UNKNOWN']);
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const need = (condition, code) => { if (!condition) throw new Error(code); };

export function validateProjectAuditResult(result, readinessRegistry) {
  validateProjectAuditReadinessRegistry(readinessRegistry);

  need(result && typeof result === 'object' && !Array.isArray(result), 'PROJECT_AUDIT_RESULT_REQUIRED');
  need(RESULT_SCHEMAS.has(result.schema), 'PROJECT_AUDIT_RESULT_SCHEMA_INVALID');
  need(nonempty(result.project_id), 'PROJECT_AUDIT_PROJECT_ID_REQUIRED');
  need(nonempty(result.repository) && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(result.repository), 'PROJECT_AUDIT_REPOSITORY_INVALID');
  need(sha(result.subject_revision), 'PROJECT_AUDIT_SUBJECT_REVISION_INVALID');

  if (result.schema === 'ai-core-project-audit-result/v2') {
    need(sha(result.standard_baseline_revision), 'PROJECT_AUDIT_STANDARD_BASELINE_REVISION_INVALID');
    need(
      typeof result.audited_at === 'string' && Number.isFinite(Date.parse(result.audited_at)),
      'PROJECT_AUDIT_AUDITED_AT_INVALID',
    );
  }

  need(result.source_proof && typeof result.source_proof === 'object' && !Array.isArray(result.source_proof), 'PROJECT_AUDIT_SOURCE_PROOF_REQUIRED');
  need(nonempty(result.source_proof.default_branch), 'PROJECT_AUDIT_DEFAULT_BRANCH_REQUIRED');
  need(result.source_proof.ci && typeof result.source_proof.ci === 'object' && !Array.isArray(result.source_proof.ci), 'PROJECT_AUDIT_CI_PROOF_REQUIRED');
  need(CI_STATUSES.has(result.source_proof.ci.status), 'PROJECT_AUDIT_CI_STATUS_INVALID');
  need(sha(result.source_proof.ci.revision), 'PROJECT_AUDIT_CI_REVISION_INVALID');
  need(result.source_proof.ci.revision === result.subject_revision, 'PROJECT_AUDIT_CI_REVISION_MISMATCH');
  need(
    result.source_proof.ci.run_id === null || Number.isInteger(result.source_proof.ci.run_id),
    'PROJECT_AUDIT_CI_RUN_ID_INVALID',
  );
  need(
    result.source_proof.branch_protected === null || typeof result.source_proof.branch_protected === 'boolean',
    'PROJECT_AUDIT_BRANCH_PROTECTION_INVALID',
  );

  need(Array.isArray(result.findings), 'PROJECT_AUDIT_FINDINGS_REQUIRED');
  need(result.findings.length === REQUIRED_AUDIT_AXES.length, 'PROJECT_AUDIT_FINDING_COUNT_INVALID');
  need(Array.isArray(result.limitations) && result.limitations.every(nonempty), 'PROJECT_AUDIT_LIMITATIONS_INVALID');

  const readinessByAxis = new Map(readinessRegistry.axes.map(axis => [axis.id, axis]));
  const seen = new Set();

  for (const finding of result.findings) {
    need(nonempty(finding.axis), 'PROJECT_AUDIT_AXIS_REQUIRED');
    need(readinessByAxis.has(finding.axis), `PROJECT_AUDIT_AXIS_UNKNOWN:${finding.axis}`);
    need(!seen.has(finding.axis), `PROJECT_AUDIT_AXIS_DUPLICATE:${finding.axis}`);
    seen.add(finding.axis);
    need(VERDICTS.has(finding.verdict), `PROJECT_AUDIT_VERDICT_INVALID:${finding.axis}`);
    need(Array.isArray(finding.evidence) && finding.evidence.every(nonempty), `PROJECT_AUDIT_EVIDENCE_INVALID:${finding.axis}`);
    need(Array.isArray(finding.gaps) && finding.gaps.every(nonempty), `PROJECT_AUDIT_GAPS_INVALID:${finding.axis}`);
    need(nonempty(finding.next_action), `PROJECT_AUDIT_NEXT_ACTION_INVALID:${finding.axis}`);

    const maturity = readinessByAxis.get(finding.axis).maturity;
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

  need(REQUIRED_AUDIT_AXES.every(axis => seen.has(axis)), 'PROJECT_AUDIT_AXIS_MISSING');
  return result;
}

export function summarizeProjectAuditResult(result, readinessRegistry) {
  validateProjectAuditResult(result, readinessRegistry);

  const counts = Object.fromEntries([...VERDICTS].map(key => [key.toLowerCase(), 0]));
  for (const finding of result.findings) counts[finding.verdict.toLowerCase()] += 1;

  const maturityByAxis = new Map(readinessRegistry.axes.map(axis => [axis.id, axis]));
  const canonicalPartial = REQUIRED_AUDIT_AXES
    .filter(axis => maturityByAxis.get(axis).maturity === 'CANONICAL_PARTIAL')
    .map(axis => ({
      axis,
      declared_gaps: [...maturityByAxis.get(axis).gaps],
    }));
  const advisoryOnly = REQUIRED_AUDIT_AXES.filter(axis => maturityByAxis.get(axis).maturity === 'RESEARCH_ONLY');
  const missing = REQUIRED_AUDIT_AXES.filter(axis => maturityByAxis.get(axis).maturity === 'MISSING');

  const findingGaps = result.findings.reduce((total, finding) => total + finding.gaps.length, 0);
  const projectGap = counts.migration_gap > 0 || counts.research_advisory > 0 || counts.unknown > 0 || findingGaps > 0;
  const standardLimitation = canonicalPartial.length > 0 || advisoryOnly.length > 0 || missing.length > 0;
  const fullConformanceEligible = !standardLimitation;

  const standardBinding = result.schema === 'ai-core-project-audit-result/v2'
    ? {
        status: result.standard_baseline_revision === readinessRegistry.baseline_revision ? 'CURRENT' : 'STALE',
        audited_baseline_revision: result.standard_baseline_revision,
        current_baseline_revision: readinessRegistry.baseline_revision,
      }
    : {
        status: 'UNKNOWN_LEGACY',
        audited_baseline_revision: null,
        current_baseline_revision: readinessRegistry.baseline_revision,
      };

  return {
    schema: 'ai-core-project-audit-summary/v2',
    audit_result_schema: result.schema,
    project_id: result.project_id,
    repository: result.repository,
    subject_revision: result.subject_revision,
    audited_at: result.audited_at ?? null,
    standard_binding: standardBinding,
    source_proof: {
      default_branch: result.source_proof.default_branch,
      ci_status: result.source_proof.ci.status,
      ci_run_id: result.source_proof.ci.run_id,
      ci_revision_match: result.source_proof.ci.revision === result.subject_revision,
      branch_protected: result.source_proof.branch_protected,
    },
    status: projectGap || standardLimitation || standardBinding.status !== 'CURRENT'
      ? 'READ_ONLY_AUDIT_COMPLETE_WITH_LIMITATIONS'
      : 'READ_ONLY_AUDIT_COMPLETE',
    counts,
    finding_gap_count: findingGaps,
    standard_limitations: {
      canonical_partial: canonicalPartial,
      advisory_only: advisoryOnly,
      missing,
    },
    full_conformance_eligible: fullConformanceEligible && standardBinding.status === 'CURRENT',
    auto_remediation_allowed: false,
    canonical_promotion_allowed: false,
    production_mutation_allowed: false,
  };
}

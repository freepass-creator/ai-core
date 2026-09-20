import {
  REQUIRED_AUDIT_AXES,
  assessProjectAuditReadiness,
  validateProjectAuditReadinessRegistry,
} from './project-audit-readiness.mjs';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);

function validateCapsule(capsule) {
  need(capsule && typeof capsule === 'object' && !Array.isArray(capsule), 'AUDIT_CAPSULE_REQUIRED');
  need(capsule.schema === 'ai-core-project-capsule/v1', 'AUDIT_CAPSULE_SCHEMA_INVALID');
  need(nonempty(capsule.project_id), 'AUDIT_CAPSULE_PROJECT_ID_REQUIRED');
  need(nonempty(capsule.repository), 'AUDIT_CAPSULE_REPOSITORY_REQUIRED');
  need(nonempty(capsule.default_branch), 'AUDIT_CAPSULE_DEFAULT_BRANCH_REQUIRED');
  need(sha(capsule.subject_revision), 'AUDIT_CAPSULE_SUBJECT_REVISION_INVALID');
  need(capsule.readiness && typeof capsule.readiness === 'object', 'AUDIT_CAPSULE_READINESS_REQUIRED');
  need(Array.isArray(capsule.readiness.blockers), 'AUDIT_CAPSULE_BLOCKERS_REQUIRED');
  need(Array.isArray(capsule.evidence_refs), 'AUDIT_CAPSULE_EVIDENCE_REQUIRED');

  const revisionEvidence = `GIT:${capsule.repository}@${capsule.subject_revision}`;
  need(capsule.evidence_refs.includes(revisionEvidence), 'AUDIT_CAPSULE_REVISION_EVIDENCE_MISSING');
  return capsule;
}

function modeFor(maturity) {
  if (maturity === 'MACHINE_ENFORCED') {
    return {
      assessment_mode: 'MACHINE_CHECK_REQUIRED',
      conformance_pass_allowed: true,
      default_result: 'NOT_RUN',
    };
  }
  if (maturity === 'CANONICAL_PARTIAL') {
    return {
      assessment_mode: 'MACHINE_CHECK_WITH_DECLARED_GAPS',
      conformance_pass_allowed: false,
      default_result: 'PARTIAL_NOT_RUN',
    };
  }
  if (maturity === 'RESEARCH_ONLY') {
    return {
      assessment_mode: 'ADVISORY_ONLY',
      conformance_pass_allowed: false,
      default_result: 'ADVISORY_NOT_RUN',
    };
  }
  return {
    assessment_mode: 'BLOCKED',
    conformance_pass_allowed: false,
    default_result: 'BLOCKED',
  };
}

export function buildProjectAuditPlan(registry, capsule) {
  validateProjectAuditReadinessRegistry(registry);
  validateCapsule(capsule);

  const readiness = assessProjectAuditReadiness(registry);
  const byId = new Map(registry.axes.map(axis => [axis.id, axis]));
  const capsuleReady = capsule.readiness.status === 'READY_FOR_REGISTRY_REVIEW';
  const missingAxes = readiness.axes.missing;

  const axes = REQUIRED_AUDIT_AXES.map(id => {
    const axis = byId.get(id);
    const mode = modeFor(axis.maturity);
    return {
      id,
      standard_maturity: axis.maturity,
      assessment_mode: mode.assessment_mode,
      conformance_pass_allowed: mode.conformance_pass_allowed,
      result: mode.default_result,
      canonical_sources: [...axis.canonical_sources],
      machine_checks: [...axis.machine_checks],
      declared_gaps: [...axis.gaps],
      evidence_refs: [],
    };
  });

  const blockers = [];
  if (!capsuleReady) blockers.push({
    code: 'PROJECT_CAPSULE_NOT_READY',
    blockers: [...capsule.readiness.blockers],
  });
  if (missingAxes.length) blockers.push({
    code: 'AUDIT_AXIS_MISSING',
    axes: [...missingAxes],
  });

  return {
    schema: 'ai-core-project-audit-plan/v1',
    project: {
      project_id: capsule.project_id,
      repository: capsule.repository,
      default_branch: capsule.default_branch,
      subject_revision: capsule.subject_revision,
      observed_at: capsule.observed_at,
    },
    standard_baseline_revision: registry.baseline_revision,
    status: blockers.length ? 'HOLD' : 'READY_FOR_READ_ONLY_AUDIT',
    axes,
    permissions: {
      read_only: true,
      execute_declared_machine_checks: blockers.length === 0,
      write_project_files: false,
      auto_remediation: false,
      canonical_promotion: false,
      production_mutation: false,
    },
    evidence_refs: [...capsule.evidence_refs],
    blockers,
    limitations: readiness.blockers,
    rule: 'The plan is revision-bound and read-only. A CANONICAL_PARTIAL axis may execute its declared checks but may not emit a full conformance PASS. External runtime, production and branch-control facts require separate observation.',
  };
}

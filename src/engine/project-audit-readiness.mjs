const MATURITY = new Set(['MACHINE_ENFORCED', 'CANONICAL_PARTIAL', 'RESEARCH_ONLY', 'MISSING']);
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const unique = values => new Set(values).size === values.length;
const need = (condition, code) => { if (!condition) throw new Error(code); };

export const REQUIRED_AUDIT_AXES = Object.freeze([
  'ui-ux',
  'data-ssot',
  'engine-adapter',
  'api-event-error',
  'workflow',
  'security-audit',
  'qa-observability',
  'build-deploy-governance',
]);

export function validateProjectAuditReadinessRegistry(registry) {
  need(registry && typeof registry === 'object' && !Array.isArray(registry), 'AUDIT_READINESS_REGISTRY_REQUIRED');
  need(registry.schema === 'ai-core-project-audit-readiness/v1', 'AUDIT_READINESS_SCHEMA_INVALID');
  need(nonempty(registry.baseline_revision) && /^[0-9a-f]{40}$/.test(registry.baseline_revision), 'AUDIT_READINESS_BASELINE_REVISION_INVALID');
  need(Array.isArray(registry.axes), 'AUDIT_READINESS_AXES_REQUIRED');
  need(registry.axes.length === REQUIRED_AUDIT_AXES.length, 'AUDIT_READINESS_AXIS_COUNT_INVALID');

  const ids = registry.axes.map(axis => axis?.id);
  need(ids.every(nonempty) && unique(ids), 'AUDIT_READINESS_AXIS_ID_INVALID');
  need(REQUIRED_AUDIT_AXES.every(id => ids.includes(id)), 'AUDIT_READINESS_AXIS_MISSING');

  for (const axis of registry.axes) {
    need(MATURITY.has(axis.maturity), `AUDIT_READINESS_MATURITY_INVALID:${axis.id}`);
    need(Array.isArray(axis.canonical_sources), `AUDIT_READINESS_CANONICAL_SOURCES_REQUIRED:${axis.id}`);
    need(Array.isArray(axis.machine_checks), `AUDIT_READINESS_MACHINE_CHECKS_REQUIRED:${axis.id}`);
    need(Array.isArray(axis.gaps), `AUDIT_READINESS_GAPS_REQUIRED:${axis.id}`);
    need(axis.canonical_sources.every(nonempty), `AUDIT_READINESS_CANONICAL_SOURCE_INVALID:${axis.id}`);
    need(axis.machine_checks.every(nonempty), `AUDIT_READINESS_MACHINE_CHECK_INVALID:${axis.id}`);
    need(axis.gaps.every(nonempty), `AUDIT_READINESS_GAP_INVALID:${axis.id}`);
    need(unique(axis.canonical_sources), `AUDIT_READINESS_CANONICAL_SOURCE_DUPLICATE:${axis.id}`);
    need(unique(axis.machine_checks), `AUDIT_READINESS_MACHINE_CHECK_DUPLICATE:${axis.id}`);
    need(unique(axis.gaps), `AUDIT_READINESS_GAP_DUPLICATE:${axis.id}`);

    if (axis.maturity === 'MACHINE_ENFORCED') {
      need(axis.canonical_sources.length > 0, `AUDIT_READINESS_ENFORCED_WITHOUT_SOURCE:${axis.id}`);
      need(axis.machine_checks.length > 0, `AUDIT_READINESS_ENFORCED_WITHOUT_CHECK:${axis.id}`);
    }
    if (axis.maturity === 'CANONICAL_PARTIAL') {
      need(axis.canonical_sources.length > 0, `AUDIT_READINESS_PARTIAL_WITHOUT_SOURCE:${axis.id}`);
      need(axis.machine_checks.length > 0, `AUDIT_READINESS_PARTIAL_WITHOUT_CHECK:${axis.id}`);
      need(axis.gaps.length > 0, `AUDIT_READINESS_PARTIAL_GAP_REQUIRED:${axis.id}`);
    }
    if (axis.maturity === 'RESEARCH_ONLY') {
      need(axis.canonical_sources.length > 0, `AUDIT_READINESS_RESEARCH_SOURCE_REQUIRED:${axis.id}`);
      need(axis.gaps.length > 0, `AUDIT_READINESS_RESEARCH_GAP_REQUIRED:${axis.id}`);
    }
  }
  return registry;
}

export function assessProjectAuditReadiness(registry) {
  validateProjectAuditReadinessRegistry(registry);
  const byId = new Map(registry.axes.map(axis => [axis.id, axis]));
  const machineEnforced = REQUIRED_AUDIT_AXES.filter(id => byId.get(id).maturity === 'MACHINE_ENFORCED');
  const canonicalPartial = REQUIRED_AUDIT_AXES.filter(id => byId.get(id).maturity === 'CANONICAL_PARTIAL');
  const advisoryOnly = REQUIRED_AUDIT_AXES.filter(id => byId.get(id).maturity === 'RESEARCH_ONLY');
  const missing = REQUIRED_AUDIT_AXES.filter(id => byId.get(id).maturity === 'MISSING');

  // Read-only audit planning is safe when no axis is missing. Only MACHINE_ENFORCED
  // axes may ever produce a full conformance PASS. CANONICAL_PARTIAL axes may execute
  // their machine checks, but their declared gaps remain binding limitations.
  const readOnlyPilotReady = missing.length === 0;
  const fullConformanceReady = REQUIRED_AUDIT_AXES.every(id => byId.get(id).maturity === 'MACHINE_ENFORCED');

  const blockers = [];
  if (missing.length) blockers.push({
    code: 'AUDIT_AXIS_MISSING',
    axes: missing,
  });
  if (!fullConformanceReady) blockers.push({
    code: 'FULL_CONFORMANCE_NOT_MACHINE_ENFORCED',
    axes: [...canonicalPartial, ...advisoryOnly],
  });
  blockers.push({
    code: 'EXTERNAL_RUNTIME_PROOF_REQUIRED',
    detail: 'Current CI execution, branch protection and target project runtime evidence are external facts and must be verified at audit time.',
  });

  return {
    schema: 'ai-core-project-audit-readiness-report/v1',
    baseline_revision: registry.baseline_revision,
    status: readOnlyPilotReady ? 'READ_ONLY_AUDIT_PILOT_READY' : 'HOLD',
    full_conformance_ready: fullConformanceReady,
    axes: {
      machine_enforced: machineEnforced,
      canonical_partial: canonicalPartial,
      advisory_only: advisoryOnly,
      missing,
      scorable: [...machineEnforced, ...canonicalPartial],
    },
    coverage: {
      total_axes: REQUIRED_AUDIT_AXES.length,
      machine_enforced_axes: machineEnforced.length,
      canonical_partial_axes: canonicalPartial.length,
      advisory_only_axes: advisoryOnly.length,
      missing_axes: missing.length,
    },
    permissions: {
      read_only_project_audit: readOnlyPilotReady,
      gap_report: readOnlyPilotReady,
      axis_machine_check: readOnlyPilotReady,
      full_conformance_pass: fullConformanceReady,
      auto_remediation: false,
      canonical_promotion: false,
      production_mutation: false,
    },
    blockers,
    rule: 'CANONICAL_PARTIAL axes may run machine checks but cannot produce a full conformance PASS while declared gaps remain. Research-only axes are advisory. Promotion, remediation and production mutation require separate authority and revision-bound proof.',
  };
}

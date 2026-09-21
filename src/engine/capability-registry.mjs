const need = (condition, code) => { if (!condition) throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const MODES = new Set(['READ_ONLY', 'LOCAL_MUTATION', 'EXTERNAL_MUTATION']);
const STATUSES = new Set(['ACTIVE', 'HOLD', 'REFERENCE']);
const PROJECT_REGISTRY_VERSIONS = new Set(['1.0', '1.1']);

export function capabilityIndex(registry) {
  const map = new Map();
  for (const item of registry?.capabilities ?? []) {
    need(nonempty(item?.id) && !map.has(item.id), 'CAPABILITY_ID_INVALID_OR_DUPLICATE');
    map.set(item.id, structuredClone(item));
  }
  return map;
}

export function projectIndex(projectRegistry) {
  const map = new Map();
  for (const item of projectRegistry?.projects ?? []) {
    need(nonempty(item?.project_id) && !map.has(item.project_id), 'PROJECT_REGISTRY_DUPLICATE');
    map.set(item.project_id, structuredClone(item));
  }
  return map;
}

export function validateCapabilityRegistryReferences(registry, projectRegistry) {
  need(registry?.schema_version === '1.0' && Array.isArray(registry.capabilities), 'CAPABILITY_REGISTRY_INVALID');
  need(PROJECT_REGISTRY_VERSIONS.has(projectRegistry?.schema_version) && Array.isArray(projectRegistry.projects), 'PROJECT_REGISTRY_INVALID');
  const projects = projectIndex(projectRegistry);
  const caps = capabilityIndex(registry);

  for (const capability of caps.values()) {
    need(STATUSES.has(capability.status), 'CAPABILITY_STATUS_INVALID');
    need(MODES.has(capability.mode), 'CAPABILITY_MODE_INVALID');
    need(Array.isArray(capability.projects) && capability.projects.length > 0, 'CAPABILITY_PROJECTS_REQUIRED');
    need(!(capability.projects.includes('*') && capability.projects.length > 1), 'CAPABILITY_WILDCARD_MIXED');
    for (const projectId of capability.projects) if (projectId !== '*') need(projects.has(projectId), 'CAPABILITY_PROJECT_UNKNOWN');
    need(capability.result_contract === 'ai-core-work-result/v1', 'CAPABILITY_RESULT_CONTRACT_INVALID');
    need(Array.isArray(capability.inputs) && Array.isArray(capability.required_scopes) && Array.isArray(capability.walls), 'CAPABILITY_BOUNDARY_INVALID');

    if (capability.status === 'ACTIVE') {
      need(capability.adapter && nonempty(capability.adapter.kind), 'ACTIVE_CAPABILITY_ADAPTER_REQUIRED');
    } else {
      need(nonempty(capability.hold_reason), 'NON_ACTIVE_CAPABILITY_REASON_REQUIRED');
    }
    if (capability.status === 'ACTIVE' && capability.mode === 'EXTERNAL_MUTATION') {
      need(capability.required_scopes.length > 0, 'EXTERNAL_CAPABILITY_SCOPE_REQUIRED');
    }
    if (capability.mode !== 'EXTERNAL_MUTATION') {
      need(capability.required_scopes.length === 0, 'NON_EXTERNAL_CAPABILITY_MUST_NOT_REQUIRE_AUTH_SCOPE');
    }
    if (capability.receipt) {
      need(capability.status === 'ACTIVE', 'RECEIPT_CAPABILITY_MUST_BE_ACTIVE');
      const dir = capability.receipt.directory;
      need(typeof dir === 'string' && dir.length > 0 && !dir.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(dir)
        && !dir.split(/[\\/]/).includes('..'), 'RECEIPT_DIRECTORY_UNSAFE');
      const states = [
        ...(capability.receipt.success_states ?? []),
        ...(capability.receipt.hold_states ?? []),
        ...(capability.receipt.failure_states ?? []),
      ];
      need(states.length > 0 && new Set(states).size === states.length, 'RECEIPT_STATES_OVERLAP');
      need(!/[\\/]/.test(capability.receipt.prefix ?? '') && !/[\\/]/.test(capability.receipt.suffix ?? ''), 'RECEIPT_FILENAME_PATTERN_UNSAFE');
    }
  }
  return { status:'VALID', capability_count:caps.size, project_count:projects.size };
}

export function capabilitySupportsProject(capability, projectId) {
  return capability.projects.includes('*') || capability.projects.includes(projectId);
}

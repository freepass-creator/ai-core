const need = (condition, code) => { if (!condition) throw new Error(code); };
const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const MODES = new Set(['READ_ONLY', 'LOCAL_MUTATION', 'EXTERNAL_MUTATION']);
const STATUSES = new Set(['ACTIVE', 'HOLD', 'REFERENCE']);

export function validateCapabilityRegistryReferences(registry, projectRegistry) {
  need(registry?.schema_version === '1.0' && Array.isArray(registry.capabilities), 'CAPABILITY_REGISTRY_INVALID');
  need(projectRegistry?.schema_version === '1.0' && Array.isArray(projectRegistry.projects), 'PROJECT_REGISTRY_INVALID');
  const projects = new Map(projectRegistry.projects.map(project => [project.project_id, project]));
  need(projects.size === projectRegistry.projects.length, 'PROJECT_REGISTRY_DUPLICATE');

  const ids = new Set();
  for (const capability of registry.capabilities) {
    need(nonempty(capability?.id) && !ids.has(capability.id), 'CAPABILITY_ID_INVALID_OR_DUPLICATE');
    ids.add(capability.id);
    need(STATUSES.has(capability.status), 'CAPABILITY_STATUS_INVALID');
    need(MODES.has(capability.mode), 'CAPABILITY_MODE_INVALID');
    need(Array.isArray(capability.projects) && capability.projects.length > 0, 'CAPABILITY_PROJECTS_REQUIRED');
    need(!(capability.projects.includes('*') && capability.projects.length > 1), 'CAPABILITY_WILDCARD_MIXED');
    for (const projectId of capability.projects) {
      if (projectId !== '*') need(projects.has(projectId), 'CAPABILITY_PROJECT_UNKNOWN');
    }
    need(capability.result_contract === 'ai-core-work-result/v1', 'CAPABILITY_RESULT_CONTRACT_INVALID');
    need(capability.match && Array.isArray(capability.match.any) && capability.match.any.length > 0, 'CAPABILITY_MATCH_INVALID');
    need(Number.isInteger(capability.match.min_score) && capability.match.min_score > 0, 'CAPABILITY_SCORE_INVALID');
    need(Array.isArray(capability.required_scopes) && Array.isArray(capability.walls), 'CAPABILITY_BOUNDARY_INVALID');
    need(capability.adapter && nonempty(capability.adapter.kind), 'CAPABILITY_ADAPTER_INVALID');
    if (capability.mode !== 'EXTERNAL_MUTATION') {
      need(capability.required_scopes.length === 0, 'NON_EXTERNAL_CAPABILITY_MUST_NOT_REQUIRE_AUTH_SCOPE');
    }
  }
  return { status: 'VALID', capability_count: registry.capabilities.length, project_count: projects.size };
}

export function capabilityIndex(registry) {
  const map = new Map();
  for (const item of registry?.capabilities ?? []) {
    if (map.has(item.id)) throw new Error('CAPABILITY_ID_INVALID_OR_DUPLICATE');
    map.set(item.id, structuredClone(item));
  }
  return map;
}

export function projectIndex(projectRegistry) {
  const map = new Map();
  for (const item of projectRegistry?.projects ?? []) {
    if (map.has(item.project_id)) throw new Error('PROJECT_REGISTRY_DUPLICATE');
    map.set(item.project_id, structuredClone(item));
  }
  return map;
}

import { capabilityIndex, projectIndex } from './capability-registry.mjs';

const nonempty = value => typeof value === 'string' && value.trim() === value && value.length > 0;
const add = (list, code, detail = null) => list.push(detail ? { code, detail } : { code });

function targetProjects(capability, projects) {
  if (capability.projects.includes('*')) return [];
  return capability.projects.map(id => projects.get(id)).filter(Boolean);
}

function inspectAdapter(capability, targets, blockers, advisories) {
  const adapter = capability.adapter;
  if (!adapter) {
    add(blockers, 'ADAPTER_CONTRACT_MISSING');
    return;
  }

  if (adapter.kind === 'BUILTIN') {
    if (!nonempty(adapter.id)) add(blockers, 'BUILTIN_ADAPTER_ID_MISSING');
    return;
  }

  if (adapter.kind === 'PROJECT_MODULE') {
    if (!nonempty(adapter.entrypoint) || !nonempty(adapter.export)) add(blockers, 'PROJECT_MODULE_BINDING_INCOMPLETE');
    for (const project of targets) if (!nonempty(project.local_path)) add(blockers, 'PROJECT_LOCAL_PATH_MISSING', project.project_id);
    return;
  }

  if (adapter.kind === 'PROJECT_COMMAND') {
    if (!Array.isArray(adapter.argv) || adapter.argv.length === 0 || adapter.argv.some(value => !nonempty(value))) {
      add(blockers, 'PROJECT_COMMAND_ARGV_INVALID');
    }
    for (const project of targets) if (!nonempty(project.local_path)) add(blockers, 'PROJECT_LOCAL_PATH_MISSING', project.project_id);
    return;
  }

  if (adapter.kind === 'PROJECT_REGISTRY_COMMAND') {
    if (!nonempty(adapter.command_key)) add(blockers, 'PROJECT_COMMAND_KEY_MISSING');
    if (capability.projects.includes('*')) {
      add(advisories, 'TARGET_PROJECT_RESOLVED_AT_ROUTE_TIME');
      return;
    }
    for (const project of targets) {
      if (!nonempty(project.commands?.[adapter.command_key])) add(blockers, 'PROJECT_COMMAND_NOT_CONFIGURED', `${project.project_id}:${adapter.command_key}`);
    }
    return;
  }

  add(blockers, 'ADAPTER_KIND_UNSUPPORTED', adapter.kind ?? null);
}

function assessOne(capability, projects) {
  const blockers = [];
  const advisories = [];
  const targets = targetProjects(capability, projects);

  if (!capability.projects.includes('*')) {
    for (const projectId of capability.projects) {
      const project = projects.get(projectId);
      if (!project) {
        add(blockers, 'PROJECT_NOT_REGISTERED', projectId);
        continue;
      }
      if (project.status !== 'ACTIVE') add(blockers, 'PROJECT_NOT_ACTIVE', projectId);
      if (!nonempty(project.head_revision)) add(blockers, 'PROJECT_REVISION_MISSING', projectId);
      if ((project.required_approvals ?? []).length > 0) add(advisories, 'PROJECT_APPROVAL_BOUNDARY_PRESENT', projectId);
      if ((project.known_blockers ?? []).length > 0) add(advisories, 'PROJECT_KNOWN_BLOCKERS_PRESENT', projectId);
    }
  } else {
    add(advisories, 'TARGET_PROJECT_RESOLVED_AT_ROUTE_TIME');
  }

  inspectAdapter(capability, targets, blockers, advisories);

  if (capability.mode === 'EXTERNAL_MUTATION') {
    if (!Array.isArray(capability.required_scopes) || capability.required_scopes.length === 0) {
      add(blockers, 'EXTERNAL_AUTHORITY_SCOPE_MISSING');
    }
    if (!capability.receipt) add(advisories, 'TERMINAL_RECEIPT_NOT_CONFIGURED');
  }

  if (capability.status === 'REFERENCE') {
    add(blockers, 'REFERENCE_CAPABILITY_NOT_PROMOTABLE');
  }

  let readiness;
  if (capability.status === 'ACTIVE') readiness = blockers.length ? 'ACTIVE_WITH_GAP' : 'ACTIVE_HEALTHY';
  else if (capability.status === 'REFERENCE') readiness = 'REFERENCE_ONLY';
  else readiness = blockers.length ? 'BLOCKED' : 'REVIEW_REQUIRED';

  return {
    capability_id: capability.id,
    status: capability.status,
    mode: capability.mode,
    readiness,
    projects: [...capability.projects],
    machine_blockers: blockers,
    advisories,
    declared_hold_reason: capability.status === 'ACTIVE' ? null : capability.hold_reason ?? null,
    promotion_allowed: false,
  };
}

export function assessCapabilityReadiness({ capabilityRegistry, projectRegistry } = {}) {
  const capabilities = capabilityIndex(capabilityRegistry);
  const projects = projectIndex(projectRegistry);
  const items = [...capabilities.values()].map(capability => assessOne(capability, projects));
  const summary = {
    total: items.length,
    active_healthy: items.filter(item => item.readiness === 'ACTIVE_HEALTHY').length,
    active_with_gap: items.filter(item => item.readiness === 'ACTIVE_WITH_GAP').length,
    blocked: items.filter(item => item.readiness === 'BLOCKED').length,
    review_required: items.filter(item => item.readiness === 'REVIEW_REQUIRED').length,
    reference_only: items.filter(item => item.readiness === 'REFERENCE_ONLY').length,
  };
  return {
    schema: 'ai-core-capability-readiness/v1',
    policy: {
      mode: 'READ_ONLY_ADVISORY',
      auto_promotion: false,
      rule: 'A readiness result never changes capability or project status. Canonical owners must review declared hold reasons and revision-bound evidence before promotion.',
    },
    summary,
    items,
  };
}

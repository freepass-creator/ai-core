export const DEFAULT_OWNER = 'freepass-creator';

export const DEFAULT_SOURCE_MAP = Object.freeze({
  aiops: Object.freeze({
    control: Object.freeze({
      repo: 'freepass-creator/aiops',
      path: 'docs/CONTROL_PLANE.md',
      role: 'authoritative'
    }),
    knowledge: Object.freeze({
      repo: 'freepass-creator/aiops',
      path: 'docs/aiknowhow/README.md',
      role: 'authoritative'
    })
  }),
  devcenter: Object.freeze({
    registry: Object.freeze({
      repo: 'freepass-creator/devcenter',
      path: 'registry.json',
      role: 'authoritative'
    }),
    baseline: Object.freeze({
      repo: 'freepass-creator/devcenter',
      path: 'docs/BASELINE.md',
      role: 'authoritative'
    }),
    inspection: Object.freeze({
      repo: 'freepass-creator/devcenter',
      path: 'operations/inspection/POLICY.md',
      role: 'authoritative'
    })
  })
});

export function projectRepository(project, owner = DEFAULT_OWNER) {
  if (!project) return null;
  return project.includes('/') ? project : `${owner}/${project}`;
}

export function buildFetchManifest(task, requirements, sourceMap = DEFAULT_SOURCE_MAP) {
  return requirements.map(requirement => {
    if (requirement.system === 'project') {
      if (!task.project) {
        return { ...requirement, status: 'HOLD', reason: 'PROJECT_UNRESOLVED' };
      }
      return {
        ...requirement,
        status: 'FETCH_REQUIRED',
        repo: projectRepository(task.project),
        ref: task.project_ref ?? 'main',
        candidates: ['AGENTS.md', 'CLAUDE.md', 'README.md'],
        role: 'authoritative'
      };
    }

    const source = sourceMap[requirement.system]?.[requirement.kind];
    if (!source) {
      return {
        ...requirement,
        status: requirement.required ? 'HOLD' : 'OPTIONAL_MISSING',
        reason: 'SOURCE_MAP_MISSING'
      };
    }

    return { ...requirement, ...source, status: 'FETCH_REQUIRED' };
  });
}

export function toResolvedPointer(item, fetched) {
  const revision = typeof fetched?.sha === 'string' ? fetched.sha.trim() : '';
  if (!revision) {
    return {
      system: item.system,
      kind: item.kind,
      status: 'unresolved',
      location: item.repo && (item.path ?? fetched?.path)
        ? `${item.repo}:${item.path ?? fetched?.path}`
        : `${item.system}:${item.kind}`,
      reason: fetched?.reason ?? 'REVISION_MISSING',
      required: item.required
    };
  }

  return {
    system: item.system,
    kind: item.kind,
    status: item.role === 'adopted' ? 'adopted' : 'authoritative',
    location: `${item.repo}:${item.path ?? fetched.path}`,
    revision_or_sha: revision,
    revision_kind: fetched.revision_kind ?? 'git_blob_sha',
    scope: item.reason,
    required: item.required
  };
}

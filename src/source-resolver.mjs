import { effectiveDomains } from './domain-policy.mjs';

export function resolveSourceRequirements(task) {
  const requirements = [];
  const domains = effectiveDomains(task);

  if (task.project) {
    requirements.push({
      system: 'project',
      kind: 'instructions',
      required: true,
      expected_repository: task.project.includes('/')
        ? task.project
        : `freepass-creator/${task.project}`,
      expected_paths: ['AGENTS.md', 'CLAUDE.md', 'README.md'],
      reason: 'current project rules and revision'
    });
  }

  requirements.push({
    system: 'aiops',
    kind: 'control',
    required: true,
    expected_repository: 'freepass-creator/aiops',
    expected_paths: ['docs/CONTROL_PLANE.md'],
    reason: 'authority, risk and operational boundary'
  });
  requirements.push({
    system: 'aiops',
    kind: 'knowledge',
    required: domains.some(domain => domain !== 'development'),
    expected_repository: 'freepass-creator/aiops',
    expected_paths: ['docs/aiknowhow/README.md'],
    reason: 'business meaning, decisions and relevant failures'
  });

  if (domains.some(domain => ['development', 'document'].includes(domain))) {
    requirements.push({
      system: 'devcenter',
      kind: 'registry',
      required: true,
      expected_repository: 'freepass-creator/devcenter',
      expected_paths: ['registry.json'],
      reason: 'standards and reusable capabilities'
    });
  }
  if (domains.includes('development')) {
    requirements.push({
      system: 'devcenter',
      kind: 'inspection',
      required: true,
      expected_repository: 'freepass-creator/devcenter',
      expected_paths: ['operations/inspection/POLICY.md'],
      reason: 'verification and corrective-action policy'
    });
  }

  if (domains.includes('legal')) {
    requirements.push({
      system: 'domain',
      kind: 'current_authority',
      required: true,
      reason: 'current official law, case authority and procedure for the applicable jurisdiction'
    });
  }

  return requirements;
}

function safeSourcePointer(source) {
  const location = typeof source?.location === 'string' ? source.location.trim() : '';
  const revision = typeof source?.revision_or_sha === 'string'
    ? source.revision_or_sha.trim()
    : '';
  return {
    system: source?.system ?? null,
    kind: source?.kind ?? null,
    status: source?.status ?? 'unknown',
    ...(location ? { location } : {}),
    ...(revision ? { revision_or_sha: revision } : {}),
    ...(typeof source?.revision_kind === 'string' && source.revision_kind.trim()
      ? { revision_kind: source.revision_kind.trim() }
      : {}),
    ...(typeof source?.scope === 'string' && source.scope.trim()
      ? { scope: source.scope.trim() }
      : {})
  };
}

function sourceMatchesRequirement(source, requirement) {
  const pointer = safeSourcePointer(source);
  if (
    pointer.system !== requirement.system
    || pointer.kind !== requirement.kind
    || pointer.status !== 'authoritative'
    || !pointer.location
    || !pointer.revision_or_sha
  ) return false;
  if (
    requirement.expected_repository
    && !pointer.location.startsWith(`${requirement.expected_repository}:`)
  ) return false;
  if (Array.isArray(requirement.expected_paths)) {
    return requirement.expected_paths.some(path => (
      pointer.location === `${requirement.expected_repository}:${path}`
    ));
  }
  return true;
}

export function bindResolvedSources(requirements, resolved = []) {
  return requirements.map(requirement => {
    const matches = resolved.filter(source => (
      source.system === requirement.system && source.kind === requirement.kind
    ));

    if (matches.length === 0) {
      return {
        ...requirement,
        status: requirement.required ? 'HOLD' : 'OPTIONAL_MISSING'
      };
    }

    const valid = matches.filter(source => sourceMatchesRequirement(source, requirement));

    if (valid.length === 1) {
      return {
        ...requirement,
        status: 'BOUND',
        pointer: safeSourcePointer(valid[0])
      };
    }
    if (valid.length > 1) {
      return {
        ...requirement,
        status: 'HOLD',
        reason: 'AMBIGUOUS_AUTHORITATIVE_SOURCE',
        candidates: valid.map(safeSourcePointer)
      };
    }

    return {
      ...requirement,
      status: requirement.required ? 'HOLD' : 'REFERENCE_ONLY',
      candidates: matches.map(safeSourcePointer)
    };
  });
}

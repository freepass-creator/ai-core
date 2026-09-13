export function resolveSourceRequirements(task) {
  const requirements = [];

  if (task.project) {
    requirements.push({
      system: 'project',
      kind: 'instructions',
      required: true,
      reason: 'current project rules and revision'
    });
  }

  requirements.push({
    system: 'aiops',
    kind: 'control',
    required: true,
    reason: 'authority, risk and operational boundary'
  });
  requirements.push({
    system: 'aiops',
    kind: 'knowledge',
    required: task.domain !== 'development',
    reason: 'business meaning, decisions and relevant failures'
  });

  if (['development', 'document'].includes(task.domain)) {
    requirements.push({
      system: 'devcenter',
      kind: 'registry',
      required: true,
      reason: 'standards and reusable capabilities'
    });
  }
  if (task.domain === 'development') {
    requirements.push({
      system: 'devcenter',
      kind: 'inspection',
      required: true,
      reason: 'verification and corrective-action policy'
    });
  }

  return requirements;
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

    const valid = matches.filter(source => (
      source.location
      && source.revision_or_sha
      && source.status === 'authoritative'
    ));

    if (valid.length === 1) {
      return { ...requirement, status: 'BOUND', pointer: valid[0] };
    }
    if (valid.length > 1) {
      return {
        ...requirement,
        status: 'HOLD',
        reason: 'AMBIGUOUS_AUTHORITATIVE_SOURCE',
        candidates: valid
      };
    }

    return {
      ...requirement,
      status: requirement.required ? 'HOLD' : 'REFERENCE_ONLY',
      candidates: matches
    };
  });
}

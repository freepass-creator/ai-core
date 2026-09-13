const AUTHORITATIVE_ROLES = new Set(['authoritative', 'adopted']);

export function hasPinnedSource(asset) {
  return Boolean(asset?.revision_or_sha || asset?.source?.revision_or_sha);
}

export function resolveCapabilities(scopes, registry) {
  const datasets = registry?.datasets ?? [];

  return scopes.map(scope => {
    const matches = datasets.filter(dataset => dataset.scope === scope);
    const authoritative = matches.filter(dataset => AUTHORITATIVE_ROLES.has(dataset.role));

    if (authoritative.length > 1) {
      return {
        scope,
        status: 'HOLD',
        reason: 'MULTIPLE_AUTHORITATIVE_ASSETS',
        candidates: authoritative
      };
    }

    if (authoritative.length === 1) {
      const asset = authoritative[0];
      if (hasPinnedSource(asset)) {
        return { scope, status: 'RESOLVED', asset };
      }
      return {
        scope,
        status: 'SELECTED',
        reason: 'SOURCE_REVISION_REQUIRED',
        asset
      };
    }

    if (matches.length) {
      return { scope, status: 'CANDIDATE_ONLY', candidates: matches };
    }
    return { scope, status: 'MISSING' };
  });
}

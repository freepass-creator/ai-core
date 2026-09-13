const AUTHORITATIVE_ROLES = new Set(['authoritative', 'adopted']);

export function hasPinnedSource(asset) {
  const source = asset?.source ?? asset;
  const location = source?.location ?? source?.locator;
  return Boolean(
    typeof location === 'string'
    && location.trim()
    && typeof source?.revision_or_sha === 'string'
    && source.revision_or_sha.trim()
  );
}

function safeAsset(asset) {
  const source = asset?.source ?? {};
  return {
    ...(typeof asset?.id === 'string' && asset.id.trim() ? { id: asset.id.trim() } : {}),
    ...(typeof asset?.scope === 'string' && asset.scope.trim()
      ? { scope: asset.scope.trim() }
      : {}),
    ...(typeof asset?.role === 'string' && asset.role.trim() ? { role: asset.role.trim() } : {}),
    source: {
      ...(typeof source.kind === 'string' && source.kind.trim()
        ? { kind: source.kind.trim() }
        : {}),
      ...(typeof source.locator === 'string' && source.locator.trim()
        ? { locator: source.locator.trim() }
        : {}),
      ...(typeof source.location === 'string' && source.location.trim()
        ? { location: source.location.trim() }
        : {}),
      ...(typeof source.revision_or_sha === 'string' && source.revision_or_sha.trim()
        ? { revision_or_sha: source.revision_or_sha.trim() }
        : {}),
      ...(typeof source.revision_kind === 'string' && source.revision_kind.trim()
        ? { revision_kind: source.revision_kind.trim() }
        : {})
    }
  };
}

export function resolveCapabilities(scopes, registry) {
  const datasets = Array.isArray(registry?.datasets) ? registry.datasets : [];
  const registryInvalid = registry != null && !Array.isArray(registry?.datasets);

  return scopes.map(scope => {
    if (registryInvalid) {
      return { scope, status: 'HOLD', reason: 'INVALID_CAPABILITY_REGISTRY' };
    }
    const matches = datasets.filter(dataset => dataset.scope === scope);
    const authoritative = matches.filter(dataset => AUTHORITATIVE_ROLES.has(dataset.role));

    if (authoritative.length > 1) {
      return {
        scope,
        status: 'HOLD',
        reason: 'MULTIPLE_AUTHORITATIVE_ASSETS',
        candidates: authoritative.map(safeAsset)
      };
    }

    if (authoritative.length === 1) {
      const asset = safeAsset(authoritative[0]);
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
      return { scope, status: 'CANDIDATE_ONLY', candidates: matches.map(safeAsset) };
    }
    return { scope, status: 'MISSING' };
  });
}

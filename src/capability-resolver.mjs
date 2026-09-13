export function resolveCapabilities(scopes, registry) {
  const datasets = registry?.datasets ?? [];
  return scopes.map(scope => {
    const matches = datasets.filter(x => x.scope === scope);
    const auth = matches.filter(x => x.role === 'authoritative');
    if (auth.length === 1) return { scope, status:'RESOLVED', asset:auth[0] };
    if (auth.length > 1) return { scope, status:'HOLD', reason:'MULTIPLE_AUTHORITATIVE_ASSETS', candidates:auth };
    if (matches.length) return { scope, status:'CANDIDATE_ONLY', candidates:matches };
    return { scope, status:'MISSING' };
  });
}

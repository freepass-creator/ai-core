const NAMESPACE_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const UNSAFE_SEPARATOR_PATTERN = /[\\%\u0000-\u001f\u007f\u2044\u2215\u29f8]/u;

function parseScope(value, { pattern = false } = {}) {
  if (typeof value !== 'string' || !value || value !== value.trim() || value.length > 1000) {
    return null;
  }
  if (UNSAFE_SEPARATOR_PATTERN.test(value)) return null;
  const separator = value.indexOf(':');
  if (separator < 1 || separator === value.length - 1) return null;
  const namespace = value.slice(0, separator);
  const body = value.slice(separator + 1);
  if (!NAMESPACE_PATTERN.test(namespace)) return null;
  if (body.includes('//')) return null;
  if (!pattern && /[*?\[\]{}]/.test(body)) return null;

  let wildcard = 'NONE';
  let concreteBody = body;
  if (pattern && body.endsWith('/**')) {
    wildcard = 'DESCENDANTS';
    concreteBody = body.slice(0, -3);
  } else if (pattern && body.endsWith('/*')) {
    wildcard = 'CHILD';
    concreteBody = body.slice(0, -2);
  } else if (/[*?\[\]{}]/.test(body)) {
    return null;
  }
  if (!concreteBody || concreteBody.startsWith('/') || /^[a-z]:/i.test(concreteBody)) return null;
  const segments = concreteBody.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return { namespace, body: concreteBody, segments, wildcard };
}

export function isValidScopePattern(value) {
  return parseScope(value, { pattern: true }) !== null;
}

export function isConcreteScope(value) {
  return parseScope(value, { pattern: false }) !== null;
}

export function scopePatternMatches(candidate, pattern) {
  const concrete = parseScope(candidate, { pattern: false });
  const allowed = parseScope(pattern, { pattern: true });
  if (!concrete || !allowed || concrete.namespace !== allowed.namespace) return false;
  if (allowed.wildcard === 'NONE') return concrete.body === allowed.body;
  if (concrete.segments.length <= allowed.segments.length) return false;
  if (!allowed.segments.every((segment, index) => concrete.segments[index] === segment)) return false;
  return allowed.wildcard === 'DESCENDANTS'
    || concrete.segments.length === allowed.segments.length + 1;
}

export function isConcreteScopeAllowed(candidate, scope = {}) {
  if (!isConcreteScope(candidate)) return false;
  const forbidden = Array.isArray(scope.forbidden) ? scope.forbidden : [];
  const allowed = Array.isArray(scope.allowed) ? scope.allowed : [];
  if (forbidden.some(pattern => scopePatternMatches(candidate, pattern))) return false;
  return allowed.some(pattern => scopePatternMatches(candidate, pattern));
}

export function operationPathScope(operation) {
  if (typeof operation !== 'string' || operation !== operation.trim()) return null;
  const match = /^(?:read|write|patch):path:(.+)$/i.exec(operation);
  if (!match) return null;
  const scope = `path:${match[1]}`;
  return isConcreteScope(scope) ? scope : null;
}

export function artifactLocationToScope(location, repositoryIdentity) {
  if (
    typeof location !== 'string'
    || typeof repositoryIdentity !== 'string'
    || !repositoryIdentity
  ) return null;
  if (location !== location.trim() || UNSAFE_SEPARATOR_PATTERN.test(location)) return null;
  const separator = location.indexOf(':');
  if (separator < 1 || separator === location.length - 1) return null;
  const owner = location.slice(0, separator);
  const artifactPath = location.slice(separator + 1);
  if (owner !== repositoryIdentity) return null;
  const scope = `path:${artifactPath}`;
  return isConcreteScope(scope) ? scope : null;
}

export function isSafeEvidenceLocation(location) {
  if (typeof location !== 'string' || !location || location !== location.trim()) return false;
  if (location.length > 1000 || UNSAFE_SEPARATOR_PATTERN.test(location) || /\s/.test(location)) return false;
  const separator = location.indexOf(':');
  if (separator < 1 || separator === location.length - 1) return false;
  return /^[a-zA-Z0-9._/-]+$/.test(location.slice(0, separator));
}

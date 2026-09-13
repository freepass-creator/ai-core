import { canonicalDigest } from './canonical-json.mjs';

const SECRET_PATTERN = /(?:bearer\s+[a-z0-9._-]{12,}|(?:token|secret|password|credential|api[_-]?key)\s*[:=]\s*[^\s,;]{8,}|gh[pousr]_[a-z0-9]{20,}|(?:sk|rk)_[a-z0-9_-]{20,})/i;

export function containsSensitiveText(value) {
  return typeof value === 'string' && SECRET_PATTERN.test(value);
}

export function sensitivePaths(value, {
  maximumDepth = 32,
  maximumFindings = 100
} = {}) {
  const findings = [];
  const seen = new WeakSet();
  function visit(current, path, depth) {
    if (findings.length >= maximumFindings) return;
    if (typeof current === 'string') {
      if (containsSensitiveText(current)) findings.push(path || '$');
      return;
    }
    if (!current || typeof current !== 'object') return;
    if (depth > maximumDepth || seen.has(current)) {
      findings.push(`${path || '$'}:UNSAFE_STRUCTURE`);
      return;
    }
    seen.add(current);
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
    } else {
      Object.entries(current).forEach(([key, child]) => (
        visit(child, path ? `${path}.${key}` : key, depth + 1)
      ));
    }
    seen.delete(current);
  }
  visit(value, '', 0);
  return findings;
}

export function redactSensitiveText(value, findings, label) {
  if (value == null || typeof value !== 'string') return value ?? null;
  if (!containsSensitiveText(value)) return value;
  findings.push(label);
  return `[REDACTED:${canonicalDigest(value).slice(7, 23)}]`;
}


import { createHash } from 'node:crypto';

function assertJsonValue(value, path, seen) {
  if (value === null) return;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return;
  if (type === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${path} must contain a finite JSON number`);
    return;
  }
  if (type !== 'object') throw new Error(`${path} contains a non-JSON value`);
  if (seen.has(value)) throw new Error(`${path} contains a cycle`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonValue(entry, `${path}[${index}]`, seen));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} must contain plain JSON objects`);
    }
    for (const [key, entry] of Object.entries(value)) {
      if (entry === undefined) throw new Error(`${path}.${key} must not be undefined`);
      assertJsonValue(entry, `${path}.${key}`, seen);
    }
  }
  seen.delete(value);
}

function serialize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(serialize).join(',')}]`;
  const entries = Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${serialize(value[key])}`);
  return `{${entries.join(',')}}`;
}

// Deterministic JSON projection compatible with the JSON primitives used by the
// Core contracts. It is an integrity encoding, not a signature or proof of who
// produced a value.
export function canonicalJson(value) {
  assertJsonValue(value, '$', new WeakSet());
  return serialize(value);
}

export function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

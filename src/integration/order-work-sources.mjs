// Production wiring for the server's `readWorkProjection` socket.
//
// What this file is: the trusted application wiring that
// `createOrderWorkContextReader` deliberately refuses to construct for itself.
// It owns exactly one decision — WHERE the canonical sources live — and nothing
// about what they mean. Reading, atomicity and judgement stay where they already
// are (order-work-context-reader.mjs, order-work-adapter.mjs, run-control-tower.mjs).
//
// ★The rule that shapes this whole file: an ABSENT source is not an EMPTY source.
// The adapter answers `UNLINKED` when the mapping inventory it is handed contains
// no row for the order. If a missing mappings file were read as `[]`, every order
// would be reported `UNLINKED` — a confident, wrong answer produced by the absence
// of data rather than by the data. So each source is required, and a missing one
// yields HOLD naming that source. "모른다" is the honest answer, not "없다".
//
// Capability boundary: only `readFile` and `store.get` are used. No append, no
// outbox, no transport, no path from the request. Paths come from the connection
// policy file, which is operator-owned configuration.

import { readFile } from 'node:fs/promises';
import { resolve, isAbsolute, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOrderWorkContextReader } from './order-work-context-reader.mjs';
import { createOrderWorkAdapter } from './order-work-adapter.mjs';
import { verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// Same three-file contract the control tower CLI already takes
// (scripts/run-control-tower.mjs:64), plus the mapping inventory, which has no
// CLI of its own yet. Names match that usage so operators configure one vocabulary.
export const SOURCE_KEYS = ['registry', 'snapshot', 'mappings', 'ledger'];

const hold = (reason) => ({
  status: 'HOLD', reason,
  execution_authorized: false, completion_authorized: false, sent: false,
});

/** Resolve configured source paths. Relative paths are repo-root relative so a
 *  policy file stays portable; absolute paths are taken as given. */
export function resolveWorkSourcePaths(workSources) {
  if (!workSources || typeof workSources !== 'object' || Array.isArray(workSources)) return null;
  const paths = {};
  for (const key of SOURCE_KEYS) {
    const value = workSources[key];
    if (typeof value !== 'string' || value.trim() !== value || !value) return { missing: key };
    paths[key] = isAbsolute(value) ? value : resolve(repoRoot, value);
  }
  return { paths };
}

/**
 * createWorkProjectionProvider({ store, workSources })
 *   -> async readWorkProjection(orderId)
 *
 * Returns null when nothing is configured, so the caller keeps the existing
 * "socket is empty" answer instead of this module inventing a different one.
 */
export function createWorkProjectionProvider({ store, workSources }) {
  const resolved = resolveWorkSourcePaths(workSources);
  if (!resolved) return null;
  if (resolved.missing) {
    const reason = `WORK_SOURCE_UNCONFIGURED_${resolved.missing.toUpperCase()}`;
    return async () => hold(reason);
  }
  const { paths } = resolved;

  // Each read is attempted per request: an operator may place a source while the
  // server runs, and a source that disappears must stop producing answers.
  const readJson = async (key) => JSON.parse(await readFile(paths[key], 'utf8'));

  return async function readWorkProjection(orderId) {
    let registry, snapshot, mappings;
    for (const key of ['registry', 'snapshot', 'mappings']) {
      try {
        const value = await readJson(key);
        if (key === 'registry') registry = value;
        else if (key === 'snapshot') snapshot = value;
        else mappings = value;
      } catch (error) {
        // ENOENT and a malformed file are different facts; keep them distinct.
        return hold(error?.code === 'ENOENT'
          ? `WORK_SOURCE_MISSING_${key.toUpperCase()}`
          : `WORK_SOURCE_UNREADABLE_${key.toUpperCase()}`);
      }
    }
    // ★The adapter reports UNLINKED from an inventory with no matching row. A
    // non-array here would otherwise be coerced into that same silence.
    if (!Array.isArray(mappings)) return hold('WORK_SOURCE_UNREADABLE_MAPPINGS');

    const readLedgerText = () => readFile(paths.ledger, 'utf8');
    try { await readLedgerText(); }
    catch (error) {
      return hold(error?.code === 'ENOENT' ? 'WORK_SOURCE_MISSING_LEDGER' : 'WORK_SOURCE_UNREADABLE_LEDGER');
    }

    const adapter = createOrderWorkAdapter({
      readContext: createOrderWorkContextReader({ store, registry, snapshot, mappings, readLedgerText }),
      verifyLedgerText,
      runControlTower,
    });
    return adapter.readWorkProjection(orderId);
  };
}

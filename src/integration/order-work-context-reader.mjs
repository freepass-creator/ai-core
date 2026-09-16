// A read-only `readContext` provider for `createOrderWorkAdapter`.
//
// Why every input is a parameter, and nothing is constructed here:
// the canonical `registry` / `snapshot` / mapping-ledger locations for production
// are NOT decided yet. Inventing them here would create a second ledger beside the
// canonical one, which is exactly what the integration boundary forbids. So this
// module owns one behaviour only — read atomicity — and takes everything else from
// trusted application wiring.
//
// Capability boundary (enforced at the parameter list, not by a later check):
// no append, submit, transport, authorization or outbox dependency can be passed.
// There is no parameter to hold one, and unexpected keys are refused, so this
// module is structurally incapable of writing anywhere.

const copy = (value) => structuredClone(value);
const need = (condition, code) => { if (!condition) throw new Error(code); };

const ACCEPTED = ['store', 'registry', 'snapshot', 'mappings', 'readLedgerText'];

// A supplied input may be a fixed value or a zero-argument reader, because some
// callers pin a snapshot once and others recompute it per read. Either way the
// value is produced by the caller; this module never derives canonical content.
const resolve = (source) => (typeof source === 'function' ? source() : source);

/**
 * createOrderWorkContextReader({ store, registry, snapshot, mappings, readLedgerText })
 *   -> readContext(orderId)
 *
 * @param store          canonical order record source; only `get(orderId)` is used.
 * @param registry       project registry value, or a zero-arg function returning it.
 * @param snapshot       canonical work snapshot value, or a zero-arg function.
 * @param mappings       the COMPLETE central order<->work mapping inventory (rows in
 *                       adapter shape), or a zero-arg function returning it. The
 *                       adapter can only reject duplicates inside what it is given;
 *                       completeness of this inventory is the caller's obligation.
 * @param readLedgerText async () => string; the canonical work-ledger text.
 */
export function createOrderWorkContextReader(dependencies) {
  need(dependencies && typeof dependencies === 'object', 'DEPENDENCY_REQUIRED');
  // Refuses an append/submit/outbox capability smuggled in as an extra key.
  need(Object.keys(dependencies).every(key => ACCEPTED.includes(key)), 'DEPENDENCY_NOT_ACCEPTED');
  const { store, registry, snapshot, mappings, readLedgerText } = dependencies;
  need(typeof store?.get === 'function' && typeof readLedgerText === 'function', 'DEPENDENCY_REQUIRED');
  need(registry !== undefined && snapshot !== undefined && mappings !== undefined, 'DEPENDENCY_REQUIRED');

  return async function readContext(orderId) {
    // Read atomicity, storage- and policy-agnostic. Extracted from the pattern in
    // src/integration/order-intake-sandbox.mjs:30-39 (and mirrored in
    // durable-order-work-sandbox.mjs:229-232): read the order, read the ledger,
    // then re-read both. If either moved, the order and the ledger text would come
    // from different moments and the projection would describe a state that never
    // existed. Reject instead of returning a blended read.
    // Rejection code is the existing convention CANONICAL_READ_CHANGED, not a new name.
    const before = store.get(orderId);
    const text = await readLedgerText();
    const after = store.get(orderId);
    const textAgain = await readLedgerText();
    need(before.version === after.version && before.revision === after.revision
      && text === textAgain, 'CANONICAL_READ_CHANGED');

    return {
      order: copy(after),
      mappings: copy(resolve(mappings)),
      registry: copy(resolve(registry)),
      snapshot: copy(resolve(snapshot)),
      ledgerText: text,
      // Deliberately empty, and only safe because of what the read-only path is:
      // readWorkProjection / linkOrder never read these two fields; only the submit
      // path (prepareWorkCommand) does. A submitter must supply a real inventory
      // from its own command/event store — this reader cannot and must not.
      //
      // The silent hole this leaves is already acknowledged in
      // docs/ORDER_CONTROL_INTEGRATION.md:77: the adapter can only judge the
      // inventory it is handed, and an absent inventory is not proof of absence.
      // Empty arrays therefore PASS the adapter's format checks while proving
      // nothing about ID reuse. Do not reuse this reader for a submit path.
      usedCommandIds: [],
      usedEventIds: [],
    };
  };
}

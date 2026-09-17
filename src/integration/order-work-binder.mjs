// The write side of the order<->work link: the one action that was missing.
//
// Everything else already existed. `createOrderWorkAdapter.linkOrder()` validates
// a proposed mapping against the registry, the work ledger and the control tower,
// and returns `{ status: 'LINK_PREPARED', persisted: false }` — judged, but never
// written down. `order-mapping-inventory.mjs` reads bindings back. Between those
// two there was nothing that actually recorded the decision, so the inventory was
// always empty and every projection answered HOLD.
//
// This module is only that missing step: persist what the adapter approved.
//
// ★It does not judge. If `linkOrder` refuses, the refusal is returned untouched
// and NOTHING is written. Re-implementing any part of that judgement here would
// create a second opinion about what a valid link is.
//
// ★It grants nothing. A binding says "this order is about that work item". It is
// not authorization to execute or close; those stay with the control tower, which
// keeps holding until a human asserts intent, commitment and authorization.
//
// The table is the prototype's (durable-order-work-sandbox.mjs:75-79) including
// its immutability triggers. Two columns differ and the difference is deliberate:
// `command_id` / `event_id` are NULLable here, because a binding created by
// LINKING an existing work item has no submitted command and appends no event.
// The prototype only ever created bindings as part of a submit, so it could
// require them. Overloading those columns with invented ids would make a link
// look like a command that was never sent.

import { createHash } from 'node:crypto';

const need = (condition, code) => { if (!condition) throw new Error(code); };
const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Same shape the sandbox pins, so a binding written here and one written there
// describe the requirement identically.
export const requirementDigest = (order) => digest([order.intent, order.criteria]);

export const BINDING_SCHEMA = `
  CREATE TABLE IF NOT EXISTS coordination_bindings (
    order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL, work_id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL, subject_revision TEXT NOT NULL, requirement_digest TEXT NOT NULL,
    created_record_version INTEGER NOT NULL, command_id TEXT UNIQUE, event_id TEXT UNIQUE,
    CHECK ((command_id IS NULL) = (event_id IS NULL)),
    PRIMARY KEY(order_id,requirement_revision));
  CREATE TRIGGER IF NOT EXISTS binding_no_update BEFORE UPDATE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;
  CREATE TRIGGER IF NOT EXISTS binding_no_delete BEFORE DELETE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;`;

const MAPPING_FIELDS = ['order_id', 'requirement_revision', 'record_version', 'work_id', 'project_id', 'subject_revision'];

/**
 * createOrderWorkBinder({ store, adapter }) -> bind({ order_id, work_id, project_id, subject_revision })
 *
 * Returns the adapter's own refusal when the link is not valid, or
 * `{ status: 'LINKED', persisted: true|false, mapping }` when it is.
 * `persisted: false` with status LINKED means the identical binding already
 * existed — binding twice is not an error, it is a no-op.
 */
export function createOrderWorkBinder({ store, adapter }) {
  need(store && typeof store.get === 'function' && store.db, 'DEPENDENCY_REQUIRED');
  need(typeof adapter?.linkOrder === 'function', 'DEPENDENCY_REQUIRED');

  return async function bind(request) {
    need(request && typeof request === 'object', 'REQUEST_REQUIRED');
    const { order_id: orderId, work_id: workId, project_id: projectId, subject_revision: subjectRevision } = request;
    need(Object.keys(request).every(key => ['order_id', 'work_id', 'project_id', 'subject_revision'].includes(key)),
      'REQUEST_FIELDS_INVALID');

    // The order's own current revision and version are read from the store, never
    // taken from the caller: a caller that could name them could bind an order to
    // a revision it is not actually at.
    const order = store.get(orderId);
    const mapping = {
      order_id: orderId,
      requirement_revision: order.revision,
      record_version: order.version,
      work_id: workId,
      project_id: projectId,
      subject_revision: subjectRevision,
    };

    const judged = await adapter.linkOrder(mapping);
    // Anything but LINK_PREPARED is a refusal. Return it exactly as the adapter
    // phrased it and write nothing.
    if (judged?.status !== 'LINK_PREPARED') return judged;

    store.db.exec(BINDING_SCHEMA);
    const existing = store.db.prepare(
      'SELECT * FROM coordination_bindings WHERE order_id=? AND requirement_revision=?').get(orderId, order.revision);
    if (existing) {
      // Immutable by trigger, so a conflicting second binding cannot overwrite the
      // first. Say which it is instead of failing silently either way.
      const same = existing.work_id === workId && existing.project_id === projectId
        && existing.subject_revision === subjectRevision;
      if (!same) return { status: 'HOLD', reason: 'BINDING_CONFLICT', persisted: false,
        execution_authorized: false, completion_authorized: false, sent: false };
      return { status: 'LINKED', persisted: false, mapping: { ...mapping, record_version: existing.created_record_version } };
    }

    store.db.prepare(`INSERT INTO coordination_bindings
      (order_id, requirement_revision, work_id, project_id, subject_revision, requirement_digest,
       created_record_version, command_id, event_id) VALUES (?,?,?,?,?,?,?,NULL,NULL)`)
      .run(orderId, order.revision, workId, projectId, subjectRevision, requirementDigest(order), order.version);

    return { status: 'LINKED', persisted: true, mapping,
      // Stated so no caller can read a binding as permission.
      execution_authorized: false, completion_authorized: false, sent: false };
  };
}

export { MAPPING_FIELDS };

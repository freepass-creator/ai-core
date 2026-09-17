// Reads the order<->work mapping inventory out of the order store's own database.
//
// ★Why there is no path to configure. The mapping IS the binding between an order
// record and a work item, so it belongs with the order record, exactly as the work
// ledger belongs beside the order database (order-work-sources.mjs). A mapping
// inventory kept somewhere else could name orders this deployment has never seen,
// and the adapter would compose a projection that passes every format check while
// describing another installation's work.
//
// The table is the prototype's, unchanged: `coordination_bindings` as defined in
// src/integration/durable-order-work-sandbox.mjs:75-79, including its immutability
// triggers. Nothing new is invented here; this only reads it from an operating
// database instead of a temp directory.
//
// Capability boundary: SELECT only. This module never creates the table, never
// writes a row, and holds no append/submit dependency. Producing bindings is the
// coordinator's job and is deliberately still absent.

const need = (condition, code) => { if (!condition) throw new Error(code); };

export const BINDING_TABLE = 'coordination_bindings';

// The adapter's mapping shape (order-work-adapter.mjs:9).
const project = (row) => ({
  order_id: row.order_id,
  requirement_revision: row.requirement_revision,
  // Truthfully the record version the binding was created at. The adapter
  // overrides it with the order's current version when it emits a projection, so
  // this must never be back-filled from "now" to look fresher than it is.
  record_version: row.created_record_version,
  work_id: row.work_id,
  project_id: row.project_id,
  subject_revision: row.subject_revision,
});

/** True when the binding table exists at all. Absent is NOT empty: an inventory
 *  nobody has created yet must not read as "this order has no mapping", which the
 *  adapter would report as a confident UNLINKED. */
export function hasBindingTable(db) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(BINDING_TABLE);
  return Boolean(row);
}

/**
 * readOrderMappingInventory(db) -> mapping rows in adapter shape
 * Throws MAPPING_INVENTORY_ABSENT when nothing has ever produced bindings.
 */
export function readOrderMappingInventory(db) {
  need(db && typeof db.prepare === 'function', 'DEPENDENCY_REQUIRED');
  need(hasBindingTable(db), 'MAPPING_INVENTORY_ABSENT');
  return db.prepare(`SELECT order_id, requirement_revision, work_id, project_id, subject_revision, created_record_version
    FROM ${BINDING_TABLE} ORDER BY order_id, requirement_revision`).all().map(project);
}

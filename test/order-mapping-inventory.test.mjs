import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readOrderMappingInventory, hasBindingTable, BINDING_TABLE } from '../src/integration/order-mapping-inventory.mjs';

// The prototype's schema, copied verbatim from
// src/integration/durable-order-work-sandbox.mjs so the reader is proved against
// the real table shape rather than a convenient stand-in.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS coordination_bindings (
    order_id TEXT NOT NULL, requirement_revision INTEGER NOT NULL, work_id TEXT UNIQUE NOT NULL,
    project_id TEXT NOT NULL, subject_revision TEXT NOT NULL, requirement_digest TEXT NOT NULL,
    created_record_version INTEGER NOT NULL, command_id TEXT UNIQUE NOT NULL, event_id TEXT UNIQUE NOT NULL,
    PRIMARY KEY(order_id,requirement_revision));
  CREATE TRIGGER IF NOT EXISTS binding_no_update BEFORE UPDATE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;
  CREATE TRIGGER IF NOT EXISTS binding_no_delete BEFORE DELETE ON coordination_bindings BEGIN SELECT RAISE(ABORT,'BINDING_IMMUTABLE'); END;`;

const SUBJECT = 'a'.repeat(40);

function fresh(t, { withTable = true } = {}) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  if (withTable) db.exec(SCHEMA);
  return db;
}

const insert = (db, row = {}) => db.prepare(`INSERT INTO ${BINDING_TABLE} VALUES (?,?,?,?,?,?,?,?,?)`).run(
  row.order_id ?? 'ORD-1', row.requirement_revision ?? 1, row.work_id ?? 'DEV-001',
  row.project_id ?? 'ai-core', row.subject_revision ?? SUBJECT, row.requirement_digest ?? 'digest',
  row.created_record_version ?? 3, row.command_id ?? 'CMD-1', row.event_id ?? 'EVENT-001');

test('★a database that has never held a binding refuses to answer, and does not answer "none"', (t) => {
  const db = fresh(t, { withTable: false });
  assert.equal(hasBindingTable(db), false);
  // The whole point: this must throw rather than return []. An empty array here
  // would make the adapter report UNLINKED for every order in the deployment —
  // a confident conclusion drawn from the absence of data.
  assert.throws(() => readOrderMappingInventory(db), /MAPPING_INVENTORY_ABSENT/);
});

test('an existing but empty inventory genuinely is an empty inventory', (t) => {
  const db = fresh(t);
  assert.equal(hasBindingTable(db), true);
  assert.deepEqual(readOrderMappingInventory(db), []);
});

test('rows come back in the adapter mapping shape', (t) => {
  const db = fresh(t);
  insert(db);
  assert.deepEqual(readOrderMappingInventory(db), [{
    order_id: 'ORD-1', requirement_revision: 1, record_version: 3,
    work_id: 'DEV-001', project_id: 'ai-core', subject_revision: SUBJECT,
  }]);
});

test('★record_version is the version the binding was created at, not the latest', (t) => {
  const db = fresh(t);
  insert(db, { created_record_version: 2 });
  // Back-filling this from "now" would make a stale binding look current, which
  // is exactly the staleness the adapter exists to catch.
  assert.equal(readOrderMappingInventory(db)[0].record_version, 2);
});

test('the inventory is ordered so two reads of the same data agree', (t) => {
  const db = fresh(t);
  insert(db, { order_id: 'ORD-2', work_id: 'DEV-002', command_id: 'CMD-2', event_id: 'EVENT-002' });
  insert(db, { order_id: 'ORD-1', work_id: 'DEV-001', command_id: 'CMD-1', event_id: 'EVENT-001' });
  assert.deepEqual(readOrderMappingInventory(db).map(row => row.order_id), ['ORD-1', 'ORD-2']);
});

test('the reader cannot write: the prototype triggers stay in force', (t) => {
  const db = fresh(t);
  insert(db);
  assert.throws(() => db.prepare(`UPDATE ${BINDING_TABLE} SET work_id='DEV-999'`).run(), /BINDING_IMMUTABLE/);
  assert.throws(() => db.prepare(`DELETE FROM ${BINDING_TABLE}`).run(), /BINDING_IMMUTABLE/);
});

test('a reader given something that is not a database refuses', () => {
  assert.throws(() => readOrderMappingInventory(null), /DEPENDENCY_REQUIRED/);
  assert.throws(() => readOrderMappingInventory({}), /DEPENDENCY_REQUIRED/);
});

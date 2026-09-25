import test from 'node:test';
import assert from 'node:assert/strict';
import { createOrderWorkAdapter } from '../src/integration/order-work-adapter.mjs';

const sha = 'a'.repeat(40);
const head = `sha256:${'b'.repeat(64)}`;
const mapping = {
  order_id: 'ORD-00000000-0000-4000-8000-000000000001',
  requirement_revision: 2,
  record_version: 8,
  work_id: 'WORK-001',
  project_id: 'sample-project',
  subject_revision: sha,
};

test('existing binding from a future order record version fails closed', async () => {
  const context = {
    order: { id: mapping.order_id, revision: 2, version: 7 },
    mappings: [structuredClone(mapping)],
    registry: { projects: [{ project_id: mapping.project_id, status: 'ACTIVE', head_revision: sha }] },
    snapshot: { items: [{ id: mapping.work_id, project_id: mapping.project_id, subject_revision: sha }] },
    ledgerText: '{"event_id":"EXISTING-001"}\n',
  };
  const ledger = {
    status: 'VALID',
    head,
    work: {
      [mapping.work_id]: {
        state: 'READY',
        project_id: mapping.project_id,
        subject_revision: sha,
        revisions: [sha],
      },
    },
  };
  const control = {
    status: 'READY',
    execution_authorized: false,
    ledger_head: head,
    items: [{
      id: mapping.work_id,
      project_id: mapping.project_id,
      ledger_state: 'READY',
      execute: { enabled: true, reasons: [] },
      close: { enabled: false, reasons: ['OUTCOME_NOT_OBSERVED'] },
    }],
  };
  const adapter = createOrderWorkAdapter({
    readContext: async () => context,
    verifyLedgerText: async () => ledger,
    runControlTower: async () => control,
  });

  const result = await adapter.readWorkProjection(mapping.order_id);
  assert.equal(result.status, 'HOLD');
  assert.equal(result.reason, 'RECORD_VERSION_STALE');
  assert.equal(result.execution_authorized, false);
  assert.equal(result.sent, false);
});

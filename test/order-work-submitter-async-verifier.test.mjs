import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { openOrderWorkSubmitter } from '../src/integration/order-work-submitter.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../scripts/work-ledger.mjs';

const sha = 'a'.repeat(40);
const mapping = {
  order_id: 'ORD-1', requirement_revision: 1, record_version: 1,
  work_id: 'WORK-001', project_id: 'ai-core', subject_revision: sha,
};
const observedAt = '2026-09-23T14:00:00Z';

const transitionEvent = (eventId, fromState, toState) => ({
  event_id: eventId,
  work_id: mapping.work_id,
  project_id: mapping.project_id,
  type: 'TRANSITIONED',
  from_state: fromState,
  to_state: toState,
  actor: 'TEST',
  subject_revision: sha,
  observed_at: observedAt,
  evidence_refs: [],
});

test('submitter awaits an async ledger verifier in reconcile and head revalidation', async t => {
  const ledgerRef = { current: null };
  const asyncVerifier = async text => verifyLedgerText(text);
  const readContext = async () => ({
    order: { id: mapping.order_id, revision: 1, version: 1 },
    mappings: [mapping],
    registry: { projects: [{ project_id: mapping.project_id, status: 'ACTIVE', head_revision: sha }] },
    snapshot: { items: [{ id: mapping.work_id, project_id: mapping.project_id, subject_revision: sha }] },
    ledgerText: await readFile(ledgerRef.current, 'utf8').catch(error => error.code === 'ENOENT' ? '' : Promise.reject(error)),
    usedCommandIds: [],
    usedEventIds: [],
  });
  const runControlTower = ({ ledgerText }) => {
    const verified = verifyLedgerText(ledgerText);
    return {
      status: 'READY', execution_authorized: false, ledger_head: verified.head,
      items: [{
        id: mapping.work_id,
        project_id: mapping.project_id,
        ledger_state: verified.work[mapping.work_id]?.state ?? null,
        execute: { enabled: true, reasons: [] },
        close: { enabled: false, reasons: ['OUTCOME_NOT_OBSERVED'] },
      }],
    };
  };

  const submitter = await openOrderWorkSubmitter({
    readContext,
    verifyLedgerText: asyncVerifier,
    runControlTower,
    appendLedgerEvent,
  });
  ledgerRef.current = submitter.ledgerPath;
  t.after(async () => {
    try { submitter.close(); } catch { /* already closed */ }
    await rm(submitter.root, { recursive: true, force: true });
  });

  await appendLedgerEvent(submitter.ledgerPath, {
    event_id: 'SEED-901', work_id: mapping.work_id, project_id: mapping.project_id,
    type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'TEST',
    subject_revision: sha, observed_at: observedAt, evidence_refs: [],
  }, null);

  const firstHead = verifyLedgerText(await readFile(submitter.ledgerPath, 'utf8')).head;
  const prepared = {
    status: 'PREPARED_NOT_SENT', sent: false,
    command: {
      command_id: 'cmd-901', event_id: 'EVT-901', intent: 'REQUEST_EXECUTION_REVIEW',
      mapping, expected_head: firstHead,
    },
  };
  const appended = await submitter.submit(prepared, transitionEvent('EVT-901', 'RECEIVED', 'PLANNED'));
  assert.equal(appended.status, 'LEDGER_APPENDED');

  const stableHead = verifyLedgerText(await readFile(submitter.ledgerPath, 'utf8')).head;
  const preparedAfterDrift = {
    status: 'PREPARED_NOT_SENT', sent: false,
    command: {
      command_id: 'cmd-902', event_id: 'EVT-902', intent: 'REQUEST_EXECUTION_REVIEW',
      mapping, expected_head: stableHead,
    },
  };
  await appendLedgerEvent(submitter.ledgerPath, {
    event_id: 'OTHER-901', work_id: 'WORK-999', project_id: mapping.project_id,
    type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'TEST',
    subject_revision: sha, observed_at: observedAt, evidence_refs: [],
  }, stableHead);

  const held = await submitter.submit(preparedAfterDrift, transitionEvent('EVT-902', 'PLANNED', 'EXECUTING'));
  assert.equal(held.status, 'HOLD');
  assert.equal(held.reason, 'LEDGER_HEAD_CHANGED');

  const currentHead = verifyLedgerText(await readFile(submitter.ledgerPath, 'utf8')).head;
  const revalidated = await submitter.revalidateHead('cmd-902', currentHead);
  assert.equal(revalidated.status, 'OUTBOXED_NOT_SENT');
});

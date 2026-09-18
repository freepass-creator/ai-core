import { dirname } from 'node:path';
import { appendLedgerEvent, verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';
import { createWorkSourceContextProvider, resolveWorkSourcePaths } from './order-work-sources.mjs';
import { openOrderWorkSubmitter } from './order-work-submitter.mjs';

const hold = reason => Object.freeze({
  status: 'HOLD',
  reason,
  enabled: false,
  execution_authorized: false,
  completion_authorized: false,
});

/**
 * Existing durable submitter wired to the actual configured order/work sources.
 *
 * Default OFF is deliberate. This factory creates no second ledger and discovers no
 * alternative path. When enabled, the canonical ledger must resolve from the same
 * workSources used by projection, and the outbox lives beside that ledger.
 */
export async function openOperatingOrderWorkSubmitter({
  store,
  workSources,
  ordersDbPath,
  enabled = false,
  initialize = false,
  checkpoint = () => {},
} = {}) {
  if (!enabled) return hold('OPERATING_SUBMITTER_DISABLED');
  if (!store?.db || typeof store?.get !== 'function') return hold('ORDER_STORE_REQUIRED');
  if (typeof ordersDbPath !== 'string' || !ordersDbPath) return hold('ORDERS_DB_PATH_REQUIRED');

  const resolved = resolveWorkSourcePaths(workSources, { ordersDbPath });
  if (!resolved) return hold('WORK_SOURCES_UNCONFIGURED');
  if (resolved.missing) return hold(`WORK_SOURCE_UNCONFIGURED_${resolved.missing.toUpperCase()}`);
  const ledgerPath = resolved.paths.ledger;
  if (typeof ledgerPath !== 'string' || !ledgerPath) return hold('WORK_SOURCE_UNCONFIGURED_LEDGER');

  const readContext = createWorkSourceContextProvider({ store, workSources, ordersDbPath });
  if (!readContext) return hold('WORK_SOURCES_UNCONFIGURED');

  const submitter = await openOrderWorkSubmitter({
    root: dirname(ledgerPath),
    ledgerPath,
    pathMode: 'trusted',
    initialize,
    readContext,
    verifyLedgerText,
    runControlTower,
    appendLedgerEvent,
    checkpoint,
  });
  return Object.freeze({
    status: 'READY',
    enabled: true,
    root: submitter.root,
    dbPath: submitter.dbPath,
    ledgerPath: submitter.ledgerPath,
    submit: submitter.submit,
    reconcile: submitter.reconcile,
    revalidateHead: submitter.revalidateHead,
    history: submitter.history,
    outbox: submitter.outbox,
    close: submitter.close,
  });
}

// Reports, per canonical source, whether the order desk can actually read it.
//
// Why this exists: `orders.connection.json`'s `workSources` decides whether
// `/api/orders/:id/work` can answer anything. Today three of the four sources
// have no operating location at all, and the only way to learn that was to start
// the server and read a reason code off one HTTP response at a time. This runs
// the SAME validators the server path runs and prints the whole picture at once.
//
// It invents nothing. Every judgement is delegated:
//   registry -> validateProjectRegistry   snapshot -> evaluateControlTower
//   ledger   -> verifyLedgerText          mappings -> the adapter's own field rules
// Read-only: it opens no database, writes nothing, and contacts no network.

import { readFile } from 'node:fs/promises';
import { validateProjectRegistry } from './validate-project-registry.mjs';
import { evaluateControlTower } from './evaluate-control-tower.mjs';
import { verifyLedgerText } from './work-ledger.mjs';
import { readConnectionPolicy } from '../src/orders/client.mjs';
import { SOURCE_KEYS, resolveWorkSourcePaths, defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

// The adapter's mapping shape (order-work-adapter.mjs). Duplicated as a shallow
// shape check only: the adapter stays the authority, this just refuses to call a
// file "readable" when the adapter would reject every row in it.
const MAPPING_FIELDS = ['order_id', 'requirement_revision', 'record_version', 'work_id', 'project_id', 'subject_revision'];

const ok = (detail) => ({ state: 'OK', detail });
const bad = (state, detail) => ({ state, detail });

async function inspectSource(key, path) {
  let text;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { return bad(error?.code === 'ENOENT' ? 'MISSING' : 'UNREADABLE', `${error?.code ?? 'ERROR'} ${path}`); }

  if (key === 'ledger') {
    const result = verifyLedgerText(text);
    return result.status === 'VALID'
      ? ok(`${text.trim() ? text.trim().split(/\r?\n/).length : 0} events, head ${result.head ?? '-'}`)
      : bad('INVALID', result.errors?.map(e => e.code ?? e).join(', ') ?? 'ledger invalid');
  }

  let value;
  try { value = JSON.parse(text); }
  catch { return bad('UNREADABLE', 'not valid JSON'); }

  if (key === 'registry') {
    const result = validateProjectRegistry(value);
    return result.status === 'VALID'
      ? ok(`${value.projects.length} projects, observed ${value.observed_at}`)
      : bad('INVALID', result.errors.map(e => `${e.code}@${e.path}`).join(', '));
  }
  if (key === 'snapshot') {
    const result = evaluateControlTower(value);
    return result.status === 'INVALID'
      ? bad('INVALID', result.errors.map(e => e.code ?? e).join(', '))
      : ok(`${value.items?.length ?? 0} work items, as_of ${value.as_of}`);
  }
  // mappings
  if (!Array.isArray(value)) return bad('INVALID', 'must be a JSON array of mapping rows');
  const wrong = value.findIndex(row => !row || MAPPING_FIELDS.some(field => !Object.hasOwn(row, field)));
  if (wrong >= 0) return bad('INVALID', `row ${wrong} is missing one of ${MAPPING_FIELDS.join('/')}`);
  return ok(`${value.length} mapping rows`);
}

export async function inspectWorkSources(workSources, { ordersDbPath = null } = {}) {
  const resolved = resolveWorkSourcePaths(workSources, { ordersDbPath });
  if (!resolved) return { status: 'UNCONFIGURED', sources: [] };
  if (resolved.missing) {
    return {
      status: 'UNCONFIGURED',
      sources: SOURCE_KEYS.map(key => ({
        key,
        ...(workSources?.[key] ? { state: 'OK', detail: 'configured' } : bad('UNCONFIGURED',
          key === 'ledger' ? 'no path, and no order DB to anchor the convention to' : 'no path in workSources')),
      })),
    };
  }
  const sources = [];
  for (const key of SOURCE_KEYS) sources.push({ key, path: resolved.paths[key], ...await inspectSource(key, resolved.paths[key]) });
  return { status: sources.every(source => source.state === 'OK') ? 'READY' : 'HOLD', sources };
}

if (process.argv[1]?.endsWith('orders-sources-preflight.mjs')) {
  let policy = null;
  try { policy = readConnectionPolicy(); }
  catch (error) { console.error(`connection policy unreadable: ${error.message}`); process.exit(2); }

  // The CLI anchors the ledger convention to whichever DB this checkout uses, so
  // the printed path is the one the server would actually read.
  const ordersDbPath = process.env.AI_CORE_ORDERS_DB || defaultDb;
  const report = await inspectWorkSources(policy.workSources ?? null, { ordersDbPath });
  console.log(`order desk work sources: ${report.status}`);
  for (const source of report.sources) {
    console.log(`  ${source.state.padEnd(12)} ${source.key.padEnd(9)} ${source.detail}${source.path ? `\n               ${source.path}` : ''}`);
  }
  if (report.status === 'UNCONFIGURED' && !report.sources.length) {
    console.log('  orders.connection.json has no "workSources" block.');
    console.log(`  It needs: ${SOURCE_KEYS.filter(key => key !== 'ledger').join(', ')}.`);
    console.log(`  ledger has a convention and needs no path: ${defaultWorkLedgerPath(ordersDbPath)}`);
  }
  // Not a failure: an unconfigured desk is a legitimate state, and this command
  // is for reading the situation, not for gating anything.
  console.log(report.status === 'READY'
    ? '\n/api/orders/:id/work can reach every source.'
    : '\n/api/orders/:id/work will answer HOLD, naming the source it cannot read.');
}

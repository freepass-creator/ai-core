import { readFile, writeFile } from 'node:fs/promises';

const sessions = ['B','C','D'];
const defaults = {
  routing: 'docs/research/a-session-routing-receipts.v1.json',
  B: 'docs/research/a-session-receiver-inbox-B.v1.json',
  C: 'docs/research/a-session-receiver-inbox-C.v1.json',
  D: 'docs/research/a-session-receiver-inbox-D.v1.json',
};

export function syncReceiverInboxes(routing, inboxes, observedAt) {
  const changed = [];
  for (const session of sessions) {
    const inbox = inboxes[session];
    const routes = routing.receipts.filter((r) => r.target_session === session);
    const existing = new Map(inbox.items.map((item) => [item.route_id, item]));
    for (const route of routes) {
      if (existing.has(route.route_id)) continue;
      inbox.items.push({
        route_id: route.route_id,
        finding_id: route.finding_id,
        source_evidence_revision: route.source_evidence_revision,
        delivered_at: route.routed_at,
        receiver_status: 'PENDING',
        acknowledgement: null,
        review: null,
        decision: null,
        history: [{
          status: 'PENDING',
          observed_at: route.routed_at,
          basis_revision: route.source_evidence_revision,
          reason: 'Seeded from the A Routing Receipt Registry; no receiver acknowledgement exists yet.'
        }]
      });
      changed.push(route.route_id);
    }
    const valid = new Set(routes.map((r) => r.route_id));
    const orphans = inbox.items.filter((item) => !valid.has(item.route_id));
    if (orphans.length) throw new Error(`refusing to delete receiver history for orphan routes: ${orphans.map((x) => x.route_id).join(', ')}`);
    inbox.items.sort((a,b) => a.route_id.localeCompare(b.route_id));
    if (changed.some((id) => id.endsWith(`::${session}`))) inbox.observed_at = observedAt;
  }
  return { inboxes, changed };
}

if (process.argv[1]?.endsWith('sync-a-session-receiver-inboxes.mjs')) {
  const write = process.argv.includes('--write');
  const routing = JSON.parse(await readFile(defaults.routing, 'utf8'));
  const inboxes = {};
  for (const session of sessions) inboxes[session] = JSON.parse(await readFile(defaults[session], 'utf8'));
  const observedAt = new Date().toISOString();
  const result = syncReceiverInboxes(routing, inboxes, observedAt);
  if (write) {
    for (const session of sessions) await writeFile(defaults[session], JSON.stringify(result.inboxes[session], null, 2) + '\n');
  }
  console.log(JSON.stringify({ changed: result.changed, wrote: write }, null, 2));
  if (!write && result.changed.length) process.exitCode = 1;
}

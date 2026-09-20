import { readFile, writeFile } from 'node:fs/promises';

const paths = {
  routing: 'docs/research/a-session-routing-receipts.v1.json',
  B: 'docs/research/a-session-receiver-inbox-B.v1.json',
  C: 'docs/research/a-session-receiver-inbox-C.v1.json',
  D: 'docs/research/a-session-receiver-inbox-D.v1.json',
};
const inboxRank = { PENDING:0, ACKNOWLEDGED:1, REVIEWING:2, DECIDED:3 };
const routeRank = { SENT:0, RECEIVED:1, UNDER_REVIEW:2, CLOSED:3 };
const routeForInbox = { PENDING:'SENT', ACKNOWLEDGED:'RECEIVED', REVIEWING:'UNDER_REVIEW', DECIDED:'CLOSED' };

function receiverFromAck(ack) {
  return {
    session: ack.session,
    ai_core_revision: ack.ai_core_revision,
    observed_at: ack.observed_at,
    evidence_refs: ack.evidence_refs
  };
}

export function reconcileRoutingReceipts(routing, inboxes) {
  const items = new Map();
  for (const inbox of inboxes) for (const item of inbox.items) items.set(item.route_id, item);
  const changed = [];

  for (const route of routing.receipts) {
    const item = items.get(route.route_id);
    if (!item) throw new Error(`missing receiver inbox item for ${route.route_id}`);
    const current = routeRank[route.route_status];
    const target = inboxRank[item.receiver_status];
    if (current > target) throw new Error(`routing receipt is ahead of receiver inbox for ${route.route_id}`);
    if (current === target) continue;

    const nextStatus = routeForInbox[item.receiver_status];
    if (item.receiver_status !== 'PENDING') route.receiver = receiverFromAck(item.acknowledgement);

    if (item.receiver_status === 'ACKNOWLEDGED') {
      route.route_status = 'RECEIVED';
      route.decision = null;
      route.feedback = { state:'PENDING', recorded_at:null, note:null };
      route.history.push({
        status:'RECEIVED',
        observed_at:item.acknowledgement.observed_at,
        evidence_revision:item.acknowledgement.ai_core_revision,
        reason:'Receiver acknowledgement reconciled from the session inbox.'
      });
    } else if (item.receiver_status === 'REVIEWING') {
      route.route_status = 'UNDER_REVIEW';
      route.decision = null;
      route.feedback = { state:'PENDING', recorded_at:null, note:null };
      route.history.push({
        status:'UNDER_REVIEW',
        observed_at:item.review.started_at,
        evidence_revision:item.review.ai_core_revision,
        reason:item.review.note
      });
    } else if (item.receiver_status === 'DECIDED') {
      route.route_status = 'CLOSED';
      route.decision = {
        outcome:item.decision.outcome,
        reason:item.decision.reason,
        ai_core_revision:item.decision.ai_core_revision,
        decided_at:item.decision.decided_at,
        evidence_refs:item.decision.evidence_refs
      };
      route.feedback = {
        state:'RECORDED',
        recorded_at:item.decision.decided_at,
        note:`Receiver ${item.acknowledgement.session} decision ${item.decision.outcome} reconciled into A routing. A Evidence Registry state remains separately reviewable.`
      };
      route.history.push({
        status:'CLOSED',
        observed_at:item.decision.decided_at,
        evidence_revision:item.decision.ai_core_revision,
        reason:`Receiver decision reconciled: ${item.decision.reason}`
      });
    }

    if (route.route_status !== nextStatus) throw new Error(`unexpected reconciliation target for ${route.route_id}`);
    changed.push(route.route_id);
  }

  return { routing, changed };
}

if (process.argv[1]?.endsWith('reconcile-a-session-routing.mjs')) {
  const write = process.argv.includes('--write');
  const routing = JSON.parse(await readFile(paths.routing, 'utf8'));
  const inboxes = [];
  for (const session of ['B','C','D']) inboxes.push(JSON.parse(await readFile(paths[session], 'utf8')));
  const result = reconcileRoutingReceipts(routing, inboxes);
  if (write) await writeFile(paths.routing, JSON.stringify(result.routing, null, 2) + '\n');
  console.log(JSON.stringify({ changed: result.changed, wrote: write }, null, 2));
  if (!write && result.changed.length) process.exitCode = 1;
}

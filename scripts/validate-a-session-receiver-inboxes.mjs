import { readFile } from 'node:fs/promises';

const SHA40 = /^[0-9a-f]{40}$/;
const SESSIONS = new Set(['B','C','D']);
const INBOX_STATUS = new Set(['PENDING','ACKNOWLEDGED','REVIEWING','DECIDED']);
const ROUTE_STATUS = new Set(['SENT','RECEIVED','UNDER_REVIEW','CLOSED']);
const DECISIONS = new Set(['ADOPTED','HOLD','REJECTED','SUPERSEDED']);
const inboxRank = { PENDING:0, ACKNOWLEDGED:1, REVIEWING:2, DECIDED:3 };
const routeRank = { SENT:0, RECEIVED:1, UNDER_REVIEW:2, CLOSED:3 };

function add(errors, code, path, detail) {
  errors.push({ code, path, ...(detail ? { detail } : {}) });
}
function validDate(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}
function validRefs(value) {
  return Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === 'string' && x.trim().length > 0);
}
function validateAcknowledgement(ack, session, path, errors) {
  if (!ack || typeof ack !== 'object') {
    add(errors, 'ACKNOWLEDGEMENT_REQUIRED', path);
    return;
  }
  if (ack.session !== session) add(errors, 'ACK_SESSION_MISMATCH', `${path}/session`);
  if (!SHA40.test(ack.ai_core_revision ?? '')) add(errors, 'ACK_REVISION_INVALID', `${path}/ai_core_revision`);
  if (!validDate(ack.observed_at)) add(errors, 'ACK_TIME_INVALID', `${path}/observed_at`);
  if (!validRefs(ack.evidence_refs)) add(errors, 'ACK_EVIDENCE_REQUIRED', `${path}/evidence_refs`);
}
function validateReview(review, path, errors) {
  if (!review || typeof review !== 'object') {
    add(errors, 'REVIEW_REQUIRED', path);
    return;
  }
  if (!SHA40.test(review.ai_core_revision ?? '')) add(errors, 'REVIEW_REVISION_INVALID', `${path}/ai_core_revision`);
  if (!validDate(review.started_at)) add(errors, 'REVIEW_TIME_INVALID', `${path}/started_at`);
  if (!validRefs(review.evidence_refs)) add(errors, 'REVIEW_EVIDENCE_REQUIRED', `${path}/evidence_refs`);
  if (typeof review.note !== 'string' || review.note.trim().length < 10) add(errors, 'REVIEW_NOTE_INVALID', `${path}/note`);
}
function validateDecision(decision, path, errors) {
  if (!decision || typeof decision !== 'object') {
    add(errors, 'DECISION_REQUIRED', path);
    return;
  }
  if (!DECISIONS.has(decision.outcome)) add(errors, 'DECISION_OUTCOME_INVALID', `${path}/outcome`);
  if (!SHA40.test(decision.ai_core_revision ?? '')) add(errors, 'DECISION_REVISION_INVALID', `${path}/ai_core_revision`);
  if (!validDate(decision.decided_at)) add(errors, 'DECISION_TIME_INVALID', `${path}/decided_at`);
  if (!validRefs(decision.evidence_refs)) add(errors, 'DECISION_EVIDENCE_REQUIRED', `${path}/evidence_refs`);
  if (typeof decision.reason !== 'string' || decision.reason.trim().length < 10) add(errors, 'DECISION_REASON_INVALID', `${path}/reason`);
}

export function validateAReceiverInboxes(inboxes, routing) {
  const errors = [];
  if (!routing || routing.schema !== 'ai-core-a-session-routing-receipts/v1' || !Array.isArray(routing.receipts)) {
    return { status:'INVALID', errors:[{ code:'ROUTING_REGISTRY_INVALID', path:'$routing' }] };
  }
  if (!Array.isArray(inboxes) || inboxes.length !== 3) {
    return { status:'INVALID', errors:[{ code:'INBOX_SET_INVALID', path:'$inboxes' }] };
  }

  const inboxBySession = new Map();
  const itemByRoute = new Map();

  inboxes.forEach((inbox, i) => {
    const p = `$inboxes/${i}`;
    if (!inbox || typeof inbox !== 'object' || Array.isArray(inbox)) {
      add(errors, 'INBOX_NOT_OBJECT', p);
      return;
    }
    if (inbox.schema !== 'ai-core-a-session-receiver-inbox/v1') add(errors, 'INBOX_SCHEMA_INVALID', `${p}/schema`);
    if (inbox.status !== 'RESEARCH_RECEIVER_INBOX_NOT_CANONICAL') add(errors, 'INBOX_BOUNDARY_INVALID', `${p}/status`);
    if (!SESSIONS.has(inbox.session)) add(errors, 'INBOX_SESSION_INVALID', `${p}/session`);
    else if (inboxBySession.has(inbox.session)) add(errors, 'INBOX_SESSION_DUPLICATE', `${p}/session`);
    else inboxBySession.set(inbox.session, inbox);
    if (!Array.isArray(inbox.items)) {
      add(errors, 'INBOX_ITEMS_NOT_ARRAY', `${p}/items`);
      return;
    }

    inbox.items.forEach((item, j) => {
      const ip = `${p}/items/${j}`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        add(errors, 'INBOX_ITEM_INVALID', ip);
        return;
      }
      if (itemByRoute.has(item.route_id)) add(errors, 'INBOX_ROUTE_DUPLICATE', `${ip}/route_id`);
      else itemByRoute.set(item.route_id, { item, inbox, path:ip });
      if (!INBOX_STATUS.has(item.receiver_status)) add(errors, 'RECEIVER_STATUS_INVALID', `${ip}/receiver_status`);
      if (!SHA40.test(item.source_evidence_revision ?? '')) add(errors, 'SOURCE_EVIDENCE_REVISION_INVALID', `${ip}/source_evidence_revision`);
      if (!validDate(item.delivered_at)) add(errors, 'DELIVERED_AT_INVALID', `${ip}/delivered_at`);
      if (!Array.isArray(item.history) || item.history.length === 0) {
        add(errors, 'INBOX_HISTORY_REQUIRED', `${ip}/history`);
      } else {
        let prior = -1;
        item.history.forEach((h, k) => {
          const hp = `${ip}/history/${k}`;
          if (!INBOX_STATUS.has(h?.status)) add(errors, 'INBOX_HISTORY_STATUS_INVALID', `${hp}/status`);
          else {
            const rank = inboxRank[h.status];
            if (rank < prior) add(errors, 'INBOX_HISTORY_REGRESSION', `${hp}/status`);
            prior = rank;
          }
          if (!validDate(h?.observed_at)) add(errors, 'INBOX_HISTORY_TIME_INVALID', `${hp}/observed_at`);
          if (!SHA40.test(h?.basis_revision ?? '')) add(errors, 'INBOX_HISTORY_REVISION_INVALID', `${hp}/basis_revision`);
          if (typeof h?.reason !== 'string' || h.reason.trim().length < 10) add(errors, 'INBOX_HISTORY_REASON_INVALID', `${hp}/reason`);
        });
        if (item.history.at(-1)?.status !== item.receiver_status) add(errors, 'RECEIVER_STATUS_NOT_HISTORY_TAIL', `${ip}/receiver_status`);
      }

      if (item.receiver_status === 'PENDING') {
        if (item.acknowledgement !== null) add(errors, 'PENDING_ACK_MUST_BE_NULL', `${ip}/acknowledgement`);
        if (item.review !== null) add(errors, 'PENDING_REVIEW_MUST_BE_NULL', `${ip}/review`);
        if (item.decision !== null) add(errors, 'PENDING_DECISION_MUST_BE_NULL', `${ip}/decision`);
      } else if (item.receiver_status === 'ACKNOWLEDGED') {
        validateAcknowledgement(item.acknowledgement, inbox.session, `${ip}/acknowledgement`, errors);
        if (item.review !== null) add(errors, 'ACK_REVIEW_MUST_BE_NULL', `${ip}/review`);
        if (item.decision !== null) add(errors, 'ACK_DECISION_MUST_BE_NULL', `${ip}/decision`);
      } else if (item.receiver_status === 'REVIEWING') {
        validateAcknowledgement(item.acknowledgement, inbox.session, `${ip}/acknowledgement`, errors);
        validateReview(item.review, `${ip}/review`, errors);
        if (item.decision !== null) add(errors, 'REVIEWING_DECISION_MUST_BE_NULL', `${ip}/decision`);
      } else if (item.receiver_status === 'DECIDED') {
        validateAcknowledgement(item.acknowledgement, inbox.session, `${ip}/acknowledgement`, errors);
        if (item.review !== null) validateReview(item.review, `${ip}/review`, errors);
        validateDecision(item.decision, `${ip}/decision`, errors);
      }
    });
  });

  for (const session of SESSIONS) {
    if (!inboxBySession.has(session)) add(errors, 'INBOX_SESSION_MISSING', '$inboxes', session);
  }

  const routeIds = new Set();
  for (const [index, route] of routing.receipts.entries()) {
    const rp = `$routing/receipts/${index}`;
    routeIds.add(route.route_id);
    if (!ROUTE_STATUS.has(route.route_status)) add(errors, 'ROUTING_STATUS_INVALID', `${rp}/route_status`);
    const found = itemByRoute.get(route.route_id);
    if (!found) {
      add(errors, 'INBOX_ITEM_MISSING', '$inboxes', route.route_id);
      continue;
    }
    const { item, inbox, path } = found;
    if (inbox.session !== route.target_session) add(errors, 'INBOX_TARGET_SESSION_MISMATCH', `${path}/route_id`);
    if (item.finding_id !== route.finding_id) add(errors, 'INBOX_FINDING_MISMATCH', `${path}/finding_id`);
    if (item.source_evidence_revision !== route.source_evidence_revision) add(errors, 'INBOX_SOURCE_REVISION_MISMATCH', `${path}/source_evidence_revision`);
    if (item.delivered_at !== route.routed_at) add(errors, 'INBOX_DELIVERY_TIME_MISMATCH', `${path}/delivered_at`);
    if (ROUTE_STATUS.has(route.route_status) && INBOX_STATUS.has(item.receiver_status) && routeRank[route.route_status] > inboxRank[item.receiver_status]) {
      add(errors, 'ROUTING_RECEIPT_AHEAD_OF_RECEIVER', `${rp}/route_status`, `${route.route_status} > ${item.receiver_status}`);
    }
    if (route.route_status !== 'SENT') {
      const ack = item.acknowledgement;
      if (!ack) add(errors, 'ROUTING_RECEIVER_HAS_NO_ACK', `${path}/acknowledgement`);
      else if (route.receiver?.ai_core_revision !== ack.ai_core_revision || route.receiver?.session !== inbox.session) {
        add(errors, 'ROUTING_RECEIVER_EVIDENCE_MISMATCH', `${rp}/receiver`);
      }
    }
    if (route.route_status === 'CLOSED') {
      if (item.receiver_status !== 'DECIDED') add(errors, 'CLOSED_ROUTE_REQUIRES_DECIDED_INBOX', `${path}/receiver_status`);
      if (route.decision?.outcome !== item.decision?.outcome) add(errors, 'CLOSED_DECISION_MISMATCH', `${rp}/decision/outcome`);
    }
  }

  for (const [routeId, found] of itemByRoute.entries()) {
    if (!routeIds.has(routeId)) add(errors, 'INBOX_ITEM_ORPHAN', `${found.path}/route_id`, routeId);
  }

  const pendingReconciliation = [];
  for (const route of routing.receipts) {
    const found = itemByRoute.get(route.route_id);
    if (!found) continue;
    if (routeRank[route.route_status] < inboxRank[found.item.receiver_status]) pendingReconciliation.push(route.route_id);
  }

  return { status: errors.length ? 'INVALID' : 'VALID', errors, pending_reconciliation: pendingReconciliation };
}

if (process.argv[1]?.endsWith('validate-a-session-receiver-inboxes.mjs')) {
  if (process.argv.length < 6) {
    console.error('Usage: node scripts/validate-a-session-receiver-inboxes.mjs <routing.json> <B.json> <C.json> <D.json>');
    process.exit(2);
  }
  const [routingPath, ...inboxPaths] = process.argv.slice(2, 6);
  const routing = JSON.parse(await readFile(routingPath, 'utf8'));
  const inboxes = [];
  for (const path of inboxPaths) inboxes.push(JSON.parse(await readFile(path, 'utf8')));
  const result = validateAReceiverInboxes(inboxes, routing);
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'VALID') process.exitCode = 1;
}

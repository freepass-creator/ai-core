import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrderStore } from '../orders/store.mjs';
import { normalizeOrderIntent } from '../intake/normalize-order-intent.mjs';
import { createOrderWorkAdapter } from './order-work-adapter.mjs';
import { appendLedgerEvent, verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requirementDigest = order => digest([order.intent, order.criteria]);
const need = (condition, code) => { if (!condition) throw new Error(code); };
const hold = reason => ({ status: 'HOLD', reason, execution_authorized: false, completion_authorized: false, sent: false });

// Explicitly a disposable integration laboratory, never a production connector.
// No caller-supplied DB/path, imported mappings or canonical policy receipts.
export async function createOrderIntakeSandbox({ registry, asOf }) {
  need(Number.isFinite(Date.parse(asOf)), 'AS_OF_REQUIRED');
  const root = await mkdtemp(join(tmpdir(), 'ai-core-integration-'));
  const store = new OrderStore(join(root, 'intake.sqlite'));
  const ledgerPath = join(root, 'work.jsonl');
  const pinnedRegistry = structuredClone(registry);
  const mappings = [], items = [], previews = new Map();
  let sequence = 0, queue = Promise.resolve();
  const ledgerText = () => readFile(ledgerPath, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return ''; throw error;
  });
  const canonicalSnapshot = () => ({ schema_version: '1.0', as_of: asOf, capacities: [], items: structuredClone(items) });
  async function readContext(orderId) {
    const before = store.get(orderId);
    const text = await ledgerText();
    const after = store.get(orderId);
    need(before.version === after.version && text === await ledgerText(), 'CANONICAL_READ_CHANGED');
    const linked = mappings.find(row => row.mapping.order_id === orderId && row.mapping.requirement_revision === after.revision);
    if (linked) need(linked.requirement_digest === requirementDigest(after), 'REQUIREMENT_DIGEST_CHANGED');
    return { order: after, mappings: mappings.map(row => structuredClone(row.mapping)), registry: structuredClone(pinnedRegistry),
      snapshot: canonicalSnapshot(), ledgerText: text, usedCommandIds: [], usedEventIds: [] };
  }
  const adapter = createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower });
  async function readWorkProjection(orderId) {
    const projection = await adapter.readWorkProjection(orderId);
    if (projection.control_result) {
      for (const action of ['execute', 'close']) {
        projection.control_result[action] = { enabled: false,
          reasons: [...new Set([...projection.control_result[action].reasons, 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE'])] };
      }
    }
    return { ...hold('DURABLE_MAPPING_OUTBOX_UNAVAILABLE'), mode: 'SYNTHETIC_ONLY', projection };
  }
  function preview(candidate, trustedSource, { projectId, title, criteria } = {}) {
    need(digest(candidate?.source) === digest(trustedSource), 'SOURCE_MISMATCH');
    const orders = store.list();
    const targetRevision = digest(orders.map(order => [order.id, order.revision, order.version]));
    const normalized = normalizeOrderIntent(candidate, { target_snapshot: { ref: 'sandbox-intake', revision: targetRevision, order_ids: orders.map(order => order.id) } });
    if (normalized.status !== 'CANDIDATE_VALIDATED') return normalized;
    const intent = normalized.intent.value;
    if (!['new', 'change'].includes(intent)) return { ...hold('INTENT_READ_OR_HANDOFF_ONLY'), candidate: normalized };
    need(pinnedRegistry.projects.some(project => project.project_id === projectId && project.status === 'ACTIVE'), 'PROJECT_NOT_REGISTERED');
    need(typeof title === 'string' && title.trim() && Array.isArray(criteria) && criteria.length && criteria.every(value => typeof value === 'string' && value.trim()), 'SEMANTIC_DETAILS_REQUIRED');
    const target = intent === 'change' ? store.get(normalized.targets[0].value) : null;
    const currentMapping = target && mappings.find(row => row.mapping.order_id === target.id && row.mapping.requirement_revision === target.revision);
    if (target) need(currentMapping?.mapping.project_id === projectId, 'PROJECT_CHANGE_NOT_SUPPORTED');
    const token = randomUUID();
    const proposal = { intent, request: normalized.request.value, projectId, title, criteria: [...criteria], target: target ? { id: target.id, revision: target.revision, version: target.version } : null };
    previews.set(token, { proposal, digest: digest(proposal), source: structuredClone(trustedSource) });
    return { status: 'SEMANTIC_CONFIRMATION_REQUIRED', token, proposal: structuredClone(proposal), proposal_digest: digest(proposal), execution_authorized: false };
  }
  function confirm({ token, proposal_digest, confirmed }) {
    const operation = queue.then(async () => {
      const entry = previews.get(token);
      need(entry && entry.digest === proposal_digest && confirmed === true, 'CONFIRMATION_MISMATCH');
      if (entry.result) return entry.result.order_id
        ? { ...structuredClone(entry.result), ...await readWorkProjection(entry.result.order_id) }
        : structuredClone(entry.result);
      // An interrupted or partial write is held; never blindly replay a dual write.
      need(!entry.started, 'PARTIAL_WRITE_REQUIRES_RECONCILIATION');
      const proposal = entry.proposal;
      if (proposal.target) {
        const order = store.get(proposal.target.id);
        need(order.version === proposal.target.version && order.revision === proposal.target.revision, 'STALE_CONFIRMATION');
      }
      const beforeText = await ledgerText();
      const before = verifyLedgerText(beforeText);
      need(before.status === 'VALID', 'LEDGER_INVALID');
      entry.started = true;
      try {
        const order = proposal.intent === 'new'
          ? store.create({ requestId: token, title: proposal.title, intent: proposal.request, project: proposal.projectId, criteria: proposal.criteria, source: 'synthetic-confirmed-candidate' })
          : store.mutate(proposal.target.id, { requestId: token, action: 'revise', version: proposal.target.version, intent: proposal.request, criteria: proposal.criteria, reason: 'Synthetic semantic confirmation' });
        const project = pinnedRegistry.projects.find(row => row.project_id === proposal.projectId);
        const workId = `INTAKE-${String(++sequence).padStart(6, '0')}`;
        await appendLedgerEvent(ledgerPath, { event_id: `INTAKEEVENT-${String(sequence).padStart(6, '0')}`, work_id: workId, project_id: project.project_id,
          type: 'CREATED', from_state: null, to_state: 'RECEIVED', actor: 'SYNTHETIC_HOST', subject_revision: project.head_revision, observed_at: asOf, evidence_refs: [] }, before.head);
        // No authorization, acceptance, evidence or READY is inferred from confirmation.
        items.push({ id: workId, project_id: project.project_id, title: proposal.title, subject_revision: project.head_revision,
          intent: { status: 'INFERRED', provenance: 'AI_INFERRED' },
          sources: [{ ref: 'synthetic-source-pending', revision: project.head_revision, observed_at: asOf, valid_until: asOf, status: 'UNAVAILABLE', severity: 'CRITICAL' }],
          commitment: { status: 'PROPOSED', accepted: false, owner: null, due_at: null, dependencies: [] }, allocations: [],
          authorization: { required: true, status: 'PENDING' }, evidence_receipts: [], verification: 'NOT_RUN', execution: 'NOT_STARTED', outcome: 'NOT_OBSERVED' });
        const mapping = { order_id: order.id, requirement_revision: order.revision, record_version: order.version, work_id: workId, project_id: project.project_id, subject_revision: project.head_revision };
        const prepared = await adapter.linkOrder(mapping);
        need(prepared.status === 'LINK_PREPARED', prepared.reason ?? 'LINK_NOT_PREPARED');
        mappings.push({ mapping: Object.freeze(mapping), requirement_digest: requirementDigest(order) });
        entry.result = { ...await readWorkProjection(order.id), order_id: order.id, requirement_revision: order.revision };
      } catch (error) { entry.result = { ...hold('PARTIAL_WRITE_REQUIRES_RECONCILIATION'), detail: error.message }; }
      return structuredClone(entry.result);
    });
    queue = operation.catch(() => {});
    return operation;
  }
  return { preview, confirm, readWorkProjection,
    // Lab instrumentation is explicit; these handles are never exposed by HTTP.
    store, ledgerPath, root,
    mappingHistory: () => structuredClone(mappings),
    async close() { await queue; store.close(); await rm(root, { recursive: true, force: true }); } };
}

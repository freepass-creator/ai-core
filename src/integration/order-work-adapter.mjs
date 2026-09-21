// Read-only boundary. Canonical validation/evaluation belongs to PR20.
const copy = (value) => structuredClone(value);
const need = (condition, code) => { if (!condition) throw new Error(code); };
const positive = (value) => Number.isSafeInteger(value) && value > 0;
const revision = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const identifier = (value) => typeof value === 'string' && /^[A-Z][A-Z0-9_-]*-[0-9]{3,}$/.test(value);
const nonempty = (value) => typeof value === 'string' && value.trim() === value && value.length > 0;
const fields = ['order_id', 'requirement_revision', 'record_version', 'work_id', 'project_id', 'subject_revision'];
const identityFields = fields.filter(key => key !== 'record_version');

function validateMapping(mapping) {
  need(mapping && Object.keys(mapping).length === fields.length && fields.every(key => Object.hasOwn(mapping, key)), 'MAPPING_INVALID');
  need(nonempty(mapping.order_id) && identifier(mapping.work_id) && mapping.order_id !== mapping.work_id, 'MAPPING_ID_INVALID');
  need(typeof mapping.project_id === 'string' && /^[a-z][a-z0-9-]{1,62}$/.test(mapping.project_id), 'MAPPING_PROJECT_INVALID');
  need(positive(mapping.requirement_revision) && positive(mapping.record_version) && revision(mapping.subject_revision), 'MAPPING_REVISION_INVALID');
}

function unique(rows, key, code) {
  need(Array.isArray(rows), code);
  const values = rows.map(row => row?.[key]);
  need(values.every(nonempty) && new Set(values).size === values.length, code);
}

/** Dependencies are trusted application wiring, never request-supplied functions.
 * readContext returns a coherent, current, complete mapping inventory and PR20 inputs.
 * No persistence, append, transport, authorization or outbox dependency is accepted.
 */
export function createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower }) {
  need([readContext, verifyLedgerText, runControlTower].every(fn => typeof fn === 'function'), 'DEPENDENCY_REQUIRED');

  async function inspect(orderId, candidate) {
    need(nonempty(orderId), 'ORDER_ID_INVALID');
    const context = copy(await readContext(orderId));
    const { order, mappings, registry, snapshot, ledgerText } = context;
    need(order?.id === orderId && positive(order.revision) && positive(order.version), 'ORDER_INVALID');
    need(Array.isArray(mappings), 'MAPPINGS_UNAVAILABLE');
    mappings.forEach(validateMapping);
    need(new Set(mappings.map(row => JSON.stringify([row.order_id, row.requirement_revision]))).size === mappings.length, 'DUPLICATE_ORDER_MAPPING');
    unique(mappings, 'work_id', 'DUPLICATE_WORK_MAPPING');
    const existing = mappings.find(row => row.order_id === orderId && row.requirement_revision === order.revision);
    if (candidate) {
      validateMapping(candidate);
      need(candidate.order_id === orderId, 'MAPPING_ORDER_MISMATCH');
      need(!existing || identityFields.every(key => existing[key] === candidate[key]), 'MAPPING_CONFLICT');
      need(!mappings.some(row => row.work_id === candidate.work_id
        && (row.order_id !== orderId || row.requirement_revision !== candidate.requirement_revision)), 'DUPLICATE_WORK_MAPPING');
    }
    const mapping = candidate ?? existing;
    need(mapping, mappings.some(row => row.order_id === orderId) ? 'REQUIREMENT_REVISION_STALE' : 'UNLINKED');
    need(mapping.requirement_revision === order.revision, 'REQUIREMENT_REVISION_STALE');
    if (candidate) need(mapping.record_version === order.version, 'RECORD_VERSION_STALE');
    unique(registry?.projects, 'project_id', 'DUPLICATE_OR_INVALID_PROJECTS');
    unique(snapshot?.items, 'id', 'DUPLICATE_OR_INVALID_WORK_ITEMS');
    need(typeof ledgerText === 'string', 'LEDGER_UNAVAILABLE');
    const ledger = await verifyLedgerText(ledgerText);
    need(ledger?.status === 'VALID', 'LEDGER_INVALID');
    const project = registry.projects.find(row => row.project_id === mapping.project_id);
    const item = snapshot.items.find(row => row.id === mapping.work_id);
    const work = Object.hasOwn(ledger.work ?? {}, mapping.work_id) ? ledger.work[mapping.work_id] : null;
    need(project && item && work, 'CANONICAL_LINK_MISSING');
    if (candidate && !existing) need(work.state === 'RECEIVED', 'NEW_LINK_REQUIRES_RECEIVED');
    need((project.execution_readiness_status ?? project.status) === 'ACTIVE', 'PROJECT_NOT_ACTIVE');
    need(item.project_id === mapping.project_id && work.project_id === mapping.project_id, 'WORK_PROJECT_MISMATCH');
    // Registry head, snapshot and ledger must all describe the SAME current revision.
    need(revision(work.subject_revision) && [project.head_revision, item.subject_revision].every(value => value === work.subject_revision), 'SUBJECT_REVISION_STALE');
    // The binding pins identity (this order <-> that work), made at one revision. It
    // stays valid after the subject moves only if the ledger itself carried the work
    // there — the bound revision must be in the work's own history. A new link must
    // be made at the current revision.
    need(candidate ? mapping.subject_revision === work.subject_revision
      : (work.revisions ?? [work.subject_revision]).includes(mapping.subject_revision), 'SUBJECT_REVISION_STALE');
    const control = await runControlTower({ registry, snapshot, ledgerText });
    need(['READY', 'HOLD'].includes(control?.status) && control.execution_authorized === false, 'CONTROL_INVALID');
    need(control.ledger_head === ledger.head && nonempty(ledger.head), 'LEDGER_HEAD_MISMATCH');
    unique(control.items, 'id', 'CONTROL_ITEMS_INVALID');
    const result = control.items.find(row => row.id === mapping.work_id);
    need(result?.project_id === mapping.project_id && result.ledger_state === work.state, 'CONTROL_WORK_MISMATCH');
    need(typeof result.execute?.enabled === 'boolean' && Array.isArray(result.execute.reasons)
      && typeof result.close?.enabled === 'boolean' && Array.isArray(result.close.reasons), 'CONTROL_ACTIONS_INVALID');
    return { context, projection: {
      status: 'LINKED', mapping: { ...copy(mapping), record_version: order.version }, canonical_state: work.state,
      ledger_head: ledger.head, control_status: control.status, control_result: copy(result),
      execution_authorized: false, completion_authorized: false, sent: false,
    } };
  }

  const failed = (error) => ({ status: error?.message === 'UNLINKED' ? 'UNLINKED' : 'HOLD',
    reason: typeof error?.message === 'string' ? error.message : 'ADAPTER_READ_FAILED',
    execution_authorized: false, completion_authorized: false, sent: false });

  async function readWorkProjection(orderId) {
    try { return (await inspect(orderId)).projection; } catch (error) { return failed(error); }
  }

  async function linkOrder(mapping) {
    try {
      const { projection } = await inspect(mapping?.order_id, copy(mapping));
      return { ...projection, status: 'LINK_PREPARED', persisted: false };
    } catch (error) { return failed(error); }
  }

  // This is an intent envelope, NOT a ledger event or execution permission.
  async function prepareWorkCommand(request) {
    try {
      const input = copy(request);
      need(input && Object.keys(input).every(key => ['mapping', 'command_id', 'event_id', 'expected_head', 'intent'].includes(key)), 'COMMAND_FIELDS_INVALID');
      validateMapping(input.mapping);
      need(nonempty(input.command_id) && identifier(input.event_id), 'COMMAND_ID_INVALID');
      need(['REQUEST_EXECUTION_REVIEW', 'REQUEST_CLOSE_REVIEW'].includes(input.intent), 'INTENT_NOT_SUPPORTED');
      const { context, projection } = await inspect(input.mapping.order_id);
      need(fields.every(key => input.mapping[key] === projection.mapping[key]), 'COMMAND_MAPPING_STALE');
      need(input.expected_head === projection.ledger_head, 'LEDGER_HEAD_CHANGED');
      // Inventory is supplied by the future coordinator; an absent inventory is not proof of absence.
      need(Array.isArray(context.usedCommandIds) && Array.isArray(context.usedEventIds), 'ID_INVENTORY_UNAVAILABLE');
      need(context.usedCommandIds.every(nonempty) && context.usedEventIds.every(identifier)
        && new Set(context.usedCommandIds).size === context.usedCommandIds.length
        && new Set(context.usedEventIds).size === context.usedEventIds.length, 'ID_INVENTORY_INVALID');
      need(!context.usedCommandIds.includes(input.command_id), 'COMMAND_ID_DUPLICATE');
      // Parsing IDs only, after PR20 verified this exact text. No chain/state logic lives here.
      const ledgerEventIds = context.ledgerText.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line).event_id);
      need(ledgerEventIds.every(identifier), 'LEDGER_EVENT_IDS_INVALID');
      need(!context.usedEventIds.includes(input.event_id) && !ledgerEventIds.includes(input.event_id), 'EVENT_ID_DUPLICATE');
      const action = input.intent === 'REQUEST_EXECUTION_REVIEW' ? projection.control_result.execute : projection.control_result.close;
      need(action.enabled && action.reasons.length === 0, 'CANONICAL_ACTION_BLOCKED');
      return { status: 'PREPARED_NOT_SENT', sent: false, persisted: false,
        execution_authorized: false, completion_authorized: false,
        command: { command_id: input.command_id, event_id: input.event_id, intent: input.intent,
          mapping: copy(projection.mapping), expected_head: projection.ledger_head } };
    } catch (error) { return failed(error); }
  }

  return Object.freeze({ linkOrder, readWorkProjection, refreshControlResult: readWorkProjection,
    prepareWorkCommand, submitWorkCommand: prepareWorkCommand });
}

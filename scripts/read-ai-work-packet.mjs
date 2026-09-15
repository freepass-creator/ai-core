/** Read-only projection over PR21 RemoteOrderClient.packet/checkContext.
 * The caller injects the existing pinned client. No connection discovery or writes.
 */
export async function readAiWorkPacket({ client, orderId, taskId } = {}) {
  const result = {
    status: 'HOLD', execution_authorized: false, claim_acquired: false,
    order_id: null, task_id: null, work_id: null,
    requirement_revision: null, order_version: null, subject_commit: null,
    execution_location: null, assigned: null, owned_files: null,
    dependencies: null, blocked_reason_ref: null, evidence_refs: null,
    observed_at: null, valid_until: null, lease_state: 'UNKNOWN',
    reasons: [],
  };
  const reasons = result.reasons;
  const positive = (v) => Number.isSafeInteger(v) && v > 0;
  const actor = (v) => ['codex', 'claude', 'cursor', 'gemini'].includes(v);
  if (!/^ORD-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(orderId ?? '')
    || !/^T[1-9][0-9]*$/.test(taskId ?? '')) {
    reasons.push('INVALID_SELECTION'); return result;
  }
  if (!client || typeof client.packet !== 'function' || typeof client.checkContext !== 'function') {
    reasons.push('CLIENT_NOT_CONNECTED'); return result;
  }
  let packet, current;
  try {
    packet = await client.packet(orderId, taskId);
    current = await client.checkContext(orderId, taskId);
  } catch {
    reasons.push('READ_FAILED'); return result; // Do not expose raw server errors.
  }
  if (!packet || packet.schema !== 'ai-core-handoff/v1' || packet.orderId !== orderId || packet.taskId !== taskId
    || !positive(packet.orderVersion) || !positive(packet.requirementRevision) || !actor(packet.assigned)
    || !['NONE', 'ACTIVE', 'EXPIRED'].includes(packet.leaseState)
    || !current || current.orderId !== orderId || current.task?.id !== taskId) {
    reasons.push('INVALID_PACKET'); return result;
  }
  result.order_id = orderId; result.task_id = taskId;
  result.requirement_revision = packet.requirementRevision;
  result.order_version = packet.orderVersion;
  result.assigned = packet.assigned; result.lease_state = packet.leaseState;
  if (current.version !== packet.orderVersion || current.requirementRevision !== packet.requirementRevision
    || current.task.assigned !== packet.assigned || current.task.status !== packet.taskStatus
    || current.orderStatus !== packet.status) reasons.push('CONTEXT_CHANGED');
  if (packet.leaseState === 'ACTIVE') reasons.push('EXISTING_CLAIM_NOT_TRANSFERABLE');
  if (packet.leaseState === 'EXPIRED') reasons.push('LEASE_EXPIRED');
  if (packet.blockedReason) reasons.push('BLOCKED_REASON_REQUIRES_SCOPED_READ');
  if (packet.status === 'CLOSED' || packet.status === 'CANCELLED' || packet.taskStatus === 'REPORTED') reasons.push('NOT_AN_EXECUTION_ASSIGNMENT');
  // PR21's existing packet does not expose these canonical integration fields.
  // Do not infer them from title/project/role/history or accept injected extra keys.
  reasons.push('UNLINKED_WORK', 'EXECUTION_SCOPE_UNAVAILABLE', 'FRESHNESS_UNAVAILABLE',
    'DEPENDENCY_EVIDENCE_UNAVAILABLE', 'CENTRAL_CLAIM_REQUIRED');
  return result;
}

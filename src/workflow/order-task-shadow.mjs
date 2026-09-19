import { createWorkflowEngine, WorkflowError } from './engine.mjs';

const TERMINAL_ORDERS = new Set(['CLOSED', 'CANCELLED']);

function nonempty(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function reportContentValid(command) {
  return nonempty(command?.summary, 10000)
    && Array.isArray(command?.evidence)
    && command.evidence.length > 0
    && command.evidence.length <= 30
    && command.evidence.every(value => nonempty(value, 2000));
}

function activeLease(task, nowMs) {
  return Boolean(task?.lease && Date.parse(task.lease.expiresAt) > nowMs);
}

function transitionId(action, state) {
  if (action === 'assign') {
    if (state === 'PENDING') return 'order-task.assign.pending';
    if (state === 'BLOCKED') return 'order-task.assign.blocked';
    if (state === 'RUNNING') return 'order-task.assign.expired-running';
  }
  if (action === 'claim') {
    if (state === 'PENDING') return 'order-task.claim.pending';
    if (state === 'BLOCKED') return 'order-task.claim.blocked';
    if (state === 'RUNNING') return 'order-task.claim.expired-running';
  }
  if (action === 'report' && state === 'RUNNING') return 'order-task.report';
  if (action === 'block' && state === 'RUNNING') return 'order-task.block';
  return null;
}

function commandId(action) {
  if (['assign', 'claim', 'report', 'block'].includes(action)) return `order-task.${action}`;
  return null;
}

export function deriveOrderAggregateStatus(order) {
  if (TERMINAL_ORDERS.has(order?.status)) return order.status;
  const tasks = order?.tasks ?? [];
  if (tasks.length > 0 && tasks.every(task => task.status === 'REPORTED')) return 'REVIEW';
  if (tasks.some(task => task.status === 'BLOCKED')) return 'BLOCKED';
  if (tasks.some(task => ['RUNNING', 'REPORTED'].includes(task.status))) return 'ACTIVE';
  return 'NEW';
}

export function createOrderTaskShadow(workflow, {
  actorIds = [],
  now = () => Date.now(),
} = {}) {
  if (workflow?.workflow_id !== 'ai-core.order-task-lifecycle') {
    throw new WorkflowError('ORDER_TASK_SHADOW_WORKFLOW_REQUIRED');
  }
  const actors = new Set(actorIds);
  const engine = createWorkflowEngine(workflow);

  function context(order, task, command) {
    const nowMs = Number(now());
    const leaseActive = activeLease(task, nowMs);
    const index = order.tasks.findIndex(item => item.id === task.id);
    return {
      actor: command?.actor ? { actor_id: command.actor } : null,
      reason: command?.reason ?? null,
      facts: {
        'task.actor_valid': actors.has(command?.actor),
        'task.actor_assigned': task.assigned === command?.actor,
        'task.lease_inactive': !leaseActive,
        'task.lease_valid': task.status === 'RUNNING'
          && leaseActive
          && task.lease?.token === command?.token
          && task.assigned === command?.actor,
        'task.dependencies_reported': index >= 0
          && order.tasks.slice(0, index).every(item => item.status === 'REPORTED'),
        'task.revision_current': command?.revision === order.revision
          && task.lease?.revision === order.revision,
        'task.report_content_valid': reportContentValid(command),
        'task.reason_valid': nonempty(command?.reason, 2000),
      },
    };
  }

  function projection(order, task) {
    return {
      entity_id: `${order.id}:${task.id}`,
      revision: order.version,
      states: { lifecycle: task.status },
      order_id: order.id,
      task_id: task.id,
      requirement_revision: order.revision,
      assigned_actor: task.assigned,
      attempt: task.attempt,
      lease: task.lease ? structuredClone(task.lease) : null,
    };
  }

  function decide(order, command, { history = [] } = {}) {
    if (!order || typeof order !== 'object') return { eligible: false, code: 'ORDER_REQUIRED' };
    if (TERMINAL_ORDERS.has(order.status)) return { eligible: false, code: 'TERMINAL_ORDER' };
    if (!Number.isInteger(command?.version) || command.version !== order.version) {
      return { eligible: false, code: 'STALE_VERSION' };
    }

    if (command.action === 'heartbeat') {
      const task = order.tasks.find(item => item.id === command.taskId);
      if (!task) return { eligible: false, code: 'TASK_NOT_FOUND', kind: 'FACT_UPDATE' };
      const ctx = context(order, task, command);
      return {
        eligible: ctx.facts['task.actor_valid'] && ctx.facts['task.lease_valid'],
        code: ctx.facts['task.actor_valid'] && ctx.facts['task.lease_valid'] ? null : 'STALE_LEASE',
        kind: 'FACT_UPDATE',
        state_changed: false,
        facts: ctx.facts,
      };
    }

    const task = order.tasks.find(item => item.id === command?.taskId);
    if (!task) return { eligible: false, code: 'TASK_NOT_FOUND' };

    const transition_id = transitionId(command.action, task.status);
    const command_id = commandId(command.action);
    if (!transition_id || !command_id) return { eligible: false, code: 'TRANSITION_NOT_ALLOWED' };

    const ctx = context(order, task, command);
    try {
      const result = engine.decide({
        projection: projection(order, task),
        transition_id,
        command_id,
        command_payload: command,
        actor: ctx.actor,
        reason: ctx.reason,
        facts: ctx.facts,
        expected_revision: command.version,
        idempotency_key: command.requestId,
        history,
      });
      return {
        eligible: true,
        code: null,
        transition_id,
        command_id,
        result,
        facts: ctx.facts,
      };
    } catch (error) {
      if (error instanceof WorkflowError) {
        return {
          eligible: false,
          code: error.code === 'VERSION_MISMATCH' ? 'STALE_VERSION' : error.code,
          reasons: error.details?.reasons ?? [],
          transition_id,
          command_id,
          facts: ctx.facts,
        };
      }
      throw error;
    }
  }

  function decideInvalidation(order, task, {
    requestId,
    version = order?.version,
    reason,
  } = {}) {
    if (TERMINAL_ORDERS.has(order?.status)) return { eligible: false, code: 'TERMINAL_ORDER' };
    if (!task) return { eligible: false, code: 'TASK_NOT_FOUND' };
    const command = {
      requestId,
      version,
      action: 'invalidate',
      taskId: task.id,
      reason,
    };
    const ctx = context(order, task, command);
    try {
      const result = engine.decide({
        projection: projection(order, task),
        transition_id: 'order-task.invalidate',
        command_id: 'order-task.invalidate',
        command_payload: command,
        actor: { actor_id: 'user' },
        reason,
        facts: ctx.facts,
        expected_revision: version,
        idempotency_key: requestId,
      });
      return { eligible: true, code: null, result, facts: ctx.facts };
    } catch (error) {
      if (error instanceof WorkflowError) {
        return { eligible: false, code: error.code, reasons: error.details?.reasons ?? [], facts: ctx.facts };
      }
      throw error;
    }
  }

  return Object.freeze({
    decide,
    decideInvalidation,
    deriveOrderAggregateStatus,
    workflow_id: workflow.workflow_id,
    workflow_version: workflow.version,
  });
}

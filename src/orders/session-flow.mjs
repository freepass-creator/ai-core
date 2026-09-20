import { randomUUID } from 'node:crypto';
import { actors } from './store.mjs';

const activeLease = (task, now) => task.lease && Date.parse(task.lease.expiresAt) > now;

export function availableTasks(orders, actor, { now = Date.now() } = {}) {
  const candidates = [];
  for (const order of orders) {
    if (['CLOSED', 'CANCELLED'].includes(order.status)) continue;
    for (let index = 0; index < order.tasks.length; index++) {
      const task = order.tasks[index];
      if (task.assigned !== actor || task.status === 'REPORTED' || activeLease(task, now)) continue;
      if (!order.tasks.slice(0, index).every(item => item.status === 'REPORTED')) continue;
      candidates.push({ order, task, index });
    }
  }
  return candidates.sort((a, b) =>
    a.order.createdAt.localeCompare(b.order.createdAt)
    || a.order.id.localeCompare(b.order.id)
    || a.index - b.index
  );
}

export async function inspectNextTask(client, actor, options = {}) {
  if (!actors.some(item => item.id === actor)) throw Object.assign(new Error('지원하는 AI를 선택하세요.'), { code: 'INVALID_ACTOR' });
  const [candidate] = availableTasks(await client.list(), actor, options);
  if (!candidate) return { status: 'NO_AVAILABLE_TASK', actor };
  return {
    status: 'AVAILABLE',
    actor,
    orderId: candidate.order.id,
    taskId: candidate.task.id,
    orderVersion: candidate.order.version,
    requirementRevision: candidate.order.revision,
    packet: await client.packet(candidate.order.id, candidate.task.id),
  };
}

export async function claimNextTask(client, actor, { requestId = randomUUID(), now = Date.now(), maxRefreshes = 3 } = {}) {
  if (!actors.some(item => item.id === actor)) throw Object.assign(new Error('지원하는 AI를 선택하세요.'), { code: 'INVALID_ACTOR' });
  for (let attempt = 0; attempt <= maxRefreshes; attempt++) {
    const orders = await client.list();
    const owned = orders.flatMap(order => order.tasks.map(task => ({ order, task })))
      .find(({ task }) => task.assigned === actor && task.status === 'RUNNING' && activeLease(task, now));
    if (owned) return {
      status: 'ALREADY_CLAIMED', actor, orderId: owned.order.id, taskId: owned.task.id,
      orderVersion: owned.order.version, requirementRevision: owned.order.revision,
      lease: owned.task.lease,
      packet: await client.packet(owned.order.id, owned.task.id),
    };
    const [candidate] = availableTasks(orders, actor, { now });
    if (!candidate) return { status: 'NO_AVAILABLE_TASK', actor };
    try {
      const order = await client.mutate(candidate.order.id, {
        requestId: `${requestId}:${candidate.order.id}:${candidate.task.id}`,
        version: candidate.order.version,
        action: 'claim',
        taskId: candidate.task.id,
        actor,
      });
      const task = order.tasks.find(item => item.id === candidate.task.id);
      let packet;
      try { packet = await client.packet(order.id, task.id); }
      catch (cause) {
        const error = new Error(`작업은 확보됐지만 세션 패킷을 읽지 못했습니다: ${order.id}/${task.id}`);
        error.code = 'CLAIMED_PACKET_UNAVAILABLE'; error.cause = cause;
        throw error;
      }
      return {
        status: 'CLAIMED', actor, orderId: order.id, taskId: task.id,
        orderVersion: order.version, requirementRevision: order.revision,
        lease: task.lease,
        packet,
      };
    } catch (error) {
      if (!['STALE_VERSION', 'ACTIVE_LEASE', 'DEPENDENCY_PENDING'].includes(error.code)) throw error;
    }
  }
  return { status: 'RETRY_REQUIRED', actor, reason: 'CONCURRENT_ORDER_CHANGES' };
}

export function sessionPackMarkdown(packet) {
  return `# AI Core work session\n\n` +
    `This packet is intake coordination only. It does not authorize execution, deployment, sending, payment, deletion, access changes or canonical completion. Re-read the central order before reporting.\n\n` +
    `## Start here\n\n` +
    `Continue the assigned task below. Preserve the order ID, requirement revision and task ID. If any of them changed, stop and report HOLD instead of reusing this packet.\n\n` +
    `## Work packet\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\`\n\n` +
    `## Return\n\nReport a short summary, evidence references, tests run, tests not run, blockers, and the exact repository commit when applicable. Do not include credentials, customer data, lease tokens or unrelated source material.\n`;
}

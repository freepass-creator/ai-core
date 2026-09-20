import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
import { readConnectionPolicy } from './client.mjs';
import { OrderStore, OrderError, actors, defaultDb } from './store.mjs';
import { createWorkProjectionProvider } from '../integration/order-work-sources.mjs';
import { routeWork, validateWorkMap } from '../routing/work-router.mjs';
import { createCapabilityEngine } from '../engine/capability-engine.mjs';
import { createOrderWorkIntakeCoordinator } from '../integration/order-work-intake-coordinator.mjs';
import { openOperatingCapabilityEngine } from '../engine/operating-engine.mjs';
import { createCapabilityExecutionCoordinator } from '../engine/capability-execution-coordinator.mjs';

let defaultRoutingConfigPromise;
async function defaultRoutingConfig() {
  if (!defaultRoutingConfigPromise) {
    defaultRoutingConfigPromise = Promise.all([
      readFile(new URL('../../registry/work-map.json', import.meta.url), 'utf8'),
      readFile(new URL('../../registry/projects.json', import.meta.url), 'utf8'),
      readFile(new URL('../../registry/capabilities.json', import.meta.url), 'utf8'),
    ]).then(([workMap, projectRegistry, capabilityRegistry]) => ({
      workMap: JSON.parse(workMap),
      projectRegistry: JSON.parse(projectRegistry),
      capabilityRegistry: JSON.parse(capabilityRegistry),
    }));
  }
  return defaultRoutingConfigPromise;
}

function storedCapabilityRoute(order) {
  const r = order?.routing;
  if (!r) return null;
  return {
    status: r.status,
    work_type_id: r.work_type_id,
    capability_id: r.capability_id,
    target_project_id: r.target_project_id,
    target_revision: r.target_revision,
  };
}

function capabilityPlan(order, config, { readWorkProjection = null } = {}) {
  if (!order?.routing) return { status:'HOLD', reason:'ROUTING_PROVENANCE_REQUIRED', order_id:order?.id ?? null };
  if (order.routing.requirement_revision !== order.revision) {
    return { status:'HOLD', reason:'ROUTING_REQUIREMENT_STALE', order_id:order.id,
      routed_requirement_revision:order.routing.requirement_revision, current_requirement_revision:order.revision };
  }
  const route = storedCapabilityRoute(order);
  const engine = createCapabilityEngine({
    capabilityRegistry: config.capabilityRegistry,
    projectRegistry: config.projectRegistry,
    readWorkProjection,
  });
  return engine.plan({ route, orderId: order.id });
}

function routingSnapshot(routed) {
  return {
    status: routed.status,
    work_type_id: routed.work_type_id,
    capability_id: routed.capability_id,
    target_project_id: routed.target_project_id,
    target_revision: routed.target_revision,
    project_status: routed.project_status ?? null,
    capability_status: routed.capability_status ?? null,
    capability_mode: routed.capability_mode ?? null,
    matched_alias: routed.matched_alias ?? null,
    blockers: [...(routed.blockers ?? (routed.reason ? [routed.reason] : []))],
    requirement_revision: 1,
  };
}

const assets = new Map([
  ['/', ['../../web/orders/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['../../web/orders/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['../../web/orders/style.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['../../design-system/tokens.css', 'text/css; charset=utf-8']],
]);
export function startServer({
  dbPath = defaultDb,
  port = 4318,
  expectedLedgerId = null,
  standalone = false,
  readWorkProjection = null,
  workSources = null,
  routingConfig = null,
  capabilityExecutionEnabled = false,
  executorIdentity = null,
  capabilityRuntime = null,
} = {}) {
  if ((!expectedLedgerId && !standalone) || (expectedLedgerId && standalone)) throw new OrderError('SERVER_MODE_REQUIRED', '공유 원장 ID 또는 명시적인 standalone 모드가 필요합니다.');
  const store = new OrderStore(dbPath);
  const ledgerId = store.ledgerId();
  if (expectedLedgerId && ledgerId !== expectedLedgerId) { store.close(); throw new OrderError('LEDGER_MISMATCH', '지정한 DB는 중앙 원장이 아닙니다. 원본 이관과 원장 ID를 확인하세요.'); }
  // An explicitly injected provider wins, so tests keep their existing seam.
  // Otherwise build the read-only provider over THIS server's store, so the order
  // the adapter re-reads is the same record the endpoint compared versions on.
  if (!readWorkProjection && workSources) readWorkProjection = createWorkProjectionProvider({ store, workSources, ordersDbPath: dbPath });
  const workIntake = workSources ? createOrderWorkIntakeCoordinator({ store, workSources, ordersDbPath: dbPath }) : null;

  let operatingCapabilityPromise = null;
  async function operatingCapability() {
    if (!operatingCapabilityPromise) {
      operatingCapabilityPromise = (async () => {
        const config = routingConfig ?? await defaultRoutingConfig();
        const operating = await openOperatingCapabilityEngine({
          store,
          workSources,
          ordersDbPath: dbPath,
          capabilityRegistry: config.capabilityRegistry,
          projectRegistry: config.projectRegistry,
          ...(capabilityRuntime ? { runtime: capabilityRuntime } : {}),
          executorIdentity,
        });
        const execution = createCapabilityExecutionCoordinator({
          store,
          projectRegistry: config.projectRegistry,
        });
        return { config, operating, execution };
      })();
    }
    return operatingCapabilityPromise;
  }

  const server = createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      res.setHeader('X-AI-Core-Ledger-Id', ledgerId);
      const actualPort = server.address().port;
      const hosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
      if (!hosts.includes(req.headers.host)) throw new OrderError('HOST_DENIED', '로컬 주소로 접속하세요.', 403);
      if (req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin)) throw new OrderError('ORIGIN_DENIED', '다른 사이트에서의 요청은 허용하지 않습니다.', 403);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      const url = new URL(req.url, `http://${req.headers.host}`);
      const expected = req.headers['x-ai-core-expected-ledger'];
      if (expected && expected !== ledgerId) throw new OrderError('LEDGER_MISMATCH', '요청한 중앙 원장과 현재 원장이 다릅니다.', 409);
      if (expectedLedgerId && req.method === 'POST' && expected !== ledgerId) throw new OrderError('LEDGER_PIN_REQUIRED', '쓰기 전에 중앙 원장 ID를 확인해야 합니다.', 409);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [path, type] = assets.get(url.pathname); res.writeHead(200, { 'Content-Type': type }); res.end(await readFile(new URL(path, import.meta.url))); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/meta') return json(200, { ...store.settings(), actors, ledgerId, mode: expectedLedgerId ? 'SHARED_PRIVATE_SERVICE' : 'STANDALONE_EXPERIMENT' });
      if (req.method === 'GET' && url.pathname === '/api/route') {
        const query = url.searchParams.get('q') ?? '';
        if (query.length > 1000) throw new OrderError('QUERY_TOO_LARGE', '업무 요청이 너무 깁니다.', 413);
        const config = routingConfig ?? await defaultRoutingConfig();
        const validation = validateWorkMap(config.workMap, config.projectRegistry, config.capabilityRegistry);
        if (validation.status !== 'VALID') return json(503, { status: 'HOLD', reason: 'WORK_MAP_INVALID', errors: validation.errors });
        return json(200, routeWork(query, config));
      }
      if (req.method === 'GET' && url.pathname === '/api/orders') return json(200, store.list());

      const capabilityMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/capability$/);
      if (req.method === 'GET' && capabilityMatch) {
        const order = store.get(capabilityMatch[1]);
        const config = routingConfig ?? await defaultRoutingConfig();
        const validation = validateWorkMap(config.workMap, config.projectRegistry, config.capabilityRegistry);
        if (validation.status !== 'VALID') return json(503, { status:'HOLD', reason:'WORK_MAP_INVALID', errors:validation.errors });
        return json(200, capabilityPlan(order, config, { readWorkProjection }));
      }

      const capabilityRunMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/capability\/run$/);
      const capabilityResultsMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/capability\/results$/);
      if (req.method === 'GET' && capabilityResultsMatch) {
        const { execution } = await operatingCapability();
        store.get(capabilityResultsMatch[1]);
        return json(200, execution.list(capabilityResultsMatch[1]));
      }

      const projectionMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/work$/);
      if (req.method === 'GET' && projectionMatch) {
        const before = store.get(projectionMatch[1]);
        const unavailable = { status: 'HOLD', reason: 'DURABLE_MAPPING_OUTBOX_UNAVAILABLE', execution_authorized: false, completion_authorized: false, sent: false };
        if (!readWorkProjection) return json(200, unavailable);
        try {
          const result = await readWorkProjection(projectionMatch[1]);
          const after = store.get(projectionMatch[1]);
          const mapping = (result?.projection ?? result)?.mapping;
          if (before.version !== after.version || (mapping && (mapping.order_id !== after.id || mapping.requirement_revision !== after.revision || mapping.record_version !== after.version))) {
            return json(200, { ...unavailable, reason: 'PROJECTION_VERSION_CHANGED' });
          }
          return json(200, result ?? { ...unavailable, reason: 'CANONICAL_READ_FAILED' });
        }
        catch { return json(200, { ...unavailable, reason: 'CANONICAL_READ_FAILED' }); }
      }
      const rerouteMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/reroute$/);
      const workIntakeMatch = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)\/work-intake$/);
      const match = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)(?:\/(packet|check-context))?$/);
      if (req.method === 'GET' && match) return json(200, match[2] === 'packet' ? store.packet(match[1], url.searchParams.get('task')) : match[2] === 'check-context' ? store.checkContext(match[1], url.searchParams.get('task')) : { order: store.get(match[1]), events: store.events(match[1]) });
      if (req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new OrderError('JSON_REQUIRED', 'JSON 요청만 허용합니다.', 415);
        const chunks = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 128 * 1024) throw new OrderError('BODY_TOO_LARGE', '요청이 너무 큽니다.', 413); chunks.push(chunk); }
        const body = Buffer.concat(chunks).toString('utf8');
        let data; try { data = JSON.parse(body); } catch { throw new OrderError('INVALID_JSON', '요청 형식을 확인하세요.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new OrderError('INVALID_INPUT', '객체가 필요합니다.');
        if (url.pathname === '/api/orders') {
          if (typeof data.project !== 'string' || !data.project.trim()) {
            const config = routingConfig ?? await defaultRoutingConfig();
            const validation = validateWorkMap(config.workMap, config.projectRegistry, config.capabilityRegistry);
            if (validation.status !== 'VALID') throw new OrderError('WORK_MAP_INVALID', '업무 지도를 확인해야 합니다.', 503);
            const routed = routeWork(`${data.title ?? ''} ${data.intent ?? ''}`, config);
            if (['UNKNOWN','AMBIGUOUS','HOLD_PROJECT_UNKNOWN','HOLD_CAPABILITY_UNKNOWN'].includes(routed.status) || !routed.target_project_id || !routed.capability_id || !routed.target_revision) {
              throw new OrderError('PROJECT_ROUTE_HOLD', `업무 경로를 확정하지 못했습니다: ${routed.status}`, 409);
            }
            /** 접수와 실행을 분리한다. project/capability가 HOLD여도 분류가 확정되면 오더는 남긴다.
             * 실제 실행 가능 여부는 routing.status와 Capability Engine이 fail-closed로 판단한다. */
            data = { ...data, project: routed.target_project_id, routing: routingSnapshot(routed) };
          }
          return json(200, store.create(data));
        }
        if (workIntakeMatch) {
          if (!workIntake) return json(200, { status:'HOLD', reason:'WORK_SOURCES_UNCONFIGURED', execution_authorized:false, completion_authorized:false });
          const result = await workIntake.intake(workIntakeMatch[1]);
          let projection = null;
          if (result.status === 'WORK_LINKED' && readWorkProjection) {
            try { projection = await readWorkProjection(workIntakeMatch[1]); }
            catch { projection = { status:'HOLD', reason:'CANONICAL_READ_FAILED', execution_authorized:false, completion_authorized:false, sent:false }; }
          }
          return json(200, { ...result, projection });
        }
        if (capabilityRunMatch) {
          if (!capabilityExecutionEnabled) {
            return json(423, { status:'HOLD', reason:'CAPABILITY_EXECUTION_DISABLED', execution_authorized:false });
          }
          if (data.perform !== true) throw new OrderError('PERFORM_CONFIRMATION_REQUIRED', '실행 요청은 perform:true가 필요합니다.', 400);
          if (typeof data.requestId !== 'string' || !data.requestId.trim()) throw new OrderError('REQUEST_ID_REQUIRED', '실행 requestId가 필요합니다.', 400);
          if (data.input !== undefined && (!data.input || typeof data.input !== 'object' || Array.isArray(data.input))) {
            throw new OrderError('INVALID_INPUT', 'capability input은 객체여야 합니다.');
          }

          const { config, operating, execution } = await operatingCapability();
          let recovered;
          try {
            recovered = execution.recover({
              requestId:data.requestId,
              orderId:capabilityRunMatch[1],
              input:data.input ?? {},
              perform:true,
            });
          } catch (error) {
            if (error?.message === 'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT') {
              throw new OrderError('CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT', '같은 실행 requestId에 다른 내용이 들어왔습니다.', 409);
            }
            throw error;
          }
          if (recovered?.status === 'RESULT') {
            if (!recovered.result) return json(409, { status:'HOLD', reason:'CAPABILITY_EXECUTION_RESULT_MISSING', execution_authorized:false });
            return json(200, recovered.result);
          }
          if (recovered?.status === 'RESERVED') {
            const recoveryCapability = config.capabilityRegistry.capabilities.find(item => item.id === recovered.row?.capability_id) ?? null;
            const reconciled = await execution.reconcile(data.requestId, recoveryCapability);
            if (reconciled.status === 'RESULT') return json(200, reconciled.result);
            return json(409, reconciled);
          }

          const order = store.get(capabilityRunMatch[1]);
          const validation = validateWorkMap(config.workMap, config.projectRegistry, config.capabilityRegistry);
          if (validation.status !== 'VALID') throw new OrderError('WORK_MAP_INVALID', '업무 지도를 확인해야 합니다.', 503);
          if (!order.routing || order.routing.requirement_revision !== order.revision) {
            return json(409, { status:'HOLD', reason:'ROUTING_REQUIREMENT_STALE' });
          }
          if (!operating.readWorkProjection) return json(409, { status:'HOLD', reason:'WORK_SOURCES_UNCONFIGURED' });

          const projection = await operating.readWorkProjection(order.id);
          if (projection?.status !== 'LINKED' || !projection.mapping?.work_id) {
            return json(409, { status:'HOLD', reason:projection?.reason ?? 'WORK_LINK_REQUIRED' });
          }
          const workId = projection.mapping.work_id;
          const route = storedCapabilityRoute(order);
          const plan = operating.engine.plan({ route, orderId:order.id, workId });
          if (plan.status !== 'PLANNED') return json(409, plan);

          const capability = config.capabilityRegistry.capabilities.find(item => item.id === plan.capability_id);
          if (!capability) return json(409, { status:'HOLD', reason:'CAPABILITY_NOT_REGISTERED' });

          let reserved;
          try {
            reserved = await execution.reserve({
              requestId:data.requestId,
              orderId:order.id,
              workId,
              capability,
              input:data.input ?? {},
              perform:true,
            });
          } catch (error) {
            if (error?.message === 'CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT') {
              throw new OrderError('CAPABILITY_EXECUTION_IDEMPOTENCY_CONFLICT', '같은 실행 requestId에 다른 내용이 들어왔습니다.', 409);
            }
            throw error;
          }
          if (reserved.replay) {
            if (reserved.status === 'RESULT' && reserved.result) return json(200, reserved.result);
            const reconciled = await execution.reconcile(data.requestId, capability);
            if (reconciled.status === 'RESULT') return json(200, reconciled.result);
            return json(409, reconciled);
          }

          const result = await operating.engine.run({
            route,
            orderId:order.id,
            workId,
            requestId:data.requestId,
            input:data.input ?? {},
            perform:true,
          });
          const durable = execution.complete(data.requestId, result);
          return json(200, durable);
        }
        if (rerouteMatch) {
          const order = store.get(rerouteMatch[1]);
          const config = routingConfig ?? await defaultRoutingConfig();
          const validation = validateWorkMap(config.workMap, config.projectRegistry, config.capabilityRegistry);
          if (validation.status !== 'VALID') throw new OrderError('WORK_MAP_INVALID', '업무 지도를 확인해야 합니다.', 503);
          const routed = routeWork(`${order.title} ${order.intent}`, config);
          if (['UNKNOWN','AMBIGUOUS','HOLD_PROJECT_UNKNOWN','HOLD_CAPABILITY_UNKNOWN'].includes(routed.status)
              || !routed.target_project_id || !routed.capability_id || !routed.target_revision) {
            throw new OrderError('PROJECT_ROUTE_HOLD', `업무 경로를 다시 확정하지 못했습니다: ${routed.status}`, 409);
          }
          const snapshot = { ...routingSnapshot(routed), requirement_revision: order.revision };
          return json(200, store.mutate(order.id, {
            requestId: data.requestId,
            version: data.version,
            action: 'reroute',
            routing: snapshot,
          }));
        }
        if (match && !match[2]) return json(200, store.mutate(match[1], data));
        if (url.pathname === '/api/name') return json(200, store.name(data.name));
      }
      json(404, { error: 'NOT_FOUND', message: '페이지를 찾을 수 없습니다.' });
    } catch (e) { json(e.status ?? 500, { error: e.code ?? 'INTERNAL_ERROR', message: e instanceof OrderError ? e.message : '처리하지 못했습니다. 서버와 원장 상태를 확인하세요.' }); }
  });
  server.on('close', () => store.close());
  return new Promise((resolvePromise, reject) => {
    server.once('error', error => { store.close(); reject(error); });
    server.listen(port, '127.0.0.1', () => resolvePromise({ server, store, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (key, fallback) => { const index = args.indexOf(key); return index < 0 ? fallback : args[index + 1]; };
  const port = Number(option('--port', 4318));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const standalone = args.includes('--standalone');
  const dbPath = option('--db', process.env.AI_CORE_ORDERS_DB);
  if (!standalone && (!dbPath || !isAbsolute(dbPath))) throw new Error('공유 서버는 --db 절대경로 또는 AI_CORE_ORDERS_DB가 필요합니다. 독립 실험만 --standalone을 사용하세요.');
  const expectedLedgerId = standalone ? null : readConnectionPolicy().ledgerId;
  if (!standalone && !expectedLedgerId) throw new Error('중앙 원장 ID가 설정되지 않았습니다.');
  const capabilityExecutionEnabled = args.includes('--enable-capability-execution');
  const executorIdentity = option('--executor', process.env.AI_CORE_EXECUTOR ?? null);
  // Fill the `readWorkProjection` socket that has been open and empty since it was
  // added: the endpoint answered HOLD for every order no matter what the canonical
  // sources said. `workSources` is operator configuration, so an unconfigured
  // server behaves exactly as before.
  const { server, url } = await startServer({
    dbPath: dbPath ?? defaultDb,
    port,
    expectedLedgerId,
    standalone,
    workSources: standalone ? null : readConnectionPolicy().workSources ?? null,
    capabilityExecutionEnabled,
    executorIdentity,
  });
  console.log(`AI Core order desk: ${url}\n${standalone ? 'Standalone experiment' : 'Shared private ledger'}; loopback only, use SSH for remote access.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

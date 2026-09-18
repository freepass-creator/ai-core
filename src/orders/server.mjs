import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, isAbsolute } from 'node:path';
import { readConnectionPolicy } from './client.mjs';
import { OrderStore, OrderError, actors, defaultDb } from './store.mjs';
import { createWorkProjectionProvider } from '../integration/order-work-sources.mjs';
import { routeWork, validateWorkMap } from '../routing/work-router.mjs';

let defaultRoutingConfigPromise;
async function defaultRoutingConfig() {
  if (!defaultRoutingConfigPromise) {
    defaultRoutingConfigPromise = Promise.all([
      readFile(new URL('../../registry/work-map.json', import.meta.url), 'utf8'),
      readFile(new URL('../../registry/projects.json', import.meta.url), 'utf8'),
    ]).then(([workMap, projectRegistry]) => ({
      workMap: JSON.parse(workMap),
      projectRegistry: JSON.parse(projectRegistry),
    }));
  }
  return defaultRoutingConfigPromise;
}

const assets = new Map([
  ['/', ['../../web/orders/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['../../web/orders/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['../../web/orders/style.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['../../design-system/tokens.css', 'text/css; charset=utf-8']],
]);
export function startServer({ dbPath = defaultDb, port = 4318, expectedLedgerId = null, standalone = false, readWorkProjection = null, workSources = null, routingConfig = null } = {}) {
  if ((!expectedLedgerId && !standalone) || (expectedLedgerId && standalone)) throw new OrderError('SERVER_MODE_REQUIRED', '공유 원장 ID 또는 명시적인 standalone 모드가 필요합니다.');
  const store = new OrderStore(dbPath);
  const ledgerId = store.ledgerId();
  if (expectedLedgerId && ledgerId !== expectedLedgerId) { store.close(); throw new OrderError('LEDGER_MISMATCH', '지정한 DB는 중앙 원장이 아닙니다. 원본 이관과 원장 ID를 확인하세요.'); }
  // An explicitly injected provider wins, so tests keep their existing seam.
  // Otherwise build the read-only provider over THIS server's store, so the order
  // the adapter re-reads is the same record the endpoint compared versions on.
  if (!readWorkProjection && workSources) readWorkProjection = createWorkProjectionProvider({ store, workSources, ordersDbPath: dbPath });
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
        const validation = validateWorkMap(config.workMap, config.projectRegistry);
        if (validation.status !== 'VALID') return json(503, { status: 'HOLD', reason: 'WORK_MAP_INVALID', errors: validation.errors });
        return json(200, routeWork(query, config));
      }
      if (req.method === 'GET' && url.pathname === '/api/orders') return json(200, store.list());
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
      const match = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)(?:\/(packet|check-context))?$/);
      if (req.method === 'GET' && match) return json(200, match[2] === 'packet' ? store.packet(match[1], url.searchParams.get('task')) : match[2] === 'check-context' ? store.checkContext(match[1], url.searchParams.get('task')) : { order: store.get(match[1]), events: store.events(match[1]) });
      if (req.method === 'POST') {
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new OrderError('JSON_REQUIRED', 'JSON 요청만 허용합니다.', 415);
        const chunks = []; let bytes = 0;
        for await (const chunk of req) { bytes += chunk.length; if (bytes > 128 * 1024) throw new OrderError('BODY_TOO_LARGE', '요청이 너무 큽니다.', 413); chunks.push(chunk); }
        const body = Buffer.concat(chunks).toString('utf8');
        let data; try { data = JSON.parse(body); } catch { throw new OrderError('INVALID_JSON', '요청 형식을 확인하세요.'); }
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new OrderError('INVALID_INPUT', '객체가 필요합니다.');
        if (url.pathname === '/api/orders') return json(200, store.create(data));
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
  // Fill the `readWorkProjection` socket that has been open and empty since it was
  // added: the endpoint answered HOLD for every order no matter what the canonical
  // sources said. `workSources` is operator configuration, so an unconfigured
  // server behaves exactly as before.
  const { server, url } = await startServer({ dbPath: dbPath ?? defaultDb, port, expectedLedgerId, standalone,
    workSources: standalone ? null : readConnectionPolicy().workSources ?? null });
  console.log(`AI Core order desk: ${url}\n${standalone ? 'Standalone experiment' : 'Shared private ledger'}; loopback only, use SSH for remote access.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

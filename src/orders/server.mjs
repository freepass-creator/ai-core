import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { OrderStore, OrderError, actors, defaultDb } from './store.mjs';

const assets = new Map([
  ['/', ['../../web/orders/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['../../web/orders/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['../../web/orders/style.css', 'text/css; charset=utf-8']],
  ['/tokens.css', ['../../design-system/tokens.css', 'text/css; charset=utf-8']],
]);
export function startServer({ dbPath = defaultDb, port = 4318 } = {}) {
  const store = new OrderStore(dbPath);
  const server = createServer(async (req, res) => {
    const json = (status, data) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); };
    try {
      const actualPort = server.address().port;
      const hosts = [`127.0.0.1:${actualPort}`, `localhost:${actualPort}`];
      if (!hosts.includes(req.headers.host)) throw new OrderError('HOST_DENIED', '로컬 주소로 접속하세요.', 403);
      if (req.headers.origin && !hosts.map(h => `http://${h}`).includes(req.headers.origin)) throw new OrderError('ORIGIN_DENIED', '다른 사이트에서의 요청은 허용하지 않습니다.', 403);
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [path, type] = assets.get(url.pathname); res.writeHead(200, { 'Content-Type': type }); res.end(await readFile(new URL(path, import.meta.url))); return;
      }
      if (req.method === 'GET' && url.pathname === '/api/meta') return json(200, { ...store.settings(), actors, mode: 'LOCAL_MANUAL_HANDOFF' });
      if (req.method === 'GET' && url.pathname === '/api/orders') return json(200, store.list());
      const match = url.pathname.match(/^\/api\/orders\/(ORD-[a-f0-9-]+)(?:\/(packet))?$/);
      if (req.method === 'GET' && match) return json(200, match[2] ? store.packet(match[1], url.searchParams.get('task')) : { order: store.get(match[1]), events: store.events(match[1]) });
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
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolvePromise({ server, store, url: `http://127.0.0.1:${server.address().port}` }));
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (key, fallback) => { const index = args.indexOf(key); return index < 0 ? fallback : args[index + 1]; };
  const port = Number(option('--port', 4318));
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
  const { server, url } = await startServer({ dbPath: option('--db', defaultDb), port });
  console.log(`AI Core order desk: ${url}\nLocal manual handoff; no automatic external execution.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
}

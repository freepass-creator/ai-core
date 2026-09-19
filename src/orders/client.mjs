import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const policyPath = fileURLToPath(new URL('../../orders.connection.json', import.meta.url));
export const localConnectionPath = fileURLToPath(new URL('../../.local/order-client.json', import.meta.url));
export class ClientError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
export function validateEndpoint(value) {
  let url; try { url = new URL(value); } catch { throw new ClientError('INVALID_ENDPOINT', '중앙 원장 접속 주소를 확인하세요.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new ClientError('PRIVATE_TRANSPORT_REQUIRED', '현재 원격 연결은 SSH 터널의 로컬 HTTP 주소만 지원합니다. 공개 인터넷에 원장을 노출하지 마세요.');
  }
  return url.origin;
}
const readJson = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
export function readConnectionPolicy(path = policyPath) {
  const policy = readJson(path);
  if (policy.schema !== 'ai-core-connection/v1' || policy.mode !== 'shared-required' || policy.transport !== 'ssh-loopback' || !/^ledger-[a-f0-9-]{36}$/.test(policy.ledgerId ?? '')) throw new ClientError('INVALID_CONNECTION_POLICY', '공유 원장 연결 규격이 올바르지 않습니다.');
  return policy;
}
export function connectionOptions({ endpoint, ledgerId, env = process.env, policyFile = policyPath, localFile = localConnectionPath } = {}) {
  const policy = readConnectionPolicy(policyFile);
  const local = !endpoint && !env.AI_CORE_ORDERS_URL && existsSync(localFile) ? readJson(localFile) : {};
  const url = endpoint ?? env.AI_CORE_ORDERS_URL ?? local.endpoint;
  const expectedLedgerId = ledgerId ?? policy.ledgerId;
  if (local.ledgerId && local.ledgerId !== expectedLedgerId) throw new ClientError('LEDGER_MISMATCH', '저장된 장치 연결과 중앙 원장 정책이 다릅니다. 확인 후 connect로 다시 연결하세요.');
  if (!url) throw new ClientError('SHARED_ENDPOINT_REQUIRED', '중앙 원장 주소가 없습니다. orders connect URL을 실행하거나 AI_CORE_ORDERS_URL을 지정하세요. 독립 실험 원장은 --local로만 엽니다.');
  if (!/^ledger-[a-f0-9-]{36}$/.test(expectedLedgerId ?? '')) throw new ClientError('LEDGER_PIN_REQUIRED', '검증된 중앙 원장 ID를 지정해야 합니다.');
  return { endpoint: validateEndpoint(url), ledgerId: expectedLedgerId };
}
export class RemoteOrderClient {
  constructor({ endpoint, ledgerId, timeoutMs = 10000, fetchImpl = fetch }) {
    this.endpoint = validateEndpoint(endpoint);
    if (!/^ledger-[a-f0-9-]{36}$/.test(ledgerId ?? '')) throw new ClientError('LEDGER_PIN_REQUIRED', '중앙 원장 ID가 필요합니다.');
    this.ledgerId = ledgerId; this.timeoutMs = timeoutMs; this.fetch = fetchImpl;
  }
  async request(path, body) {
    let response;
    try {
      response = await this.fetch(`${this.endpoint}${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs),
        headers: { 'X-AI-Core-Expected-Ledger': this.ledgerId, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new ClientError('CENTRAL_UNAVAILABLE', '중앙 원장 응답을 확인할 수 없습니다. 로컬 원장으로 대체하지 않았습니다. 쓰기 요청은 같은 requestId로 재조회·재전송하세요.');
    }
    if (response.headers.get('x-ai-core-ledger-id') !== this.ledgerId) throw new ClientError('LEDGER_MISMATCH', '응답한 원장이 지정된 중앙 원장과 다릅니다. 연결을 확인하세요.');
    let data; try { data = await response.json(); } catch { throw new ClientError('INVALID_RESPONSE', '중앙 응답을 해석하지 못했습니다. 처리 여부를 확인한 뒤 같은 요청을 재전송하세요.'); }
    if (!response.ok) throw new ClientError(data.error ?? 'CENTRAL_ERROR', data.message ?? '중앙 원장이 요청을 거부했습니다.');
    return data;
  }
  meta() { return this.request('/api/meta'); }
  list() { return this.request('/api/orders'); }
  show(id) { return this.request(`/api/orders/${encodeURIComponent(id)}`); }
  async get(id) { return (await this.show(id)).order; }
  async events(id) { return (await this.show(id)).events; }
  create(input) { return this.request('/api/orders', input); }
  mutate(id, command) { return this.request(`/api/orders/${encodeURIComponent(id)}`, command); }
  packet(id, taskId) { return this.request(`/api/orders/${encodeURIComponent(id)}/packet?task=${encodeURIComponent(taskId)}`); }
  checkContext(id, taskId) { return this.request(`/api/orders/${encodeURIComponent(id)}/check-context?task=${encodeURIComponent(taskId)}`); }
  workProjection(id) { return this.request(`/api/orders/${encodeURIComponent(id)}/work`); }
  workIntake(id) { return this.request(`/api/orders/${encodeURIComponent(id)}/work-intake`, {}); }
  capabilityPlan(id) { return this.request(`/api/orders/${encodeURIComponent(id)}/capability`); }
  runCapability(id, command) { return this.request(`/api/orders/${encodeURIComponent(id)}/capability/run`, command); }
  capabilityResults(id) { return this.request(`/api/orders/${encodeURIComponent(id)}/capability/results`); }
  reroute(id, command) { return this.request(`/api/orders/${encodeURIComponent(id)}/reroute`, command); }
  name(name) { return this.request('/api/name', { name }); }
}

import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCapabilityEngine } from './capability-engine.mjs';
import { createControlTowerAuthorityBridge } from './control-tower-authority.mjs';
import { createWorkProjectionProvider, createWorkSourceContextProvider } from '../integration/order-work-sources.mjs';
import { verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { runControlTower } from '../../scripts/run-control-tower.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readJson = path => readFile(resolve(root, path), 'utf8').then(JSON.parse);

/**
 * 운영 호스트용 단일 배선점.
 *
 * - route/plan은 Git에 있는 capability + project registry를 사용한다.
 * - work projection과 external authority 검증은 동일한 workSources trusted context를 사용한다.
 * - workSources가 없으면 읽기 projection은 HOLD, external mutation은 verifier 부재로 HOLD한다.
 * - 외부 실행 권한을 이 factory가 만들지 않는다.
 */
export async function openOperatingCapabilityEngine({
  store,
  workSources = null,
  ordersDbPath = null,
  capabilityRegistry = null,
  projectRegistry = null,
  runtime,
  clock,
  executorIdentity = process.env.AI_CORE_EXECUTOR ?? null,
} = {}) {
  const [caps, projects] = await Promise.all([
    capabilityRegistry ? Promise.resolve(capabilityRegistry) : readJson('registry/capabilities.json'),
    projectRegistry ? Promise.resolve(projectRegistry) : readJson('registry/projects.json'),
  ]);

  const readContext = createWorkSourceContextProvider({ store, workSources, ordersDbPath });
  const readWorkProjection = createWorkProjectionProvider({ store, workSources, ordersDbPath });
  const authorityBridge = readContext
    ? createControlTowerAuthorityBridge({ readContext, verifyLedgerText, runControlTower })
    : null;

  const engine = createCapabilityEngine({
    capabilityRegistry: caps,
    projectRegistry: projects,
    ...(runtime ? { runtime } : {}),
    ...(clock ? { clock } : {}),
    readWorkProjection,
    executorIdentity,
    verifyAuthority: authorityBridge?.verify ?? null,
    authorityProvider: authorityBridge?.issue ?? null,
  });

  return Object.freeze({
    engine,
    readWorkProjection,
    verifyAuthority: authorityBridge?.verify ?? null,
    issueAuthority: authorityBridge?.issue ?? null,
    capabilityRegistry: caps,
    projectRegistry: projects,
    source_mode: readContext ? 'TRUSTED_WORK_SOURCES' : 'ROUTING_ONLY',
  });
}

// AI Core 한 화면 — 세션 시작에 이것부터.
//
//   npm run core:brief                  둔 사본을 읽는다 (네트워크는 열린 PR 조회만)
//   npm run core:brief -- --refresh     먼저 work:observe · ops:watch 를 돌리고 읽는다 (둘 다 읽기만)
//
// ★읽기만 한다. 판정은 각 모듈의 것 — 여기서는 모을 뿐이다(src/integration/core-brief.mjs).

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 브리핑, 글로 } from '../src/integration/core-brief.mjs';
import { 관측파일자리 } from '../src/integration/landed-observer.mjs';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

const run = promisify(execFile);
const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };
const 읽기 = (길) => readFile(길, 'utf8').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
const JSON읽기 = async (길) => { const 글 = await 읽기(길); return 글 === null ? null : JSON.parse(글); };

const 원장길 = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);

if (인.includes('--refresh')) {
  const 노드 = (스크립트, 더 = []) => run(process.execPath, [join(뿌리, 'scripts', 스크립트), ...더], { cwd: 뿌리, timeout: 180_000, windowsHide: true })
    .catch((e) => ({ stdout: e.stdout ?? '' }));
  const 열쇠 = 값('--env-file');
  await Promise.all([노드('work-observe.mjs', ['--ledger', 원장길]), 노드('ops-watch.mjs', 열쇠 ? ['--env-file', 열쇠] : [])]);
}

/** 열린 PR — ai-core 전부 + 다른 저장소는 AI Core 가 연 운영 갈래(ops/)만. 못 읽으면 null. */
async function 열린PR() {
  try {
    const 목록 = [];
    const 읽 = async (repo, 거르기) => {
      const { stdout } = await run('gh', ['pr', 'list', '-R', repo, '--state', 'open', '--limit', '50', '--json', 'number,title,updatedAt,isDraft,headRefName'],
        { timeout: 60_000, windowsHide: true });
      for (const p of JSON.parse(stdout)) if (거르기(p)) 목록.push({ repo: repo.split('/')[1], number: p.number, title: p.title, updated_at: p.updatedAt, draft: p.isDraft });
    };
    await 읽('freepass-creator/ai-core', () => true);
    await 읽('freepass-creator/freepasserp4', (p) => p.headRefName.startsWith('ops/'));
    return 목록;
  } catch { return null; }
}

const b = 브리핑({
  ops: await JSON읽기(join(뿌리, '.local', 'ops-watch.json')),
  landed: await JSON읽기(관측파일자리(원장길)),
  ledgerText: await 읽기(원장길),
  directions: (await JSON읽기(join(뿌리, 'registry', 'directions.json')))?.방향 ?? [],
  prs: 인.includes('--no-prs') ? null : await 열린PR(),
});
console.log(인.includes('--json') ? JSON.stringify(b, null, 2) : 글로(b));

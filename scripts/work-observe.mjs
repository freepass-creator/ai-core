// 그룹 저장소 기본 갈래에 올라간 커밋을 GitHub 에서 읽어 원장 옆에 둔다.
//
//   npm run work:observe                  이전에 본 데부터 이어 읽는다(처음이면 7일)
//   npm run work:observe -- --days 14     처음 읽을 때 며칠 치를 볼지
//
// ★읽기만 한다 — gh api GET 뿐. 원장에 쓰지 않고, 무엇도 실행하지 않는다.
// ★못 본 프로젝트가 있으면 exit 2 — 「올라간 것 없음」 이 아니라 「모른다」 다.
// 보기: npm run work:recent

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 관측한다, 관측파일자리 } from '../src/integration/landed-observer.mjs';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

const run = promisify(execFile);
const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };

const api = async (args) => (await run('gh', ['api', ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 120_000, windowsHide: true })).stdout;

/** gh api 로 읽는 셋 — 모두 GET. */
export const gh = {
  head: async (repo, branch) => (await api([`repos/${repo}/commits/${encodeURIComponent(branch)}`, '--jq', '.sha'])).trim(),
  commits: async (repo, branch, since) => (await api([`repos/${repo}/commits`, '-X', 'GET', '-f', `sha=${branch}`, '-f', `since=${since}`,
    '-f', 'per_page=100', '--paginate', '--jq',
    '.[] | {sha, message: .commit.message, author: (.author.login // .commit.author.name), committed_at: .commit.committer.date} | tojson']))
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)),
  compare: async (repo, base, head) => JSON.parse(await api([`repos/${repo}/compare/${base}...${head}`, '--jq',
    '{status, ahead_by, behind_by, files: [.files[]?.filename]}'])),
};

const 읽기 = (길) => readFile(길, 'utf8').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 원장 = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);
  const 나갈곳 = 값('--out') ?? 관측파일자리(원장);
  const 등록부 = JSON.parse((await readFile(값('--registry') ?? join(뿌리, 'registry', 'projects.json'), 'utf8')).replace(/^﻿/, ''));
  const 이전글 = await 읽기(나갈곳);
  const 관측 = await 관측한다({ registry: 등록부, ledgerText: (await 읽기(원장)) ?? '', prior: 이전글 ? JSON.parse(이전글) : null,
    gh, 처음며칠: Number(값('--days') ?? 7) });

  /** 반쯤 쓴 파일이 남지 않게 — 옆에 쓰고 바꿔 끼운다. */
  await writeFile(`${나갈곳}.tmp`, `${JSON.stringify(관측, null, 2)}\n`, 'utf8');
  await rename(`${나갈곳}.tmp`, 나갈곳);

  const 못봄 = Object.entries(관측.projects).filter(([, p]) => p.status !== 'OBSERVED');
  for (const [id, p] of Object.entries(관측.projects)) {
    const n = 관측.commits.filter((c) => c.project_id === id && p.since && c.committed_at >= p.since).length;
    console.log(p.status === 'OBSERVED' ? `${id}: ${p.since} 부터 ${n}건 · head ${p.head.slice(0, 8)}` : `★${id}: UNKNOWN ${p.reason}`);
  }
  console.log(`적었다: ${나갈곳}  (보관 ${관측.commits.length}건)`);
  process.exitCode = 못봄.length ? 2 : 0;
}

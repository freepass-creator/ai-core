// AI Core 가 지켜보는 운영 회차를 한 번 본다 — 읽기만 한다.
//
//   npm run ops:watch                                   registry/operations.json 의 운영 전부
//   npm run ops:watch -- --env-file C:\dev\freepasserp.com\.env.local
//
// ★GitHub 은 gh api GET, 발행 기록은 Firestore REST GET «문서 한 건».
//   쓰기 경로는 이 파일에 없다. 켜지도, 다시 걸지도 않는다.
// ★열쇠 값은 찍지 않는다. 열쇠 파일 «자리» 만 환경변수(또는 --env-file 의 그 변수)에서 읽는다.
// ★알릴 것이 있으면 exit 1 · 못 읽은 것이 있으면 그것도 알린다(UNKNOWN).
// 결과: .local/ops-watch.json

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createSign } from 'node:crypto';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 판정, 알릴까 } from '../src/integration/ops-watch.mjs';

const run = promisify(execFile);
const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const 인 = process.argv.slice(2);
const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };
const KST = (t) => new Date(Date.parse(t) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

async function 회차들(op) {
  try {
    const { stdout } = await run('gh', ['api', `repos/${op.repository}/actions/workflows/${op.workflow}/runs?per_page=30`, '--jq',
      '.workflow_runs[] | {id, event, status, conclusion, created_at, url: .html_url} | tojson'], { timeout: 60_000, windowsHide: true });
    return stdout.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch { return null; }
}

/** 열쇠 파일 자리 — 환경변수, 없으면 --env-file 에서 그 변수 한 줄만. */
async function 열쇠자리(변수) {
  if (process.env[변수]) return process.env[변수];
  const 파일 = 값('--env-file');
  if (!파일) return null;
  const 글 = await readFile(파일, 'utf8').catch(() => '');
  const 줄 = 글.split(/\r?\n/).find((l) => l.startsWith(`${변수}=`));
  return 줄 ? 줄.slice(변수.length + 1).trim().replace(/^["']|["']$/g, '') : null;
}

const b64u = (x) => Buffer.from(x).toString('base64url');
async function 토큰(sa) {
  const 지금 = Math.floor(Date.now() / 1000);
  const 머리 = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const 몸 = b64u(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: sa.token_uri, iat: 지금, exp: 지금 + 600 }));
  const 서명 = createSign('RSA-SHA256').update(`${머리}.${몸}`).sign(sa.private_key, 'base64url');
  const r = await fetch(sa.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${머리}.${몸}.${서명}` }) });
  if (!r.ok) throw new Error(`TOKEN_${r.status}`);
  return (await r.json()).access_token;
}

/** Firestore 문서 한 건을 GET 하고 맨 위 칸만 평평하게. */
async function 발행기록(기록) {
  try {
    const 자리 = await 열쇠자리(기록.열쇠환경변수);
    if (!자리) return null;
    const sa = JSON.parse(await readFile(자리, 'utf8'));
    if (sa.project_id !== 기록.firebase_project) return null;
    const url = `https://firestore.googleapis.com/v1/projects/${기록.firebase_project}/databases/(default)/documents/${기록.문서}`;
    const r = await fetch(url, { headers: { authorization: `Bearer ${await 토큰(sa)}` } });
    if (!r.ok) return null;
    const 필드 = (await r.json()).fields ?? {};
    return Object.fromEntries(Object.entries(필드).map(([k, v]) => [k, v.stringValue ?? v.timestampValue ?? v.integerValue ?? v.booleanValue ?? null]));
  } catch { return null; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 목록 = JSON.parse(await readFile(값('--operations') ?? join(뿌리, 'registry', 'operations.json'), 'utf8')).operations ?? [];
  const 판들 = [];
  for (const op of 목록) {
    const 판 = 판정({ op, runs: await 회차들(op), publication: op.발행기록 ? await 발행기록(op.발행기록) : undefined });
    판들.push(판);
    console.log(`■ ${op.id}  ${판.status}${판.창안 ? '' : '  (창 밖)'}  담당 ${판.담당 ?? '-'}`);
    if (판.발행) console.log(`   발행   ${KST(판.발행.at)} KST · ${판.발행.나이분}분 전 · ${판.발행.snapshotId}`);
    if (판.마지막회차) console.log(`   회차   마지막 ${KST(판.마지막회차.created_at)} ${판.마지막회차.event} ${판.마지막회차.status}/${판.마지막회차.conclusion ?? '-'}`);
    if (판.회차) console.log(`   오늘   예약 ${판.회차.온_오늘}회 옴 / 지금까지 ${판.회차.기대_지금까지}회 와야 함`);
    for (const 이 of 판.이유) {
      const 덧 = 이.자료반영 === true ? ' — 자료는 반영됨, 회차 뒤 검사만 실패' : 이.자료반영 === false ? ' — ★자료도 안 바뀜' : '';
      console.log(`   ★${이.status} ${이.code}${덧}${이.url ? ` ${이.url}` : ''}`);
    }
  }
  const 곳 = join(뿌리, '.local');
  await mkdir(곳, { recursive: true });
  await writeFile(join(곳, 'ops-watch.json.tmp'), `${JSON.stringify({ as_of: new Date().toISOString(), 판들 }, null, 2)}\n`);
  await rename(join(곳, 'ops-watch.json.tmp'), join(곳, 'ops-watch.json'));
  process.exitCode = 판들.some(알릴까) ? 1 : 0;
}

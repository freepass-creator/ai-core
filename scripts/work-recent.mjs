// 그룹에 최근 무엇이 올라갔나 — 세션을 시작할 때 «다시 조사하지 말고» 이것부터 읽는다.
//
//   npm run work:recent                         최근 24시간, 전 프로젝트
//   npm run work:recent -- --hours 72 --project aiops
//   npm run work:recent -- --all                 프로젝트마다 다 찍는다(기본은 10건씩)
//
// ★네트워크를 쓰지 않는다 — work:observe 가 둔 사본을 읽을 뿐이다. 낡았으면 그렇게 말한다.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 최근, 관측파일자리 } from '../src/integration/landed-observer.mjs';
import { defaultWorkLedgerPath } from '../src/integration/order-work-sources.mjs';
import { defaultDb } from '../src/orders/store.mjs';

const KST = (t) => new Date(Date.parse(t) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');

export function 글로(보기, { 다 = false, now = new Date() } = {}) {
  const 줄 = [];
  const 나이 = 보기.as_of ? Math.round((now.getTime() - Date.parse(보기.as_of)) / 60_000) : null;
  줄.push(`AI Core — 최근 ${보기.hours}시간 그룹에 올라간 일   (관측 ${보기.as_of ? `${KST(보기.as_of)} KST, ${나이}분 전` : '없음'})`);
  if (나이 !== null && 나이 > 180) 줄.push(`★관측이 ${Math.round(나이 / 60)}시간 낡았다 — npm run work:observe`);
  for (const p of 보기.projects) {
    줄.push('');
    if (p.status !== 'OBSERVED') { 줄.push(`■ ${p.project_id}  ★UNKNOWN ${p.reason} — 「없다」 가 아니라 「모른다」`); continue; }
    줄.push(`■ ${p.project_id}  ${p.count}건${p.complete ? '' : '  ★이 기간을 다 못 읽었다 — 이 수가 전부가 아니다'}`);
    const 보일것 = 다 ? p.commits : p.commits.slice(0, 10);
    for (const c of 보일것) 줄.push(`   ${KST(c.committed_at)}  ${c.sha.slice(0, 8)}  ${c.subject.slice(0, 90)}`);
    if (보일것.length < p.commits.length) 줄.push(`   … ${p.commits.length - 보일것.length}건 더 (--all)`);
  }
  if (보기.works.length) {
    줄.push('', '■ 원장 일감 — 묶인 리비전 뒤에 무엇이 들어왔나');
    for (const w of 보기.works) {
      const 머리 = `   ${w.work_id} (${w.project_id}, ${w.state})`;
      if (w.status === 'CURRENT') 줄.push(`${머리}  지금 head 와 같다`);
      else if (w.status === 'UNBOUND') 줄.push(`${머리}  리비전에 안 묶였다`);
      else if (w.status === 'UNKNOWN') 줄.push(`${머리}  ★UNKNOWN ${w.reason}${w.bound ? ` (묶음 ${w.bound.slice(0, 8)})` : ''}`);
      else {
        줄.push(`${머리}  ${w.bound.slice(0, 8)} → ${w.head.slice(0, 8)}  커밋 ${w.ahead_by}개 뒤 · 파일 ${w.files_total}개${w.status === 'DIVERGED' ? ' ★갈라졌다' : ''}`);
        for (const f of w.files.slice(0, 5)) 줄.push(`      ${f}`);
        if (w.files_total > 5) 줄.push(`      … ${w.files_total - 5}개 더`);
      }
    }
  }
  return 줄.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 인 = process.argv.slice(2);
  const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };
  const 원장 = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);
  const 자리 = 값('--from') ?? 관측파일자리(원장);
  const 글 = await readFile(자리, 'utf8').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  if (글 === null) {
    console.log(`관측 사본이 없다: ${자리}\n먼저: npm run work:observe`);
    process.exitCode = 1;
  } else {
    console.log(글로(최근(JSON.parse(글), { hours: Number(값('--hours') ?? 24), project: 값('--project') }), { 다: 인.includes('--all') }));
  }
}

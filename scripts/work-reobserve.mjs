// 프로젝트가 앞서 나간 원장 일감을 «지금 head 에서 다시 본다» — REOBSERVED 공급자.
//
//   npm run work:reobserve                      무엇을 적을지 보여만 준다 (기본)
//   npm run work:reobserve -- --work GWATAERYO-001 --write
//   npm run work:reobserve -- --all --write
//
// ★근거는 work:observe 가 GitHub 에서 잰 비교(묶인 리비전…head: 몇 커밋, 어느 파일)다.
//   그 관측이 낡았거나(기본 3시간) 그 프로젝트를 못 봤으면 적지 않는다.
// ★재관측은 걸음이 아니다. 상태를 옮기지 않고, 검증 뒤(VERIFYING 부터)는 원장이 거절한다.
//   「바뀐 것이 이 일과 무관하다」는 판단도 아니다 — 무엇이 바뀌었는지를 증거로 남길 뿐이다.
// ★적은 뒤에도 등록부 head 와 스냅샷이 같은 리비전이어야 투영이 LINKED 가 된다. 끝에 그걸 찍는다.

import { readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyLedgerText, REOBSERVABLE } from './work-ledger.mjs';
import { 관측파일자리 } from '../src/integration/landed-observer.mjs';
import { createWorkRecorder } from '../src/integration/work-recorder.mjs';

const 시간 = 3600_000;

/** 무엇을 적을지 정한다 — 쓰지 않는다. */
export function 재관측안(관측, ledgerText, { now = new Date(), 최대나이시간 = 3, work = null } = {}) {
  const 원장 = verifyLedgerText(ledgerText ?? '');
  if (원장.status !== 'VALID') return [{ work_id: work, status: 'SKIP', reason: 'LEDGER_INVALID' }];
  const 나이 = 관측?.as_of ? (now.getTime() - Date.parse(관측.as_of)) / 시간 : Infinity;
  const 대상 = work ? [work] : Object.keys(원장.work);
  return 대상.map((id) => {
    const w = 원장.work[id];
    const 건너 = (reason) => ({ work_id: id, status: 'SKIP', reason });
    if (!w) return 건너('WORK_NOT_IN_LEDGER');
    if (!(나이 <= 최대나이시간)) return 건너('OBSERVATION_STALE');
    const 프 = 관측.projects?.[w.project_id];
    if (프?.status !== 'OBSERVED') return 건너('PROJECT_UNOBSERVED');
    if (w.subject_revision === 프.head) return 건너('ALREADY_CURRENT');
    if (!REOBSERVABLE.includes(w.state)) return 건너('STATE_NOT_REOBSERVABLE');
    const 비교 = (관측.works ?? []).find((x) => x.work_id === id);
    /** 비교가 이번 관측의 head·묶인 리비전과 맞아야 증거다. 다른 때의 비교를 끌어다 쓰지 않는다. */
    if (!비교 || 비교.head !== 프.head || 비교.bound !== (w.subject_revision ?? null)) return 건너('COMPARISON_MISSING');
    /** 처음부터 이 프로젝트에 없던 revision은 «낡아진 정본»이 아니다.
     * 그 binding의 project/revision identity provenance를 다시 세우기 전에는
     * 자동 REOBSERVED로 새 head에 옮기지 않는다. */
    if (비교.status === 'UNKNOWN' && 비교.reason === 'REVISION_NOT_IN_PROJECT') {
      return 건너('REVISION_NOT_IN_PROJECT_REQUIRES_REBIND');
    }
    const 어디서 = `gh api repos/${프.repository}/compare (landed-observations ${관측.as_of})`;
    const 짧게 = (r) => (r ? r.slice(0, 8) : 'null');
    let 무엇;
    if (비교.status === 'BEHIND_HEAD' || 비교.status === 'DIVERGED') {
      const 파일 = 비교.files.slice(0, 3).join(', ') + (비교.files_total > 3 ? ` 외 ${비교.files_total - 3}` : '');
      무엇 = `${짧게(비교.bound)}...${짧게(프.head)} ${비교.status} 커밋 ${비교.ahead_by} · 파일 ${비교.files_total}${파일 ? ` (${파일})` : ''}`;
    } else if (비교.status === 'UNBOUND') {
      무엇 = `리비전에 안 묶였던 일감을 ${프.repository} ${프.branch} head ${짧게(프.head)} 에서 본다`;
    } else {
      return 건너(`COMPARISON_${비교.status}${비교.reason ? `_${비교.reason}` : ''}`);
    }
    return { work_id: id, status: 'PROPOSE', project_id: w.project_id, state: w.state, from: w.subject_revision ?? null, to: 프.head,
      증거: [{ 갈래: 'MEASURED', 무엇, 어디서 }] };
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const 인 = process.argv.slice(2);
  const 값 = (이름) => { const i = 인.indexOf(이름); return i < 0 ? null : 인[i + 1] ?? null; };
  const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const { defaultWorkLedgerPath } = await import('../src/integration/order-work-sources.mjs');
  const { defaultDb } = await import('../src/orders/store.mjs');
  const 원장길 = 값('--ledger') ?? defaultWorkLedgerPath(process.env.AI_CORE_ORDERS_DB || defaultDb);
  const 읽기 = (길) => readFile(길, 'utf8').catch((e) => (e.code === 'ENOENT' ? null : Promise.reject(e)));
  const 관측글 = await 읽기(값('--from') ?? 관측파일자리(원장길));
  if (관측글 === null) { console.log('관측 사본이 없다 — 먼저: npm run work:observe'); process.exit(1); }
  const work = 인.includes('--all') ? null : 값('--work');
  const 안 = 재관측안(JSON.parse(관측글), (await 읽기(원장길)) ?? '', { work, 최대나이시간: Number(값('--max-age-hours') ?? 3) });
  const 적기 = 인.includes('--write');
  const 기록기 = createWorkRecorder({ ledgerPath: 원장길, actor: 값('--actor') ?? 'AI_CORE_REOBSERVER' });
  const 등록부 = JSON.parse((await readFile(값('--registry') ?? join(뿌리, 'registry', 'projects.json'), 'utf8')).replace(/^﻿/, ''));
  let 문제 = 0;
  for (const 줄 of 안) {
    if (줄.status === 'SKIP') { console.log(`- ${줄.work_id}: 건너뜀 ${줄.reason}`); continue; }
    console.log(`${적기 ? '적는다' : '적을 것'} ${줄.work_id} (${줄.project_id}, ${줄.state}) ${String(줄.from).slice(0, 8)} → ${줄.to.slice(0, 8)}`);
    for (const 증 of 줄.증거) console.log(`    ${증.갈래}:${증.무엇} @${증.어디서}`);
    if (적기) {
      const r = await 기록기.적는다({ work_id: 줄.work_id, project_id: 줄.project_id, type: 'REOBSERVED', subject_revision: 줄.to,
        무엇: '지금 head 에서 다시 본다', 증거: 줄.증거 });
      console.log(`    → ${r.event_id}`);
    }
    const 등록head = 등록부.projects?.find((p) => p.project_id === 줄.project_id)?.head_revision;
    if (등록head !== 줄.to) { 문제 += 1; console.log(`    ★등록부 head ${String(등록head).slice(0, 8)} ≠ ${줄.to.slice(0, 8)} — npm run registry:refresh 전에는 투영이 선다`); }
  }
  if (!적기 && 안.some((x) => x.status === 'PROPOSE')) console.log('\n보여만 줬다. 적으려면 --write');
  if (적기 && 안.some((x) => x.status === 'PROPOSE')) console.log('\n다음: npm run control:snapshot  (스냅샷이 새 리비전을 따라가야 LINKED)');
  process.exitCode = 문제 ? 2 : 0;
}

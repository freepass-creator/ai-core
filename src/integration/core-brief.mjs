// AI Core 한 화면 — 세션을 시작할 때 «다시 조사하지 말고» 이것부터 읽는다.
//
// ★2026-09-18: 운영 감시(ops:watch) · 올라간 일(work:recent) · 원장 · 방향이 따로따로였다.
//   넷을 다 읽는 세션은 없었다. 그래서 흩어진 판정을 «모으기만» 한다.
// ★새로 판정하지 않는다. 각 칸의 판정은 그 모듈의 것을 그대로 부른다:
//   운영 → ops-watch.알릴까 · 올라간 일 → landed-observer.최근 · 원장 → verifyLedgerText
//   · 방향 → direction.쓸수있나 + order-work-sources.원장승인확인
// ★사본이 없거나 낡았으면 그렇게 말한다 — 「없다」가 아니라 「모른다」.

import { verifyLedgerText } from '../../scripts/work-ledger.mjs';
import { 알릴까 } from './ops-watch.mjs';
import { 최근 } from './landed-observer.mjs';
import { 쓸수있나 } from './direction.mjs';
import { 원장승인확인 } from './order-work-sources.mjs';

const 분 = 60_000;
const 나이분 = (t, now) => (t ? Math.round((now.getTime() - Date.parse(t)) / 분) : null);

/** 방향 하나가 지금 살아 있나 — 파일에 적힌 것만으로는 안 선다(원장 승인 사건이 있어야 한다). */
export function 방향상태(방향, { asOf, 승인확인 }) {
  const 못씀 = 쓸수있나(방향, asOf);
  if (못씀 === 'DIRECTION_AUTHOR_REQUIRED' || 못씀 === 'DIRECTION_WINDOW_REQUIRED') return { id: 방향.id, 상태: '초안', 까닭: 못씀 };
  if (못씀) return { id: 방향.id, 상태: '못씀', 까닭: 못씀 };
  const 근거 = 방향.승인근거?.원장사건;
  if (!근거) return { id: 방향.id, 상태: '승인근거없음', 까닭: 'EVIDENCE_REQUIRED' };
  if (!승인확인({ 원장사건: 근거 })) return { id: 방향.id, 상태: '승인근거없음', 까닭: 'LEDGER_APPROVAL_NOT_FOUND' };
  return { id: 방향.id, 상태: '살아있음', 만료: 방향.만료 };
}

/**
 * 브리핑({ now, ops, landed, ledgerText, directions, prs })
 *   ops        — .local/ops-watch.json (없으면 null)
 *   landed     — .local/landed-observations.json (없으면 null)
 *   ledgerText — 원장 글 (파일이 없으면 null)
 *   directions — registry/directions.json 의 방향[]
 *   prs        — 열린 PR [{ repo, number, title, updated_at, draft }] (못 읽었으면 null)
 */
export function 브리핑({ now = new Date(), ops = null, landed = null, ledgerText = null, directions = [], prs = null }) {
  const 대표몫 = [];

  const 운영 = ops ? {
    나이분: 나이분(ops.as_of, now),
    판들: (ops.판들 ?? []).map((판) => ({ id: 판.id, status: 판.status, 알림: 알릴까(판), 발행: 판.발행 ?? null,
      이유: 판.이유.map((이) => `${이.code}${이.자료반영 === true ? '(자료는 반영됨)' : 이.자료반영 === false ? '(자료도 안 바뀜)' : ''}`) })),
  } : null;
  for (const 판 of 운영?.판들 ?? []) if (판.알림) 대표몫.push(`운영 ${판.id}: ${판.status} ${판.이유.join(', ')}`);

  const 올라감 = landed ? (() => {
    const 보기 = 최근(landed, { hours: 24, now });
    return { 나이분: 나이분(landed.as_of, now),
      projects: 보기.projects.map((p) => ({ project_id: p.project_id, status: p.status, count: p.count, complete: p.complete,
        첫줄: p.commits.slice(0, 2).map((c) => c.subject) })),
      works: 보기.works };
  })() : null;

  let 원장 = null;
  if (ledgerText !== null) {
    const r = verifyLedgerText(ledgerText);
    원장 = r.status !== 'VALID' ? { status: r.status } : { status: 'VALID', event_count: r.event_count,
      일감: Object.entries(r.work).map(([id, w]) => {
        const 드리프트 = (landed?.works ?? []).find((x) => x.work_id === id);
        return { id, project_id: w.project_id, state: w.state, rev: w.subject_revision ?? null,
          리비전: 드리프트 ? `${드리프트.status}${드리프트.reason ? ` ${드리프트.reason}` : ''}` : '모름' };
      }) };
    if (r.status !== 'VALID') 대표몫.push(`원장이 깨졌다: ${r.errors?.[0]?.code ?? r.status}`);
  }

  const 승인확인 = 원장승인확인(ledgerText ?? '');
  const 방향 = directions.map((d) => 방향상태(d, { asOf: now.toISOString(), 승인확인 }));
  for (const d of 방향) if (d.상태 === '초안') 대표몫.push(`방향 ${d.id}: 초안 — 세운이·만료를 채우고 원장에 승인을 남겨야 산다`);

  /** 사흘 안에 움직인 열린 PR 만 — 오래된 연구 초안은 결정 거리가 아니다. */
  const PR갱신시각깨짐 = prs !== null && prs.some((p) => !p.draft && !Number.isFinite(Date.parse(p.updated_at)));
  const 열린 = prs === null || PR갱신시각깨짐 ? null : prs.filter((p) => !p.draft && now.getTime() - Date.parse(p.updated_at) <= 3 * 24 * 60 * 분);
  for (const p of 열린 ?? []) 대표몫.push(`열린 PR ${p.repo}#${p.number} ${p.title}`);

  return { now: now.toISOString(), 운영, 올라감, 원장, 방향, 열린PR: 열린, 대표몫 };
}

const KST = (t) => new Date(Date.parse(t) + 9 * 3600_000).toISOString().slice(5, 16).replace('T', ' ');
const 낡음 = (나이, 한계) => (나이 === null ? '' : 나이 > 한계 ? `  ★${Math.round(나이 / 60)}시간 낡음` : `  (${나이}분 전)`);

export function 글로(b) {
  const 줄 = [`AI Core 한 화면 — ${KST(b.now)} KST`, ''];
  줄.push('■ 운영');
  if (!b.운영) 줄.push('   모름 — npm run ops:watch 를 한 번도 안 돌렸다');
  else for (const 판 of b.운영.판들) {
    줄.push(`   ${판.알림 ? '★' : '·'} ${판.id}  ${판.status}${낡음(b.운영.나이분, 60)}`);
    if (판.발행) 줄.push(`     발행 ${KST(판.발행.at)} KST (${판.발행.나이분}분 전 기준)`);
    if (판.이유.length) 줄.push(`     ${판.이유.join(' · ')}`);
  }
  줄.push('', '■ 최근 24시간 올라간 일');
  if (!b.올라감) 줄.push('   모름 — npm run work:observe');
  else {
    if (b.올라감.나이분 > 180) 줄.push(`   ★관측이 ${Math.round(b.올라감.나이분 / 60)}시간 낡았다 — npm run work:observe`);
    for (const p of b.올라감.projects) {
      if (p.status !== 'OBSERVED') { 줄.push(`   ${p.project_id}  모름`); continue; }
      줄.push(`   ${p.project_id}  ${p.count}건${p.complete ? '' : ' (다 못 읽음)'}${p.첫줄[0] ? ` — ${p.첫줄[0].slice(0, 60)}` : ''}`);
    }
  }
  줄.push('', '■ 원장 일감');
  if (!b.원장) 줄.push('   모름 — 원장 파일이 없다');
  else if (b.원장.status !== 'VALID') 줄.push(`   ★원장 ${b.원장.status}`);
  else for (const w of b.원장.일감) 줄.push(`   ${w.id} (${w.project_id}) ${w.state} · 리비전 ${w.리비전}`);
  줄.push('', '■ 방향');
  for (const d of b.방향) 줄.push(`   ${d.상태 === '살아있음' ? '·' : '○'} ${d.id}  ${d.상태}${d.만료 ? ` (만료 ${d.만료.slice(0, 10)})` : d.까닭 ? ` ${d.까닭}` : ''}`);
  줄.push('', '■ 대표 몫');
  if (b.열린PR === null) 줄.push('   (열린 PR 은 못 읽었다 — 모름)');
  if (!b.대표몫.length) 줄.push(b.열린PR === null ? '   알려진 것은 없음 — PR 은 모름' : '   없음');
  for (const x of b.대표몫) 줄.push(`   - ${x}`);
  return 줄.join('\n');
}

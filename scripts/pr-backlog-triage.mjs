#!/usr/bin/env node
// 열린 PR 재고를 «정리 가능한 묶음»으로 만든다.
//
// ★왜 (2026-09-23 실측)
//   통합의 병목은 만드는 속도가 아니라 합치는 속도였다. 열린 PR 78개 · 충돌 17개 · 초안 50개.
//   숫자만 보면 손댈 수 없다. 그래서 «무엇부터, 왜» 가 나오게 쪼갠다:
//     · 지금 합칠 수 있는 것(CLEAN)
//     · 다시 얹어야 하는 것(DIRTY — 충돌)
//     · 서로 같은 파일을 건드려 «먼저 합치는 쪽이 이기는» 것
//
//   node scripts/pr-backlog-triage.mjs            — 표로 보여 준다
//   node scripts/pr-backlog-triage.mjs --write    — docs/integration/PR_BACKLOG_TRIAGE.md 를 다시 쓴다
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const 읽기 = () => JSON.parse(execFileSync('gh', [
  'pr', 'list', '--state', 'open', '--limit', '200',
  '--json', 'number,title,createdAt,isDraft,mergeable,mergeStateStatus,files,baseRefName'
], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));

const 나이 = (pr, 지금 = Date.now()) => Math.floor((지금 - new Date(pr.createdAt)) / 86400000);
const 주제 = (pr) => (pr.title.match(/^(\w+)\(([^)]+)\)/)?.slice(1, 3).join('(') ?? pr.title.split(/[\s:—]/)[0]) + (pr.title.match(/^\w+\(/) ? ')' : '');

/** 같은 파일을 건드리는 PR 이 많을수록, 하나를 합치는 순간 나머지가 충돌한다. */
export function 겹침(prs) {
  const 표 = new Map();
  for (const pr of prs) for (const f of pr.files ?? []) {
    if (!표.has(f.path)) 표.set(f.path, []);
    표.get(f.path).push(pr.number);
  }
  return [...표.entries()]
    .map(([path, numbers]) => ({ path, numbers, count: numbers.length }))
    .filter((r) => r.count >= 3)
    .sort((a, b) => b.count - a.count);
}

export function 분류(prs, 지금 = Date.now()) {
  const 바로 = prs.filter((p) => p.mergeStateStatus === 'CLEAN');
  const 충돌 = prs.filter((p) => p.mergeable === 'CONFLICTING' || p.mergeStateStatus === 'DIRTY');
  const 검사막힘 = prs.filter((p) => p.mergeStateStatus === 'UNSTABLE');
  const 묶음 = new Map();
  for (const pr of prs) {
    const k = 주제(pr);
    if (!묶음.has(k)) 묶음.set(k, []);
    묶음.get(k).push(pr);
  }
  return {
    전체: prs.length,
    초안: prs.filter((p) => p.isDraft).length,
    바로, 충돌, 검사막힘,
    오래된: prs.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, 10).map((p) => ({ ...p, 일수: 나이(p, 지금) })),
    주제별: [...묶음.entries()].map(([이름, 목록]) => ({ 이름, 수: 목록.length, 번호: 목록.map((p) => p.number) })).sort((a, b) => b.수 - a.수),
    겹침: 겹침(prs)
  };
}

const 표문서 = (r) => `# 열린 PR 재고 정리 — ${new Date().toISOString().slice(0, 10)}

> 자동 생성: \`node scripts/pr-backlog-triage.mjs --write\`. 손으로 고치지 않는다.

통합의 병목은 «만드는 속도»가 아니라 «합치는 속도»다. 지금 **열린 PR ${r.전체}개**(초안 ${r.초안}) 중
**${r.충돌.length}개가 이미 충돌**하고 있다. 하나를 합칠 때마다 나머지가 더 어긋난다.

## 지금 상태

| 갈래 | 수 | 뜻 |
|---|---|---|
| 바로 합칠 수 있음 (CLEAN) | ${r.바로.length} | 충돌 없음 · 검사 통과 |
| 검사가 막힘 (UNSTABLE) | ${r.검사막힘.length} | ★GitHub Actions 가 결제 문제로 «시작조차» 못 한다 |
| 충돌 (DIRTY) | ${r.충돌.length} | 다시 얹어야 한다 |

## ★같은 파일을 여럿이 건드린다 — 충돌의 구조적 원인

| 그 파일을 건드리는 PR 수 | 파일 |
|---|---|
${r.겹침.slice(0, 10).map((x) => `| ${x.count} | \`${x.path}\` |`).join('\n')}

**\`docs/episodes/ORDER-DESK-001.json\` 이 가장 아프다.** 규칙상 모든 PR 이 자기가 바꾼 파일을 이 «한 배열»에 적어야 해서,
PR 이 늘어날수록 **서로가 서로를 충돌시킨다**. 내용이 겹쳐서가 아니라 «같은 줄에 적어야 해서» 충돌한다.

## 주제별 묶음 (한 번에 하나씩 합치기 위한 단위)

| 수 | 주제 | 번호 |
|---|---|---|
${r.주제별.slice(0, 12).map((x) => `| ${x.수} | ${x.이름} | ${x.번호.slice(0, 8).join(', ')}${x.번호.length > 8 ? ' …' : ''} |`).join('\n')}

## 가장 오래 열려 있는 것

${r.오래된.slice(0, 8).map((p) => `- #${p.number} · ${p.일수}일 · ${p.title}`).join('\n')}

## 제안 (판단은 대표가)

1. **결제부터** — Actions 가 멈춰 있어 ${r.검사막힘.length}개가 검사조차 못 받는다. 이걸 풀지 않으면 나머지는 의미가 없다.
2. **에피소드 목록 규칙을 바꾼다** — 지금은 PR 하나가 모든 PR 을 충돌시킨다.
   목록을 PR 별 파일로 쪼개거나, \`verify-main-state\` 가 git diff 에서 «유도»하게 하면 이 충돌이 사라진다.
3. **주제 단위로 한 묶음씩** — 같은 주제 PR 을 한 번에 올리고, 합친 직후 나머지를 다시 얹는다.
4. **9일 넘게 열린 것부터 판정** — 합칠지 닫을지. 열어 두는 것 자체가 비용이다.
`;

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const prs = 읽기();
  const r = 분류(prs);
  console.log(`열린 PR ${r.전체} · 초안 ${r.초안} · 바로합침 ${r.바로.length} · 검사막힘 ${r.검사막힘.length} · 충돌 ${r.충돌.length}`);
  console.log('\n같은 파일을 건드리는 PR:');
  for (const x of r.겹침.slice(0, 8)) console.log(`  ${String(x.count).padStart(3)}  ${x.path}`);
  console.log('\n주제별:');
  for (const x of r.주제별.slice(0, 10)) console.log(`  ${String(x.수).padStart(3)}  ${x.이름}`);
  if (process.argv.includes('--write')) {
    const 길 = resolve(root, 'docs/integration/PR_BACKLOG_TRIAGE.md');
    writeFileSync(길, 표문서(r));
    console.log(`\nwrote docs/integration/PR_BACKLOG_TRIAGE.md`);
  }
}

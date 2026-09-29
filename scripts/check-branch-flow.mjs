#!/usr/bin/env node
// 원격 가지를 «전수»로 보고, main 으로 흐르지 않는 것을 FAIL 한다.
//
// ★대표 2026-09-29: 「브랜치 이런 거 메인에 다 병합되게 «한 방향»으로 잘 가게 해줘야 돼」
//
//   check-branch-discipline.mjs 는 PR 의 head 하나만 본다. 그래서 «이미 서 있는 가지» 126개가 쌓였다.
//   이 검사는 정책(registry/development-continuity-policy.json)의 숫자를 그대로 강제한다 — 새 정책을 만들지 않는다.
//
//   node scripts/check-branch-flow.mjs            본다 (열린 PR 은 gh 로 읽는다)
//   node scripts/check-branch-flow.mjs --no-pr    gh 없이 (PR 정보 없음을 «분명히» 찍고 판정한다)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { 전수판정 } from '../src/governance/branch-flow.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const 정책읽기 = () => JSON.parse(readFileSync(resolve(root, 'registry/development-continuity-policy.json'), 'utf8'));

const 달리기 = (cmd, args) => {
  try { return { ok: true, out: execFileSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 26 }).trim() }; }
  catch (오류) { return { ok: false, err: String(오류.message).split('\n')[0] }; }
};

/** ★읽기 실패를 «빈 값»으로 돌려주지 않는다. 2026-09-29 에 git 실패를 «깨끗함»으로 세어
 *  가지 124개를 전부 잘못 분류한 적이 있다. 못 읽으면 못 읽었다고 말한다. */
export function 원격가지() {
  const r = 달리기('git', ['for-each-ref', '--format=%(refname:short)\t%(committerdate:iso-strict)', 'refs/remotes/origin']);
  if (!r.ok) throw new Error(`REMOTE_REFS_UNREADABLE: ${r.err}`);
  return r.out.split('\n').filter(Boolean)
    .map((l) => { const [ref, 날짜] = l.split('\t'); return { ref: ref.replace(/^origin\//, ''), 마지막커밋: 날짜 }; })
    .filter((b) => b.ref !== 'HEAD' && b.ref !== 'origin');
}

export function 열린PR들() {
  const r = 달리기('gh', ['pr', 'list', '--state', 'open', '--limit', '200', '--json', 'number,headRefName']);
  if (!r.ok) return null;
  return new Map(JSON.parse(r.out).map((p) => [p.headRefName, p.number]));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const 정책 = 정책읽기();
  const 가지들 = 원격가지();
  const pr = process.argv.includes('--no-pr') ? null : 열린PR들();
  if (!pr) console.log('※ 열린 PR 을 못 읽었다 — 「흐르는 중」을 나이로만 본다(조용히 통과시키지 않는다)');
  for (const b of 가지들) b.열린PR = pr?.get(b.ref) ?? null;

  const { 면제, 흐름, 위반, 한도 } = 전수판정(가지들, 정책);
  console.log(`원격 가지 ${가지들.length}개 · 면제 ${면제.length} · 흐름 ${흐름.length} · 위반 ${위반.length}`);
  console.log(`활성 작업선 ${한도.활성} / 한도 ${한도.한도} (${한도.프로필})`);

  if (위반.length) {
    console.error('');
    for (const b of 위반.slice(0, 20)) console.error(`  ${b.ref}\n      ${b.까닭}\n      → ${b.고치는법}`);
    if (위반.length > 20) console.error(`  … 외 ${위반.length - 20}개`);
    console.error(`\nFAIL: main 으로 흐르지 않는 가지 ${위반.length}개`);
  }
  if (한도.넘음) console.error(`FAIL: 활성 작업선이 한도를 ${한도.넘음}개 넘었다 — ${한도.목록.join(', ')}`);
  if (위반.length || 한도.넘음) process.exit(1);
  console.log('\nPASS: 모든 가지가 main 한 방향으로 흐른다');
}

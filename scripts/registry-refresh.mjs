// registry/projects.json 의 «관측» 을 정본 원격에서 다시 읽는다.
//
// ★2026-09-18: 다섯 프로젝트 head_revision 이 «전부» 낡아 있었다. 그래서 진짜 오더를
//   묶으려는 첫 시도가 SUBJECT_REVISION_STALE 로 막혔다. 손으로 고치면 또 낡는다.
//
// ★2026-09-18 정정(GPT_REVIEW 08:30, PR #29): 처음 판은 `../<project_id>` 형제 폴더의
//   HEAD 를 읽었다. 그 폴더가 다른 갈래·낡은 체크아웃이면 그 SHA 가 «정본» 으로 찍혔고,
//   ai-core 는 registry 의 local_path(ai-core-control-tower)와 다른 폴더를 읽고 있었다.
//   이제 registry 의 repository + default_branch 로 «원격 ref 를 직접» 본다
//   (#48 에서 손으로 하던 git ls-remote 를 코드로). 로컬 체크아웃은 보지 않는다.
//
// ★세지 않는다 — 읽는다. git 이 말하는 것만 적고, 아무것도 지어내지 않는다.
//   mission·벽·required_approvals 같은 «사람이 선언한 것» 은 손대지 않는다.
//   단 canonical head 가 움직인 ACTIVE 프로젝트는 그 새 revision 의 실행 검증이 아직
//   없으므로 HOLD 로 내린다. source freshness 는 execution readiness 증거가 아니다.
//
//   node scripts/registry-refresh.mjs            고치고 무엇이 바뀌었는지 찍는다
//   node scripts/registry-refresh.mjs --check    안 고치고 본다
//     exit 0 전부 관측했고 낡은 것 없음 · 1 낡은 것 있음 · 2 못 본 것 있음(UNKNOWN)
//
// ★CI 에는 걸지 않는다. 다른 저장소가 앞서 나갈 때마다 ai-core 가 빨개지고,
//   hosted runner 는 비공개 저장소를 볼 자격이 없어 늘 UNKNOWN 이다. 묶기 직전에 돌린다.

import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;

/** 원격의 그 갈래가 지금 가리키는 SHA. 못 보면 던진다 — 「없다」가 아니라 「모른다」. */
export const 원격보기 = (repository, branch) => {
  const out = execFileSync('git', ['ls-remote', '--exit-code', `https://github.com/${repository}.git`, `refs/heads/${branch}`],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 30_000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  return out.trim().split(/\s+/)[0];
};

/**
 * 등록부를 제자리에서 고친다. 관측한 것만 적고, 못 본 것은 «건드리지 않는다».
 * 지우거나 null 로 덮으면 「없다」고 말하는 것이 되는데, 실제로는 「못 봤다」일 뿐이다.
 */
export function registryRefresh(등록부, { observe = 원격보기, now = new Date() } = {}) {
  const 이제 = now.toISOString().replace(/\.\d+Z$/, 'Z');
  const 바뀜 = [];
  const 모름 = [];
  const 자기관리 = [];
  const 관측 = [];
  for (const 프 of 등록부.projects ?? []) {
    if (!프.repository || !프.default_branch) { 모름.push({ project_id: 프.project_id, reason: 'CANONICAL_REF_UNDECLARED' }); continue; }
    /** ai-core 자기 자신은 이 파일을 커밋하는 순간 HEAD가 다시 바뀐다.
     * committed registry 안에 자기 현재 SHA를 영구히 맞추려는 것은 불가능하므로
     * 일반 remote-refresh 대상에서 제외한다. 자기 revision runtime binding은 별도 계약으로 다룬다. */
    if (프.project_id === 'ai-core' && 프.repository === 'freepass-creator/ai-core') {
      자기관리.push({ project_id: 프.project_id, reason: 'SELF_REVISION_CYCLE' });
      continue;
    }
    let rev = null;
    try { rev = observe(프.repository, 프.default_branch); } catch { rev = null; }
    if (typeof rev !== 'string' || !SHA.test(rev)) { 모름.push({ project_id: 프.project_id, reason: 'REMOTE_UNOBSERVED' }); continue; }
    관측.push({ 프, rev });
    if (프.head_revision !== rev) 바뀜.push({ project_id: 프.project_id, from: 프.head_revision ?? null, to: rev });
  }

  /** ★부분 관측을 canonical registry에 쓰지 않는다.
   * A는 새 head를 봤고 B는 못 본 상태에서 A만 갱신하면 source.observed_at이
   * top-level observed_at보다 새로워져 INVALID가 되거나, 한 파일 안에 서로 다른
   * 관측 시점이 섞인다. UNKNOWN 하나라도 있으면 입력 객체를 한 글자도 안 바꾼다. */
  if (모름.length) return { 바뀜, 모름, 자기관리 };

  for (const { 프, rev } of 관측) {
    const previousHead = 프.head_revision;
    if (previousHead !== rev && 프.execution_readiness_status === 'ACTIVE') {
      프.execution_readiness_status = 'HOLD';
    }
    프.head_revision = rev;
    for (const 원천 of 프.authoritative_sources ?? []) {
      const canonicalRefs = new Set([프.repository, `${프.repository}#${프.default_branch}`]);
      if (원천.kind === 'GIT' && canonicalRefs.has(원천.ref) && 원천.revision === previousHead) {
        원천.revision = rev;
        원천.observed_at = 이제;
      }
    }
  }
  등록부.observed_at = 이제;
  return { 바뀜, 모름, 자기관리 };
}

/** UNKNOWN이 하나라도 있으면 stale보다 우선한다 — 관측 자체가 불완전한 상태다. */
export const 끝값 = ({ 바뀜, 모름 }) => (모름.length ? 2 : 바뀜.length ? 1 : 0);

async function main(인) {
  const 볼까만 = 인.includes('--check');
  const 뿌리 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const 길 = 인.find((x) => !x.startsWith('--')) ?? join(뿌리, 'registry', 'projects.json');
  const 등록부 = JSON.parse((await readFile(길, 'utf8')).replace(/^﻿/, ''));
  const 결과 = registryRefresh(등록부);
  for (const b of 결과.바뀜) console.log(`${볼까만 ? '낡음' : '고침'} ${b.project_id}: ${String(b.from).slice(0, 8)} → ${b.to.slice(0, 8)}`);
  if (!결과.바뀜.length) console.log('낡은 것 없음');
  for (const m of 결과.모름) console.log(`★UNKNOWN ${m.project_id}: ${m.reason} — «그대로 뒀다»`);
  for (const s of 결과.자기관리 ?? []) console.log(`★SELF ${s.project_id}: ${s.reason} — committed registry remote-refresh 제외`);
  if (!볼까만) {
    if (결과.모름.length) {
      console.log(`★안 적었다: UNKNOWN ${결과.모름.length}개 — canonical registry는 원래 bytes를 유지한다`);
      process.exitCode = 2;
      return;
    }
    await writeFile(길, `${JSON.stringify(등록부, null, 2)}\n`, 'utf8');
    console.log(`적었다: ${길}`);
    process.exitCode = 0;
    return;
  }
  process.exitCode = 끝값(결과);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => { console.error(e.message); process.exitCode = 3; });
}

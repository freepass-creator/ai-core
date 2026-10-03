// duo 쪽지가 «GitHub 까지 닿았는지» 본다 — 모든 worktree 를 훑는다.
//
// ★2026-10-03 실측: duo.mjs 는 자기가 돈 worktree 에 쪽지를 쓴다. 다른 worktree 에서 한 문답 29건이
//   main 에 한 번도 못 올라가고 B3Q 백업 가지에만 남아 있었다. worktree 를 지웠으면 그대로 사라졌다.
//   「어느 세션에서든 같은 자리」는 읽는 쪽만 맞았고, 쓴 기록이 «모이는» 길은 없었다.
//
//   그래서 쓰는 자리는 그대로 둔다(기록은 그 일을 한 가지의 PR 로 같이 올라간다).
//   대신 «유실 지점» — 커밋 안 됨 · 푸시 안 됨 · worktree 폴더 사라짐 — 을 전부 드러낸다.
//   Codex 검토(4822ca44, 2026-10-03): 미푸시 PR 을 origin/main 기준으로 오판하지 말 것, 고아 worktree,
//   worktree 간 같은 id 충돌을 같이 볼 것. → 기준은 «원격 어딘가에 닿았나»(--not --remotes)다.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const 우편함자리 = 'docs/coordination/duo';

const 깃 = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const 줄들 = (글) => 글.split(/\r?\n/).map((줄) => 줄.trim()).filter(Boolean);
const 같은길 = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/** `git worktree list --porcelain` 을 읽는다. 폴더가 사라진 것도 빼지 않는다 — 그게 고아다. */
export function worktree들(root) {
  const 것들 = [];
  let 지금 = null;
  for (const 줄 of 깃(root, ['worktree', 'list', '--porcelain']).split(/\r?\n/)) {
    if (줄.startsWith('worktree ')) {
      지금 = { 경로: 줄.slice(9), 가지: null };
      것들.push(지금);
    } else if (지금 && 줄.startsWith('branch ')) {
      지금.가지 = 줄.slice(7).replace(/^refs\/heads\//, '');
    } else if (지금 && 줄 === 'detached') {
      지금.가지 = '(detached)';
    }
  }
  return 것들.map((w) => ({ ...w, 있음: existsSync(w.경로) }));
}

/** 한 worktree 에서 GitHub 에 닿지 않은 쪽지 파일을 찾는다. */
export function 안닿은것(경로) {
  /** 다른 가지에서 같은 내용이 이미 main 에 올라갔으면(복구 PR 등) 닿은 것이다 — 내용(blob)으로 비교한다. */
  const main에같다 = (f) => {
    try {
      return 깃(경로, ['rev-parse', `origin/main:${f}`]).trim() === 깃(경로, ['hash-object', '--', f]).trim();
    } catch {
      return false;
    }
  };
  const 미커밋 = 줄들(깃(경로, ['status', '--porcelain', '--untracked-files=all', '--', 우편함자리]))
    .map((줄) => 줄.slice(3).replace(/^"|"$/g, ''))
    .filter((f) => !main에같다(f));
  /** 커밋은 했지만 어느 원격 가지에도 없는 것. origin/main 이 아니라 «원격 전체»가 기준이다 —
   *  푸시해서 PR 을 기다리는 쪽지는 이미 GitHub 에 있으니 갇힌 것이 아니다. */
  const 미푸시 = [...new Set(줄들(깃(경로, ['log', '--format=', '--name-only', 'HEAD', '--not', '--remotes', '--', 우편함자리])))]
    .filter((f) => !미커밋.includes(f));
  return { 미커밋, 미푸시 };
}

/** 모든 worktree 를 훑어 갇힌 쪽지를 모은다. `대상` 을 주면 그 worktree 하나만 본다(지우기 전 검사). */
export function 갇힌기록(root, { 대상 = null } = {}) {
  const 자리 = [];
  const 목록 = worktree들(root);
  if (대상 && !목록.some((w) => 같은길(w.경로, 대상))) {
    return { 자리, 미커밋: 0, 미푸시: 0, 고아: 0, 대상없음: true };
  }
  for (const w of 목록) {
    if (대상 && !같은길(w.경로, 대상)) continue;
    if (!w.있음) {
      자리.push({ ...w, 고아: true, 미커밋: [], 미푸시: [] });
      continue;
    }
    const { 미커밋, 미푸시 } = 안닿은것(w.경로);
    if (미커밋.length || 미푸시.length) 자리.push({ ...w, 고아: false, 미커밋, 미푸시 });
  }
  const 합 = (키) => 자리.reduce((n, w) => n + w[키].length, 0);
  return { 자리, 미커밋: 합('미커밋'), 미푸시: 합('미푸시'), 고아: 자리.filter((w) => w.고아).length };
}

/** 모든 worktree 의 쪽지를 id 로 합친다. 같은 id 가 다르면 «충돌»로 따로 낸다 — 조용히 하나를 고르지 않는다.
 *  고를 때는 답이 있는 쪽, 그다음 늦게 답한 쪽을 앞에 둔다. */
export function 모든쪽지(root) {
  const 모음 = new Map();
  for (const w of worktree들(root)) {
    const 함 = join(w.경로, 우편함자리);
    if (!w.있음 || !existsSync(함)) continue;
    for (const f of readdirSync(함).filter((x) => x.endsWith('.json'))) {
      let 쪽지;
      try {
        쪽지 = JSON.parse(readFileSync(join(함, f), 'utf8'));
      } catch {
        continue;
      }
      const 판들 = 모음.get(쪽지.id) ?? [];
      판들.push({ ...쪽지, 파일: f, 자리: w.경로 });
      모음.set(쪽지.id, 판들);
    }
  }
  const 점수 = (x) => [x.state === 'OPEN' ? 0 : 1, String(x.answered_at ?? '')];
  const 쪽지들 = [];
  const 충돌 = [];
  for (const [id, 판들] of 모음) {
    판들.sort((a, b) => {
      const [sa, ta] = 점수(a);
      const [sb, tb] = 점수(b);
      return sb - sa || tb.localeCompare(ta);
    });
    /** OPEN 판과 답한 판이 같이 있는 것은 충돌이 아니라 «진행»이다. 답한 판끼리 다를 때만 충돌이다. */
    const 내용 = new Set(판들.filter((x) => x.state !== 'OPEN').map(({ 자리, 파일, ...x }) => JSON.stringify(x)));
    if (내용.size > 1) 충돌.push({ id, 자리: 판들.map((x) => x.자리) });
    쪽지들.push(판들[0]);
  }
  쪽지들.sort((a, b) => String(a.asked_at).localeCompare(String(b.asked_at)));
  return { 쪽지들, 충돌 };
}

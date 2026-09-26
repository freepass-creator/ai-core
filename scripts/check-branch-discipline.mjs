// PR 이 main 에서 멀어지지 않았는지, 같은 정본을 다른 열린 PR 이 동시에 고치고 있지 않은지 잰다.
//
// 갈림은 대개 여기서 생긴다(2026-09-25 전 저장소 점검): 사흘·백 커밋씩 묵은 가지, 같은 정본 파일을
// 두세 PR 이 각자 고치다 한쪽이 병합되면 나머지가 옛 판으로 되돌리는 일.
//
//   node scripts/check-branch-discipline.mjs [--root <repo>] [--base main]
// CI 에서는 GITHUB_TOKEN·GITHUB_REPOSITORY·PR_NUMBER 가 있으면 열린 PR 과의 겹침까지 본다.
// 토큰이 없으면 겹침 검사는 SKIPPED 라고 분명히 찍는다(조용히 통과시키지 않는다).
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function canonicalPaths(registry) {
  const out = new Set();
  for (const line of registry.lines ?? []) {
    if (line.canonical_entrypoint) out.add(line.canonical_entrypoint);
    for (const r of line.canonical_roots ?? []) out.add(r);
  }
  return [...out];
}

export const touches = (file, root) => (root.endsWith('/') || !root.includes('.') ? file.startsWith(root) : file === root);

export function overlaps(myFiles, otherFiles, roots) {
  const mine = roots.filter(r => myFiles.some(f => touches(f, r)));
  return mine.filter(r => otherFiles.some(f => touches(f, r)));
}

export function validateHeadBranch(headRef, policy = {}, today = new Date().toISOString().slice(0, 10)) {
  if (!headRef) return [];
  const exceptions = new Map((policy.legacy_head_exceptions ?? []).map(x => [x.branch, x]));
  const legacy = exceptions.get(headRef);
  if (legacy && (!legacy.expires || legacy.expires >= today)) return [];
  const actor = (policy.forbidden_actor_prefixes ?? []).find(prefix => headRef.startsWith(prefix));
  if (actor) return [`ACTOR_OWNED_BRANCH_FORBIDDEN: ${headRef} starts with ${actor} — resume/create work/<project-id>/<work-id>`];
  const patterns = policy.allowed_head_patterns ?? [];
  if (!patterns.length) return [];
  const allowed = patterns.some(pattern => new RegExp(pattern, 'i').test(headRef));
  return allowed ? [] : [`WORK_BRANCH_REQUIRED: ${headRef} — use work/<project-id>/<work-id> or an explicitly allowed automation branch`];
}

async function gh(path, token) {
  const res = await fetch(`https://api.github.com${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' } });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${path}`);
  return res.json();
}

async function prFiles(repo, number, token) {
  const files = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await gh(`/repos/${repo}/pulls/${number}/files?per_page=100&page=${page}`, token);
    files.push(...batch.map(f => f.filename));
    if (batch.length < 100) break;
  }
  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
  const root = resolve(opt('--root', here));
  const base = opt('--base', process.env.GITHUB_BASE_REF || 'main');
  const registryPath = join(root, 'registry/canonical-development-lines.json');
  if (!existsSync(registryPath)) { console.error('FAIL: registry/canonical-development-lines.json missing'); process.exitCode = 1; return; }
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  const policy = registry.repository_guards?.pull_request ?? {};
  const git = (...a) => execFileSync('git', ['-c', 'core.quotepath=false', ...a], { cwd: root, encoding: 'utf8' }).trim();
  const errors = [];
  const headRef = process.env.PR_HEAD_REF || process.env.GITHUB_HEAD_REF || null;
  errors.push(...validateHeadBranch(headRef, policy));

  // CI 의 pull_request checkout 은 main 이 이미 합쳐진 병합 커밋이라 HEAD 로 재면 늘 0 이다 — PR 끝 커밋으로 잰다.
  const head = process.env.PR_HEAD_SHA || 'HEAD';
  const behind = Number(git('rev-list', '--count', `${head}..origin/${base}`));
  const max = policy.max_behind_main ?? 30;
  if (behind > max) errors.push(`BRANCH_TOO_FAR_BEHIND_MAIN: ${behind} commits behind origin/${base} (max ${max}) — merge ${base} into this branch first`);
  else console.log(`ok: ${behind} commits behind origin/${base} (max ${max})`);

  const myFiles = git('diff', '--name-only', `origin/${base}...${head}`).split('\n').filter(Boolean);
  const roots = canonicalPaths(registry);
  const touched = roots.filter(r => myFiles.some(f => touches(f, r)));
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  const self = Number(process.env.PR_NUMBER || 0);
  if (policy.single_open_pr_per_canonical_path && touched.length) {
    if (!token || !repo) console.log(`SKIPPED: open-PR overlap check (no GITHUB_TOKEN/GITHUB_REPOSITORY) — this PR touches canonical ${touched.join(', ')}`);
    else {
      const open = await gh(`/repos/${repo}/pulls?state=open&per_page=100`, token);
      for (const pr of open) {
        if (pr.number === self) continue;
        const shared = overlaps(myFiles, await prFiles(repo, pr.number, token), touched);
        if (!shared.length) continue;
        // 초안끼리는 막지 않되 보이게 한다 — 초안이 «준비 완료» 로 바뀌는 순간 둘 중 하나는 여기서 막힌다.
        if (pr.draft) console.log(`notice: draft PR #${pr.number} (${pr.head.ref}) also changes ${shared.join(', ')}`);
        else errors.push(`CANONICAL_PATH_CONTESTED: PR #${pr.number} (${pr.head.ref}) also changes ${shared.join(', ')} — finish or close one first`);
      }
      if (!errors.some(e => e.startsWith('CANONICAL_PATH_CONTESTED'))) console.log(`ok: no other ready PR changes ${touched.join(', ')}`);
    }
  }
  if (errors.length) { errors.forEach(e => console.error(`FAIL: ${e}`)); process.exitCode = 1; }
  else console.log('PASS: branch discipline');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

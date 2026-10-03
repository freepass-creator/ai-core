#!/usr/bin/env node
// 제품 저장소의 AI Core 시작 키트를 다시 깔 «준비»를 한다 — 푸시하지 않는다.
//
// ★2026-10-03: compat 3 재배포를 손으로 10번 했다. 그 절차(GPT 상의 MODIFY 반영)를 여기 고정한다.
//   - 사용자 작업 폴더는 건드리지 않는다: 그 클론에 임시 worktree 를 origin/main 에서 만든다
//   - 생성기는 내용이 다른 키트를 덮어쓰지 않는다 → 옛 .ai-core 제거 커밋 → 새 키트 커밋(두 커밋: 원인·되돌림 지점이 선명)
//   - ★키트 밖 프로젝트 소유 파일(예: freepass-sales .ai-core/ui-ux.consumer.json)은 되살려 보존한다 — 실제로 지워질 뻔했다
//   - .ai-core 밖 변경 0 · verify-kit PASS · bootstrap 키트 막힘 0 을 확인한다
//   - 원격 PR 가지 SHA 를 기록해 두고, 푸시는 그 SHA 에 고정한 --force-with-lease 명령만 찍는다(푸시는 사람·AI 가 따로 한다)
//
//   node scripts/kit-redistribute.mjs <project-id> --branch <PR 가지> [--work <임시 폴더>]
//   → stdout 에 증거 JSON. exit 0 READY_TO_PUSH · 1 HOLD(failed_at 에 단계)
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const coreRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 이전에 있었는데 새 트리에 없는 .ai-core 파일 중 «옛 키트가 만든 것이 아닌» 것 — 되살릴 프로젝트 소유 파일.
 *  ★Codex 검토(REQUEST_CHANGES): 없어진 것을 전부 되살리면 새 생성기가 «일부러» 뺀 옛 생성물까지 부활한다.
 *  옛 kit.json 의 files[](와 kit.json 자신)은 생성물이므로 되살리지 않는다. 옛 매니페스트를 못 읽으면 아무것도 되살리지 않고 HOLD 로 알린다. */
export function lostFiles(before, after, oldManifestPaths) {
  if (!Array.isArray(oldManifestPaths)) return null;
  const now = new Set(after);
  const generated = new Set(['.ai-core/kit.json', ...oldManifestPaths.map((p) => `.ai-core/${p}`)]);
  return before.filter((p) => p.startsWith('.ai-core/') && !now.has(p) && !generated.has(p)).sort();
}

const sh = (cwd, cmd, args) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
};
const git = (cwd, ...a) => sh(cwd, 'git', a);
const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
const TRAILER = '\n\nCo-Authored-By: AI Core kit-redistribute <noreply@anthropic.com>';

function main() {
  const argv = process.argv.slice(2);
  const opt = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : null; };
  const id = argv[0];
  const branch = opt('branch');
  if (!id || !branch) {
    console.error('사용법: node scripts/kit-redistribute.mjs <project-id> --branch <PR 가지> [--work <임시 폴더>]');
    process.exit(2);
  }
  const registry = JSON.parse(readFileSync(join(coreRoot, 'registry/projects.json'), 'utf8'));
  const project = registry.projects.find((p) => p.project_id === id);
  const clone = project?.local_path?.replaceAll('\\', '/');
  const tmp = opt('work') ?? join(tmpdir(), `ai-core-kit-${id}`);
  const ev = { schema: 'ai-core-kit-redistribute/v1', project_id: id, clone, branch, work: tmp, steps: [] };
  const step = (name, ok, detail = null) => {
    ev.steps.push({ name, ok, detail });
    if (!ok) { ev.status = 'HOLD'; ev.failed_at = name; console.log(JSON.stringify(ev, null, 2)); process.exit(1); }
  };

  /** 키트는 «만든 ai-core 커밋»을 core_revision 으로 적고, 제품 bootstrap 은 그 커밋을 GitHub 에서 비교한다.
   *  작업 가지·미푸시 커밋에서 만들면 제품마다 원격에 없는 커밋을 가리켜 AI_CORE_KIT_FRESHNESS_UNKNOWN 이 된다(2026-10-03 실측). */
  git(coreRoot, 'fetch', '-q', 'origin', 'main');
  const coreHead = git(coreRoot, 'rev-parse', 'HEAD').out;
  const coreMain = git(coreRoot, 'rev-parse', 'origin/main').out;
  step('ai-core-at-origin-main', coreHead === coreMain && !git(coreRoot, 'status', '--porcelain').out, { head: coreHead, origin_main: coreMain, hint: 'main 체크아웃(C:\\dev\\ai-core)을 origin/main 에 맞춘 뒤 거기서 돌린다' });
  step('registered-clone', Boolean(clone && existsSync(clone)), { local_path: project?.local_path ?? null });
  step('fetch', git(clone, 'fetch', '-q', 'origin').ok);
  ev.origin_main = git(clone, 'rev-parse', 'origin/main').out;
  ev.remote_branch_sha_before = git(clone, 'ls-remote', 'origin', `refs/heads/${branch}`).out.split(/\s+/)[0] || null;

  if (existsSync(tmp)) { git(clone, 'worktree', 'remove', '--force', tmp); rmSync(tmp, { recursive: true, force: true }); }
  const local = `kit-redeploy/${id}`;
  step('worktree', git(clone, 'worktree', 'add', '-q', '-B', local, tmp, 'origin/main').ok, { local_branch: local });

  const before = lines(git(tmp, 'ls-files', '.ai-core').out);
  ev.ai_core_before = before.length;
  if (before.length) {
    step('remove-old-kit', git(tmp, 'rm', '-r', '-q', '.ai-core').ok);
    step('commit-remove', git(tmp, 'commit', '-q', '-m', `chore(ai-core): remove previous starter kit before regeneration${TRAILER}`).ok);
  }
  const start = sh(coreRoot, process.execPath, ['scripts/academy-start.mjs', '--task', 'AI Core starter kit redistribution', '--root', tmp, '--track', 'development', '--kit', '.ai-core']);
  let receipt = null;
  try { receipt = JSON.parse(start.out); } catch {}
  step('academy-start-READY', receipt?.status === 'READY', { blockers: receipt?.blockers ?? null });
  git(tmp, 'add', '.ai-core');
  step('commit-kit', git(tmp, 'commit', '-q', '-m', `chore(ai-core): regenerate AI Core starter kit${TRAILER}`).ok);

  let oldManifest = before.length ? null : [];
  if (before.length) {
    try { oldManifest = JSON.parse(git(tmp, 'show', 'origin/main:.ai-core/kit.json').out).files.map((f) => f.path); } catch {}
  }
  const lost = lostFiles(before, lines(git(tmp, 'ls-files', '.ai-core').out), oldManifest);
  step('old-manifest-readable', lost !== null, { why: lost === null ? '옛 kit.json 을 못 읽어 생성물과 프로젝트 소유 파일을 가를 수 없다 — 손으로 본다' : null });
  ev.dropped_generated = before.filter((p) => !lines(git(tmp, 'ls-files', '.ai-core').out).includes(p) && !lost.includes(p));
  if (lost.length) {
    step('restore-project-owned', git(tmp, 'checkout', 'origin/main', '--', ...lost).ok, { files: lost });
    step('commit-restore', git(tmp, 'commit', '-q', '-m', `chore(ai-core): keep project-owned files beside the regenerated kit\n\n${lost.join('\n')}${TRAILER}`).ok);
  }
  ev.preserved = lost;

  const changed = lines(git(tmp, 'diff', '--name-only', `${ev.origin_main}..HEAD`).out);
  step('only-ai-core-changed', changed.length > 0 && changed.every((p) => p.startsWith('.ai-core/')), { count: changed.length, outside: changed.filter((p) => !p.startsWith('.ai-core/')) });

  let v = null;
  try { v = JSON.parse(sh(tmp, process.execPath, ['.ai-core/verify-kit.mjs']).out); } catch {}
  step('verify-kit-PASS', v?.status === 'PASS', { revision: v?.revision?.status ?? null });

  let b = null;
  try { b = JSON.parse(sh(tmp, process.execPath, ['.ai-core/session-bootstrap.mjs']).out); } catch {}
  const kitBlockers = (b?.blockers ?? []).filter((x) => /^(AI_CORE_KIT|STARTER_KIT)/.test(x));
  step('bootstrap-no-kit-blockers', Boolean(b) && kitBlockers.length === 0, { blockers: b?.blockers ?? null });

  ev.head = git(tmp, 'rev-parse', 'HEAD').out;
  ev.status = 'READY_TO_PUSH';
  ev.push = ev.remote_branch_sha_before
    ? `git -C "${tmp}" push --force-with-lease=refs/heads/${branch}:${ev.remote_branch_sha_before} origin HEAD:refs/heads/${branch}`
    : `git -C "${tmp}" push origin HEAD:refs/heads/${branch}`;
  ev.after_push = 'CI 를 확인한다. 워크플로가 없으면 CI: UNAVAILABLE 로 적는다(통과로 세지 않음). 병합 뒤 origin/main 에서 verify-kit·bootstrap 을 다시 본다.';
  console.log(JSON.stringify(ev, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

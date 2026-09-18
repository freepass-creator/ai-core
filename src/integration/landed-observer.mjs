// 그룹 저장소에 «실제로 올라간 일» 을 GitHub 에서 읽어 둔다 — AI Core 가 쓰이게 하는 첫 길.
//
// ★2026-09-18 실측: 어제 0시 이후 다섯 저장소 main 에 263 커밋이 올라갔는데 AI Core
//   원장에는 0줄이었다. 원장은 3줄. 관문은 튼튼한데 그 안으로 흐르는 일이 없었다.
//   대표: 「통합하는거 하려고 하는건데 잘되나 모르겠다」 — 안 되고 있었다.
//
// ★PR 이 아니라 «기본 갈래의 커밋» 을 읽는다. 같은 날 잰 것:
//     aiops main 7 · 병합PR 0 / freepass-sales main 27 · 병합PR 0 / fp4 main 204 · 병합PR 71
//   PR 만 읽으면 대부분을 놓친다. 올라간 것은 커밋이다.
//
// ── 이것이 아닌 것
// - 원장이 아니다. 일의 상태를 옮기지 않는다. 「올라갔다」는 «관측» 이지 「끝났다」가 아니다.
//   원장에 RECEIVED→…→EXECUTED 를 지어 넣으면 «안 한 걸음» 을 한 것으로 만든다.
// - 권한을 주지 않는다. 아무것도 실행하지 않는다. GitHub 에서 읽기만 한다.
// - 정본이 아니다. GitHub 이 정본이고 이것은 언제든 다시 만들 수 있는 사본이다.
//
// ── 지키는 것
// - 못 읽은 프로젝트는 UNKNOWN 이다. 「올라간 것 없음」 과 「못 봤다」 는 다르다.
//   못 봤으면 이전 기록을 지우지 않고, 어디까지 봤는지(until)도 앞당기지 않는다.
// - 원장 일감이 묶인 리비전과 지금 head 사이에 무엇이 들어왔는지 같이 본다.
//   SUBJECT_REVISION_STALE 가 «왜» 났는지를 사람이 읽을 수 있게 한다.

import { dirname, join, resolve } from 'node:path';
import { verifyLedgerText } from '../../scripts/work-ledger.mjs';

export const 관측파일이름 = 'landed-observations.json';
export const 관측파일자리 = (ledgerPath) => join(dirname(resolve(ledgerPath)), 관측파일이름);
export const SCHEMA = 'ai-core-landed-observations/v1';

const SHA = /^[0-9a-f]{40}$/;
const 시간 = 3600_000;
const 날 = 24 * 시간;
const iso = (d) => new Date(d).toISOString().replace(/\.\d+Z$/, 'Z');

/** 커밋 한 개를 적을 꼴로. 제목 끝의 (#123) 이나 «Merge pull request #123» 에서 PR 번호를 읽는다. */
export function 커밋정리(raw, projectId) {
  const 제목 = String(raw?.message ?? '').split(/\r?\n/)[0].trim();
  const pr = 제목.match(/\(#(\d+)\)\s*$/)?.[1] ?? 제목.match(/^Merge pull request #(\d+)/)?.[1] ?? null;
  return {
    project_id: projectId,
    sha: raw.sha,
    subject: 제목,
    author: raw.author ?? null,
    committed_at: raw.committed_at,
    pr: pr === null ? null : Number(pr),
  };
}

/** ★2026-09-18 실측: 없는 SHA 에 GitHub 은 404 가 아니라 422 「No commit found」 로도 답한다. */
const 이유 = (error) => (/\b404\b|\b422\b|Not Found|No commit found|No common ancestor/i.test(String(error?.message ?? error))
  ? 'REVISION_NOT_IN_PROJECT' : 'REMOTE_UNOBSERVED');

/**
 * 관측한다({ registry, ledgerText, prior, gh, now }) -> 새 관측 문서
 *
 * gh = { head(repo, branch) -> sha, commits(repo, branch, sinceIso) -> raw[], compare(repo, base, head) -> { status, ahead_by, behind_by, files[] } }
 * ★gh 는 주입한다 — 검사에서는 가짜, 운영에서는 `gh api`.
 */
export async function 관측한다({ registry, ledgerText = '', prior = null, gh, now = new Date(), 처음며칠 = 7, 보관일 = 30, 겹침시간 = 1 }) {
  const 이제 = iso(now);
  const 이전프 = prior?.projects ?? {};
  const projects = {};
  const 새커밋 = [];

  for (const 프 of registry?.projects ?? []) {
    const id = 프.project_id;
    const 전 = 이전프[id];
    if (!프.repository || !프.default_branch) {
      projects[id] = { ...전, status: 'UNKNOWN', reason: 'CANONICAL_REF_UNDECLARED' };
      continue;
    }
    /** ★이전에 «본» 데까지에서 겹쳐 다시 읽는다. 못 본 적만 있으면 처음처럼 읽는다. */
    const since = 전?.until ? iso(Date.parse(전.until) - 겹침시간 * 시간) : iso(now.getTime() - 처음며칠 * 날);
    try {
      const head = await gh.head(프.repository, 프.default_branch);
      if (typeof head !== 'string' || !SHA.test(head)) throw new Error('HEAD_UNOBSERVED');
      const raws = await gh.commits(프.repository, 프.default_branch, since);
      if (!Array.isArray(raws)) throw new Error('COMMITS_UNOBSERVED');
      for (const raw of raws) if (raw && SHA.test(raw.sha ?? '')) 새커밋.push(커밋정리(raw, id));
      /** covered_from — 여기서부터 지금까지 «빈틈 없이» 읽었다. 이어 읽었으면 이전 시작을 물려받는다. */
      const 이어 = 전?.until ? (전.covered_from ?? 전.since) : since;
      const covered_from = iso(Math.max(Date.parse(이어), now.getTime() - 보관일 * 날));
      projects[id] = { repository: 프.repository, branch: 프.default_branch, status: 'OBSERVED', since, until: 이제, covered_from, head };
    } catch (error) {
      /** 못 봤다. 이전 기록(until·head)은 «그대로» 두고 상태만 UNKNOWN 으로. */
      projects[id] = { repository: 프.repository, branch: 프.default_branch, ...전, status: 'UNKNOWN', reason: 이유(error) };
    }
  }

  /** 합친다 — 같은 커밋은 한 번. 보관일보다 오래된 것은 버린다(GitHub 에 그대로 있다). */
  const 한계 = now.getTime() - 보관일 * 날;
  const 모음 = new Map();
  for (const c of [...(prior?.commits ?? []), ...새커밋]) {
    if (Date.parse(c.committed_at) >= 한계) 모음.set(`${c.project_id}:${c.sha}`, c);
  }
  const commits = [...모음.values()].sort((a, b) => Date.parse(b.committed_at) - Date.parse(a.committed_at) || a.sha.localeCompare(b.sha));

  return { schema: SCHEMA, 무엇: '파생 사본 — GitHub 기본 갈래 커밋을 읽어 둔 것. 원장이 아니고 권한을 주지 않는다. 언제든 다시 만든다.',
    as_of: 이제, projects, works: await 묶인뒤(ledgerText, projects, gh), commits };
}

/** 원장 일감이 묶인 리비전 → 지금 head 사이에 무엇이 들어왔나. */
async function 묶인뒤(ledgerText, projects, gh) {
  if (!ledgerText.trim()) return [];
  const 원장 = verifyLedgerText(ledgerText);
  if (원장.status !== 'VALID') return [{ status: 'UNKNOWN', reason: 'LEDGER_INVALID' }];
  const 결과 = [];
  for (const [work_id, w] of Object.entries(원장.work)) {
    const 프 = projects[w.project_id];
    const 줄 = { work_id, project_id: w.project_id, state: w.state, bound: w.subject_revision ?? null, head: 프?.head ?? null };
    if (!줄.bound) { 결과.push({ ...줄, status: 'UNBOUND' }); continue; }
    if (프?.status !== 'OBSERVED') { 결과.push({ ...줄, status: 'UNKNOWN', reason: 프 ? 'PROJECT_UNOBSERVED' : 'PROJECT_UNREGISTERED' }); continue; }
    if (줄.bound === 프.head) { 결과.push({ ...줄, status: 'CURRENT', ahead_by: 0, files: [] }); continue; }
    try {
      const c = await gh.compare(프.repository, 줄.bound, 프.head);
      const files = Array.isArray(c?.files) ? c.files : [];
      결과.push({ ...줄, status: c?.status === 'ahead' ? 'BEHIND_HEAD' : 'DIVERGED', ahead_by: c?.ahead_by ?? null,
        files_total: files.length, files: files.slice(0, 50) });
    } catch (error) {
      결과.push({ ...줄, status: 'UNKNOWN', reason: 이유(error) });
    }
  }
  return 결과;
}

/** 최근(관측, { hours, project, now }) — 읽기만 한다. 네트워크 없음. */
export function 최근(관측, { hours = 24, project = null, now = new Date() } = {}) {
  const 부터 = now.getTime() - hours * 시간;
  const 프들 = Object.entries(관측?.projects ?? {}).filter(([id]) => !project || id === project);
  return {
    as_of: 관측?.as_of ?? null,
    hours,
    projects: 프들.map(([id, p]) => {
      const commits = (관측.commits ?? []).filter((c) => c.project_id === id && Date.parse(c.committed_at) >= 부터);
      /** ★관측 창이 이 기간을 다 덮지 못하면 «이 수가 전부» 라고 말하지 않는다. */
      const 덮음 = p.status === 'OBSERVED' && Date.parse(p.covered_from) <= 부터;
      return { project_id: id, status: p.status, reason: p.reason ?? null, until: p.until ?? null, complete: 덮음, count: commits.length, commits };
    }),
    works: (관측?.works ?? []).filter((w) => !project || w.project_id === project),
  };
}

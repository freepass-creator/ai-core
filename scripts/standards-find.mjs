#!/usr/bin/env node
// 개발 시작 전에 틀을 «가져오는» 자리. 읽으라고 하면 안 읽는다.
//   node 틀.mjs                  등록된 규격 전부
//   node 틀.mjs 디자인            키워드로 찾기 (scope·project·경로 어디든 걸리면)
//   node 틀.mjs dev.design.token scope로 찾기
import { readFileSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export function resolveLocator(locator, { repoRoot, projects, projectsRoot, exists }) {
  const [첫, ...나머지] = locator.split(/[\\/]/);
  if (exists(join(repoRoot, 첫))) return join(repoRoot, 첫, ...나머지);
  const 프로젝트 = projects.find((p) => p.project_id === 첫 ||
    p.local_path?.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) === 첫);
  // 등록부의 local_path 는 다른 PC 경로일 수 있다 — 이 PC 에 실제로 있을 때만 쓴다
  const 등록경로 = 프로젝트?.local_path && exists(프로젝트.local_path) ? 프로젝트.local_path : null;
  return join(등록경로 || join(projectsRoot, 첫), ...나머지);
}

function main() {
const repoRoot = resolve(HERE, "..");
const projects = JSON.parse(readFileSync(join(repoRoot, "registry", "projects.json"), "utf8")).projects;
const 위치 = (locator) => resolveLocator(locator, {
  repoRoot, projects, projectsRoot: process.env.AI_CORE_PROJECTS_ROOT || "C:\\dev", exists: existsSync,
});
const registry = JSON.parse(readFileSync(join(HERE, "..", "registry", "devcenter-datasets.json"), "utf8"));
const query = process.argv.slice(2).join(" ").trim().toLowerCase();

const ROLE = {
  authoritative: "정본",
  candidate: "★미확정 — 대표님이 정해야 함",
  replica: "사본",
};

const hit = (d) =>
  !query ||
  [d.scope, d.project, d.owner, d.id, d.source.locator]
    .join(" ")
    .toLowerCase()
    .includes(query);

const matched = registry.datasets.filter(hit);

if (!matched.length) {
  console.log(`\n「${query}」에 걸리는 등록 규격이 없다.`);
  console.log("등록되지 않았다는 뜻이지, 규격이 없다는 뜻이 아니다.");
  console.log("찾아서 쓴 뒤에는 ../registry/devcenter-datasets.json 에 등록해라 — 안 그러면 다음 세션이 또 찾는다.\n");
  process.exit(2);
}

console.log("");
for (const d of matched) {
  const abs = 위치(d.source.locator);
  const there = existsSync(abs);
  let kind = "";
  if (there) kind = statSync(abs).isDirectory() ? " (폴더)" : "";
  console.log(`■ ${d.scope}`);
  console.log(`   ${ROLE[d.role] ?? d.role} · ${d.project} · 책임 ${d.owner}`);
  console.log(`   ${abs}${kind}`);
  if (!there) console.log(`   ★없다 — 규격이 옮겨졌거나 지워졌다. ../registry/devcenter-datasets.json 을 고쳐라`);
  console.log("");
}

// 가리킨 저장소가 «어느 가지»에 서 있나 — 폴더는 그대로여도 내용이 갈린다.
//   2026-09-09: freepasserp4 가 feat/spring-atom-monitor 에 서 있었고, 그 가지의
//   CLAUDE.md 는 main 보다 86줄 짧았다(지침 넷 누락). 누가 브랜치만 바꿔도 정본이 바뀐다.
const branchOf = (repo) => {
  try {
    const b = execFileSync("git", ["-C", repo, "rev-parse", "--abbrev-ref", "HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    const behind = execFileSync("git", ["-C", repo, "rev-list", "--count", "HEAD..origin/main"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return { b, behind };
  } catch { return null; }
};

const repos = [...new Set(matched.map((d) => d.source.locator.split("/")[0]))];
const offMain = [];
for (const r of repos) {
  const abs = 위치(r);
  if (!existsSync(abs)) continue;
  const g = branchOf(abs);
  if (g && (g.b !== "main" || g.behind !== "0")) offMain.push({ r, ...g });
}
if (offMain.length) {
  console.log("★ 이 폴더는 «main» 이 아니다 — 폴더째 믿지 마라:");
  for (const o of offMain) {
    console.log(`   ${o.r}  가지 ${o.b}${o.behind === "0" ? "" : ` · origin/main 보다 ${o.behind} 커밋 뒤`}`);
    console.log(`     정본으로 읽으려면:  git -C ${위치(o.r)} show origin/main:<경로>`);
  }
  console.log("");
}

const missing = matched.filter(
  (d) => !existsSync(위치(d.source.locator)),
);
const undecided = matched.filter((d) => d.role === "candidate");

if (undecided.length) {
  console.log(`★미확정 ${undecided.length}건 — 정본으로 확정할지 대표님 판단이 필요하다:`);
  for (const d of undecided) console.log(`   ${d.scope}  (${d.source.locator})`);
  console.log("");
}
console.log("겹치는 규격이 있는지 검사:");
console.log("   python devcenter\\ssot\\ssot_audit.py registry\\devcenter-datasets.json");
console.log("");

process.exit(missing.length ? 1 : 0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();

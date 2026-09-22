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
const DEV = resolve(HERE, "..");            // C:\dev
const registry = JSON.parse(readFileSync(join(HERE, "registry.json"), "utf8"));
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
  console.log("찾아서 쓴 뒤에는 registry.json 에 등록해라 — 안 그러면 다음 세션이 또 찾는다.\n");
  process.exit(2);
}

console.log("");
for (const d of matched) {
  const abs = join(DEV, d.source.locator.replaceAll("/", "\\"));
  const there = existsSync(abs);
  let kind = "";
  if (there) kind = statSync(abs).isDirectory() ? " (폴더)" : "";
  console.log(`■ ${d.scope}`);
  console.log(`   ${ROLE[d.role] ?? d.role} · ${d.project} · 책임 ${d.owner}`);
  console.log(`   ${abs}${kind}`);
  if (!there) console.log(`   ★없다 — 규격이 옮겨졌거나 지워졌다. registry.json 을 고쳐라`);
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
  const abs = join(DEV, r);
  if (!existsSync(abs)) continue;
  const g = branchOf(abs);
  if (g && (g.b !== "main" || g.behind !== "0")) offMain.push({ r, ...g });
}
if (offMain.length) {
  console.log("★ 이 폴더는 «main» 이 아니다 — 폴더째 믿지 마라:");
  for (const o of offMain) {
    console.log(`   ${o.r}  가지 ${o.b}${o.behind === "0" ? "" : ` · origin/main 보다 ${o.behind} 커밋 뒤`}`);
    console.log(`     정본으로 읽으려면:  git -C ${join(DEV, o.r)} show origin/main:<경로>`);
  }
  console.log("");
}

const missing = matched.filter(
  (d) => !existsSync(join(DEV, d.source.locator.replaceAll("/", "\\"))),
);
const undecided = matched.filter((d) => d.role === "candidate");

if (undecided.length) {
  console.log(`★미확정 ${undecided.length}건 — 정본으로 확정할지 대표님 판단이 필요하다:`);
  for (const d of undecided) console.log(`   ${d.scope}  (${d.source.locator})`);
  console.log("");
}
console.log("겹치는 규격이 있는지 검사:");
console.log("   python C:\\dev\\devcenter\\ssot\\ssot_audit.py C:\\dev\\devcenter\\registry.json");
console.log("");

process.exit(missing.length ? 1 : 0);

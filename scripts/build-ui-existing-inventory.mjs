import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative } from "node:path";

const sources = [
  { id: "freepass-sales", root: "C:/dev/freepass-sales", include: /^(웹|콜앱|손님)\// },
  { id: "freepass-admin", root: "C:/dev/freepass-admin", include: /^src\/app\// },
  { id: "freepasserp4", root: "C:/dev/freepasserp4", include: /^(app\/.+\/page\.tsx|app\/page\.tsx|components\/|features\/|lib\/(appbar|tabbar)\.tsx)/ },
  { id: "freepass-data", root: "C:/dev/freepass-data", include: /^preview\// },
  { id: "teamjpkwork", root: "C:/dev/teamjpkwork", include: /^(app\/.+\.(tsx|css)|components\/)/ },
  { id: "renman", root: "C:/dev/renman", include: /^(app\/.+\/page\.tsx|app\/page\.tsx|components\/|lib\/appbar\.tsx)/ },
];
const allowed = new Set([".tsx", ".jsx", ".html", ".css"]);
const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  if (entry.isDirectory()) return ["node_modules", ".git", ".next"].includes(entry.name) ? [] : walk(path);
  return [path];
});
const kind = (path) => {
  const name = basename(path).toLowerCase();
  if (name === "page.tsx" || name.endsWith(".html")) return "화면";
  if (name.endsWith(".css")) return "스타일";
  if (/nav|tab|bar|shell|layout|toolbar/.test(name)) return "이동·골격";
  if (/form|input|select|filter|search|upload|dropzone|edit/.test(name)) return "입력·검색";
  if (/table|list|row|card|grid|ledger/.test(name)) return "목록·표";
  if (/dialog|sheet|overlay|popover|menu/.test(name)) return "대화상자";
  if (/badge|status|toast|spinner|loading|feedback/.test(name)) return "상태·안내";
  return "내용·기능";
};
const status = (path) => /rtdb|legacy|archive|known-bad|\/test\/|\/demo\//i.test(path) ? "제외·이관대상" : "현재 후보";

const repositories = [];
const items = [];
for (const source of sources) {
  if (!existsSync(source.root)) continue;
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source.root, encoding: "utf8" }).trim();
  const files = walk(source.root).filter((file) => allowed.has(extname(file)));
  const selected = files.filter((file) => source.include.test(relative(source.root, file).replaceAll("\\", "/")));
  const searchable = files.map((file) => ({ path: relative(source.root, file).replaceAll("\\", "/"), text: readFileSync(file, "utf8") }));
  repositories.push({ id: source.id, root: source.root, commit, count: selected.length });
  for (const file of selected) {
    const path = relative(source.root, file).replaceAll("\\", "/");
    const stem = basename(file, extname(file));
    const itemKind = kind(path);
    const genericName = ["page", "index", "layout", "globals"].includes(stem.toLowerCase());
    const consumers = itemKind === "화면" || genericName ? [] : searchable.filter((candidate) => candidate.path !== path && candidate.text.includes(stem)).map((candidate) => candidate.path).slice(0, 12);
    items.push({ id: `${source.id}:${path}`, repository: source.id, commit, name: stem, kind: itemKind, status: status(path), source_path: path, applied_at: consumers.length ? consumers : [path] });
  }
}

const output = { contract: "ai-core-existing-ui-inventory/v1", generated_at: new Date().toISOString(), repositories, items };
writeFileSync(new URL("../registry/ui-existing-pattern-inventory.json", import.meta.url), `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${items.length} UI sources from ${repositories.length} repositories.`);

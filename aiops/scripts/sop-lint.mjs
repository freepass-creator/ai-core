/** SOP 규격 검사 + 목록 자동 생성 — 여러 AI가 각자 써도 규격이 갈리지 않게.
 *  2026-08-20 사장님: 「다른 AI들이 작업했던 기억이나 규격을 통일할 수 있게끔 해야지」
 *
 *  검사 항목
 *   ① 위치      — docs/sop/<영역>/ 안에 있어야 한다 (재무·차량·채권·영업·시트·AI운영)
 *   ② 제목      — 첫 줄이 `# SOP · <업무 이름>`
 *   ③ 주인 줄   — `주인: <코덱스|Claude> · …`
 *   ④ 5섹션    — 1.언제 2.시작 전 확인 3.순서 4.끝나고 확인 5.멈출 때
 *   ⑤ 명령     — 「순서」에 실행 가능한 명령(코드블록)이 있어야 한다
 *   ⑥ 중복     — 같은 업무를 두 파일이 다루지 않는지(제목 겹침)
 *
 *  실행: node scripts/sop-lint.mjs            검사만
 *        node scripts/sop-lint.mjs --index    docs/sop/README.md 의 목록을 파일에서 다시 생성
 */
import { readdirSync, readFileSync, writeFileSync, statSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = new URL('../docs/sop/', import.meta.url).pathname.replace(/^\//, '');
const AREAS = ['재무', '차량', '채권', '영업', '시트', 'AI운영'];
const SECTIONS = ['1. 언제', '2. 시작 전 확인', '3. 순서', '4. 끝나고 확인', '5. 멈출 때'];
const IDX = process.argv.includes('--index');

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (n.endsWith('.md') && !['README.md', '_양식.md'].includes(n)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const items = [];
let refCount = 0;
for (const p of files) {
  const rel = relative(ROOT, p).replace(/\\/g, '/');
  const area = rel.includes('/') ? rel.split('/')[0] : null;
  const t = readFileSync(p, 'utf8');
  const lines = t.split('\n');
  const problems = [];
  if (!area || !AREAS.includes(area)) problems.push(`위치 — 영역 폴더(${AREAS.join('·')}) 안으로`);
  const title = (lines[0] || '').trim();
  if (!/^# SOP · .+/.test(title)) problems.push('제목 — `# SOP · <업무 이름>` 형식');
  const owner = lines.slice(1, 6).find((l) => /^주인:/.test(l.trim()));
  if (!owner) problems.push('주인 줄 — `주인: 코덱스 · 날짜`');
  const missing = SECTIONS.filter((s) => !new RegExp(`^##\\s*${s.replace('.', '\\.')}`, 'm').test(t));
  if (missing.length) problems.push(`섹션 없음 — ${missing.join(', ')}`);
  const order = t.split(/^##\s*3\. 순서/m)[1]?.split(/^##\s*4\./m)[0] || '';
  if (!/```/.test(order)) problems.push('「순서」에 실행 명령(코드블록)이 없다');
  // ⑦ 적힌 파일이 실제로 있는가 — 형식만 맞고 안 돌아가는 매뉴얼을 막는다
  // 코드블록마다 바로 앞의 cd 를 그 블록의 자리로 본다 (한 매뉴얼이 두 저장소를 다룰 수 있다)
  const at = (idx) => { const m = [...t.slice(0, idx).matchAll(/cd\s+(C:[^\s`\n]+)/g)]; return m.length ? m[m.length - 1][1] : 'C:/dev/aiops'; };
  const refRe = /(?:scripts|tmp|lib\/domain|jageum|drive|sheets)\/[A-Za-z0-9_.가-힣-]+\.(?:mts|ts|cjs|mjs)/g;
  const blocks = [...t.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)];   // 코드블록 «안»만 = 실제로 돌리는 것
  const refs = blocks.flatMap((b) => [...b[1].matchAll(new RegExp(refRe.source, 'g'))].map((m) => ({ r: m[0], cwd: at(b.index + b[0].indexOf(b[1]) + m.index) })));
  const gone = [...new Set(refs.filter((x) => !existsSync(`${x.cwd}/${x.r}`)).map((x) => `${x.cwd}/${x.r}`))];
  if (gone.length) problems.push(`없는 파일 ${gone.length}개 — ${gone.slice(0, 4).join(', ')}${gone.length > 4 ? ' …' : ''}`);
  refCount += refs.length;
  items.push({ rel, area, name: title.replace(/^# SOP · /, '').trim() || rel, owner: (owner || '').replace(/^주인:\s*/, '').split('·')[0].trim(), problems, path: p });
}
// 중복 제목
const byName = {};
items.forEach((i) => { (byName[i.name] ||= []).push(i.rel); });
Object.entries(byName).filter(([, v]) => v.length > 1).forEach(([k, v]) => items.filter((i) => i.name === k).forEach((i) => i.problems.push(`중복 — 같은 업무 이름이 ${v.join(', ')} 에 있다`)));

const bad = items.filter((i) => i.problems.length);
console.log(`SOP ${items.length}개 · 규격 통과 ${items.length - bad.length} · 손볼 것 ${bad.length} · 적힌 명령 ${refCount}개 실존 확인\n`);
for (const i of items) console.log(`${i.problems.length ? '❌' : '✅'} ${i.rel.padEnd(34)} ${i.name.slice(0, 30).padEnd(32)} 주인 ${i.owner || '?'}`);
if (bad.length) { console.log('\n손볼 것'); for (const i of bad) { console.log(`  ${i.rel}`); i.problems.forEach((p) => console.log(`     - ${p}`)); } }

if (IDX) {
  const P = join(ROOT, 'README.md');
  let md = readFileSync(P, 'utf8');
  const head = md.split('\n## 재무')[0];
  let body = '';
  for (const a of AREAS) {
    const list = items.filter((i) => i.area === a);
    body += `\n## ${a}\n| 업무 | 상태 | 주인 | 파일 |\n|---|---|---|---|\n`;
    if (!list.length) body += '| _(아직 없음)_ | ⬜ | | |\n';
    for (const i of list) body += `| ${i.name} | ${i.problems.length ? '❌ 규격' : '✅'} | ${i.owner || '?'} | [${i.rel}](${i.rel}) |\n`;
  }
  const tail = md.split('\n---\n')[1] ? '\n---\n' + md.split('\n---\n').slice(1).join('\n---\n') : '';
  writeFileSync(P, head + body + tail);
  console.log('\ndocs/sop/README.md 목록 다시 생성');
}
process.exit(bad.length ? 1 : 0);

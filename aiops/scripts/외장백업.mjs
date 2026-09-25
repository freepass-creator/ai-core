/** ★★외장 백업 — «다른 기계» 에 한 벌 둔다 (2026-09-11)
 *
 *  대표: 「물리적으로 하드 달아가지고 거기다가 백업해도 돼」
 *  코덱스(H-20260910-013): 「백업은 ★해시 목록과 복원시험이 성공해야 «완료» 다.
 *                          ★D는 같은 PC이므로 핵심자료는 별도 외부 사본도 둔다」
 *
 *  ── ★왜 D로는 부족한가
 *  D:/backup 은 «같은 기계 안» 이다. PC가 죽거나 도난·화재면 C와 «같이» 간다.
 *  ★이 도구는 «뽑아서 들고 갈 수 있는» 곳에 한 벌을 만든다.
 *
 *  ── ★무엇을 넣나 (저장소지도.md 백업 규칙 ①~⑨)
 *      ○ 깃이 안 담는 «원본» 자료           tmp 원본PDF·그림·등록증
 *      ○ 원격이 «없는» 저장소               switchdebt·renman-v2·sales·sheetops
 *      ○ 깃 히스토리 (push 가 막힌 것)       aiops .git — 100MB 파일 셋 때문에 원격에 못 올린다
 *      ✗ node_modules·빌드캐시              규칙 ② — 다시 만들어진다. ★안 넣는다
 *      ✗ 원격에 올라간 것                    규칙 ① — clone 하면 된다
 *
 *    node scripts/외장백업.mjs                 어디에 할지 찾고 «얼마나» 인지만 본다
 *    node scripts/외장백업.mjs --간다=E:       실제로 넣는다
 *    node scripts/외장백업.mjs --검사=E:       ★해시로 «제대로 갔나» 를 잰다
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const 인 = process.argv.slice(2);
const 값 = (k) => (인.find((a) => a.startsWith(k)) ?? '').split('=')[1] ?? null;
const 간다 = 값('--간다');
const 검사 = 값('--검사');

/** ★넣을 것 — 규칙대로. «다시 만들어지는 것» 은 없다 */
const 담을것 = [
  { 이름: '업무원본',   곳: 'D:/backup/aiops-tmp-2026-09-10',      왜: '깃이 안 담는 원본 PDF·그림·등록증 (규칙 ④)' },
  { 이름: 'aiops깃',    곳: 'D:/backup/aiops-저장소-2026-09-10',    왜: '★push 가 막힌 깃 히스토리 (규칙 ⑤ 못 지킴)' },
  { 이름: '원격없는것', 곳: 'D:/backup/원격없는것-2026-09-10',      왜: '깃도 원격도 없는 다섯 (규칙 ③)' },
  { 이름: '안넣은것',   곳: 'D:/backup/fp4-안넣은것-2026-09-10',    왜: 'diff·bundle — 어디에도 없는 것' },
  { 이름: '게임세이브', 곳: 'D:/backup/게임세이브-2026-09-10',      왜: '다시 못 만드는 것' },
];

const GB = (n) => (n / 1073741824).toFixed(1);
function 크기(p, 깊이 = 0) {
  if (깊이 > 8) return 0;
  let s = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name);
      s += e.isDirectory() ? 크기(q, 깊이 + 1) : (() => { try { return fs.statSync(q).size; } catch { return 0; } })();
    }
  } catch { /* 못 열면 0 */ }
  return s;
}

/** ★뽑을 수 있는 드라이브를 찾는다 — C·D 는 «붙박이» 라 뺀다 */
function 외장찾기() {
  const 것 = [];
  for (const c of 'EFGHIJKLMNOPQRSTUVWXYZ') {
    const d = c + ':/';
    try { const st = fs.statfsSync(d); 것.push({ 드: d, 남: st.bavail * st.bsize, 다: st.blocks * st.bsize }); } catch { /* 없는 드라이브 */ }
  }
  return 것;
}

if (검사) {
  /** ★★«갔다» 가 아니라 «같다» 를 잰다 — 해시로 대 본다 (코덱스 요구) */
  const 뿌리 = path.join(검사.replace(/\/$/, ''), 'aiops-외장백업');
  const 목록 = path.join(뿌리, '_해시목록.txt');
  if (!fs.existsSync(목록)) { console.log(`\n   ★해시 목록이 없다 — ${목록}\n   먼저 --간다=${검사} 로 넣어라\n`); process.exit(1); }
  const 줄 = fs.readFileSync(목록, 'utf8').split(String.fromCharCode(10)).filter(Boolean);
  let 맞 = 0, 틀 = 0, 없 = 0;
  for (const l of 줄) {
    const i = l.indexOf('  ');
    if (i < 0) continue;
    const h = l.slice(0, i), rel = l.slice(i + 2);
    const q = path.join(뿌리, rel);
    if (!fs.existsSync(q)) { 없 += 1; continue; }
    const 지금 = crypto.createHash('sha256').update(fs.readFileSync(q)).digest('hex');
    if (지금 === h) 맞 += 1; else { 틀 += 1; console.log(`   ★다르다: ${rel}`); }
  }
  console.log(`\n   ★검사 — 같다 ${맞} · 다르다 ${틀} · 없다 ${없}`);
  console.log(틀 || 없 ? '   ★★백업이 «완료가 아니다». 다시 넣어라\n' : '   ★★해시가 다 맞다 — 백업 «완료»\n');
  process.exit(틀 || 없 ? 1 : 0);
}

const 있는것 = 담을것.filter((x) => fs.existsSync(x.곳));
console.log(`\n════ ★외장 백업 — «다른 기계» 에 한 벌 ════\n`);
let 합 = 0;
for (const x of 있는것) { const s = 크기(x.곳); 합 += s; console.log(`   ${GB(s).padStart(6)}GB  [${x.이름}]  ${x.왜}`); }
for (const x of 담을것.filter((y) => !fs.existsSync(y.곳))) console.log(`   ★없다  [${x.이름}]  ${x.곳}`);
console.log(`\n   ★넣을 것 모두 ${GB(합)}GB`);

const 외장 = 외장찾기();
console.log(`\n   ── 쓸 수 있는 드라이브 (C·D 는 붙박이라 뺐다)`);
if (!외장.length) console.log(`   ★없다 — 외장하드를 꽂아라. 꽂고 다시 부르면 여기 뜬다`);
else for (const d of 외장) console.log(`   ${d.드}  여유 ${GB(d.남)}GB / ${GB(d.다)}GB  ${d.남 > 합 ? '★넣을 수 있다' : '★자리가 모자라다'}`);

if (!간다) { console.log(`\n   ※실제로 넣으려면  node scripts/외장백업.mjs --간다=E:\n   ※넣은 뒤 반드시   node scripts/외장백업.mjs --검사=E:\n`); process.exit(0); }

const 뿌리 = path.join(간다.replace(/\/$/, ''), 'aiops-외장백업');
fs.mkdirSync(뿌리, { recursive: true });
console.log(`\n   → ${뿌리} 로 넣는다\n`);
for (const x of 있는것) {
  const 목 = path.join(뿌리, x.이름);
  console.log(`   [${x.이름}] 넣는 중...`);
  try {
    execFileSync('robocopy', [x.곳, 목, '/E', '/COPY:DAT', '/R:1', '/W:1', '/MT:8', '/XJ', '/NFL', '/NDL', '/NP',
      '/XD', 'node_modules', '.next', 'dist', '.turbo'], { stdio: 'ignore' });
  } catch { /* robocopy 는 0이 아닌 코드로도 «성공» 을 말한다 */ }
  console.log(`   [${x.이름}] 끝`);
}

/** ★해시 목록을 남긴다 — 이게 있어야 «완료» 를 말할 수 있다 */
console.log(`\n   해시 목록 만드는 중...`);
const 줄들 = [];
const 걷 = (p, 깊이 = 0) => {
  if (깊이 > 12) return;
  let 목;
  try { 목 = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
  for (const e of 목) {
    const q = path.join(p, e.name);
    if (e.isDirectory()) { 걷(q, 깊이 + 1); continue; }
    if (e.name === '_해시목록.txt') continue;
    try {
      const h = crypto.createHash('sha256').update(fs.readFileSync(q)).digest('hex');
      줄들.push(h + '  ' + path.relative(뿌리, q).split(path.sep).join('/'));
    } catch { /* 못 읽으면 건너뛴다 */ }
  }
};
걷(뿌리);
fs.writeFileSync(path.join(뿌리, '_해시목록.txt'), 줄들.join(String.fromCharCode(10)) + String.fromCharCode(10));
console.log(`   ★해시 ${줄들.length.toLocaleString('ko-KR')}개 적었다 — _해시목록.txt`);
console.log(`\n   ★★아직 «완료» 가 아니다. 검사까지 해야 완료다:\n      node scripts/외장백업.mjs --검사=${간다}\n`);

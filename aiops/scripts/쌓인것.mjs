/** ★★똥이 «쌓이는 자리» 를 찾는다 — 2026-09-10
 *
 *  대표: 「어느 순간부터 뭘 하면 이렇게 뭐가 계속 똥처럼 쌓이는데
 *         이거 근본적으로 해결할 방법이 없나?」
 *
 *  ── ★무늬가 하나다
 *  2026-09-10 하루에 같은 것을 넷 봤다 —
 *      devcenter/portal/.dist·static-previous-*   이틀에 148개 · 19.2GB
 *      aiops/tmp/read/adhoc                       13,642개 · 4.8GB
 *      C:/dev/.wt-* 고아                          35개
 *      Cursor state.vscdb / .codex sessions       12.7GB / 6.3GB
 *  ★전부 «만드는 줄» 은 있는데 «치우는 줄» 이 없다.
 *    build-static.mjs 는 주석에 「되돌리기용으로 남긴다」 라 «하나» 를 말해 놓고 148개를 남겼다.
 *
 *  ── ★그래서 이 도구는 «코드» 가 아니라 «디스크» 를 본다
 *  누가 만들었는지 몰라도 된다. ★한 폴더 안에 «이름이 같은 꼴» 이 여럿이면 그게 쌓인 자리다.
 *      .static-previous-1788925343333 · .static-previous-1788926999590 · …
 *      read-0695bb86-….xls · read-38e8db05-….xls · …
 *  ★그리고 「치우는 데가 있나」 를 같이 묻는다 — 없으면 «앞으로도» 쌓인다.
 *
 *    node scripts/쌓인것.mjs            aiops 안
 *    node scripts/쌓인것.mjs --전체      C:/dev 전부
 *    node scripts/쌓인것.mjs --자세히
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const 전체 = process.argv.includes('--전체');
const 자세히 = process.argv.includes('--자세히');
const 뿌리들 = 전체 ? ['C:/dev'] : ['.'];

/** ★몇 개부터 «쌓였다» 고 보나 — 되돌리기 2~3개는 정상이다 */
const 문턱 = 8;
const 건너뛴다 = /(^|\/)(node_modules|\.git|\.venv|__pycache__|\.next\/cache)(\/|$)/;

/** 이름에서 «변하는 부분» 을 지워 꼴을 만든다 — 숫자·UUID·날짜 */
const 꼴 = (이름) => 이름
  .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '‹uuid›')
  .replace(/\d{10,}/g, '‹때›')
  .replace(/\d{4}-?\d{2}-?\d{2}/g, '‹날›')
  .replace(/\d+/g, '‹수›');

/** ★역슬래시를 «리터럴로» 안 쓴다 — heredoc→도구→파일 을 지나며 한 겹씩 먹힌다(2026-09-10 다섯 번 겪었다).
 *  docs/aiknowhow/한글로-코딩-함정.md 「git ls-files 를 다른 프로그램에 넘길 때」 */
const 슬래시 = (x) => String(x).split(String.fromCharCode(92)).join('/');

const 쌓인곳 = [];
function 걷기(dir, 깊이 = 0) {
  if (깊이 > 6) return;
  let 것;
  try { 것 = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  const 무리 = new Map();
  for (const e of 것) {
    const k = 꼴(e.name);
    if (k === e.name) continue;              /* 변하는 부분이 없으면 «한 개짜리» 다 */
    if (!무리.has(k)) 무리.set(k, []);
    무리.get(k).push(e);
  }
  for (const [k, 목] of 무리) {
    if (목.length < 문턱) continue;
    let 바이트 = 0;
    for (const e of 목.slice(0, 400)) {
      try { 바이트 += e.isDirectory() ? 재기(path.join(dir, e.name)) : fs.statSync(path.join(dir, e.name)).size; } catch { /* 못 재면 넘어간다 */ }
    }
    쌓인곳.push({ 곳: 슬래시(dir), 꼴: k, 수: 목.length, MB: Math.round(바이트 / 1048576), 폴더인가: 목[0].isDirectory() });
  }
  for (const e of 것) {
    if (!e.isDirectory()) continue;
    const p = 슬래시(path.join(dir, e.name));
    if (건너뛴다.test(p)) continue;
    걷기(p, 깊이 + 1);
  }
}
function 재기(p, 깊이 = 0) {
  if (깊이 > 4) return 0;
  let s = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name);
      if (e.isDirectory()) s += 재기(q, 깊이 + 1);
      else { try { s += fs.statSync(q).size; } catch { /* 넘어간다 */ } }
    }
  } catch { /* 못 열면 0 */ }
  return s;
}

/** ★★차기 «전» 에 말한다 — 1%가 되고 나서 아는 것은 늦다 (2026-09-10)
 *  실측: C가 1% 남았을 때 SSD 순차쓰기가 1,031 → ★63MB/s 로 죽어 있었다.
 *  SSD는 빈 블록이 있어야 빠르게 쓴다. ★15~20%는 비워 둔다. */
function 디스크경보() {
  const GB = (n) => (n / 1073741824).toFixed(1);
  for (const 드 of ['C:/', 'D:/']) {
    try {
      const st = fs.statfsSync(드);
      const 다 = st.blocks * st.bsize, 남 = st.bavail * st.bsize, 몫 = 남 / 다 * 100;
      if (몫 < 15) console.log(`   ★★${드} 여유 ${GB(남)}GB / ${GB(다)}GB (${몫.toFixed(1)}%) — 15% 아래다. SSD면 쓰기가 «느려진다»`);
      else console.log(`   ○ ${드} 여유 ${GB(남)}GB / ${GB(다)}GB (${몫.toFixed(1)}%)`);
    } catch { /* 없는 드라이브는 넘어간다 */ }
  }
}
디스크경보();

for (const r of 뿌리들) 걷기(r);
쌓인곳.sort((a, b) => b.MB - a.MB);

console.log(`\n════ ★쌓이는 자리 (${전체 ? 'C:/dev 전부' : 'aiops'}) — ${문턱}개 넘게 같은 꼴이 모인 데 ════\n`);
if (!쌓인곳.length) { console.log('   ★없다\n'); process.exit(0); }

let 합 = 0;
for (const x of 쌓인곳.slice(0, 자세히 ? 100 : 20)) {
  합 += x.MB;
  console.log(`   ${String(x.MB).padStart(6)}MB  ${String(x.수).padStart(6)}개  ${x.곳}`);
  console.log(`            ${x.꼴}`);
}
console.log(`\n   ★모두 ${쌓인곳.length}군데 · 위 ${Math.min(쌓인곳.length, 자세히 ? 100 : 20)}개 합 ${합.toLocaleString('ko-KR')}MB`);
console.log(`\n   ※「몇 개까지 두나」 를 ★만드는 코드 옆에 적어라. 나중에 사람이 치우게 두지 마라.`);
console.log(`   ※되돌리기용이면 2~3개면 된다 — devcenter/portal/build-static.mjs 되돌리기보관수 참고\n`);

/** ★막지는 않는다 — 무엇이 정상인지 사람이 정해야 한다. 다만 «보이게» 한다 */
process.exit(0);

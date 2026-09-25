/** ★★주기 청소 — 쌓이는 것을 «규칙대로» 치운다 (2026-09-10)
 *
 *  대표: 「제대로 정리하고 저런 거 지우는 거 무슨 시스템 만들어놔야겠어. 주기적으로 좀 지워」
 *
 *  ── ★왜
 *  2026-09-10 에 C(464GB)가 ★4.5GB 남았다. 그런데 «사람이 쓴 소스» 는 2GB 남짓이었다.
 *  나머지는 다 기계가 만들고 아무도 안 치운 것 —
 *      빌드캐시 24GB · node_modules 17.8GB · AI 대화이력 21GB · AppData 캐시 40GB
 *  ★쌓이는 자리를 찾는 것은 scripts/쌓인것.mjs 다. ★치우는 것은 여기다.
 *
 *  ── ★지키는 것 셋
 *  ① 기본은 «보기만» 이다. 정말 지우려면 --한다 를 준다.
 *  ② «업무 자료» 는 절대 안 건드린다 — lib/wonja · Documents · Downloads · 원본 PDF·그림
 *  ③ 무엇을 왜 지웠는지 «말한다». 조용히 지우지 않는다.
 *
 *    node scripts/청소.mjs           보기만 (아무것도 안 지운다)
 *    node scripts/청소.mjs --한다     실제로 지운다
 *    node scripts/청소.mjs --한다 --만=temp,npm     고른 것만
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const 한다 = process.argv.includes('--한다');
const 만 = (process.argv.find((a) => a.startsWith('--만=')) ?? '').slice(4).split(',').filter(Boolean);
const 집 = os.homedir();
const 이제 = Date.now();
const 날 = (n) => n * 864e5;

/** ★이 세션이 쓰는 자리는 «절대» 안 지운다 — 지우면 지금 도는 작업이 깨진다 */
const 지키는것 = [
  path.join(집, 'AppData', 'Local', 'Temp', 'claude'),
  path.join(집, '.claude'),
];
const 지킬까 = (p) => 지키는것.some((k) => p.toLowerCase().startsWith(k.toLowerCase()));

/** ★규칙표 — 여기만 고치면 된다 */
const 규칙 = [
  { 이름: 'temp', 곳: path.join(집, 'AppData', 'Local', 'Temp'), 갈래: '파일', 지난: 날(7),
    무엇: '윈도우 임시파일 — 7일 지난 것' },
  { 이름: 'npm', 곳: path.join(집, 'AppData', 'Local', 'npm-cache'), 갈래: '파일', 지난: 날(30),
    무엇: 'npm 내려받기 캐시 — 다시 받으면 된다' },
  { 이름: 'codex', 곳: path.join(집, '.codex', 'sessions'), 갈래: '파일', 지난: 날(14),
    무엇: '코덱스 옛 대화 기록' },
  { 이름: 'adhoc', 곳: 'tmp/read', 갈래: '파일', 지난: 날(30),
    무엇: '드라이브 내려받기 임시 — lib/drive.mjs runTmp() 가 만든다. 다시 안 읽는다' },
  { 이름: 'jjogaegi', 곳: 'tmp/쪼개기', 갈래: '파일', 지난: 날(30),
    무엇: '고지서 쪼갠 조각 — 낱장은 드라이브에 올라가 있다' },
  /** ★★tmp 는 «어디서 왔나» 로 가른다 — 2026-09-11 실측
   *  코덱스: 「파일명·크기로 가르지 말고 «소비 여부 + 재생성 가능 여부 + 원본 여부» 로 가른다」
   *  ★확장자가 .pdf 100%라고 «원본» 이 아니다. 실제로 열어 보니 —
   *    발송대기      [검토중] 경기고속도로_손오공렌터카_1건_20260829.pdf  → ★우리가 «만든» 공문
   *    계약서받은것   01도9893__1_wqMtusnHe1CeD6bx….pdf  → 뒤가 ★구글드라이브 파일 ID. «받은» 것
   *    용량줄이기    X.pdf 와 X-줄인.pdf 가 짝  → 받아서 «줄인» 것
   *  ★tmp 36GB 에 «다시 못 만드는 원본» 은 사실상 «없다». 전부 드라이브에 있거나 다시 만든다.
   *  ★그래서 D로 «옮기지» 않는다. 기한이 지나면 지운다. 사본은 D:/backup/2026-09-10-aiops-tmp 에 있다.
   *  ※도구가 «읽는» 것(계약서·고지서·계약그림·codex·엑셀 등 약 16GB)은 ★건드리지 않는다. */
  { 이름: 'balsong', 곳: 'tmp/발송대기', 갈래: '파일', 지난: 날(60),
    무엇: '우리가 만든 공문 — 드라이브 「만든공문」 에 올라가 있다' },
  { 이름: 'batgeot', 곳: 'tmp/계약서받은것', 갈래: '파일', 지난: 날(60),
    무엇: '드라이브에서 받은 계약서 — 이름 뒤가 드라이브 파일 ID다. 다시 받으면 된다' },
  { 이름: 'yongryang', 곳: 'tmp/용량줄이기', 갈래: '파일', 지난: 날(60),
    무엇: '받아서 용량 줄인 것 — 원본도 줄인 것도 다시 만든다' },
  { 이름: 'siteugirok', 곳: 'tmp/시트수정기록', 갈래: '파일', 지난: 날(90),
    무엇: '시트 고친 기록 — 시트가 원본이다' },
  { 이름: 'nextcache', 곳: 'C:/dev', 갈래: '빌드캐시', 지난: 날(14),
    무엇: '.next · .turbo 빌드 캐시 — 14일 안 쓴 것. 다시 빌드하면 생긴다' },
  { 이름: 'previous', 곳: 'C:/dev/devcenter/portal', 갈래: '몇개만', 앞딱지: ['.static-previous-', '.dist-previous-'], 남길: 2,
    무엇: '옛 빌드 되돌리기용 — 최신 2개만 남긴다' },
];

/** ★절대 안 건드리는 곳 — 눈에 보이게 적어 둔다 */
const 성역 = ['lib/wonja', 'Documents', 'Downloads', 'tmp/계약서', 'tmp/고지서', 'tmp/등록증',
  '.git', 'AppData/Local/Google/Chrome', 'D:/backup'];

const 재기 = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };
function 폴더크기(p, 깊이 = 0) {
  if (깊이 > 5) return 0;
  let s = 0;
  try {
    for (const e of fs.readdirSync(p, { withFileTypes: true })) {
      const q = path.join(p, e.name);
      s += e.isDirectory() ? 폴더크기(q, 깊이 + 1) : 재기(q);
    }
  } catch { /* 못 열면 0 */ }
  return s;
}

const 여유 = () => { try { const s = fs.statfsSync('C:/'); return { 남: s.bavail * s.bsize, 다: s.blocks * s.bsize }; } catch { return null; } };
const GB = (n) => (n / 1073741824).toFixed(1);

const 낼것 = [];
function 모으기_파일(곳, 지난) {
  const 것 = [];
  const 걷 = (p, 깊이 = 0) => {
    if (깊이 > 6 || 지킬까(p)) return;
    let 목;
    try { 목 = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of 목) {
      const q = path.join(p, e.name);
      if (지킬까(q)) continue;
      if (e.isDirectory()) { 걷(q, 깊이 + 1); continue; }
      try { const st = fs.statSync(q); if (이제 - st.mtimeMs > 지난) 것.push({ q, sz: st.size }); } catch { /* 넘어간다 */ }
    }
  };
  걷(곳);
  return 것;
}
function 모으기_빌드캐시(뿌리, 지난) {
  const 것 = [];
  const 이름들 = new Set(['.next', '.next-qa', '.next-dev', '.turbo']);
  const 걷 = (p, 깊이 = 0) => {
    if (깊이 > 3) return;
    let 목;
    try { 목 = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of 목) {
      if (!e.isDirectory()) continue;
      const q = path.join(p, e.name);
      if (이름들.has(e.name)) {
        try { if (이제 - fs.statSync(q).mtimeMs > 지난) 것.push({ q, sz: 폴더크기(q), 폴더: true }); } catch { /* 넘어간다 */ }
        continue;
      }
      if (e.name === 'node_modules' || e.name === '.git') continue;
      걷(q, 깊이 + 1);
    }
  };
  걷(뿌리);
  return 것;
}
function 모으기_몇개만(곳, 앞딱지들, 남길) {
  const 것 = [];
  let 목;
  try { 목 = fs.readdirSync(곳); } catch { return 것; }
  for (const pre of 앞딱지들) {
    const 무리 = 목.filter((n) => n.startsWith(pre))
      .map((n) => ({ n, t: Number(n.slice(pre.length)) || 0 })).sort((a, b) => b.t - a.t);
    for (const x of 무리.slice(남길)) {
      const q = path.join(곳, x.n);
      것.push({ q, sz: 폴더크기(q), 폴더: true });
    }
  }
  return 것;
}

const 앞 = 여유();
console.log(`\n════ ★청소 ${한다 ? '— «한다»' : '— 보기만 (지우려면 --한다)'} ════`);
if (앞) console.log(`   지금 C 여유 ${GB(앞.남)}GB / ${GB(앞.다)}GB (${(앞.남 / 앞.다 * 100).toFixed(1)}%)\n`);

let 합 = 0, 수 = 0;
for (const r of 규칙) {
  if (만.length && !만.includes(r.이름)) continue;
  let 것 = [];
  if (r.갈래 === '파일') 것 = 모으기_파일(r.곳, r.지난);
  else if (r.갈래 === '빌드캐시') 것 = 모으기_빌드캐시(r.곳, r.지난);
  else if (r.갈래 === '몇개만') 것 = 모으기_몇개만(r.곳, r.앞딱지, r.남길);
  const sz = 것.reduce((a, x) => a + x.sz, 0);
  합 += sz; 수 += 것.length;
  console.log(`   ${String(Math.round(sz / 1048576)).padStart(6)}MB  ${String(것.length).padStart(6)}개  [${r.이름}]  ${r.무엇}`);
  if (한다) {
    let 지움 = 0;
    for (const x of 것) {
      if (지킬까(x.q)) continue;
      try { fs.rmSync(x.q, { recursive: !!x.폴더, force: true }); 지움 += 1; } catch { /* 잠긴 것은 다음에 */ }
    }
    console.log(`            → ★${지움}개 지웠다 (못 지운 것 ${것.length - 지움}개는 «쓰는 중» 이다)`);
  }
  낼것.push({ 이름: r.이름, 수: 것.length, MB: Math.round(sz / 1048576) });
}

console.log(`\n   ${한다 ? '★지운 것' : '★지울 수 있는 것'} 모두 ${수.toLocaleString('ko-KR')}개 · ${Math.round(합 / 1048576).toLocaleString('ko-KR')}MB`);
if (한다) { const 뒤 = 여유(); if (뒤 && 앞) console.log(`   C 여유 ${GB(앞.남)}GB → ★${GB(뒤.남)}GB  (되찾은 것 ${GB(뒤.남 - 앞.남)}GB)`); }
else console.log(`   ※실제로 지우려면  node scripts/청소.mjs --한다`);

console.log(`\n   ★안 건드리는 곳 — ${성역.join(' · ')}`);
console.log(`   ★이 세션이 쓰는 자리도 안 건드린다 — .claude · Temp/claude\n`);

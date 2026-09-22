/** ★자동 커밋 — «다른 세션이 일하는 중에도» 안전하게
 *
 *  대표(2026-09-09): 「자동으로 커밋하면서 이력 남기게는 못하나?」 → 「문제 없게끔 해야지」
 *
 *  ── 왜 `git add` 를 안 쓰나
 *  2026-09-03 `aiops` 에서 `git add -A` 한 번으로 남의 세션 변경 615개가 묶였고,
 *  100MB 넘는 파일 둘이 이력에 박혀 «지금도 main 을 못 올린다».
 *  2026-09-09 나(클로드)도 devcenter 에서 같은 명령으로 코덱스가 편집 중이던 3개를 묶었다.
 *  네 AI 검수 만장일치: 「여러 세션이 도는 저장소에 add -A 기반 자동 커밋을 붙이지 마라」.
 *
 *  ── 그래서 무엇을 하나 (`aiops/scripts/미수가지-올린다.mjs` 의 방식을 가져왔다)
 *  ★작업 트리도 · 진짜 인덱스도 · HEAD 도 건드리지 않는다.
 *    딴 인덱스(GIT_INDEX_FILE)에 HEAD 트리를 읽고, 담을 파일만 얹어 write-tree 하고,
 *    commit-tree 로 커밋을 짓고, update-ref 로 가지만 옮긴다.
 *  ★update-ref 에 «옛 값» 을 같이 준다 — 그 사이 남이 커밋했으면 실패하고 멈춘다(compare-and-swap).
 *
 *  ── 안 하는 것
 *  ★푸시하지 않는다. 대표가 정할 일이다.
 *  ★지우지 않는다. 사라진 파일은 이름만 알리고 손대지 않는다.
 *  ★.gitignore 가 막는 것은 담지 않는다 (git status 가 이미 걸러 준다).
 *  ★큰 파일은 담지 않는다 — 2026-09-03 사고가 그거였다.
 *
 *  ── ★맡은 곳 밖은 담지 않는다 (2026-09-09 첫 DRY RUN 에서 잡혔다)
 *  처음엔 「바뀐 것 전부」 를 담게 만들었다. 확인만 돌려 보니 28개 중 26개가
 *  코덱스가 «그 시각 편집 중이던» portal/ 이었다. 커밋했으면 그날 낸 실수를 자동화하는 꼴이었다.
 *  ★그래서 «맡은 곳» 을 반드시 대야 한다. 세션마다 자기 길만 맡는다.
 *  노하우 그대로다 — 「★파일을 «이름으로» 만 담는다」(`aiops/scripts/하루한바퀴.mjs`).
 *
 *  ── 쓰는 법
 *      node engine/자동커밋.mjs                          ★확인만 (기본) — 지금 무엇이 바뀌었나 다 보여준다
 *      node engine/자동커밋.mjs --맡은곳=engine/,orders/   그 길의 것만 확인한다
 *      node engine/자동커밋.mjs --맡은곳=engine/ --넣는다   ★그 길의 것만 커밋한다
 *      node engine/자동커밋.mjs --맡은곳=engine/ --지켜본다 --넣는다   조용해지면 커밋. Ctrl+C 로 멈춘다
 *      node engine/자동커밋.mjs --저장소=<경로>            다른 저장소에 쓴다 (기본: 이 저장소)
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const 인 = process.argv.slice(2);
const 넣는다 = 인.includes('--넣는다');
const 지켜본다 = 인.includes('--지켜본다');
const 저장소 = path.resolve(
  인.find((a) => a.startsWith('--저장소='))?.slice('--저장소='.length)
  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
);

// ★맡은 곳 — 이 길 아래만 담는다. 대지 않으면 커밋하지 않는다.
const 맡은곳 = (인.find((a) => a.startsWith('--맡은곳='))?.slice('--맡은곳='.length) ?? '')
  .split(',').map((s) => s.trim().replace(/\\/g, '/').replace(/^\.?\//, '')).filter(Boolean);

const 큰파일한도 = 5 * 1024 * 1024;   // 5 MiB. 넘으면 담지 않는다
const 조용초 = 5;                      // 마지막 수정이 이만큼 지나야 담는다 (쓰다 만 파일 방지)
const 쓸어보는초 = 300;                 // 지켜볼 때 이 주기로 한 번씩 훑는다

const git = (인자, 옵 = {}) =>
  execFileSync('git', ['-C', 저장소, '-c', 'core.quotepath=false', ...인자],
    { encoding: 'utf8', ...옵 }).replace(/\n$/, '');

const 로그길 = path.join(저장소, 'runs', '자동커밋.log');
function 적는다(줄) {
  const 때 = new Date(Date.now() + 9 * 36e5).toISOString().replace('T', ' ').slice(0, 19);
  console.log(`   ${줄}`);
  try {
    fs.mkdirSync(path.dirname(로그길), { recursive: true });
    fs.appendFileSync(로그길, `${때}  ${줄}\n`, 'utf8');
  } catch { /* 로그를 못 써도 커밋은 계속한다 */ }
}

/** 지금 담을 만한 것들을 고른다. 무엇을 «왜» 뺐는지도 함께 돌려준다. */
function 고른다() {
  const 담을것 = [];
  const 뺀것 = [];
  // -z 로 받아야 한글·공백 경로가 안 깨진다
  const 날것 = execFileSync('git', ['-C', 저장소, 'status', '--porcelain', '-z'], { encoding: 'utf8' });
  const 조각 = 날것.split('\0');
  for (let i = 0; i < 조각.length; i++) {
    const 줄 = 조각[i];
    if (!줄) continue;
    const 표 = 줄.slice(0, 2);
    let 경로 = 줄.slice(3);
    if (표[0] === 'R') { i++; 경로 = 조각[i] ?? 경로; }   // 이름이 바뀐 것은 새 이름이 다음 조각에 온다

    if (맡은곳.length && !맡은곳.some((맡) => 경로 === 맡 || 경로.startsWith(맡.endsWith('/') ? 맡 : 맡 + '/'))) {
      뺀것.push([경로, '맡은 곳이 아니다 — 남의 세션 것일 수 있다']); continue;
    }
    if (표.includes('D')) { 뺀것.push([경로, '사라진 파일 — 지우지 않는다']); continue; }
    if (표.includes('U') || 표 === 'AA' || 표 === 'DD') { 뺀것.push([경로, '★병합 충돌 중 — 사람이 풀어야 한다']); continue; }

    const 온길 = path.join(저장소, 경로);
    let 상태;
    try { 상태 = fs.statSync(온길); } catch { 뺀것.push([경로, '읽을 수 없다']); continue; }
    if (상태.isDirectory()) { 뺀것.push([경로, '폴더다']); continue; }
    if (상태.size > 큰파일한도) {
      뺀것.push([경로, `★${(상태.size / 1048576).toFixed(1)}MB — 한도(${큰파일한도 / 1048576}MB) 초과. 이력에 박히면 못 지운다`]);
      continue;
    }
    const 지난초 = (Date.now() - 상태.mtimeMs) / 1000;
    if (지난초 < 조용초) { 뺀것.push([경로, `아직 쓰는 중일 수 있다 (${지난초.toFixed(0)}초 전)`]); continue; }
    담을것.push(경로);
  }
  return { 담을것, 뺀것 };
}

/** 한 회차. 실제로 커밋했으면 커밋 해시를 돌려준다. */
function 한바퀴() {
  // ★맡은 곳을 대지 않으면 커밋하지 않는다. 2026-09-09 첫 DRY RUN 에서 남의 것 26개가 잡혔다.
  if (!맡은곳.length) {
    적는다('★--맡은곳= 을 대지 않았다. 맡은 길 밖을 담으면 남의 세션 것이 묶인다. 커밋하지 않는다.');
    return null;
  }
  const 가지 = git(['symbolic-ref', '--short', 'HEAD']);
  const 옛머리 = git(['rev-parse', 'HEAD']);
  const { 담을것, 뺀것 } = 고른다();

  for (const [경로, 왜] of 뺀것) 적는다(`뺐다   ${경로}  — ${왜}`);
  if (!담을것.length) { 적는다('담을 것이 없다'); return null; }

  const 인덱스 = path.join(os.tmpdir(), `devcenter-idx-${process.pid}-${Date.now()}`);
  const 옵 = { env: { ...process.env, GIT_INDEX_FILE: 인덱스 } };
  try {
    // ★HEAD 트리를 딴 인덱스에 읽는다 — 나머지 파일은 그대로 보존된다
    git(['read-tree', 'HEAD'], 옵);
    for (const 경로 of 담을것) {
      const 해시 = git(['hash-object', '-w', '--', 경로]);
      const 실행가능 = (() => { try { return (fs.statSync(path.join(저장소, 경로)).mode & 0o111) !== 0; } catch { return false; } })();
      git(['update-index', '--add', '--cacheinfo', `${실행가능 ? '100755' : '100644'},${해시},${경로}`], 옵);
    }
    const 나무 = git(['write-tree'], 옵);

    // ★내용이 그대로면 커밋하지 않는다 — 같은 커밋이 쌓이지 않게
    if (나무 === git(['rev-parse', 'HEAD^{tree}'])) { 적는다('바뀐 게 없다'); return null; }

    const 말 = [
      `자동: ${담을것.length}개 파일 (맡은 곳 ${맡은곳.join(' ')})`,
      '',
      ...담을것.map((f) => `  ${f}`),
      '',
      '기계가 지었다. 파일을 이름으로만 담고 작업 트리·인덱스·HEAD 를 건드리지 않았다.',
      '지운 파일은 담지 않는다. 사람이 확인한다.',
    ].join('\n');
    const 커밋 = git(['commit-tree', 나무, '-p', 옛머리, '-m', 말]);

    // ★그 사이 남이 커밋했으면 여기서 실패한다 (옛 값을 같이 준다)
    git(['update-ref', `refs/heads/${가지}`, 커밋, 옛머리]);

    // 진짜 인덱스에서 «담은 파일만» 새 내용으로 맞춘다.
    // 안 하면 다음 git status 가 이 파일들을 계속 「바뀜」 으로 보여 준다.
    // 남의 파일은 건드리지 않는다.
    try { git(['update-index', '--add', '--', ...담을것]); } catch { /* 맞추기 실패는 커밋을 무르지 않는다 */ }

    적는다(`★커밋 ${커밋.slice(0, 8)} — ${담을것.length}개`);
    for (const f of 담을것) 적는다(`       ${f}`);
    return 커밋;
  } finally {
    try { fs.unlinkSync(인덱스); } catch { /* 없으면 그만 */ }
  }
}

/* ── 여기서부터 실행 ───────────────────────────────────────── */

try { git(['rev-parse', '--git-dir']); }
catch { console.error(`★깃 저장소가 아니다: ${저장소}`); process.exit(1); }

if (!넣는다) {
  const { 담을것, 뺀것 } = 고른다();
  console.log(`\n■ ${저장소}`);
  console.log(`  맡은 곳 ${맡은곳.length ? 맡은곳.join(' · ') : '★안 댔다 — 이 상태로는 커밋하지 않는다'}`);
  console.log(`  담을 것 ${담을것.length}개`);
  for (const f of 담을것) console.log(`     ${f}`);
  console.log(`  뺀 것 ${뺀것.length}개`);
  for (const [f, 왜] of 뺀것) console.log(`     ${f}  — ${왜}`);
  console.log('\n  ★확인만 했다. 실제로 커밋하려면 --넣는다');
  console.log('  ★푸시는 하지 않는다. 사람이 정한다.\n');
  process.exit(0);
}

if (!지켜본다) { 한바퀴(); process.exit(0); }

// ── 지켜보기 ──
const 잠금길 = path.join(os.tmpdir(), `devcenter-자동커밋-${Buffer.from(저장소).toString('hex').slice(0, 16)}.lock`);
try { fs.writeFileSync(잠금길, String(process.pid), { flag: 'wx' }); }
catch { console.error(`★이미 돌고 있다 (잠금: ${잠금길}). 아니면 그 파일을 지워라.`); process.exit(0); }
const 잠금풀기 = () => { try { fs.unlinkSync(잠금길); } catch { /* 그만 */ } };
process.on('exit', 잠금풀기);
for (const 신호 of ['SIGINT', 'SIGTERM']) process.on(신호, () => { 잠금풀기(); process.exit(0); });

적는다(`지켜본다 (pid ${process.pid}) — ${저장소}`);
let 예약 = null;
const 미룬다 = () => {
  clearTimeout(예약);
  예약 = setTimeout(() => { try { 한바퀴(); } catch (e) { 적는다(`★실패 ${e.message}`); } }, 조용초 * 1000);
};
fs.watch(저장소, { recursive: true }, (_종류, 이름) => {
  if (!이름) return;
  const 정 = String(이름).replace(/\\/g, '/');
  if (정.startsWith('.git/') ||정.startsWith('runs/') || 정.includes('/node_modules/')) return;
  미룬다();
});
setInterval(() => { try { 한바퀴(); } catch (e) { 적는다(`★실패 ${e.message}`); } }, 쓸어보는초 * 1000);

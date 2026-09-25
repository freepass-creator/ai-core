/** ★구문검사 — 「파일이 아예 안 열리는 것」만 잡는다.
 *
 *  aiops 는 타입이 없는 .mjs 저장소다. 그래서 `typecheck` 자리에 «타입» 대신
 *  «구문» 을 건다. 재는 것은 딱 하나 — `node --check` 가 파일을 파싱하나.
 *
 *  ★왜 필요한가 — docs/aiknowhow/한글로-코딩-함정.md
 *    한글 변수·별표·조사·이스케이프가 깨지면 파일이 통째로 안 열린다.
 *    그런 파일은 «부를 때» 터지고, 부르는 자리가 매시간 잡이면 밤에 조용히 죽는다.
 *
 *  ★이것은 «되나» 검사가 아니다. 문법만 본다. 돌려서 맞는지는 npm test 가 본다.
 *
 *    node scripts/구문검사.mjs
 */
import { execFile, execFileSync } from 'node:child_process';

/** ★-z 로 «NUL» 로 끊어 받는다.
 *  그냥 `git ls-files` 는 한글 경로를 "\353\257\270…" 처럼 8진 이스케이프로 «따옴표 씌워» 준다
 *  (core.quotePath 기본값). 그걸 그대로 넘기면 파일을 못 찾고 100개가 «문법 오류» 로 둔갑한다.
 *  2026-09-10 에 이 도구가 처음 그렇게 틀렸다 — docs/aiknowhow/한글로-코딩-함정.md */
const 대상 = execFileSync(
  'git',
  ['-c', 'core.quotePath=false', 'ls-files', '-z', '*.mjs', '*.cjs', '*.js'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
)
  .split('\0').map((s) => s.trim()).filter(Boolean)
  .filter((p) => !p.startsWith('node_modules/'));

const 한번에 = 12;
const 탈 = [];
const 못잼 = [];
let 다음 = 0;

const 재다 = () => new Promise((끝) => {
  const i = 다음++;
  if (i >= 대상.length) return 끝();
  const 파일 = 대상[i];
  execFile(process.execPath, ['--check', 파일], (err, _o, stderr) => {
    if (err) {
      const 말 = String(stderr);
      // ★파일을 «못 찾은» 것은 문법 탈이 아니라 이 도구의 탈이다 — 「없다」가 아니라 「모른다」
      const 통 = (말.includes('MODULE_NOT_FOUND') || 말.includes('Cannot find module')) ? 못잼 : 탈;
      통.push({ 파일, 말: 말.split('\n').filter(Boolean).slice(0, 3).join(' / ') });
    }
    재다().then(끝);
  });
});

await Promise.all(Array.from({ length: 한번에 }, 재다));

console.log(`\n   구문검사 — ${대상.length}개 파일`);
if (못잼.length) {
  console.log(`   ※못 잰 것 ${못잼.length}개 — 파일을 못 찾았다(이 도구의 탈이다). 예: ${못잼[0].파일}`);
}
if (!탈.length) {
  console.log('   ★탈 없음\n');
  process.exit(못잼.length ? 1 : 0);
}
console.log(`\n   ★안 열리는 파일 ${탈.length}개\n`);
for (const t of 탈.sort((a, b) => a.파일.localeCompare(b.파일))) {
  console.log(`      ${t.파일}`);
  console.log(`         ${t.말}`);
}
console.log('\n   ★★막는다(나가는 코드 1) — 이 파일들은 부르는 순간 터진다\n');
process.exit(1);

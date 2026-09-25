/** ★★폴더가 규격대로인가 — «묻지 말고 돌려서» 답을 받는다.
 *
 *  대표(2026-09-03): 「이제 연결된 거 없어서 **폴더 구조대로 하고 작업하는데 문제 없게** 해봐」
 *
 *  ── ★왜 «도구» 로 만드나
 *  「문제 없나?」 를 사람이 눈으로 훑으면 세션마다 다른 답이 나온다.
 *  2026-08-24 에 하루 동안 대수를 다섯 번 다르게 답한 적이 있다. 폴더도 똑같다.
 *  ★그래서 규격을 «기계가 읽는 표» 로 두고, 어긋나면 어디가 어긋났는지 짚게 한다.
 *
 *  ── 무엇을 보나 (일곱 가지)
 *      ①최상위가 «셋» 인가                     — 대표: 「폴더는 딱 3개 있어야 하는데」
 *      ②정본자료보관 아래가 규격대로인가          — 01~05 · 06_공통 · 07_직원별자료 · 99_
 *      ③회사마다 갈래가 다 있나                  — A_법인 … Z_기타
 *      ④잎이 «두 자리» 규격인가                  — C1_계약서 가 남아 있으면 짚는다
 *      ⑤같은 이름이 겹치나                       — 겹치면 이름으로 찾을 때 아무거나 걸린다
 *      ⑥★코드가 부르는 이름이 «다» 풀리나        — 옛 이름·새 이름 둘 다
 *      ⑦★과태료 자리 여덟이 다 서 있나           — 여기가 무너지면 관청에 두 번 낸다
 *
 *  ★아무것도 «안 고친다». 보기만 한다. 고치는 것은 폴더정리·이름규격이 한다.
 *
 *    node scripts/폴더점검.mjs           다 본다
 *    node scripts/폴더점검.mjs --조용히   어긋난 것만
 */
import { drive } from '../lib/drive.mjs';
import { DRIVE, folder } from '../lib/ids.mjs';
import { 규격, 옛에서새로 } from '../lib/폴더이름.mjs';

const 조용히 = process.argv.includes('--조용히');
const d = await drive();

/** ★★규격은 «여기» 에 없다 — `lib/올리는곳.json` 의 `폴더규격`이 정본이다 (2026-09-03).
 *
 *  > 대표: 「그러니까 폴더를 «유연하게» aiops 에서 하려면 어떻게 해야하는데??」
 *
 *  ★전에는 최상위·회사·갈래·잎이 이 파일에 «상수로 박혀» 있었다.
 *    그래서 회사를 하나 늘리는 데도 «이 도구를 고쳐야» 했다. 그게 뻣뻣함의 정체였다.
 *  ★이제 표만 고친다. 이 도구는 표를 읽을 뿐이다.
 *
 *  ★잎마다 «어디» 를 고를 수 있다 —
 *      "모든회사"      01~06 에 다 있어야 한다   (예: C01_계약서)
 *      ["06_공통"]    그 회사에만 있으면 된다    (예: 과태료-AI보관)
 *      반드시: false   있어도 되고 없어도 된다
 *    그래서 「다 똑같이」 와 「이 회사만」 이 «코드가 아니라 표» 에서 갈린다. */
const 최상위규격 = 규격.최상위;
const 보관아래규격 = 규격.보관아래;
const 회사들 = 규격.회사;
/** 그 회사에 «있어야 할» 갈래만 고른다 */
const 이회사갈래 = (co) => 규격.갈래.filter((g) => (g.어디 === '모든회사' || (Array.isArray(g.어디) && g.어디.includes(co))));
const 잎규격 = Object.fromEntries(규격.갈래.map((g) => [g.이름, g.잎.map((x) => x.이름)]));

const 껍데기 = (n) => /^\[비었음\]/.test(n);
const 아이들 = async (id) => (await d.call(
  `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed=false`)}`
  + '&fields=files(id,name,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives',
)).files || [];
const 폴더만 = (l) => l.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');

const 어긋남 = [];
const 짚는다 = (갈래, 무엇, 어떻게) => 어긋남.push({ 갈래, 무엇, 어떻게 });
const 좋다 = [];
const 좋다고 = (s) => { if (!조용히) 좋다.push(s); };

console.log(`\n════ ★폴더 점검 (${new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10)}) ════\n`);

// ── ①최상위
const 위 = await 아이들(DRIVE.데이터센터);
const 위폴 = 폴더만(위).filter((f) => !껍데기(f.name));
const 위껍 = 폴더만(위).filter((f) => 껍데기(f.name));
for (const n of 최상위규격) if (!위폴.some((f) => f.name === n)) 짚는다('최상위', n, '★없다');
for (const f of 위폴) if (!최상위규격.includes(f.name)) 짚는다('최상위', f.name, '★규격에 없는 폴더가 최상위에 있다 — 대표: 「폴더는 딱 3개」');
for (const f of 위껍) 짚는다('최상위', f.name, '비운 껍데기가 최상위에 남았다 — 99_원본보관_기존자료 로 내린다');
if (위폴.length === 3 && !위껍.length) 좋다고(`최상위 3개 — ${위폴.map((f) => f.name).join(' · ')}`);

// ── ②정본자료보관 아래
const 보관 = 위폴.find((f) => f.name === '03_정본자료보관');
if (!보관) { console.log('★03_정본자료보관 이 없다. 더 못 본다'); process.exit(1); }
const 보관아래 = 폴더만(await 아이들(보관.id));
for (const n of 보관아래규격) if (!보관아래.some((f) => f.name === n)) 짚는다('03_정본자료보관', n, '★없다');
for (const f of 보관아래) if (!보관아래규격.includes(f.name) && !껍데기(f.name)) 짚는다('03_정본자료보관', f.name, '규격에 없다');
if (!어긋남.some((x) => x.갈래 === '03_정본자료보관')) 좋다고(`정본자료보관 아래 ${보관아래규격.length}개 — 규격대로`);

// ── ③④⑤회사마다
for (const co of 회사들) {
  const 것 = 보관아래.find((f) => f.name === co);
  if (!것) { 짚는다(co, '(회사 폴더)', '★없다'); continue; }
  const 갈래 = 폴더만(await 아이들(것.id));
  const 산것 = 갈래.filter((f) => !껍데기(f.name));

  // 겹침
  const 셈 = new Map();
  for (const f of 산것) 셈.set(f.name, (셈.get(f.name) ?? 0) + 1);
  for (const [n, c] of 셈) if (c > 1) 짚는다(co, n, `★같은 이름이 ${c}개 — 이름으로 찾으면 아무거나 걸린다`);

  for (const { 이름: g, 반드시 } of 이회사갈래(co)) {
    const 그것 = 산것.find((f) => f.name === g);
    if (!그것) { if (반드시 !== false) 짚는다(co, g, '★갈래가 없다'); continue; }
    const 잎 = 폴더만(await 아이들(그것.id));
    const 산잎 = 잎.filter((f) => !껍데기(f.name));
    for (const 있어야 of 잎규격[g] ?? []) {
      if (!산잎.some((f) => f.name === 있어야)) 짚는다(co, `${g}/${있어야}`, '★없다');
    }
    /** ★옛 이름이 «아직 살아 있으면» 바꾸다 만 것이다 */
    for (const f of 산잎) {
      if (옛에서새로.has(f.name)) 짚는다(co, `${g}/${f.name}`, `★옛 이름이 남았다 → 「${옛에서새로.get(f.name)}」 여야 한다`);
    }
    const 잎셈 = new Map();
    for (const f of 산잎) 잎셈.set(f.name, (잎셈.get(f.name) ?? 0) + 1);
    for (const [n, c] of 잎셈) if (c > 1) 짚는다(co, `${g}/${n}`, `★같은 이름이 ${c}개`);
  }
}
if (!어긋남.some((x) => 회사들.includes(x.갈래))) 좋다고(`회사 ${회사들.length}곳 — 갈래·잎이 표(lib/폴더규격.json)대로 다 섰다`);

// ── ⑥코드가 부르는 이름이 다 풀리나 (옛 이름·새 이름 둘 다)
let 못푼것 = 0;
for (const co of 회사들) {
  for (const [옛, 새] of 옛에서새로) {
    if (/과태료작업|올리는곳|발송할것|확인할것|완료한것|JPK/.test(옛)) continue;   // 최상위·공통 것
    const a = folder(co, 옛); const b = folder(co, 새);
    if (co === '06_공통' && !a && !b) continue;                                   // 공통엔 없는 잎이 있다
    if (!a || !b || a !== b) { 짚는다(co, `${옛} / ${새}`, `★이름으로 못 찾는다 (옛 ${a ? '✔' : '✘'} · 새 ${b ? '✔' : '✘'})`); 못푼것++; }
  }
}
if (!못푼것) 좋다고(`옛 이름·새 이름 «둘 다» 같은 폴더를 가리킨다 (${옛에서새로.size}쌍 × 회사)`);

/** ── ⑧★★표 자체가 성한가 + 「올리는곳」 과 어긋나지 않나 (2026-09-03)
 *
 *  ★제미나이가 짚었다 — 「JSON 규격 파일 자체의 무결성 문제. 파일이 깨지면 이를 읽는 모든 도구가 오작동」.
 *    그래서 표를 «쓰기 전에» 꼴부터 본다.
 *  ★코덱스가 짚었다 — 「올리는곳은 «파일을 어디에 둘까», 폴더규격은 «그 자리가 존재해야 하나».
 *    합치지 않습니다. 대신 `쌓이는곳` 이 폴더규격의 잎을 정확히 가리키는지 «검사» 합니다」.
 *    ★합치면 경로 규칙 한 줄 고치다 구조가 흔들린다. 갈라 두고 «이어졌나» 만 본다. */
for (const 칸 of ['최상위', '보관아래', '회사', '갈래']) {
  if (!Array.isArray(규격[칸])) 짚는다('표', `lib/폴더규격.json / ${칸}`, '★칸이 없거나 배열이 아니다 — 표가 깨졌다');
}
for (const g of 규격.갈래 ?? []) {
  if (!g.이름 || !Array.isArray(g.잎)) { 짚는다('표', String(g.이름 ?? '(이름없음)'), '★갈래 꼴이 틀렸다 (이름·잎)'); continue; }
  if (g.어디 !== '모든회사' && !Array.isArray(g.어디)) 짚는다('표', g.이름, '★「어디」 는 "모든회사" 이거나 회사 배열이어야 한다');
  for (const co of (Array.isArray(g.어디) ? g.어디 : [])) {
    if (!규격.회사.includes(co)) 짚는다('표', `${g.이름} / ${co}`, '★「어디」 에 적힌 회사가 회사 목록에 없다');
  }
}
if (규격.상태 !== 'active') 짚는다('표', '상태', `★「${규격.상태}」 다 — active 가 아니면 도구가 이 표를 따르면 안 된다`);

/** ★「올리는곳」 의 쌓이는곳이 규격 잎을 가리키나 — 갈라 두되 «끊기지는» 않게 */
try {
  const { readFileSync } = await import('node:fs');
  const 올 = JSON.parse(readFileSync('lib/올리는곳.json', 'utf8'));
  const 잎이름 = new Set((규격.갈래 ?? []).flatMap((g) => g.잎.map((x) => x.이름)));
  const 옛잎 = new Map((규격.갈래 ?? []).flatMap((g) => g.잎.flatMap((x) => (x.옛 ?? []).map((o) => [o, x.이름]))));
  let 옛쓴것 = 0;
  for (const g of 올.갈래 ?? []) {
    const 곳 = g.쌓이는곳;
    if (!곳) continue;
    if (잎이름.has(곳)) continue;
    if (옛잎.has(곳)) { 옛쓴것 += 1; continue; }      // 별명이 받아 준다 — 죽지는 않는다
    짚는다('올리는곳', `${g.갈래} → ${곳}`, '★규격에 «없는» 잎을 가리킨다 — 파일이 갈 곳이 없다');
  }
  if (옛쓴것) 좋다고(`올리는곳 «쌓이는곳» ${옛쓴것}곳이 옛 이름이다 — 별명이 받아 주지만 표기는 새 이름이 낫다`);
  else 좋다고('올리는곳 «쌓이는곳» 이 모두 규격 잎을 가리킨다');
} catch (e) { 짚는다('올리는곳', 'lib/올리는곳.json', `★못 읽었다 — ${String(e.message).slice(0, 40)}`); }

// ── ⑦과태료 자리 여덟
const { 자리점검 } = await import('../lib/gwataeryo-polder.mjs');
const 자리 = 자리점검();
for (const x of 자리) if (!x.있나) 짚는다('과태료', x.이름, `★자리를 못 찾는다 (${x.무엇})`);
if (자리.every((x) => x.있나)) 좋다고(`과태료 자리 ${자리.length}/${자리.length} — 다 선다`);

// ── 냄
for (const s of 좋다) console.log(`   ✔ ${s}`);
if (!어긋남.length) {
  console.log('\n   ★어긋난 것이 없다. 폴더 구조대로 서 있다.\n');
  process.exit(0);
}
console.log(`\n   ★★어긋난 것 ${어긋남.length}개\n`);
let 앞 = null;
for (const x of 어긋남) {
  if (x.갈래 !== 앞) { console.log(`   ── ${x.갈래}`); 앞 = x.갈래; }
  console.log(`      ✘ ${String(x.무엇).padEnd(30)} ${x.어떻게}`);
}
console.log(`
   ── 고치는 것은 이 도구가 아니다
      겹침·자리         node scripts/폴더정리.mjs        (계획) → --한다
      이름·갈래         node scripts/이름규격.mjs        (계획) → --한다
      지도를 다시 굽기   node wonja/build-dc-folders.mjs
`);
process.exit(1);

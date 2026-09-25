/** ★★데이터센터 이름 규격 픽스 — 잎을 «두 자리» 로, 그리고 갈래를 나눈다.
 *
 *  대표(2026-09-03): 「이제 픽스하겠다」
 *
 *  ── ★왜 지금인가
 *  `C_차량` 이 이미 C1~C9 로 «꽉 찼다». 하나만 더 생기면 C10 이 되어
 *  정렬이 C1 · C10 · C2 로 깨진다. 사람이 목록을 못 읽는다.
 *  ★그래서 자리가 남아 있을 때 두 자리로 바꾼다 — 나중엔 더 비싸진다.
 *
 *  ── 규격 (대표가 정한 것)
 *      차례가 있으면 → 두 자리 숫자   01_ 02_ 03_
 *      차례가 없으면 → 문자          A_ B_ C_
 *      잎          → 부모문자+두자리  A01_ B01_ C01_
 *      닫힌 자리     → 99_
 *
 *  ── ★한꺼번에 하는 까닭 (이름 바꾸기 «와» 갈래 나누기)
 *  `C6_고지서_미처리` 는 «이름만» 바뀌는 게 아니라 `G_고지서·채권` 아래로 «옮겨진다».
 *  둘을 따로 돌리면 중간에 C06 이 두 뜻으로 겹친다 — 옛 C6 과 새 C9→C06 이 부딪친다.
 *  ★그래서 한 도구가 순서를 쥔다 — ①만들고 ②내보내고 ③두 자리로 바꾸고 ④겹치면 합친다.
 *
 *  ── ★지키는 것
 *   · 아무것도 «지우지 않는다». 이름을 바꾸거나 옮기기만 한다
 *   · 갈 곳에 같은 이름이 이미 있으면 «그 안으로 합친다» (덮어쓰지 않는다)
 *   · `[비었음] …` 껍데기는 건드리지 않는다 — 이미 비운 것이다
 *   · 한 번 더 돌려도 안전하다(멱등). 계획을 «지금 상태» 에서 다시 그린다
 *
 *    node scripts/이름규격.mjs                 ★계획만 (아무것도 안 건드린다)
 *    node scripts/이름규격.mjs --한다           실제로 바꾼다
 *    node scripts/이름규격.mjs --회사=01_손오공  한 회사만 (첫 판을 좁게 보고 싶을 때)
 */
import fs from 'node:fs';
import { drive } from '../lib/drive.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { 쓴다 } from '../lib/쓴다.mjs';
/** ★★이름표는 «여기 없다» — `lib/폴더이름.mjs` 가 정본이다.
 *  같은 표를 두 곳에 두면 반드시 갈라진다. 폴더를 바꾸는 쪽(이 도구)과
 *  이름을 찾는 쪽(`lib/ids.mjs` 의 `folder()`)이 «같은 표» 를 봐야 한다. */
import {
  이름표, 새갈래, 나갈것, 새로만들잎, 들일것,
  최상위이름표, 과태료안이름표, 공통이름표,
} from '../lib/폴더이름.mjs';

const 진짜로 = process.argv.includes('--한다');
const 회사만 = (process.argv.find((a) => a.startsWith('--회사=')) || '').split('=')[1] || null;
const 오늘 = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);

const d = await drive();
const 아이들 = async (id) => (await d.call(
  `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`'${id}' in parents and trashed=false`)}`
  + '&fields=files(id,name,mimeType)&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives',
)).files || [];
const 폴더만 = (목) => 목.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
/** ★껍데기는 건드리지 않는다 */
const 껍데기 = (이름) => /^\[비었음\]/.test(이름);

const 계획 = { 기준일: 오늘, 만듦: [], 옮김: [], 이름바꿈: [], 합침: [], 못한것: [] };

const 위 = 폴더만(await 아이들(DRIVE.데이터센터));
const 보관 = 위.find((f) => f.name === '03_정본자료보관');
if (!보관) { console.log('★03_정본자료보관 을 못 찾았다. 먼저 scripts/폴더정리.mjs 를 돌린다'); process.exit(1); }

// ── 최상위 이름
for (const [옛, 새] of 최상위이름표) {
  const f = 위.find((x) => x.name === 옛);
  if (f) 계획.이름바꿈.push({ 길: 옛, id: f.id, 새이름: 새, 왜: '번호로 차례를 고정한다' });
}
const 과 = 위.find((f) => /과태료작업/.test(f.name));
if (과) {
  const 손 = 폴더만(await 아이들(과.id));
  for (const [옛, 새] of 과태료안이름표) {
    const f = 손.find((x) => x.name === 옛);
    if (f) 계획.이름바꿈.push({ 길: `${과.name}/${옛}`, id: f.id, 새이름: 새, 왜: '한 자리 → 두 자리' });
  }
}

// ── 회사·공통
const 회사들 = 폴더만(await 아이들(보관.id))
  .filter((f) => !f.name.startsWith('99_'))
  .filter((f) => !회사만 || f.name === 회사만)
  .sort((a, b) => a.name.localeCompare(b.name));

for (const co of 회사들) {
  const 갈래 = 폴더만(await 아이들(co.id));
  const 갈래찾 = (이름) => 갈래.filter((f) => f.name === 이름);

  if (co.name === '06_공통') {
    for (const [옛, 새] of 공통이름표) {
      const f = 갈래.find((x) => x.name === 옛);
      if (f) 계획.이름바꿈.push({ 길: `${co.name}/${옛}`, id: f.id, 새이름: 새, 왜: '★G 는 고지서·채권 자리다 — JPK 가 H 로 비킨다' });
    }
  }

  /** ★★겹친 갈래가 아직 남아 있으면(06_공통) 그 갈래는 «건너뛴다» — 먼저 합쳐야 한다.
   *  겹친 A_법인 여섯 중 «아무거나» 골라 이름을 바꾸면, 나머지 다섯은 옛 이름으로 남는다.
   *  ★그러면 이름으로 찾을 때 아무거나 걸리는 병이 그대로 남는다 */
  const 겹친갈래 = new Set();
  for (const 이름 of new Set(갈래.map((f) => f.name))) {
    if (껍데기(이름)) continue;
    if (갈래.filter((f) => f.name === 이름).length > 1) {
      겹친갈래.add(이름);
      계획.못한것.push({ 길: `${co.name}/${이름}`, 왜: '★같은 이름 갈래가 여럿이다 — scripts/폴더정리.mjs --한다 를 먼저 끝낸다' });
    }
  }

  // ①C_차량 → G_고지서·채권 으로 내보낸다 (이름 바꾸기 «전» 에 한다)
  const 차 = 겹친갈래.has('C_차량') ? null : 갈래찾('C_차량')[0];
  const G있나 = 갈래.find((f) => f.name === 새갈래);
  /** ★★같은 옛 이름이 «여럿» 일 수 있다 — 하나만 내보내면 나머지가 C_차량 에 남는다.
   *  2026-09-03 실측 — `06_공통/C_차량` 에 `C8_채권·내용증명` 이 여럿이었다.
   *  ★한 번 돌릴 때마다 하나씩 나가서, 돌릴수록 G03 이 늘고 C8 도 남았다. «다» 거둔다. */
  const 내보낼 = [];
  const G잎 = G있나 ? 폴더만(await 아이들(G있나.id)) : [];
  if (차) {
    const 잎 = 폴더만(await 아이들(차.id)).filter((x) => !껍데기(x.name));
    for (const [옛, 새] of 나갈것) {
      const 것들 = 잎.filter((x) => x.name === 옛);
      if (!것들.length) continue;
      const 이미 = G잎.find((x) => x.name === 새);
      for (const f of 것들) 내보낼.push({ f, 새, 이미: 이미?.id ?? null });
    }
  }
  const G길 = `${co.name}/${새갈래}`;
  if ((내보낼.length || 차) && !G있나) {
    계획.만듦.push({ 길: G길, 부모: co.id, 이름: 새갈래, 왜: '★과태료→채권→위약금은 한 줄기다. 차량 서류에서 뽑는다' });
  }
  /** ★갈 곳에 그 이름이 «이미» 있으면 옮기지 말고 «그 안으로 합친다» — 안 그러면 G03 이 둘이 된다 */
  const 첫째 = new Set();
  for (const { f, 새, 이미 } of 내보낼) {
    if (이미) { 계획.합침.push({ 길: `${co.name}/C_차량/${f.name}`, 버릴: f.id, 남길: 이미, 왜: `★「${새}」 가 이미 G 아래 있다 — 그 안으로 모은다` }); continue; }
    if (첫째.has(새)) {
      /** 같은 이름 둘째부터는 «먼저 나간 것» 으로 모은다 — 이번 판에서 만들어질 자리다 */
      계획.합침.push({ 길: `${co.name}/C_차량/${f.name}`, 버릴: f.id, 남길길: `${G길}/${새}`, 왜: `★「${새}」 로 모은다 — 같은 뜻 폴더가 여럿이었다` });
      continue;
    }
    첫째.add(새);
    계획.옮김.push({ 길: `${co.name}/C_차량/${f.name}`, id: f.id, 옛부모: 차.id, 어디로: G길, 새이름: 새, 왜: '고지서·채권 갈래로' });
  }

  // ②없던 자리를 만든다 (G04_위약금 · B07_CMS·카드정산)
  for (const [부모이름, 잎이름] of 새로만들잎) {
    if (겹친갈래.has(부모이름)) continue;
    const 부모길 = `${co.name}/${부모이름}`;
    const 부모 = 부모이름 === 새갈래 ? G있나 : 갈래찾(부모이름)[0];
    if (!부모 && !계획.만듦.some((x) => x.길 === 부모길)) continue;
    const 있나 = 부모 ? 폴더만(await 아이들(부모.id)).some((f) => f.name === 잎이름) : false;
    if (!있나) 계획.만듦.push({ 길: `${부모길}/${잎이름}`, 부모: 부모?.id ?? null, 부모길, 이름: 잎이름, 왜: '★폴더가 없어서 안 쌓이던 것 — 자리를 먼저 만든다' });
  }

  // ③갈래 안 잎 이름 (C9→C06 은 위에서 C6 이 나간 «뒤» 라 안 부딪친다)
  for (const [갈래이름, 표] of Object.entries(이름표)) {
    if (겹친갈래.has(갈래이름)) continue;
    const g = 갈래찾(갈래이름)[0];
    if (!g) continue;
    const 잎 = 폴더만(await 아이들(g.id)).filter((x) => !껍데기(x.name));
    for (const [옛, 새] of 표) {
      /** ★★같은 옛 이름이 «여럿» 일 수 있다 — 하나만 보면 나머지가 옛 이름으로 남는다.
       *
       *  2026-09-03 실측 — `06_공통/C_차량` 안에 `C2_자동차등록증` 이 «일곱 개» 였다.
       *  ★겹침은 갈래끼리만 있는 게 아니라 «갈래 안쪽» 에도 원래부터 있었다.
       *    합치기 도구(`폴더정리.mjs`)는 «넘어온 것» 만 봤지 «받는 쪽 제 안» 은 안 봤다.
       *    그래서 하나만 C02 로 바뀌고 여섯이 C2 로 남아, 이름으로 찾으면 «아무거나» 걸렸다.
       *  ★그래서 여기서 «다» 거둔다 — 가장 큰 것을 새 이름으로 세우고 나머지를 그 안으로 합친다.
       *    (작은 것을 세우면 큰 것을 통째로 옮기게 되어 API 를 몇백 번 더 부른다) */
      const 옛것들 = 잎.filter((x) => x.name === 옛);
      const 이미 = 잎.find((x) => x.name === 새);
      if (!옛것들.length) continue;

      let 세울것 = 이미 ?? null;
      let 합칠것들 = 옛것들;
      if (!세울것) {
        if (옛것들.length === 1) { 세울것 = 옛것들[0]; 합칠것들 = []; }
        else {
          /** 자식이 가장 많은 것을 세운다 — 겹칠 때만 센다(드물다) */
          const 잰것 = [];
          for (const f of 옛것들) 잰것.push({ f, 몇: (await 아이들(f.id)).length });
          잰것.sort((a, b) => b.몇 - a.몇);
          세울것 = 잰것[0].f;
          합칠것들 = 잰것.slice(1).map((x) => x.f);
        }
        계획.이름바꿈.push({ 길: `${co.name}/${갈래이름}/${옛}`, id: 세울것.id, 새이름: 새, 왜: '한 자리 → 두 자리' });
      }
      for (const f of 합칠것들) {
        if (f.id === 세울것.id) continue;
        계획.합침.push({ 길: `${co.name}/${갈래이름}/${옛}`, 버릴: f.id, 남길: 세울것.id, 왜: `★「${새}」 로 모은다 — 같은 뜻 폴더가 ${옛것들.length}개였다` });
      }
    }
  }

  /** ④★규격에 있는데 «없는» 잎을 만든다 — 회사마다 같은 꼴이어야 사람이 헤매지 않는다.
   *  ★빈 폴더를 만드는 것은 값이 싸고, 자리가 없으면 «안 쌓인다»(위약금이 그랬다). */
  for (const [갈래이름, 표] of [...Object.entries(이름표), [새갈래, 나갈것]]) {
    if (겹친갈래.has(갈래이름)) continue;
    const g = 갈래이름 === 새갈래 ? G있나 : 갈래찾(갈래이름)[0];
    if (!g) continue;
    const 잎 = 폴더만(await 아이들(g.id));
    for (const [옛, 새] of 표) {
      if (잎.some((x) => x.name === 새 || x.name === 옛)) continue;
      if (계획.이름바꿈.some((x) => x.길 === `${co.name}/${갈래이름}/${옛}`)) continue;
      if (계획.옮김.some((x) => x.새이름 === 새 && x.어디로 === `${co.name}/${갈래이름}`)) continue;
      계획.만듦.push({ 길: `${co.name}/${갈래이름}/${새}`, 부모: g.id, 이름: 새, 왜: '★규격에 있는데 없다 — 자리가 없으면 안 쌓인다' });
    }
  }

  /** ⑤★★«새 이름끼리» 겹친 것도 거둔다 — 2026-09-03
   *
   *  ③은 「옛 이름 → 새 이름」 을 거두고, ④는 「없는 것」 을 만든다.
   *  ★그런데 «처음부터 새 이름이 둘» 인 경우가 남는다 —
   *    `06_공통/G_고지서·채권` 에 `G03_채권·내용증명` 이 둘이었다.
   *    옛 이름이 아니라 손댈 곳이 없었고, 없는 것도 아니라 만들 것도 없었다. 그대로 남는다.
   *  ★겹침이 병인 까닭은 «이름으로 찾으면 아무거나 걸려서» 다. 새 이름이라고 다르지 않다. */
  for (const [갈래이름, 표] of [...Object.entries(이름표), [새갈래, 나갈것], ...새로만들잎.map(([부모, 잎]) => [부모, [[잎, 잎]]])]) {
    if (겹친갈래.has(갈래이름)) continue;
    const g = 갈래이름 === 새갈래 ? G있나 : 갈래찾(갈래이름)[0];
    if (!g) continue;
    const 잎 = 폴더만(await 아이들(g.id)).filter((x) => !껍데기(x.name));
    for (const [, 새] of 표) {
      const 것들 = 잎.filter((x) => x.name === 새);
      if (것들.length < 2) continue;
      const 잰것 = [];
      for (const f of 것들) 잰것.push({ f, 몇: (await 아이들(f.id)).length });
      잰것.sort((a, b) => b.몇 - a.몇);
      for (const x of 잰것.slice(1)) {
        계획.합침.push({ 길: `${co.name}/${갈래이름}/${새}`, 버릴: x.f.id, 남길: 잰것[0].f.id, 왜: `★새 이름끼리 ${것들.length}개 겹쳤다 — 가장 큰 것으로 모은다` });
      }
    }
  }

  // ④Z_기타 에 떠 있던 「정산」 을 B07 로
  for (const 일 of 들일것) {
    if (겹친갈래.has(일.어디) || 겹친갈래.has(일.어디로)) continue;
    const 밖 = 갈래찾(일.어디)[0];
    if (!밖) continue;
    const 것들 = 폴더만(await 아이들(밖.id)).filter((f) => f.name === 일.무엇);
    for (const f of 것들) {
      계획.옮김.push({
        길: `${co.name}/${일.어디}/${일.무엇}`, id: f.id, 옛부모: 밖.id,
        어디로: `${co.name}/${일.어디로}/${일.새이름}`, 합쳐서: true,
        왜: `★「정산」 이 ${것들.length}개 — A~F 어디에도 안 속하고 떠 있었다`,
      });
    }
  }
}

// ── 계획을 보여 준다
console.log(`\n════ ★이름 규격 픽스 — 계획 (${오늘}) ════\n`);
console.log(`  ── ①만들 것 ${계획.만듦.length}`);
for (const x of 계획.만듦) console.log(`     + ${x.길}`);
console.log(`\n  ── ②옮길 것 ${계획.옮김.length}`);
for (const x of 계획.옮김) console.log(`     → ${x.길}  ⇒  ${x.어디로}${x.새이름 ? ` (「${x.새이름}」)` : ' ⊕합쳐서'}`);
console.log(`\n  ── ③이름 바꿀 것 ${계획.이름바꿈.length}`);
for (const x of 계획.이름바꿈) console.log(`     ✎ ${x.길}  →  ${x.새이름}`);
console.log(`\n  ── ④합칠 것 ${계획.합침.length} (갈 이름이 이미 있다)`);
for (const x of 계획.합침) console.log(`     ⊕ ${x.길}`);
if (계획.못한것.length) {
  console.log(`\n  ── ★못한 것 ${계획.못한것.length}`);
  for (const x of 계획.못한것) console.log(`     ! ${x.길}  ${x.왜}`);
}
console.log('\n   ★아무것도 지우지 않는다. 이름을 바꾸거나 옮기기만 한다\n');

fs.mkdirSync('logs', { recursive: true });
if (!진짜로) {
  fs.writeFileSync(`logs/이름규격-계획-${오늘}.json`, JSON.stringify(계획, null, 1), 'utf8');
  console.log(`   → logs/이름규격-계획-${오늘}.json`);
  console.log('   ※아직 «안 건드렸다». 정말 바꾸려면:  node scripts/이름규격.mjs --한다\n');
  process.exit(0);
}

// ══════════ 실제로 한다 ══════════
const 한것 = [];
const 이름바꾼다 = async (id, 새이름) => {
  await d.call(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id`, { method: 'PATCH', body: JSON.stringify({ name: 새이름 }) });
  한것.push({ 짓: '이름', id, 새이름 });
};
const 옮긴다 = async (id, 새부모, 옛부모, 새이름 = null) => {
  await d.call(`https://www.googleapis.com/drive/v3/files/${id}?addParents=${새부모}&removeParents=${옛부모}&supportsAllDrives=true&fields=id`,
    { method: 'PATCH', body: JSON.stringify(새이름 ? { name: 새이름 } : {}) });
  한것.push({ 짓: '옮김', id, 새부모, 옛부모, 새이름 });
};
const 만든다 = async (이름, 부모) => {
  const r = await d.call('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id', {
    method: 'POST', body: JSON.stringify({ name: 이름, mimeType: 'application/vnd.google-apps.folder', parents: [부모] }),
  });
  한것.push({ 짓: '만듦', 이름, id: r.id, 부모 });
  return r.id;
};
/** ★갈 곳에 같은 이름이 있으면 «그 안으로» 내려가며 합친다 — 덮어쓰지 않는다.
 *  (scripts/폴더정리.mjs 와 같은 규칙. 한 겹만 합치면 겹침이 «안쪽으로 밀릴» 뿐이다) */
const 속까지합친다 = async (버릴id, 남길id, 길, 깊 = 0) => {
  if (깊 > 6) { console.log(`   ★${길} — 너무 깊다. 멈춘다`); return; }
  const 손 = await 아이들(버릴id);
  const 갈곳 = 폴더만(await 아이들(남길id));
  for (const f of 손) {
    if (f.mimeType !== 'application/vnd.google-apps.folder') { await 옮긴다(f.id, 남길id, 버릴id); continue; }
    const 같은 = 갈곳.find((g) => g.name === f.name);
    if (같은) await 속까지합친다(f.id, 같은.id, `${길}/${f.name}`, 깊 + 1);
    else { await 옮긴다(f.id, 남길id, 버릴id); 갈곳.push(f); }
  }
  const 끝 = 길.split('/').pop();
  if (!껍데기(끝)) await 이름바꾼다(버릴id, `[비었음] ${끝}`);
  한것.push({ 짓: '합침', 버릴id, 남길id, 길 });
};
/** 03_정본자료보관 아래 길로 폴더를 찾는다 — 「06_공통/G_고지서·채권/G04_위약금」 */
const 길로찾는다 = async (길) => {
  let 여기 = 보관.id;
  for (const 조 of 길.split('/')) {
    const f = 폴더만(await 아이들(여기)).find((g) => g.name === 조);
    if (!f) return null;
    여기 = f.id;
  }
  return 여기;
};

await 쓴다('drive', '데이터센터 이름 규격 — 잎을 두 자리로 · G_고지서·채권 갈래 신설 (지우지 않는다)', async () => {
  /** ★차례가 있다 — ①갈래를 만들고 ②내보내고 ③빈 잎을 만들고 ④이름을 바꾸고 ⑤겹친 것을 합친다.
   *  ★특히 「옮김」 이 「이름바꿈」 보다 «먼저» 다. C6 이 나가야 C9→C06 이 안 부딪친다 */
  const 만든길 = new Map();
  for (const x of 계획.만듦.filter((y) => y.부모)) {
    만든길.set(x.길, await 만든다(x.이름, x.부모));
    console.log(`   + ${x.길}`);
  }
  for (const x of 계획.옮김) {
    const 새부모 = 만든길.get(x.어디로) || await 길로찾는다(x.어디로);
    if (!새부모) { console.log(`   ★${x.길} — 갈 곳 「${x.어디로}」 를 못 찾았다. 건너뛴다`); 계획.못한것.push({ 길: x.길, 왜: `갈 곳 없음: ${x.어디로}` }); continue; }
    if (x.합쳐서) { await 속까지합친다(x.id, 새부모, x.길); console.log(`   ⊕ ${x.길} → ${x.어디로}`); }
    else { await 옮긴다(x.id, 새부모, x.옛부모, x.새이름); console.log(`   → ${x.길} ⇒ ${x.어디로}`); }
  }
  /** ★부모를 «방금 만든» 잎 (G_고지서·채권/G04_위약금) */
  for (const x of 계획.만듦.filter((y) => !y.부모)) {
    const 부모 = 만든길.get(x.부모길) || await 길로찾는다(x.부모길);
    if (!부모) { console.log(`   ★${x.길} — 부모를 못 찾았다`); continue; }
    await 만든다(x.이름, 부모);
    console.log(`   + ${x.길}`);
  }
  for (const x of 계획.이름바꿈) { await 이름바꾼다(x.id, x.새이름); console.log(`   ✎ ${x.길} → ${x.새이름}`); }
  for (const x of 계획.합침) {
    const 남길 = x.남길 ?? await 길로찾는다(x.남길길);
    if (!남길) { console.log(`   ★${x.길} — 모을 곳 「${x.남길길}」 을 못 찾았다. 건너뛴다`); 계획.못한것.push({ 길: x.길, 왜: `모을 곳 없음: ${x.남길길}` }); continue; }
    await 속까지합친다(x.버릴, 남길, x.길);
    console.log(`   ⊕ ${x.길}`);
  }
});

fs.writeFileSync(`logs/이름규격-${오늘}.json`, JSON.stringify({ 기준일: 오늘, 계획, 한것 }, null, 1), 'utf8');
console.log(`\n   ★${한것.length}가지를 했다 → logs/이름규격-${오늘}.json`);
console.log('   ★다음:  node wonja/build-dc-folders.mjs 로 폴더 지도를 다시 굽는다\n');

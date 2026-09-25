/** ★★데이터센터 «파일» 장부 — 폴더가 아니라 파일을 장악한다.
 *
 *  대표(2026-09-03): 「이 폴더를 aiops 가 **완전히 장악해야돼 마스터해야함**」
 *
 *  ── ★무엇이 모자랐나
 *  오늘 폴더 «구조» 는 세웠다(`scripts/폴더점검.mjs` 가 어긋난 것 0 을 낸다).
 *  ★그런데 그 «안에 무엇이 들었는지» 는 못 답했다. 파일이 33,474개다.
 *    · 문서대장은 `tmp/문서대장.json` 에 있었고 «돌 때마다 덮였다» — 어제와 견줄 수가 없다
 *    · 그래서 「어제 대비 무엇이 늘고 줄었나」 를 못 냈다
 *    ★실제로 `00_공통_받은파일함` 이 저절로 다시 생겼는데 «우연히» 알았다. 도구가 안 알려줬다
 *
 *  ── ★AI 셋에게 물어 정한 설계 (2026-09-03)
 *  > 코덱스: 「하나만 고르면 — 문서대장을 전 데이터센터의 «불변 파일 스냅샷» 으로 먼저 고정」
 *  > 제미나이: 「새 도구를 만들지 마십시오 — 저장 경로를 정본화하고 «드리프트 감지» 만 추가」
 *
 *  ★그래서 이 도구는 «판정» 을 하지 않는다. 딱 셋만 한다 —
 *      ①오늘 무엇이 있나를 «날짜별로 굳힌다»   state/데이터센터장부/<날>.ndjson
 *      ②어제와 견준다                        새로 생김 · 없어짐 · 옮겨짐 · 고쳐짐
 *      ③★«어디까지 봤나» 를 같이 남긴다        범위 밖은 「없다」 가 아니라 「모른다」
 *
 *  ── ★③이 왜 따로 있나 (코덱스가 짚었다)
 *  「어느 Drive·루트·갈래까지 훑었는가」 를 안 적으면, 안 훑은 자리를 «없다» 로 읽게 된다.
 *  ★6616 계좌 2026-07-21~08-01 이 비어 있는 것을 「입금이 없다」 고 세 번 말해 틀린 적이 있다.
 *    그래서 장부에 «범위» 를 같이 박는다.
 *
 *    node scripts/데이터센터-장부.mjs            오늘 것을 굳히고 어제와 견준다
 *    node scripts/데이터센터-장부.mjs --그려만    견주기만 (안 굳힌다)
 *    node scripts/데이터센터-장부.mjs --날=2026-09-02   그날 것과 견준다
 */
import fs from 'node:fs';
import path from 'node:path';
import { drive } from '../lib/drive.mjs';
import { DRIVE } from '../lib/ids.mjs';

const 그려만 = process.argv.includes('--그려만');
const 견줄날 = (process.argv.find((a) => a.startsWith('--날=')) ?? '').split('=')[1] || null;
const 오늘 = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const 자리 = 'state/데이터센터장부';
const 폴더 = 'application/vnd.google-apps.folder';

const d = await drive();

/** ── ①드라이브를 «한 번에» 다 읽는다. 몇 쪽을 읽었는지도 센다(범위 증명) */
const 다 = [];
let 다음 = ''; let 쪽 = 0;
do {
  const r = await d.call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent('trashed=false')}`
    + '&fields=nextPageToken,files(id,name,parents,mimeType,size,modifiedTime,createdTime)'
    + `&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${DRIVE.데이터센터}`
    + `&pageSize=1000${다음 ? `&pageToken=${다음}` : ''}`);
  다.push(...(r.files || []));
  다음 = r.nextPageToken || '';
  쪽 += 1;
} while (다음 && 쪽 < 200);

const 폴목 = 다.filter((f) => f.mimeType === 폴더);
const 파목 = 다.filter((f) => f.mimeType !== 폴더);
const 이름표 = new Map(폴목.map((f) => [f.id, f]));

/** 길을 짓는다 — 「03_정본자료보관/02_스위치플랜/C_차량/C01_계약서」 */
const 길칸 = new Map();
const 길 = (id, 깊 = 0) => {
  if (!id || 깊 > 12) return '';
  if (길칸.has(id)) return 길칸.get(id);
  const f = 이름표.get(id);
  if (!f) return '';
  const 위 = f.parents?.[0];
  const 앞 = 위 && 위 !== DRIVE.데이터센터 ? 길(위, 깊 + 1) : '';
  const 온 = 앞 ? `${앞}/${f.name}` : f.name;
  길칸.set(id, 온);
  return 온;
};

const 줄 = 파목.map((f) => ({
  id: f.id,
  이름: f.name,
  길: 길(f.parents?.[0]),
  부모: f.parents?.[0] ?? null,
  크기: Number(f.size ?? 0) || 0,
  고친때: f.modifiedTime ?? null,
  생긴때: f.createdTime ?? null,
}));

/** ★★범위 증명 — 어디까지 봤나. 이걸 안 적으면 안 본 자리를 「없다」 로 읽는다 */
const 범위 = {
  드라이브: '데이터센터', 드라이브id: DRIVE.데이터센터,
  읽은쪽: 쪽, 잘렸나: Boolean(다음),
  폴더: 폴목.length, 파일: 파목.length,
  훑은때: new Date().toISOString(),
  '★안 본 것': '휴지통(trashed) · 다른 드라이브(여기에업로드·freepasserp) — 여기 없다고 «없는» 게 아니다',
};

console.log(`\n════ ★데이터센터 파일 장부 (${오늘}) ════\n`);
console.log(`   폴더 ${범위.폴더}  ·  파일 ${범위.파일}   (${쪽}쪽 읽음${범위.잘렸나 ? ' · ★잘렸다!' : ''})`);

/** ── ②어제와 견준다 */
fs.mkdirSync(자리, { recursive: true });
const 있는날 = fs.readdirSync(자리).filter((n) => n.endsWith('.ndjson')).map((n) => n.replace('.ndjson', '')).sort();
const 앞날 = 견줄날 ?? 있는날.filter((n) => n < 오늘).pop() ?? null;

if (!앞날) {
  console.log('\n   ★견줄 어제 장부가 없다 — 오늘이 «첫 장» 이다. 내일부터 움직임이 보인다');
} else {
  const 옛 = new Map();
  for (const 한줄 of fs.readFileSync(`${자리}/${앞날}.ndjson`, 'utf8').split('\n')) {
    if (!한줄.trim()) continue;
    const x = JSON.parse(한줄);
    옛.set(x.id, x);
  }
  const 이제 = new Map(줄.map((x) => [x.id, x]));
  const 새로 = 줄.filter((x) => !옛.has(x.id));
  const 없어짐 = [...옛.values()].filter((x) => !이제.has(x.id));
  const 옮김 = 줄.filter((x) => 옛.has(x.id) && 옛.get(x.id).길 !== x.길);
  const 고침 = 줄.filter((x) => 옛.has(x.id) && 옛.get(x.id).길 === x.길
    && (옛.get(x.id).고친때 !== x.고친때 || 옛.get(x.id).크기 !== x.크기));

  console.log(`\n  ── ${앞날} 과 견준다`);
  console.log(`     새로 생김 ${새로.length}  ·  없어짐 ${없어짐.length}  ·  ★옮겨짐 ${옮김.length}  ·  고쳐짐 ${고침.length}`);
  const 보이기 = (제목, 것들, 꼴) => {
    if (!것들.length) return;
    console.log(`\n     ── ${제목} ${것들.length}`);
    for (const x of 것들.slice(0, 8)) console.log(`        ${꼴(x)}`);
    if (것들.length > 8) console.log(`        … ${것들.length - 8}개 더`);
  };
  보이기('새로 생김', 새로, (x) => `${x.길}/${x.이름}`.slice(0, 100));
  보이기('★없어짐 (지워졌거나 휴지통)', 없어짐, (x) => `${x.길}/${x.이름}`.slice(0, 100));
  보이기('옮겨짐', 옮김, (x) => `${x.이름.slice(0, 34).padEnd(36)} ${옛.get(x.id).길} → ${x.길}`);
  if (없어짐.length) console.log('\n     ★없어진 것이 있으면 «누가 왜» 를 본다 — logs/ 와 .coordination/audit.ndjson');
}

if (그려만) { console.log('\n   ※안 굳혔다. 굳히려면 --그려만 을 뺀다\n'); process.exit(0); }

/** ── ③굳힌다. ★한 번 굳힌 날은 «덮지 않는다» — 덮으면 어제가 사라진다 */
const 길이름 = `${자리}/${오늘}.ndjson`;
if (fs.existsSync(길이름)) {
  console.log(`\n   ★${오늘} 장부가 이미 있다 — 덮지 않는다 (하루에 한 장이 원칙)`);
  console.log(`      다시 굳히려면 그 파일을 손으로 치운다: ${길이름}`);
} else {
  fs.writeFileSync(길이름, `${줄.map((x) => JSON.stringify(x)).join('\n')}\n`, 'utf8');
  fs.writeFileSync(`${자리}/${오늘}.범위.json`, JSON.stringify(범위, null, 1), 'utf8');
  console.log(`\n   ★굳혔다 → ${길이름}  (${줄.length}줄)`);
  console.log(`            → ${자리}/${오늘}.범위.json   ★어디까지 봤나`);
}
console.log('');

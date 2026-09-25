/** 데이터센터에 **무엇이 얼마나 있나** — 읽기만 한다.
 *
 *  대표(2026-08-22): 「파일이 35만 개나 된다고? 이거 파일 정리도 한번 해야 할 거 같은데」
 *
 *  ── 왜 만드나
 *  기존 도구는 «최근 것»(dc-analyze)이나 «찾는 것»(purge-list)만 본다.
 *  전체가 어떤 모양인지 세어 본 적이 없어서 **어디부터 정리할지 정할 수가 없다.**
 *
 *  ── 무엇을 세나
 *   · 최상위 폴더별 개수·용량
 *   · 종류별(PDF·사진·시트…)
 *   · 언제 올라온 것인지 (해마다)
 *   · **같은 이름이 여러 개** — 중복 후보
 *   · 휴지통
 *
 *  ── 쓰는 법
 *    node drive/dc-count.mjs              # 데이터센터
 *    node drive/dc-count.mjs --드라이브=여기에업로드
 *
 *  받은 목록은 `tmp/dc-count-<드라이브>.json` 에 남는다 —
 *  다시 훑지 않고 다른 각도로 세어 볼 수 있게. **PII 다. 커밋 금지.**
 */
import { token, makeCall } from '../lib/goog.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const 드라이브이름 = arg('드라이브', '데이터센터');
const ID = DRIVE[드라이브이름];
if (!ID) throw new Error(`모르는 드라이브: ${드라이브이름} (${Object.keys(DRIVE).join(' · ')})`);

const call = makeCall(await token());
const 밑 = `https://www.googleapis.com/drive/v3/files?corpora=drive&driveId=${ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000`;

/** 한 판 다 훑기. 35만 건이면 350판이라 «몇 판째» 를 찍어 준다 */
async function 훑기(q, fields, 무엇) {
  const 모은것 = [];
  let 다음 = '', 판 = 0;
  do {
    const r = await call(`${밑}&q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`nextPageToken,files(${fields})`)}${다음 ? `&pageToken=${다음}` : ''}`);
    모은것.push(...(r.files ?? []));
    다음 = r.nextPageToken ?? '';
    if (++판 % 20 === 0) process.stdout.write(`\r  ${무엇} ${모은것.length.toLocaleString('ko-KR')}건…`);
  } while (다음);
  process.stdout.write(`\r  ${무엇} ${모은것.length.toLocaleString('ko-KR')}건\n`);
  return 모은것;
}

console.log(`\n═══ ${드라이브이름} 세는 중 ═══`);

// ① 폴더 지도부터. 파일이 어느 «맨 위 폴더» 밑에 있는지 알아야 한다
const 폴더들 = await 훑기("mimeType = 'application/vnd.google-apps.folder' and trashed = false", 'id,name,parents', '폴더');
const 지도 = new Map(폴더들.map((f) => [f.id, { 이름: f.name, 부모: f.parents?.[0] ?? '' }]));

/** 맨 위 폴더 이름 — 드라이브 바로 밑까지 거슬러 올라간다 */
function 맨위(부모, 깊이 = 0) {
  if (!부모 || 부모 === ID || 깊이 > 20) return '(드라이브 바로 밑)';
  const 나 = 지도.get(부모);
  if (!나) return '(모르는 폴더)';
  return 나.부모 === ID || !나.부모 ? 나.이름 : 맨위(나.부모, 깊이 + 1);
}

// ② 파일
const 파일들 = await 훑기("mimeType != 'application/vnd.google-apps.folder' and trashed = false",
  'id,name,mimeType,size,createdTime,parents', '파일');
const 휴지통 = await 훑기('trashed = true', 'id,name,size', '휴지통');

mkdirSync('tmp', { recursive: true });
writeFileSync(`tmp/dc-count-${드라이브이름}.json`,
  JSON.stringify({ 때: new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 16), 폴더: 폴더들.length, 파일들, 휴지통: 휴지통.length }, null, 0), 'utf8');

// ── 세기 ────────────────────────────────────────────────────────
const 억 = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}MB` : `${(n / 1e3).toFixed(0)}KB`;
const 셈 = (arr, 열쇠) => {
  const m = new Map();
  for (const x of arr) {
    const k = 열쇠(x);
    const v = m.get(k) ?? { 수: 0, 크기: 0 };
    v.수 += 1; v.크기 += Number(x.size ?? 0);
    m.set(k, v);
  }
  return [...m.entries()].sort((a, b) => b[1].수 - a[1].수);
};

const 총크기 = 파일들.reduce((a, x) => a + Number(x.size ?? 0), 0);
console.log(`\n총 ${파일들.length.toLocaleString('ko-KR')}건 · ${억(총크기)} · 폴더 ${폴더들.length.toLocaleString('ko-KR')}개 · 휴지통 ${휴지통.length.toLocaleString('ko-KR')}건`);

console.log('\n── 맨 위 폴더별 ──');
for (const [k, v] of 셈(파일들, (f) => 맨위(f.parents?.[0])).slice(0, 20)) {
  console.log(`  ${String(v.수).padStart(7)}건  ${억(v.크기).padStart(7)}  ${k}`);
}

console.log('\n── 종류별 ──');
const 갈래 = (m) => m.includes('image') ? '사진' : m.includes('pdf') ? 'PDF'
  : m.includes('spreadsheet') || m.includes('excel') ? '시트' : m.includes('document') || m.includes('word') ? '문서'
  : m.includes('video') ? '영상' : m.includes('audio') ? '소리' : m.split('/').pop().slice(0, 20);
for (const [k, v] of 셈(파일들, (f) => 갈래(f.mimeType ?? '')).slice(0, 12)) {
  console.log(`  ${String(v.수).padStart(7)}건  ${억(v.크기).padStart(7)}  ${k}`);
}

console.log('\n── 언제 올라왔나 ──');
for (const [k, v] of 셈(파일들, (f) => String(f.createdTime ?? '').slice(0, 4) || '?').sort((a, b) => a[0] < b[0] ? -1 : 1)) {
  console.log(`  ${String(v.수).padStart(7)}건  ${억(v.크기).padStart(7)}  ${k}년`);
}

console.log('\n── 같은 이름이 여럿 (중복 후보) ──');
const 이름별 = 셈(파일들, (f) => f.name);
const 겹친것 = 이름별.filter(([, v]) => v.수 > 1);
const 겹친건수 = 겹친것.reduce((a, [, v]) => a + v.수 - 1, 0);
const 겹친크기 = 겹친것.reduce((a, [, v]) => a + Math.round(v.크기 * (v.수 - 1) / v.수), 0);
console.log(`  이름이 겹치는 것 ${겹친것.length.toLocaleString('ko-KR')}가지 · **한 벌씩만 남기면 ${겹친건수.toLocaleString('ko-KR')}건 (${억(겹친크기)}) 준다**`);
console.log('  많이 겹치는 것:');
for (const [k, v] of 겹친것.slice(0, 10)) console.log(`    ${String(v.수).padStart(5)}개  ${k.slice(0, 60)}`);

console.log(`\n적어 둠: aiops/tmp/dc-count-${드라이브이름}.json  (PII — 커밋 금지)`);

/** 중복 파일 — **내용(md5)까지 대조해서** 진짜 같은 것만 고른다. 읽기만 한다.
 *
 *  대표(2026-08-22): 「중복 정리하고 깔끔하게 뭘 수집해야 하는지만 보자고」
 *
 *  ── 왜 md5 인가
 *  이름이 같아도 다른 파일일 수 있고(같은 차의 다른 달 고지서),
 *  이름이 달라도 같은 파일일 수 있다(`계약서.pdf` · `계약서_최종.pdf`).
 *  **드라이브가 md5 를 준다.** 이름으로 세면 틀린다.
 *
 *  ── 어느 벌을 남기나
 *  순서대로 따진다:
 *    ① **법인 폴더**(01~06) 안에 있는 것 — 미분류(99·00)에 있는 사본보다 낫다
 *    ② **갈래 폴더**(C1_계약서 …) 안에 있는 것 — 분류가 끝난 자리다
 *    ③ 경로가 깊은 것 — 정리된 자리일수록 깊다
 *    ④ 그래도 같으면 **먼저 만들어진 것**
 *
 *  ── 쓰는 법
 *    node drive/dc-dup.mjs                 # 세기만 (목록은 CSV 로 나온다)
 *    node drive/dc-dup.mjs --자세히=30     # 큰 무리 30개를 눈으로 본다
 *
 *  **아무것도 지우지 않는다.** 지우는 것은 목록을 대표가 보고 정한다.
 *  결과: `tmp/dc-dup.csv` — PII 다. 커밋 금지.
 */
import { token, makeCall } from '../lib/goog.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const 자세히 = Number(arg('자세히', 0));
const ID = DRIVE.데이터센터;
const call = makeCall(await token());
const 밑 = `https://www.googleapis.com/drive/v3/files?corpora=drive&driveId=${ID}&includeItemsFromAllDrives=true&supportsAllDrives=true&pageSize=1000`;

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

console.log('\n═══ 중복 세는 중 ═══');
const 폴더들 = await 훑기("mimeType = 'application/vnd.google-apps.folder' and trashed = false", 'id,name,parents', '폴더');
const 지도 = new Map(폴더들.map((f) => [f.id, { 이름: f.name, 부모: f.parents?.[0] ?? '' }]));

/** 「02_스위치플랜 / C_차량 / C1_계약서」 */
const 길캐시 = new Map();
function 길(부모, 깊이 = 0) {
  if (!부모 || 부모 === ID || 깊이 > 20) return '';
  if (길캐시.has(부모)) return 길캐시.get(부모);
  const 나 = 지도.get(부모);
  if (!나) return '(모르는 폴더)';
  const 위 = 나.부모 && 나.부모 !== ID ? 길(나.부모, 깊이 + 1) : '';
  const 전체 = 위 ? `${위} / ${나.이름}` : 나.이름;
  길캐시.set(부모, 전체);
  return 전체;
}

// md5 는 구글 문서(시트·문서)에는 없다 — 그건 애초에 «복사본» 개념이 다르니 뺀다
const 파일들 = await 훑기(
  "mimeType != 'application/vnd.google-apps.folder' and trashed = false",
  'id,name,size,md5Checksum,createdTime,parents', '파일');

const 잰것 = 파일들.filter((f) => f.md5Checksum);
console.log(`\n md5 가 있는 것 ${잰것.length.toLocaleString('ko-KR')}건 / 전체 ${파일들.length.toLocaleString('ko-KR')}건`);
console.log(` (구글 시트·문서는 md5 가 없어 뺀다 — ${(파일들.length - 잰것.length).toLocaleString('ko-KR')}건)`);

// ── 무리 짓기 ────────────────────────────────────────────────────
const 무리 = new Map();
for (const f of 잰것) {
  const k = f.md5Checksum;
  if (!무리.has(k)) 무리.set(k, []);
  무리.get(k).push({ ...f, 길: 길(f.parents?.[0]) });
}
const 겹친무리 = [...무리.values()].filter((v) => v.length > 1);

/** 남길 한 벌 고르기 */
const 법인폴더 = /^0[1-6]_/;
const 갈래폴더 = /(^|\/)\s*C\d_/;
function 점수(f) {
  let s = 0;
  if (법인폴더.test(f.길)) s += 100;                       // ① 법인 폴더 안
  if (갈래폴더.test(f.길)) s += 50;                        // ② 갈래 폴더 안
  if (/99_원본보관|00_공통|미분류/.test(f.길)) s -= 80;    // 미분류 자리는 사본일 가능성이 높다
  s += (f.길.match(/\//g) ?? []).length * 5;               // ③ 깊을수록 정리된 자리
  return s;
}
function 남길것(무리) {
  return 무리.slice().sort((a, b) =>
    점수(b) - 점수(a) || String(a.createdTime).localeCompare(String(b.createdTime)))[0];
}

const 억 = (n) => n >= 1e9 ? `${(n / 1e9).toFixed(1)}GB` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}MB` : `${(n / 1e3).toFixed(0)}KB`;
let 지울수 = 0, 지울크기 = 0;
const 줄 = [['남길지', 'md5', '이름', '크기', '폴더', '만든날', 'id']];
for (const g of 겹친무리) {
  const 남길 = 남길것(g);
  for (const f of g) {
    const 남기나 = f.id === 남길.id;
    if (!남기나) { 지울수 += 1; 지울크기 += Number(f.size ?? 0); }
    줄.push([남기나 ? '남김' : '지움', f.md5Checksum, f.name, f.size ?? '', f.길, String(f.createdTime).slice(0, 10), f.id]);
  }
}

mkdirSync('tmp', { recursive: true });
const csv = 줄.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n');
writeFileSync('tmp/dc-dup.csv', '﻿' + csv, 'utf8');

console.log(`\n── 내용까지 같은 것 ──`);
console.log(`  무리 ${겹친무리.length.toLocaleString('ko-KR')}가지`);
console.log(`  **한 벌씩만 남기면 ${지울수.toLocaleString('ko-KR')}건 (${억(지울크기)}) 준다**`);

// 어느 폴더에서 지워지나 — 정리 방향이 여기서 보인다
const 어디 = new Map();
for (const g of 겹친무리) {
  const 남길 = 남길것(g);
  for (const f of g) {
    if (f.id === 남길.id) continue;
    const 맨위 = f.길.split(' / ')[0] || '(바로 밑)';
    어디.set(맨위, (어디.get(맨위) ?? 0) + 1);
  }
}
console.log('\n── 지워질 사본이 어디 있나 ──');
for (const [k, v] of [...어디.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(v).padStart(6)}건  ${k}`);
}

if (자세히) {
  console.log(`\n── 큰 무리 ${자세히}개 ──`);
  for (const g of 겹친무리.slice().sort((a, b) => b.length - a.length).slice(0, 자세히)) {
    const 남길 = 남길것(g);
    console.log(`\n  ${g.length}벌  ${g[0].name}  (${억(Number(g[0].size ?? 0))})`);
    for (const f of g) console.log(`     ${f.id === 남길.id ? '남김' : '지움'}  ${f.길}`);
  }
}

console.log('\n적어 둠: aiops/tmp/dc-dup.csv  (PII — 커밋 금지)');
console.log('아무것도 안 지웠다. 지울 것은 이 목록을 보고 정한다.');

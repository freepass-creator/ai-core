/** 대표자 개인 서류가 **어디에 흩어져 있나** — 읽기만 한다.
 *
 *  대표(2026-08-22): 「**대표자 개인 서류는 아예 따로 빼자**」
 *
 *  ── 왜 따로 빼나
 *  신분증·주민등록등본·인감증명은 **우리가 가진 것 중 가장 센 개인정보**다.
 *  지금은 여신 심사 묶음을 법인마다 복사하면서 법인 폴더 곳곳에 흩어져 있다.
 *  한 곳에 모아야 **접근 권한을 그 폴더에만 걸 수 있고, 파기할 때 한 번에 지운다.**
 *
 *  ── 갈 자리는 이미 있다
 *  `06_공통 / A_법인 / A3_대표자(제한)`. 폴더를 새로 만들지 않는다
 *  (메모리 `datacenter-drive-structure`: 「폴더 새로 만들지 말 것」).
 *
 *  ── 무엇을 개인 서류로 보나
 *   ① `A3_대표자(제한)` 폴더 안에 있는 것 — 자리가 곧 뜻이다
 *   ② 이름에 개인 식별 서류 낱말이 있는 것 — 신분증·주민등록·인감·여권·면허
 *  ②는 **어디에 있든** 찾는다. 그게 흩어진 것을 찾는 목적이다.
 *
 *  ── 쓰는 법
 *    node drive/dc-personal.mjs
 *
 *  **아무것도 옮기거나 지우지 않는다.** 결과: `tmp/dc-personal.csv` — PII. 커밋 금지.
 */
import { token, makeCall } from '../lib/goog.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

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

console.log('\n═══ 대표자 개인 서류 찾는 중 ═══');
const 폴더들 = await 훑기("mimeType = 'application/vnd.google-apps.folder' and trashed = false", 'id,name,parents', '폴더');
const 지도 = new Map(폴더들.map((f) => [f.id, { 이름: f.name, 부모: f.parents?.[0] ?? '' }]));
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

const 파일들 = await 훑기("mimeType != 'application/vnd.google-apps.folder' and trashed = false",
  'id,name,size,md5Checksum,parents', '파일');

/** 개인 식별 서류로 보이는 이름.
 *  「사업자등록증」·「법인인감」은 법인 것이라 뺀다 — 개인 서류만 골라야 한다 */
const 개인낱말 = /(신분증|주민등록|주민증|등본|초본|인감증명|본인서명|여권|운전면허|가족관계|혼인관계|재직증명|건강보험자격)/;
const 법인것 = /(사업자등록|법인인감|법인등기|주주명부|정관|통장사본|사용인감)/;
const 제한폴더 = /A3_대표자/;

const 줄 = [['왜', '이름', '크기', '폴더', 'md5', 'id']];
const 자리별 = new Map();
const 사람별 = new Map();
let 셈 = 0;

for (const f of 파일들) {
  const 경로 = 길(f.parents?.[0]);
  const 자리 = 제한폴더.test(경로);
  const 이름 = 개인낱말.test(f.name) && !법인것.test(f.name);
  if (!자리 && !이름) continue;

  셈 += 1;
  const 왜 = 자리 && 이름 ? '자리+이름' : 자리 ? '제한 폴더' : '이름';
  줄.push([왜, f.name, f.size ?? '', 경로, f.md5Checksum ?? '', f.id]);

  const 맨위 = 경로.split(' / ')[0] || '(바로 밑)';
  자리별.set(맨위, (자리별.get(맨위) ?? 0) + 1);

  // 누구 것인가 — 이름 앞머리의 사람 이름을 본다
  const 사람 = f.name.match(/([가-힣]{2,4})\s*(신분증|주민등록|주민증|등본|초본|인감|여권|면허)/);
  if (사람) 사람별.set(사람[1], (사람별.get(사람[1]) ?? 0) + 1);
}

mkdirSync('tmp', { recursive: true });
writeFileSync('tmp/dc-personal.csv', '﻿' + 줄.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')).join('\n'), 'utf8');

console.log(`\n총 ${셈.toLocaleString('ko-KR')}건`);

console.log('\n── 어디에 있나 ──');
for (const [k, v] of [...자리별.entries()].sort((a, b) => b[1] - a[1])) {
  const 제자리 = k === '06_공통';
  console.log(`  ${String(v).padStart(5)}건  ${k}${제자리 ? '   ← 여기가 모을 자리' : ''}`);
}

console.log('\n── 누구 것인가 ──');
for (const [k, v] of [...사람별.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(v).padStart(5)}건  ${k}`);
}

// 같은 내용이 몇 벌인가 — 모으고 나면 몇 건이 남나
const md5별 = new Map();
for (const r of 줄.slice(1)) { if (r[4]) md5별.set(r[4], (md5별.get(r[4]) ?? 0) + 1); }
const 한벌씩 = md5별.size;
const md5있는것 = [...md5별.values()].reduce((a, b) => a + b, 0);
console.log(`\n── 모으고 한 벌씩만 남기면 ──`);
console.log(`  지금 ${md5있는것.toLocaleString('ko-KR')}건 → **${한벌씩.toLocaleString('ko-KR')}건** (${(md5있는것 - 한벌씩).toLocaleString('ko-KR')}건 줄어든다)`);

console.log('\n적어 둠: aiops/tmp/dc-personal.csv  (PII — 커밋 금지)');
console.log('아무것도 안 옮기고 안 지웠다.');

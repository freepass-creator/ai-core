/** 폐기 목록 만들기 — 지우기 «전에» 무엇을 지울지 파일로 남긴다. 읽기 전용.
 *  2026-08-21 대표: 「웰릭스 재고랑 자산시트만 남기고 다 폐기 · 개인정보 관련만」
 *  ★사람 정보(이름·연락처·주민번호)가 든 것만 고른다. 차량 정보는 남긴다.
 *  ★지운 목록은 반드시 남긴다 — 나중에 「그거 어디 갔냐」에 답할 수 있어야 한다.
 *
 *  실행: node drive/purge-list.mjs --word=웰릭스 --out=tmp/purge-welrix.csv
 */
import { makeCall, token } from '../lib/goog.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const WORD = arg('word', '웰릭스');
const OUT = arg('out');
const call = makeCall(await token());
const kst = (t) => new Date(new Date(t).getTime() + 9 * 36e5).toISOString().slice(0, 10);

/** 사람 정보가 든 것 — 이름·연락처·주민번호가 실릴 만한 문서 */
const 사람 = /상담|디비|DB|삼당|전화|명단|고객|회원|신청서|가입|동의|위임|주민|계약서(?!.*서식)|등록증|채권|채무|명세|리스트(?!.*요청)/i;
/** 사람 정보가 없는 것 — 차량·회사·서식 */
const 사람아님 = /재고|상품리스트|차종|시세|견적|계산기|대시보드|사업자등록증|정책|서식|양식|심사기준|부채잔액|요청자료|회신자료|전대차/i;

const 모두 = [];
for (const [name, did] of [['데이터센터', DRIVE.데이터센터], ['옛 드라이브', DRIVE.여기에업로드], ['프리패스ERP', DRIVE.freepasserp]]) {
  let page = '';
  do {
    const r = await call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`trashed=false and name contains '${WORD}'`)}&fields=nextPageToken,files(id,name,mimeType,createdTime,size,parents)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${did}${page ? `&pageToken=${page}` : ''}`);
    (r.files || []).forEach((f) => 모두.push({ ...f, 드라이브: name })); page = r.nextPageToken || '';
  } while (page);
}
const r2 = await call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`trashed=false and name contains '${WORD}'`)}&fields=files(id,name,mimeType,modifiedTime,size,parents)&pageSize=200&supportsAllDrives=true`);
(r2.files || []).forEach((f) => 모두.push({ ...f, 드라이브: '내 드라이브', createdTime: f.modifiedTime }));

const 판정 = (x) => {
  if (사람아님.test(x.name)) return '남김 — 차량·회사·서식';
  if (/채권|채무/.test(x.name)) return '★확인 — 채무자 정보이자 법적 근거';
  if (사람.test(x.name)) return '폐기 — 사람 정보';
  return '?  사람이 정해야 함';
};
const 목록 = 모두.map((x) => ({ ...x, 판정: 판정(x) }));
const g = {};
for (const x of 목록) (g[x.판정] ||= []).push(x);

console.log(`\n「${WORD}」 ${모두.length}건 — 판정\n`);
for (const [k, v] of Object.entries(g).sort()) {
  console.log(`■ ${k} — ${v.length}건`);
  for (const x of v.slice(0, 14)) console.log(`   ${x.mimeType.includes('folder') ? '📁' : '  '} ${kst(x.createdTime)} ${x.드라이브.padEnd(10)} ${x.name.slice(0, 46)}`);
  if (v.length > 14) console.log(`   … 그 밖 ${v.length - 14}건`);
  console.log('');
}
if (OUT) {
  mkdirSync(dirname(OUT), { recursive: true });
  const h = ['판정', '드라이브', '이름', 'id', '만든날', '종류'];
  writeFileSync(OUT, '﻿' + [h.join(','), ...목록.map((x) => [x.판정, x.드라이브, x.name, x.id, kst(x.createdTime), x.mimeType.includes('folder') ? '폴더' : '파일'].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n'));
  console.log(`${OUT} 에 적었습니다 — 이 파일을 보고 「폐기」 열을 고친 뒤 실행합니다`);
}
console.log(`\n※ 폴더를 지우면 «그 안의 파일도 전부» 사라집니다. 폴더는 안을 먼저 보십시오.`);

/** 개인정보 찾기 — 파일 «안»을 열어 사람 정보가 들었는지 본다. 읽기 전용.
 *  2026-08-21 대표: 「개인정보는 없다고 보면 되지?? 더 찾아봐 나중에 감사해서 발견하지 말고」
 *
 *  ★찾은 «내용»은 절대 적지 않는다. 무엇이 몇 개 있었는지만 센다.
 *  ★이름만 보고 판단하지 않는다 — 「JPK회신자료_13번」 같은 이름에도 고객 명단이 들었을 수 있다.
 *
 *  실행: node drive/pii-scan.mjs --word=웰릭스 [--limit=200]
 */
import { makeCall, token } from '../lib/goog.mjs';
import { DRIVE } from '../lib/ids.mjs';
import { drive } from '../lib/drive.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const WORD = arg('word', '웰릭스');
const LIMIT = Number(arg('limit', 300));
const call = makeCall(await token());
const d = await drive();

/** 개인정보 냄새 — 셀 값과 헤더 둘 다 본다 */
const 주민 = /\b\d{6}\s*-\s*[1-4]\d{6}\b/;
const 휴대 = /\b01[016-9][-\s]?\d{3,4}[-\s]?\d{4}\b/;
const 이메일 = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const 머리 = /성명|고객명|이름|연락처|전화|휴대폰|주민|생년월일|주소|이메일|계약자|임차인|보증인/;

const 모두 = [];
for (const [name, did] of [['데이터센터', DRIVE.데이터센터], ['옛 드라이브', DRIVE.여기에업로드], ['프리패스ERP', DRIVE.freepasserp]]) {
  let page = '';
  do {
    const r = await call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`trashed=false and name contains '${WORD}' and mimeType != 'application/vnd.google-apps.folder'`)}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${did}${page ? `&pageToken=${page}` : ''}`);
    (r.files || []).forEach((f) => 모두.push({ ...f, 드라이브: name })); page = r.nextPageToken || '';
  } while (page);
}
const r2 = await call(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(`trashed=false and name contains '${WORD}' and mimeType != 'application/vnd.google-apps.folder'`)}&fields=files(id,name,mimeType,size)&pageSize=200&supportsAllDrives=true`);
(r2.files || []).forEach((f) => 모두.push({ ...f, 드라이브: '내 드라이브' }));

// 같은 파일이 여러 번 잡히면 하나로
const uniq = [...new Map(모두.map((x) => [x.id, x])).values()].slice(0, LIMIT);
console.log(`\n「${WORD}」 파일 ${uniq.length}개를 열어 봅니다…\n`);

const 걸림 = [], 못엶 = [];
let n = 0;
for (const f of uniq) {
  n++;
  if (n % 25 === 0) process.stdout.write(`   …${n}/${uniq.length}\n`);
  let 글 = '';
  try {
    if (/spreadsheetml|ms-excel|csv|\.xls|\.csv/i.test(f.mimeType + f.name)) {
      const rows = await d.rows(f.id);
      글 = rows.slice(0, 400).map((r) => (r || []).join(' ')).join('\n');
    } else if (/pdf/i.test(f.mimeType + f.name)) {
      글 = (await d.text(f.id)) || '';
    } else if (/google-apps.spreadsheet/.test(f.mimeType)) {
      const { sheet } = await import('../lib/sheet.mjs');
      const s = await sheet(f.id);
      for (const t of (await s.tabs()).slice(0, 8)) { const v = await s.values(t.title); 글 += v.slice(0, 200).map((r) => (r || []).join(' ')).join('\n') + '\n'; }
    } else continue;
  } catch (e) { 못엶.push({ ...f, 왜: String(e.message).slice(0, 50) }); continue; }
  if (!글.trim()) { 못엶.push({ ...f, 왜: '글자 없음(스캔본일 수 있음)' }); continue; }

  const 셈 = {
    주민: (글.match(new RegExp(주민, 'g')) || []).length,
    휴대: (글.match(new RegExp(휴대, 'g')) || []).length,
    이메일: (글.match(new RegExp(이메일, 'g')) || []).length,
    머리: 머리.test(글.split('\n').slice(0, 8).join(' ')) ? 1 : 0,
  };
  if (셈.주민 || 셈.휴대 >= 2 || (셈.머리 && 셈.이메일 >= 2)) 걸림.push({ ...f, 셈 });
}

console.log(`\n■ 사람 정보가 든 것으로 보이는 파일 — ${걸림.length}건`);
걸림.sort((a, b) => (b.셈.주민 - a.셈.주민) || (b.셈.휴대 - a.셈.휴대));
for (const x of 걸림) {
  const t = [x.셈.주민 ? `주민번호 ${x.셈.주민}` : '', x.셈.휴대 ? `휴대전화 ${x.셈.휴대}` : '', x.셈.이메일 ? `이메일 ${x.셈.이메일}` : '', x.셈.머리 ? '사람 열 있음' : ''].filter(Boolean).join(' · ');
  console.log(`   ${x.드라이브.padEnd(10)} ${x.name.slice(0, 44).padEnd(46)} ${t}`);
}
if (!걸림.length) console.log('   없습니다.');

console.log(`\n■ 못 연 파일 — ${못엶.length}건 (스캔 이미지·zip·hwp 등은 눈으로 봐야 합니다)`);
const 왜별 = {}; for (const x of 못엶) (왜별[x.왜] ||= []).push(x);
for (const [k, v] of Object.entries(왜별).sort((a, b) => b[1].length - a[1].length).slice(0, 5)) {
  console.log(`   ${String(v.length).padStart(3)}건  ${k}`);
  for (const x of v.slice(0, 4)) console.log(`          ${x.name.slice(0, 50)}`);
}
console.log(`\n※ 찾은 내용은 적지 않았습니다 — 몇 개인지만 셌습니다.`);

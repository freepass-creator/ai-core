/** 연결 확인 + 이 폴더 쓰는 법 한눈에. 실행: node examples/hello.mjs */
import { drive, kst } from '../lib/drive.mjs';
import { sheet } from '../lib/sheet.mjs';
import { SHEET, DCF, folder, misc, url } from '../lib/ids.mjs';
import { locks } from '../lib/lock.mjs';

console.log('■ 1. 지금 다른 AI가 잡고 있는 작업');
try { const L = await locks(); console.log(L.length ? L.map((l) => `   ${l.target} ← ${l.who} (${l.at}) ${l.what}`).join('\n') : '   없음 — 시작해도 됩니다'); }
catch (e) { console.log('   (작업판 확인 실패:', e.message.slice(0, 80), ')'); }

console.log('\n■ 2. 시트 읽기 — 열은 이름으로');
const s = await sheet(SHEET.업무내비게이션);
const le = await s.lastEdit();
console.log(`   업무내비게이션 마지막 수정 ${kst(le.at)} (${le.who})`);
const t = await s.table('해야 할 일');
console.log(`   「해야 할 일」 ${t.rows.length}행 · 열: ${t.header.filter(Boolean).join('·')}`);
for (const x of t.rows.slice(0, 3)) console.log(`     ${t.get(x, '담당')} · ${t.get(x, '업무주기')} · ${t.get(x, '업무명')}`);

console.log('\n■ 3. 데이터센터 — 폴더 열기');
const d = await drive();
const c1 = await d.ls('02_스위치플랜', 'C1_계약서');
console.log(`   02_스위치플랜 / C1_계약서 : ${c1.length}건 (예: ${c1.slice(0, 2).map((f) => f.name).join(' | ')})`);
console.log(`   회사별 00_미분류자료 링크: ${['01_손오공', '02_스위치플랜', '03_프라임구독'].map((co) => co + ' ' + url.folder(misc(co)).slice(-8)).join(' · ')}`);

console.log('\n■ 4. 최근 올라온 파일 (24시간, 두 드라이브)');
const r = await d.recent(24);
console.log(`   ${r.length}건`);
for (const f of r.slice(-5)) console.log(`     ${kst(f.createdTime)} [${f.drive}] ${f.name}`);

console.log('\n■ 5. 파일 내용 열기 (PDF 텍스트 / 엑셀 행)');
const pdf = c1.find((f) => /pdf$/i.test(f.name));
if (pdf) { const txt = await d.text(pdf.id); console.log(`   ${pdf.name} → 텍스트 ${txt.trim().length}자 ${txt.trim().length < 50 ? '(스캔 이미지 — AI가 이미지로 봐야 함)' : '(' + txt.trim().slice(0, 40).replace(/\n/g, ' ') + '…)'}`); }

console.log('\n다음: AI_GUIDE.md 를 읽으세요. 하지 말 것이 거기 있습니다.');

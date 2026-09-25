/** 폐기 — 목록(CSV)에서 「폐기」로 표시된 것을 휴지통으로 보낸다.
 *  2026-08-21 대표: 「개인정보는 다 지워주고」
 *  ★휴지통이다 — 30일 안에는 되살릴 수 있다. 영구 삭제는 하지 않는다.
 *  ★지운 목록은 남긴다(tmp/purged-<날짜>.csv) — 「그거 어디 갔냐」에 답할 수 있어야 한다.
 *
 *  실행: node drive/purge.mjs --in=tmp/purge-welrix.csv            무엇을 지울지만
 *        node drive/purge.mjs --in=tmp/purge-welrix.csv --apply    휴지통으로
 */
import { makeCall, token } from '../lib/goog.mjs';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const IN = arg('in');
const APPLY = process.argv.includes('--apply');
if (!IN) { console.log('--in=<목록.csv> 이 필요합니다'); process.exit(1); }
const call = makeCall(await token());
const 오늘 = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);

const 줄 = readFileSync(IN, 'utf8').replace(/^﻿/, '').split('\n').filter((l) => l.trim());
const cell = (l) => l.match(/"((?:[^"]|"")*)"/g)?.map((c) => c.slice(1, -1).replace(/""/g, '"')) || [];
const head = cell(줄[0]).length ? cell(줄[0]) : 줄[0].split(',');
const iOf = (n) => head.indexOf(n);
const 대상 = [];
for (const l of 줄.slice(1)) {
  const c = cell(l); if (!c.length) continue;
  if (!/^폐기/.test(c[iOf('판정')] || '')) continue;
  대상.push({ 이름: c[iOf('이름')], id: c[iOf('id')], 드라이브: c[iOf('드라이브')], 종류: c[iOf('종류')] });
}

console.log(`\n휴지통으로 보낼 것 ${대상.length}건\n`);
for (const x of 대상) console.log(`   ${x.종류 === '폴더' ? '📁' : '  '} ${x.드라이브.padEnd(10)} ${x.이름.slice(0, 50)}`);
const 폴더 = 대상.filter((x) => x.종류 === '폴더');
if (폴더.length) console.log(`\n⚠ 폴더 ${폴더.length}건 — 안의 파일도 함께 사라집니다`);
if (!APPLY) { console.log(`\nDRY — 아무것도 안 지웠습니다 (--apply)`); process.exit(0); }

const 된것 = [], 안된것 = [];
for (const x of 대상) {
  try {
    await call(`https://www.googleapis.com/drive/v3/files/${x.id}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });
    된것.push(x);
  } catch (e) { 안된것.push({ ...x, 왜: String(e.message).slice(0, 80) }); }
}
mkdirSync('tmp', { recursive: true });
const OUT = `tmp/purged-${오늘}.csv`;
writeFileSync(OUT, '﻿' + ['날짜,드라이브,이름,id,종류', ...된것.map((x) => [오늘, x.드라이브, x.이름, x.id, x.종류].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n'));
console.log(`\n휴지통으로 보냄 ${된것.length}건 · 실패 ${안된것.length}건`);
for (const x of 안된것) console.log(`   ✕ ${x.이름.slice(0, 40)} — ${x.왜}`);
console.log(`기록: ${OUT}  (30일 안에는 구글 드라이브 휴지통에서 되살릴 수 있습니다)`);

/** 데이터센터 새 업로드 분석 (읽기만) — 상태 파일 dc-state.json 에 처리한 파일 id 를 기록해 «새 파일만» 본다.
 *  사용: node dc-analyze.mjs [시간h=48] [--all]   (--all = 상태 무시하고 전부)
 *  엑셀/CSV: 시트·헤더·행수·날짜범위·입출금 합계·계좌번호 후보. PDF/이미지: 내려받기만(내용은 사람이/Claude가 읽는다).
 *  내려받은 파일은 tmp/dc/ (PII — 공유·커밋 금지)
 */
import { token, makeCall } from './lib-goog.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import * as XLSX from 'file:///C:/dev/renman/node_modules/xlsx/xlsx.mjs';
const tk = await token(); const call = makeCall(tk);
const DRIVE = '0ALp5cUm1kqTvUk9PVA';
const args = process.argv.slice(2); const hours = Number(args.find((a) => /^\d+$/.test(a)) || 48); const ALL = args.includes('--all');
const STATE = 'dc-state.json'; const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { done: {} };
mkdirSync('tmp/dc', { recursive: true });
const since = new Date(Date.now() - hours * 3600e3).toISOString();
const q = encodeURIComponent(`modifiedTime > '${since}' and trashed = false and mimeType != 'application/vnd.google-apps.folder'`);
const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,parents,size,lastModifyingUser(emailAddress,displayName))');
let files = [], pageToken = '';
do { const r = await call(`https://www.googleapis.com/drive/v3/files?corpora=drive&driveId=${DRIVE}&includeItemsFromAllDrives=true&supportsAllDrives=true&q=${q}&orderBy=createdTime&pageSize=200&fields=${fields}${pageToken ? '&pageToken=' + pageToken : ''}`); files.push(...(r.files || [])); pageToken = r.nextPageToken || ''; } while (pageToken);
if (!ALL) files = files.filter((f) => !state.done[f.id]);
const cache = new Map();
async function pathOf(id, depth = 0) { if (!id || depth > 8) return ''; if (cache.has(id)) return cache.get(id); const f = await call(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=id,name,parents`); const p = f.parents?.[0] && f.parents[0] !== DRIVE ? await pathOf(f.parents[0], depth + 1) : ''; const full = (p ? p + ' / ' : '') + f.name; cache.set(id, full); return full; }
const kst = (t) => new Date(new Date(t).getTime() + 9 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
const excelDate = (v) => { if (v instanceof Date) return v; if (typeof v === 'number' && v > 30000 && v < 60000) return new Date(Math.round((v - 25569) * 86400e3)); if (typeof v === 'string') { const m = v.match(/(20\d{2})[.\-\/년 ]\s*(\d{1,2})[.\-\/월 ]\s*(\d{1,2})/); if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); } return null; };
const num = (v) => { if (typeof v === 'number') return v; if (typeof v === 'string') { const s = v.replace(/[,\s원]/g, ''); if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s); } return null; };
console.log(`데이터센터 최근 ${hours}h · 변경 파일 ${files.length}건`);
const out = [], touched = [];
for (const f of files) {
  const path = await pathOf(f.parents?.[0]);
  const who = f.lastModifyingUser?.emailAddress || '?';
  const rec = { id: f.id, name: f.name, path, who, created: kst(f.createdTime), modified: kst(f.modifiedTime), size: f.size ? +f.size : null, mime: f.mimeType, parent: f.parents?.[0] };
  // «새 업로드»만 내려받아 분석: 최근 생성 또는 00_미분류자료 안. 옛 파일이 수정만 된 것(내용증명 재생성 등)은 목록만 남긴다
  const isNew = new Date(f.createdTime) >= new Date(since) || /00_미분류자료/.test(path);
  rec.kind = isNew ? 'new' : 'touched';
  if (!isNew) { touched.push(rec); state.done[f.id] = { name: f.name, at: new Date().toISOString(), touched: true }; continue; }
  const local = `tmp/dc/${f.id}_${f.name.replace(/[\\/:*?"<>|]/g, '_')}`;
  if (!f.mimeType.includes('google-apps')) {
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${tk}` } });
    writeFileSync(local, Buffer.from(await r.arrayBuffer())); rec.local = local;
  }
  console.log(`\n■ ${rec.created}  ${who}  ${path}  ›  ${f.name}  (${rec.size ? Math.round(rec.size / 1024) + 'KB' : f.mimeType})`);
  if (/\.(xlsx?|csv)$/i.test(f.name) && rec.local) {
    try {
      const wb = XLSX.read(readFileSync(local), { type: 'buffer', cellDates: true, codepage: 949 });
      rec.sheets = [];
      for (const sn of wb.SheetNames) {
        const ws = wb.Sheets[sn]; const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        const hi = rows.findIndex((r) => r.filter((c) => String(c).trim() !== '').length >= 3); if (hi < 0) { rec.sheets.push({ sheet: sn, rows: 0 }); continue; }
        const hdr = rows[hi].map((c) => String(c).trim()); const body = rows.slice(hi + 1).filter((r) => r.some((c) => String(c).trim() !== ''));
        // 날짜 열: 헤더에 일자/일시/날짜 또는 값이 날짜인 열
        let dcol = hdr.findIndex((h) => /거래일|일자|일시|날짜|date/i.test(h)); if (dcol < 0) dcol = hdr.findIndex((_, i) => body.slice(0, 5).every((r) => excelDate(r[i])));
        const dates = dcol >= 0 ? body.map((r) => excelDate(r[dcol])).filter(Boolean) : [];
        const dmin = dates.length ? new Date(Math.min(...dates)).toISOString().slice(0, 10) : null, dmax = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null;
        const sumCol = (re) => { const i = hdr.findIndex((h) => re.test(h)); if (i < 0) return null; const s = body.reduce((a, r) => a + (num(r[i]) || 0), 0); return { col: hdr[i], sum: s, n: body.filter((r) => (num(r[i]) || 0) !== 0).length }; };
        const inn = sumCol(/입금|맡기신|입금액|수입/), outn = sumCol(/출금|찾으신|출금액|지출/), bal = hdr.findIndex((h) => /잔액|잔고/.test(h));
        const lastBal = bal >= 0 && body.length ? num(body[body.length - 1][bal]) ?? num(body[0][bal]) : null;
        const pre = rows.slice(0, hi).flat().map(String).join(' '); const acct = (pre + ' ' + hdr.join(' ')).match(/\d{3,6}-\d{2,6}-\d{3,8}|\d{10,14}/g);
        rec.sheets.push({ sheet: sn, headerRow: hi + 1, header: hdr.filter(Boolean), rows: body.length, dateCol: dcol >= 0 ? hdr[dcol] : null, from: dmin, to: dmax, in: inn, out: outn, lastBalance: lastBal, acctHints: acct ? [...new Set(acct)].slice(0, 4) : [] });
        console.log(`   시트「${sn}」 헤더${hi + 1}행 ${body.length}건 · ${dmin || '?'}~${dmax || '?'} · ${inn ? `${inn.col} Σ${inn.sum.toLocaleString()}(${inn.n}건)` : '입금열?'} · ${outn ? `${outn.col} Σ${outn.sum.toLocaleString()}(${outn.n}건)` : '출금열?'}${lastBal != null ? ` · 잔액 ${lastBal.toLocaleString()}` : ''}${acct ? ` · 계좌힌트 ${[...new Set(acct)].slice(0, 3).join(',')}` : ''}`);
        console.log(`     열: ${hdr.filter(Boolean).join(' | ').slice(0, 200)}`);
      }
    } catch (e) { rec.error = String(e.message).slice(0, 200); console.log('   [파싱 실패]', rec.error); }
  } else if (/\.pdf$/i.test(f.name)) { console.log('   PDF — 내려받음: ' + local); }
  out.push(rec); state.done[f.id] = { name: f.name, at: new Date().toISOString() };
}
if (touched.length) { console.log(`
(수정만 된 옛 파일 ${touched.length}건 — 분석 생략, 상태에만 기록)`); const byDir = {}; for (const t of touched) byDir[t.path] = (byDir[t.path] || 0) + 1; for (const [d, n] of Object.entries(byDir)) console.log(`   ${n}건  ${d}`); }
writeFileSync(STATE, JSON.stringify(state, null, 1));
writeFileSync('tmp/dc/last-analysis.json', JSON.stringify({ analyzed: out, touched }, null, 1));
console.log(`\n상태 저장 · 처리 누계 ${Object.keys(state.done).length}건 · 상세 tmp/dc/last-analysis.json`);

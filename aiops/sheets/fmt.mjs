/** 공통 서식 빌더 — 시트 서식 표준(구글 템플릿 갤러리 문법): 흰 바탕 · 남색 #0b5394 제목 · 회색 #efefef 필드헤더 · 본문 #434343 · 가로 밑줄 #d9d9d9 */
export const SS = 'https://sheets.googleapis.com/v4/spreadsheets';
export const rgb = (r, g, b) => ({ red: r / 255, green: g / 255, blue: b / 255 });
// 구역 왼쪽 굵은선 색(의미 표시용) — 배경으로는 쓰지 않는다
export const NAVY = rgb(30, 58, 95), GREEN = rgb(22, 101, 62), ORANGE = rgb(200, 85, 40), GREY = rgb(90, 90, 90), PURPLE = rgb(78, 52, 120), RED = rgb(190, 60, 45);
export const STD_NAVY = rgb(11, 83, 148);   // #0b5394 제목색
export const TAB = rgb(120, 144, 172);       // 탭 색은 한 가지, 연하게
// 탭별 색조(연하게) — 제목 배경·교차색상 헤더·탭 색에 같이 쓴다
export const TINTS = { 지침: rgb(224, 232, 243), 요청: rgb(252, 234, 217), 할일: rgb(222, 240, 229), 안내: rgb(224, 232, 243), 매뉴얼: rgb(236, 230, 246), AI: rgb(221, 240, 238) };
export const TABS = { 지침: rgb(96, 132, 176), 요청: rgb(214, 140, 74), 할일: rgb(76, 150, 104), 안내: rgb(96, 132, 176), 매뉴얼: rgb(140, 112, 184), AI: rgb(70, 150, 144) };
// 템플릿 갤러리(프로젝트 추적기) 느낌의 진한·채도 낮은 강조색 — 헤더 채움 + 흰 글씨. 탭마다 다르게
export const ACCENT = { 지침: rgb(59, 91, 138), 요청: rgb(192, 105, 43), 할일: rgb(47, 125, 79), 안내: rgb(59, 91, 138), 매뉴얼: rgb(110, 86, 168), AI: rgb(46, 127, 121) };
export const HAIR = rgb(232, 234, 237);
export const INK = rgb(67, 67, 67), LINE = rgb(217, 217, 217), HEADBG = rgb(239, 239, 239), SECBG = rgb(238, 242, 247), WHITE = rgb(255, 255, 255), SUB = rgb(102, 102, 102);
const F = 'Roboto';   // 2026-08-18 사장님: 모든 관리시트 글꼴 Roboto 통일 (fmt.mjs FONT와 같이)

/** blocks: [sectionTitle, accentColor, headRow, rows[]] — 열 수는 W.length */
export const mk = (title, sub, W, blocks) => {
  const N = W.length, pad = (r) => { const o = [...r]; while (o.length < N) o.push(''); return o.slice(0, N); };
  const SEC = [], B = [pad([title]), pad([sub])];
  for (const [t, c, head, rows] of blocks) { SEC.push({ r: B.length + 1, t, c }); B.push(pad([t])); B.push(pad(head)); rows.forEach((r) => B.push(pad(r))); }
  return { SEC, B, W };
};

const mix = (c, w) => ({ red: c.red + (1 - c.red) * w, green: c.green + (1 - c.green) * w, blue: c.blue + (1 - c.blue) * w });   // 흰색 쪽으로 w 만큼
export async function textTab(call, id, name, idx, { SEC, B, W }, opts = {}) {
  const N = W.length;
  const ACC = opts.accent || STD_NAVY, TABC = opts.accent || opts.tab || TAB;
  const meta = await call(`${SS}/${id}?fields=sheets.properties`);
  const T = new Map(meta.sheets.map((s) => [s.properties.title, s.properties]));
  if (T.has(name)) await call(`${SS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: T.get(name).sheetId } }] }) });
  const res = await call(`${SS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name, index: idx, gridProperties: { rowCount: B.length + 4, columnCount: N, frozenRowCount: 2, hideGridlines: true }, tabColorStyle: { rgbColor: TABC } } } }] }) });
  const g = res.replies[0].addSheet.properties.sheetId;
  const lastCol = String.fromCharCode(64 + N);
  await call(`${SS}/${id}/values/${encodeURIComponent(`${name}!A1:${lastCol}${B.length}`)}?valueInputOption=USER_ENTERED`, { method: 'PUT', body: JSON.stringify({ values: B }) });
  const req = [
    { repeatCell: { range: { sheetId: g, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { fontFamily: F, fontSize: 18, bold: true, foregroundColor: ACC }, verticalAlignment: 'BOTTOM', padding: { left: 12, bottom: 4 } } }, fields: 'userEnteredFormat' } },
    { repeatCell: { range: { sheetId: g, startRowIndex: 1, endRowIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { fontFamily: F, fontSize: 10, foregroundColor: SUB }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP', padding: { left: 12, right: 12, top: 2, bottom: 10 } } }, fields: 'userEnteredFormat' } },
    { repeatCell: { range: { sheetId: g, startRowIndex: 2 }, cell: { userEnteredFormat: { backgroundColor: WHITE, textFormat: { fontFamily: F, fontSize: 10, foregroundColor: INK }, verticalAlignment: 'TOP', wrapStrategy: 'WRAP', padding: { left: 10, right: 10, top: 7, bottom: 7 }, borders: { bottom: { style: 'SOLID', colorStyle: { rgbColor: HAIR } } } } }, fields: 'userEnteredFormat' } },
    { repeatCell: { range: { sheetId: g, startRowIndex: 2, startColumnIndex: 0, endColumnIndex: 1 }, cell: { userEnteredFormat: { textFormat: { bold: true } } }, fields: 'userEnteredFormat.textFormat.bold' } },
    { updateDimensionProperties: { range: { sheetId: g, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 52 }, fields: 'pixelSize' } },
    { updateDimensionProperties: { range: { sheetId: g, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 48 }, fields: 'pixelSize' } },
    { mergeCells: { range: { sheetId: g, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: N }, mergeType: 'MERGE_ALL' } },
    { mergeCells: { range: { sheetId: g, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: N }, mergeType: 'MERGE_ALL' } },
    ...W.map((px, i) => ({ updateDimensionProperties: { range: { sheetId: g, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } })),
  ];
  for (const s of SEC) req.push(
    { mergeCells: { range: { sheetId: g, startRowIndex: s.r - 1, endRowIndex: s.r, startColumnIndex: 0, endColumnIndex: N }, mergeType: 'MERGE_ALL' } },
    { updateDimensionProperties: { range: { sheetId: g, dimension: 'ROWS', startIndex: s.r - 1, endIndex: s.r }, properties: { pixelSize: 36 }, fields: 'pixelSize' } },
    { repeatCell: { range: { sheetId: g, startRowIndex: s.r - 1, endRowIndex: s.r }, cell: { userEnteredFormat: { backgroundColor: ACC, textFormat: { fontFamily: F, fontSize: 11, bold: true, foregroundColor: WHITE }, verticalAlignment: 'MIDDLE', padding: { left: 12 }, borders: { bottom: { style: 'NONE' } } } }, fields: 'userEnteredFormat' } },
    { repeatCell: { range: { sheetId: g, startRowIndex: s.r, endRowIndex: s.r + 1 }, cell: { userEnteredFormat: { backgroundColor: rgb(241, 243, 244), textFormat: { fontFamily: F, fontSize: 9, bold: true, foregroundColor: rgb(95, 99, 104) }, verticalAlignment: 'MIDDLE', padding: { left: 10 }, borders: { bottom: { style: 'SOLID', colorStyle: { rgbColor: HAIR } } } } }, fields: 'userEnteredFormat' } });
  // ★ 표시 행 — 아주 연한 살구색
  const starCols = Array.from({ length: N }, (_, i) => `LEFT($${String.fromCharCode(65 + i)}3,1)="★"`).join(',');
  req.push({ addConditionalFormatRule: { rule: { ranges: [{ sheetId: g, startRowIndex: 2, endRowIndex: B.length }], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: `=OR(${starCols})` }] }, format: { backgroundColor: rgb(253, 246, 236) } } }, index: 0 } });
  for (const t of opts.tall || []) req.push({ updateDimensionProperties: { range: { sheetId: g, dimension: 'ROWS', startIndex: t.row - 1, endIndex: t.row }, properties: { pixelSize: t.px }, fields: 'pixelSize' } });
  for (const m of opts.merge || []) req.push({ mergeCells: { range: { sheetId: g, startRowIndex: m.row - 1, endRowIndex: m.row, startColumnIndex: m.c0, endColumnIndex: m.c1 }, mergeType: 'MERGE_ALL' } });
  await call(`${SS}/${id}:batchUpdate`, { method: 'POST', body: JSON.stringify({ requests: req }) });
  console.log(`   ${name.padEnd(12)} gid=${g} · ${B.length}행 · 구역 ${SEC.length}`);
  return g;
}

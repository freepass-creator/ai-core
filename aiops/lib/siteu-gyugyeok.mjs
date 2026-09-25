/** ★시트 규격 — 우리가 만드는 시트는 다 이 꼴이다. 여기가 정본이다.
 *
 *  대표(2026-08-26): 「모든 시트 규격을 **상품리스트 말고 다 규격 통일**해야 하고」
 *                    「그리고 **타이틀헤더를 어떤 라인으로 감싸려고 하지 마**」
 *                    「폰트는 로보토 쓰기로 했음 — **숫자가 산스가 좀 별루야**」
 *
 *  ── ★왜 한 곳에 두나
 *  실측(2026-08-26) 결과 우리 시트 규격이 «여섯 갈래» 로 갈려 있었다:
 *      시세      남색 제목 · #efefef 9pt 머리 · 선 없음
 *      원장      ★선[top,left] 로 칸마다 감쌈 · 머리 8pt
 *      시작      #1e3a5f 12~14pt
 *      거래처    흰 18pt · 머리 #3b5b8a / #2f7d4f (탭마다 다름)
 *      업무내비  흰 18pt · 머리 #283856 / ★「진행중」 탭은 서식이 아예 없음
 *      차종마스터 #ededed 9pt
 *  도구마다 제 색을 박아 넣어 이렇게 됐다. 그래서 값을 여기 하나에 둔다.
 *
 *  ── ★상품리스트는 예외다
 *  영업자가 보는 것이고 공급사 시트 꼴을 그대로 따른다 (memory: 영업자용=기존 「전체시트」 스타일).
 *  대표가 콕 집어 뺐다.
 *
 *  ── ★본문 배경은 건드리지 않는다
 *  운영관리 원장은 본문 칸의 50~60% 가 색칠돼 있다 — 직원이 «뜻» 을 담아 칠한 것이다.
 *  흰색으로 밀면 그 뜻이 통째로 사라지고 되돌릴 수 없다.
 *  ★그래서 규격은 «틀»(제목·머리·행높이·선) 만 맞추고 본문 색은 그대로 둔다.
 */

/** 글꼴 — ★Roboto. 숫자 모양이 기준이다 (2026-08-26 대표 확정).
 *  한글 글리프는 Roboto 에 없어 Sheets 가 자동 폴백한다 — 숫자·영문만 Roboto 모양이 된다. 그게 노린 것이다 */
export const 글꼴 = 'Roboto';

const rgb = (r, g, b) => ({ red: r / 255, green: g / 255, blue: b / 255 });

/** 빛깔 — ★새 색을 여기 말고 다른 데서 만들지 마라 */
export const 빛 = {
  제목바탕: rgb(11, 83, 148),      // #0b5394  제목줄
  제목글: rgb(255, 255, 255),
  제목곁글: rgb(206, 221, 239),    // 제목 옆 설명 — 남색 위라 옅게
  머리바탕: rgb(239, 239, 239),    // #efefef  필드헤더
  머리글: rgb(95, 99, 104),        // #5f6368
  본문글: rgb(67, 67, 67),         // #434343
  밑줄: rgb(232, 234, 237),        // #e8eaed  본문 가로 밑줄
  구역선: rgb(188, 196, 207),      // #bcc4cf  구역이 바뀌는 열에만 세로선
  흰: rgb(255, 255, 255),
};

/** 크기 — 한 번 정하면 어느 시트나 같다 */
export const 크기 = {
  제목: 14, 제목곁: 10, 머리: 9, 본문: 10,
  제목높이: 34, 구역높이: 22, 머리높이: 23, 본문높이: 23,
  /** ★공지줄 — 탭 맨 위. 대표(2026-08-26)
   *  「맨 상단에 탭이름이랑 그 탭에 대한 업무설명 또는 부가적 내용들 공지 같은 거」
   *  「3줄 정도 보조글씨로 입력할 수 있는 크기면 될 것 같은데」 「너무 많이 쓸 거는 아니고」
   *  → 「★**공지는 2줄로 끝내라**고 해야겠다」 (같은 날 다시 정함)
   *  10pt 두 줄 ≈ 16px × 2 + 위아래 여백 = 40 */
  공지: 10, 공지높이: 40, 공지줄수: 2,
};

/** 숫자 꼴 */
export const 꼴 = {
  돈: { type: 'NUMBER', pattern: '#,##0' },
  율: { type: 'NUMBER', pattern: '0.0%' },
  날: { type: 'DATE', pattern: 'yyyy-mm-dd' },
  글: { type: 'TEXT', pattern: '@' },
};

/** ★선 규칙 — 대표(2026-08-26)「타이틀헤더를 어떤 라인으로 감싸려고 하지 마」
 *
 *  제목줄·필드헤더는 **테두리를 두르지 않는다.** 바탕색이 이미 경계다.
 *  거기에 선까지 두르면 칸이 «갇혀» 보이고, 스물몇 열이 한 덩어리로 뭉친다.
 *  본문은 «가로 밑줄 하나» 만 — 줄을 따라 눈이 가게. 세로선은 구역이 바뀌는 자리에만.
 */
export const 선 = {
  없음: {},
  밑줄만: { bottom: { style: 'SOLID', colorStyle: { rgbColor: 빛.밑줄 } } },
  구역: { left: { style: 'SOLID', colorStyle: { rgbColor: 빛.구역선 } } },
  구역과밑줄: {
    left: { style: 'SOLID', colorStyle: { rgbColor: 빛.구역선 } },
    bottom: { style: 'SOLID', colorStyle: { rgbColor: 빛.밑줄 } },
  },
};

/** 제목줄 한 칸의 꼴 */
export const 제목꼴 = () => ({
  backgroundColor: 빛.제목바탕, verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP',
  padding: { left: 12, right: 16, top: 6, bottom: 6 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.제목, bold: true, foregroundColor: 빛.제목글 },
  borders: 선.없음,                      // ★감싸지 않는다
});

/** ★구역 머리 한 칸의 꼴 — 「식별 | | | 제조사 스펙 | …」 처럼 **여러 칸에 나뉘어 든** 1행.
 *
 *  ★이것을 제목으로 착각하면 안 된다 (2026-08-26 실측):
 *      자산   「식별 · 제조사 스펙 · …」          열 구역을 가르는 라벨
 *      계약   「… 현재 계약 …」
 *      수납   「… 26년 8월 …」                   ★달을 가리킨다. **자리가 뜻이다**
 *      운영현황「차량 · 지금 챙길 것 · 계약 세부」
 *  통째로 14pt 제목으로 칠하면 저 라벨들이 다 뭉개진다.
 *  그래서 «1행에 글이 한 칸만» 들면 제목, «여러 칸» 이면 구역 머리로 가른다.
 *
 *  꼴은 제목과 같은 남색이되 작고 왼쪽 정렬이다 — 아래 필드헤더와 층이 지게 */
export const 구역머리꼴 = () => ({
  backgroundColor: 빛.제목바탕, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE',
  wrapStrategy: 'CLIP', padding: { left: 8, right: 6 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.머리, bold: true, foregroundColor: 빛.제목글 },
  borders: 선.없음,                      // ★감싸지 않는다
});

/** ★선 — 「감싸는 것」 과 「가르는 것」 은 다르다.
 *
 *  대표(2026-08-26): 「타이틀헤더를 어떤 라인으로 **감싸려고** 하지 마」
 *  ★사방을 두르지 말라는 뜻이다. 바탕색이 이미 경계라 선까지 두르면 답답해진다.
 *
 *  ★«구역이 바뀌는 자리의 세로선 하나» 는 감싸는 것이 아니다 —
 *    시세 시트가 「차량 │ 감가 │ 금융 │ 값 │ 운영 …」 을 그렇게 가른다. 그건 규격에 든다.
 *  검사기(`unyoung/gyugyeok-jeonsu.mjs`)도 이 기준으로 본다:
 *      위·아래 선이 있거나 세로선이 «양쪽» 이면  → 감쌌다 (규격 위반)
 *      세로선이 «한쪽» 만                        → 구역 나눔 (규격 안) */

/** ★공지줄 한 칸의 꼴 — 탭 맨 위. 탭 이름 + 무슨 일을 하는 탭인가.
 *
 *  ★표 탭의 1행은 «전부» 이 꼴이다 — 제목꼴(14pt)은 「읽는 글」 탭에만 쓴다.
 *    옛날엔 표 탭 1행도 14pt 제목으로 칠했는데, 대표가 거기에 «탭 이름 + 업무 설명»을
 *    쓰겠다고 해서 보조글씨로 내렸다. 큰 글씨로 두 줄을 쓰면 표를 밀어낸다.
 *  ★두 줄로 끝낸다 (대표 2026-08-26). 더 길면 표가 안 보인다 —
 *    길게 쓸 것은 그 시트의 「시트 규격」·「시작」 탭에 적는다.
 *  ★선으로 감싸지 않는다 (대표 2026-08-26) — 바탕색이 이미 경계다. */
export const 공지꼴 = () => ({
  backgroundColor: 빛.제목바탕, horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE',
  // ★병합하지 않고 «넘쳐 보이게» 한다.
  //   WRAP + 병합이 먼저 떠올랐지만 두 가지 때문에 안 된다:
  //    ① 필터가 걸린 탭은 그 범위와 겹치는 병합을 거부한다 (400) — 우리 표엔 필터가 걸려 있다
  //    ② 병합은 나중에 열을 넣고 빼는 것을 막는다
  //   OVERFLOW_CELL 이면 1행 옆칸이 비어 있는 한 글이 옆으로 넘쳐 다 보이고,
  //   Alt+Enter 로 줄을 바꾸면 그대로 세 줄이 된다. 병합 없이 같은 것을 얻는다
  wrapStrategy: 'OVERFLOW_CELL',
  padding: { left: 12, right: 16, top: 6, bottom: 6 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.공지, bold: false, foregroundColor: 빛.제목글 },
  borders: 선.없음,
});

/** 필드헤더 한 칸의 꼴 */
export const 머리꼴 = () => ({
  backgroundColor: 빛.머리바탕, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE',
  wrapStrategy: 'WRAP', padding: { left: 6, right: 6 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.머리, bold: true, foregroundColor: 빛.머리글 },
  borders: 선.없음,                      // ★감싸지 않는다
});

/** 본문 한 칸의 꼴 — ★배경은 안 준다. 직원이 칠한 색을 덮지 않으려고 */
export const 본문꼴 = () => ({
  verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP', padding: { left: 8, right: 8 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.본문, foregroundColor: 빛.본문글 },
  borders: 선.밑줄만,
});

/** ★본문에 무엇을 «쓸» 것인가 — repeatCell 의 fields.
 *
 *  ★두 가지를 일부러 «안» 넣는다. 넣으면 지워지는 것이 있다:
 *
 *  ① `backgroundColor` — 넣는 순간 직원이 칠한 색이 다 지워진다 (원장의 50~60%)
 *  ② `textFormat`      — ★넣는 순간 «셀 안의 링크» 가 지워진다
 *        구글 시트에서 Ctrl+K 로 넣은 링크는 `textFormatRuns` 에 산다.
 *        `textFormat` 을 통째로 덮으면 runs 가 같이 날아간다.
 *        값(글자)은 남고 링크만 사라져서 **눈으로는 잘 안 보인다.**
 *        2026-08-26 에 거래처 「공급사」 탭의 공급사시트·정제시트 링크 42개를 그렇게 날렸다.
 *        대표: 「공급사시트랑 제공시트 링크 다 어디 갔냐??」
 *        → `unyoung/link-doellyeonota.mjs` 로 버전 기록에서 되살렸다.
 *
 *  ③ `borders` — ★2026-08-27 에 여기서 당했다.
 *        대표: 「**이력 바뀔 때나 월 지나갈 때 구분선이 없어진** 거 같아」
 *        운영관리 「계약」 탭은 회차가 바뀌는 자리(7·15·23…)에 «세로 굵은 선» 이 그어져 있다.
 *        직원이 «여기서 다음 계약» 이라고 눈으로 가르려고 그은 것이다.
 *        `borders` 를 fields 에 넣으면 그 선이 **통째로 지워진다** —
 *        본문꼴이 「밑줄만」 을 주니까 세로선이 다 날아간다.
 *        ★사업현황(원본)에는 `SOLID_MEDIUM` 으로 살아 있는데 운영관리에서만 사라졌다.
 *        → 「색은 조심했는데 선은 안 챙긴」 것이다. 둘 다 «직원이 뜻을 담아» 넣은 것이다.
 *
 *  ★그래서 본문 글꼴·크기는 «따로» 건다 — `글자필드` 로 낱개만.
 *    낱개로 걸면 runs 가 살아남는다.
 */
export const 본문필드 = 'userEnteredFormat(verticalAlignment,wrapStrategy,padding)';
/** ★선까지 갈아엎어야 할 때만 쓴다 — 새로 만드는 탭처럼 «지울 선이 없는» 자리.
 *  이미 쓰던 탭에는 쓰지 않는다. 직원이 그은 선이 날아간다 */
export const 본문필드_선까지 = 'userEnteredFormat(verticalAlignment,wrapStrategy,padding,borders)';
/** 글꼴·크기만 — ★링크(textFormatRuns)를 살리려고 낱개로 건다 */
export const 글자필드 = 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize';
export const 온통필드 = 'userEnteredFormat';

/** ★탭은 두 갈래다 — 「표」 와 「읽는 글」. 규격이 다르다.
 *
 *  표     자산·계약·수납·공급사 …   제목/구역머리 + 필드헤더 + 줄줄이 데이터
 *  읽는글 시작·직원 안내·AI 인계 …   제목 + 「■ 구역」 + 설명. **필드헤더가 없다**
 *
 *  ★읽는 글에 «표 규격» 을 입히면 2행(곁말)이 회색 필드헤더가 되어 거짓말이 된다.
 *    2026-08-26 에 거래처 「시작」 에 그렇게 잘못 입혔다가 되돌렸다.
 *  ★읽는 글에는 밑줄도 두지 않는다 — 표가 아니니 줄을 따라갈 일이 없다.
 */
export const 읽는탭 = [/^시작$/, /^직원 안내$/, /^안내$/, /^AI 인계$/, /^이 시트는$/, /^시트 규격$/, /^AI 운영 매뉴얼$/];

/** 읽는 글의 본문 한 칸 */
export const 읽는꼴 = () => ({
  backgroundColor: 빛.흰, verticalAlignment: 'MIDDLE', wrapStrategy: 'CLIP',
  padding: { left: 10, right: 10 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.본문, bold: false, foregroundColor: 빛.본문글 },
  borders: 선.없음,                      // ★밑줄도 없다
});

/** 읽는 글의 「■ …」 구역머리 */
export const 읽는구역꼴 = () => ({
  backgroundColor: 빛.머리바탕, verticalAlignment: 'MIDDLE', padding: { left: 10 },
  textFormat: { fontFamily: 글꼴, fontSize: 크기.머리, bold: true, foregroundColor: 빛.머리글 },
  borders: 선.없음,
});

/** 어느 시트에 입히나 — ★상품리스트는 뺀다 (대표 2026-08-26) */
export const 뺄시트 = ['프리패스_상품리스트'];

/** 손대지 않는 탭 — 사람이 읽는 안내이거나, 도구가 매일 새로 쓰는 자리 */
export const 뺄탭 = [
  /^_/, /^\[구버전/, /^차종사전$/, /^AI 정제$/,
];

/** 시트·드라이브 id 한 곳. 하드코딩 금지 — 어디서든 여기만 import 한다. */
import { readFileSync } from 'node:fs';
import { 별명들 } from './폴더이름.mjs';

export const SHEET = {
  자산행위원장: '1lXmUx65OMMr_K1e1rzaW1nMzbt2ZzCeJXmxaK-GrUxI',   // 한 줄에 한 행위 · AI 전용 · 2026-08-21 신설
  프리패스_정산원장: '1BjGBqAjRLEb9ZMKarpQsMF-q_UjdgmEqBAl1uVk8SR4',   // 계약 한 건이 한 줄 · 정산월 열 · 2026-08-21 신설
  업무내비게이션: '1EO72KmCWKeZIcSAL2WAsmHMm2ZKy5imDqjWwyud2FSg',   // 직원이 보는 유일한 시트
  업무지도: '1cur0CNa14hJh8Vvu0etKtKGIzWYUPKEs9M65WM_Uiv8',           // 대표용 — 관제·조치대상·채권통합
  스위치_운영관리: '1KEKm4j0oQ39Jk-0IgaydeMF_IpW7-_evOfeP_pyBkgM',
  스위치_재무관리: '1iSe54he4nRIYv5Q7Qo35FrlnXUwHhYCso-GWjR7gALk',   // 계좌내역·자금일보·입금내역·CMS
  스위치_백데이터: '17PZxK5TCdqNQDccQWWPdWBwylAu96hPIgGz42Dz5DA0',
  프라임_운영관리: '13QQTz1W0FlBk5V8lggVw93EhDwIgjFF4mRb2BOiKSPk',
  프라임_백데이터: '18QFWdK4ovXUcEZZGoT4Qb8mcnKYMf8CPqG2iN7J8xFA',
  손오공_운영관리: '1AZuqIb2xlHHgU_1QmxQpfgtRM-XEwmk-jyyDm9FFLA0',   // 2026-08 기준 보류
  프리패스_자금일보: '1BIs3AGsODGj5OxBuPDYj6KJs3T-budcVONl1TO85RwE',
  스위치_자금일보: '1eOyTCixXJhMkmYsw2TgL14UkMVY9MIwW7DtqPwH--Ck',
  접속정보: '1nEA23OeDmb-z--qrdb01xQltFSbr788n8rY09kFLeeU',
  세무사제출자료: '1VpgfPRe9nMkHrbb2FGxWxg5KROIcwwtzDYEPLcebAQ8',
  AI작업판: '1WvzUIJK8HLhytgGdN5LCFqOHoHkO2J6ZIuqeHwt9yxs',   // 잠금·작업로그·인계 (코덱스·커서와 충돌 방지)
};

/** ★사업현황 시트 = 「구_○○ 운영관리」 — **작업층(원본)** 이다.
 *
 *  대표(2026-08-23): 「기존 사업현황 시트, 운영관리 시트 보면 돼」
 *
 *  시트는 두 겹이다. 이것이 **사장님이 10년째 직접 쓰는 원본**이고,
 *  위의 `스위치_운영관리` 등은 이것을 읽어 산출한 **분석층**이다.
 *  분석층만 보고 판단하면 틀린다 — 2026-08-23 에 실제로 4대가 어긋나 있었다.
 *
 *  ★운영 대수는 「자산」이 아니라 **「채권」 탭**으로 센다
 *    (프라임만 채권 탭이 없고 「대여료(구독료)」가 그 자리다).
 *
 *  **원본 양식을 재설계하지 않는다.** 원본 그대로 두고 분석층만 얹는다.
 */
export const 사업현황 = {
  /** ★★2026-09-01 Claude 확인 — **이 id 는 「[구버전·폐기 2026-09-26] 구_손오공 운영관리」 다.**
   *  ★2026-09-02 해결 — 최신 xlsx 를 구글 시트로 변환했다(`scripts/xlsx-시트로.mjs`).
   *    ★답은 아래 `손오공최신` 이다. 이 id 는 «옛 값과 견줄 때만» 쓴다. */
  손오공: '1Po2wPLY-T6IQvmlO5vYS3el6e9x0THh64HUdztwTkJI',
  /** ★★손오공 «최신» 사업현황 — 「[손오공] 사업현황 (시트변환 2026-09-02)」
   *  원본은 `[손오공] 사업현황-32026.08.31.xlsx`(1Xu6PpEfXVlytHu6Lt4rTxKM9q2YzH-Ah, 2026-09-01 수정).
   *  ★실측: 자산 탭 **393대** — 「[G01 사용중] 운영관리」 367대를 «통째로 품고» 26대가 더 있다.
   *    ★「사라졌다」던 24대가 여기 다 있었다. 지워진 게 아니라 «우리가 폐기본을 보고 있었다».
   *  ★원본 xlsx 가 새로 올라오면 다시 변환해서 이 id 를 갈아 끼운다. */
  손오공최신: '1OSfxtH905P8DTBDJ4CtpVsAfWZOOLWrTh6wd7Q412Hs',
  /** ★2026-09-01 갈아 끼움 — 옛 id 는 「[구버전·폐기 2026-09-26] 구_스위치플랜 운영관리」 였다.
   *  대표가 준 최신은 「[스위치플랜] 사업현황」 (9-01 tbag4783 수정). 미수를 옛 시트에서 읽고 있었다. */
  스위치: '1bOD57IKtX3gyklYDYXI3F6_sbRlUh3Agh-eHT8qdI8M',
  /** ★★2026-09-01 Claude 확인 — 이 id 도 「[구버전·폐기 2026-09-26] 구_프라임구독 운영관리」 다.
   *  ★프라임은 «최신 사업현황 시트가 아예 없다». 현역은 `SHEET.프라임_운영관리`(「[P01 사용중]」) 뿐이다. */
  프라임: '1_I3_vArR45OE0sRds6ov7OR5E2yzkRuWTV4HZWclJ_w',
};

/** ★★어느 것이 «현역» 인가 — 이름 앞 표가 답이다 (2026-09-01 실측)
 *
 *  「[S01/P01/G01/F50… 사용중]」  ← 현역
 *  「[구버전·폐기 2026-09-26]」    ← ★읽지 마라. 지금 `사업현황.손오공`·`사업현황.프라임` 이 이것이다
 *
 *  ★시트를 새로 물릴 때는 **파일 «이름» 을 먼저 확인한다.** id 만 보면 폐기본을 읽는다.
 *     const m = await d.call(`https://www.googleapis.com/drive/v3/files/${id}?fields=name&supportsAllDrives=true`);
 */
export const 현역시트 = {
  SW: { 사업현황: '1bOD57IKtX3gyklYDYXI3F6_sbRlUh3Agh-eHT8qdI8M', 운영관리: '1KEKm4j0oQ39Jk-0IgaydeMF_IpW7-_evOfeP_pyBkgM' },
  PR: { 사업현황: null, 운영관리: '13QQTz1W0FlBk5V8lggVw93EhDwIgjFF4mRb2BOiKSPk' },
  SO: { 사업현황: null, 운영관리: '1AZuqIb2xlHHgU_1QmxQpfgtRM-XEwmk-jyyDm9FFLA0' },
};

/** 폐기 예정 — 옛 값과 견줄 때만 쓴다. 답으로 읽지 마라 */
export const 사업현황_구 = {
  스위치: '13GIcmSROn0cROHUf9oPskhG7jM_l8TUm0i5vbJJSC9M',
};

export const DRIVE = {
  데이터센터: '0ALp5cUm1kqTvUk9PVA',            // 회사 문서고 (정본)
  여기에업로드: '0ANV0xihd4PCFUk9PVA',          // 옛 드라이브 — 직원이 습관으로 여기 올린다. 반드시 같이 훑을 것
  freepasserp: '0AJxfpv00AHkkUk9PVA',

  /** ★★「받은파일함」 은 뺐다 — 2026-09-03 대표 지시
   *  대표: 「직원들 받은 파일함 이거는 됐어 그냥 빼자」 「그냥 로컬에 받으라고 하고 따로 올리라고 해야지」
   *  ★직원은 카톡·다운로드를 자기 PC 에 받고, 올릴 것만 «01_일반자료_올리기» 에 올린다.
   *    옛 파일 222개는 99_원본보관_기존자료/기존_받은파일함 에 그대로 있다(지우지 않았다).
   *  ★id 를 여기 두면 누군가 또 여기에 쓴다. 그래서 뺀다. */
};

/** 데이터센터 폴더 id 지도: DCF['02_스위치플랜']['C01_계약서'] */
export const DCF = JSON.parse(readFileSync(new URL('./dc-folders.json', import.meta.url), 'utf8'));
/** ★회사·공통 갈래. 2026-09-03 부터 이 여섯은 `03_정본자료보관` «아래» 에 있다(최상위가 아니다).
 *  옛 자료는 `99_원본보관_기존자료` 로 내려갔다 — 새로 넣지 않는 자리라 여기 넣지 않는다 */
export const CO = ['01_손오공', '02_스위치플랜', '03_프라임구독', '04_프리패스', '05_팀제이피케이', '06_공통'];
/** 회사 폴더 안 리프 (2026-09-03 «두 자리» 규격):
 *  A01_등기·정관 A02_사업자·인감 A03_대표자(제한) A04_대여사업인허가 A05_사무실·임대차 A06_위임장·재직증명
 *  B01_계좌내역(매일) B02_세금계산서 B03_세무신고 B04_재무제표·결산 B05_여신·금융심사 B06_계정별원장 B07_CMS·카드정산
 *  C01_계약서 C02_자동차등록증 C03_상환스케줄 C04_보험증권 C05_보험가입증명서 C06_매각·폐차
 *  G01_고지서_미처리 G02_고지서_처리완료 G03_채권·내용증명 G04_위약금      ★C6~C8 이 여기로 나왔다
 *  D01_근로계약서(제한) D02_4대보험·급여 D03_퇴직·정산 · E01_견적·매물리스트 E02_기관청구 · F01_금융사별스케줄표 · Z_기타
 *
 *  ★★옛 이름(`C1_계약서`)으로 물어도 찾아 준다 — `lib/폴더이름.mjs` 의 별명표를 본다.
 *    폴더 이름을 바꾸면서 코드 여든 곳을 다 고칠 수는 없다. 안 고치면 «조용히 빈 값» 을 읽는다.
 *    ★그래서 «찾는 자리 한 곳» 이 옛 이름을 알아듣게 했다. 새 이름을 먼저 보고, 없으면 옛 이름을 본다. */
export const folder = (co, leaf) => {
  const 표 = DCF[co];
  if (!표) return null;
  for (const 이름 of 별명들(leaf)) if (표[이름]) return 표[이름];
  return null;
};
export const misc = (co) => folder(co, '00_미분류자료');
export const url = { folder: (id) => `https://drive.google.com/drive/folders/${id}`, sheet: (id, gid) => `https://docs.google.com/spreadsheets/d/${id}/edit${gid ? '#gid=' + gid : ''}` };

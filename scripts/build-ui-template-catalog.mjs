import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const common = {
  accessibility: "키보드 조작, 보이는 초점, 이름·상태 전달, WCAG 2.2 AA를 확인한다.",
  requires: ["AI Core UI 토큰", "브라우저 기본 HTML"],
};
const item = (id, name, use, avoid, starter, sources, extra = {}) => ({
  id, name, use, avoid,
  desktop: extra.desktop || "넓은 본문에서 정렬과 밀도를 유지한다.",
  mobile: extra.mobile || "390px 단일 열, 44px 조작 영역, 가로 넘침 없음.",
  states: extra.states || ["기본", "호버", "초점", "비활성"],
  accessibility: extra.accessibility || common.accessibility,
  requires: extra.requires || common.requires,
  starter,
  sources,
  preview: extra.preview || "control",
  status: extra.status || "READY",
});

const sales = ["freepass-sales/웹/app.css", "freepass-sales/웹/index.html"];
const erp = ["freepasserp4/components/ui/form-controls.tsx"];
const work = ["teamjpkwork/components/penalty/ui"];
const renman = ["renman/components/ui"];

const foundations = [
  item("F01","색상","정보 위계와 상태를 일관되게 표시","장식만을 위한 다색 사용","--color-primary: #1b2a4a;",sales,{preview:"colors"}),
  item("F02","글자","제목·본문·보조 정보의 위계를 구분","작은 영문 제목을 장식처럼 사용","font: 14px/1.5 system-ui;",sales,{preview:"type"}),
  item("F03","간격","4px 배수로 정렬과 밀도를 통일","요소마다 임의 여백 사용","gap: var(--space-3);",sales,{preview:"spacing"}),
  item("F04","격자","웹 다열과 모바일 단일 열을 전환","고정 폭으로 모바일 넘침 발생","grid-template-columns: repeat(2,minmax(0,1fr));",sales,{preview:"grid"}),
  item("F05","화면 폭","360·390·412·1280·1440에서 확인","특정 기기 한 개만 기준으로 설계","@media (max-width:640px) { ... }",sales,{preview:"breakpoint"}),
  item("F06","접근성","누구나 키보드·보조기술로 완료","색만으로 선택·오류를 구분","aria-live=\"polite\"",["WCAG 2.2","WAI-ARIA APG"],{preview:"accessibility"}),
];

const components = [
  item("B01","기본 버튼","저장·완료 같은 한 가지 핵심 실행","이동 링크나 여러 핵심 실행","<button class=\"ui-button\">저장</button>",sales,{preview:"button"}),
  item("B04","아이콘 버튼","검색·닫기·더보기","뜻을 모르는 핵심 실행","<button aria-label=\"검색\">⌕</button>",sales,{preview:"icon-button"}),
  item("B06","위험 버튼","삭제 등 되돌리기 어려운 실행","일반 취소·닫기","<button class=\"danger\">삭제</button>",work,{preview:"danger"}),
  item("B07","비활성 버튼","조건 미충족 상태를 표시","이유 설명 없이 영구 비활성","<button disabled>신청</button>",sales,{preview:"disabled"}),
  item("S02","입력칸","한 줄 값을 직접 입력","검색이나 긴 메모","<input class=\"ui-control\">",erp,{preview:"input"}),
  item("S03","검색창","알고 있는 말로 목록을 찾기","새 데이터 등록","<input type=\"search\" placeholder=\"검색\">",sales,{preview:"search"}),
  item("S04","선택 상자","짧은 고정 선택지 하나","많은 항목을 검색해서 선택","<select><option>전체</option></select>",erp,{preview:"select"}),
  item("S13","검색 선택","많은 고객·차종 중 검색해 선택","선택지가 5개 이하","<input role=\"combobox\" aria-expanded=\"false\">",renman,{preview:"combobox"}),
  item("S05","체크박스","여러 항목 선택","서로 배타적인 하나 선택","<input type=\"checkbox\">",work,{preview:"checkbox"}),
  item("S06","라디오","적은 수의 배타적 선택","복수 선택","<input type=\"radio\">",erp,{preview:"radio"}),
  item("S14","스위치","즉시 켜고 끄는 설정","저장 전 검토가 필요한 값","<button role=\"switch\" aria-checked=\"false\">",renman,{preview:"switch"}),
  item("S07","날짜·시간","처리일이나 예약 시간을 입력","기간 탐색이 핵심인 달력","<input type=\"datetime-local\">",work,{preview:"date"}),
  item("S11","숫자+단위","비율·금액·거리 입력","일반 텍스트","<span class=\"ui-input-with-suffix\"><input><span>%</span></span>",sales,{preview:"unit"}),
  item("C04","파일 업로드","사진·문서 접수","이미 등록된 파일 열람","<input type=\"file\">",work,{preview:"upload"}),
  item("C01","카드","한 주제의 정보 묶음","카드 안 카드 중첩","<article class=\"card\">...</article>",sales,{preview:"card"}),
  item("L01","한 박스 목록","행 전체를 눌러 한 건 선택","다열 수치 비교","<div class=\"model-list\"><button class=\"model-row\">...</button></div>",sales,{preview:"list"}),
  item("L02","표·데이터 격자","여러 열과 수치 비교","모바일 단일 작업 목록","<table>...</table>",[...erp,...work],{preview:"table"}),
  item("C05","상태 배지","짧은 진행 상태 표시","행동 버튼 대체","<span class=\"ui-badge\">검토 중</span>",sales,{preview:"badge"}),
  item("N03","탭","같은 맥락의 보기 전환","서로 다른 업무 페이지 이동","<div role=\"tablist\">...</div>",erp,{preview:"tabs"}),
  item("N01","현재 위치","상위 목록과 현재 항목 표시","주 실행 대체","<nav aria-label=\"현재 위치\">...</nav>",sales,{preview:"breadcrumb"}),
  item("N04","쪽 이동","긴 목록의 페이지 이동","항목이 적은 목록","<nav aria-label=\"페이지\">...</nav>",erp,{preview:"pagination"}),
  item("N05","웹 이동틀","웹 주요 구역 이동","모바일 하단 이동","<nav class=\"sidebar\">...</nav>",erp,{preview:"sidebar"}),
  item("M01","모바일 하단 이동","모바일 주요 화면 이동","페이지 저장 실행","<nav class=\"model-nav\">...</nav>",sales,{preview:"bottom-nav"}),
  item("O01","대화창","주의가 필요한 짧은 결정","긴 입력 흐름","<dialog open>...</dialog>",erp,{preview:"dialog"}),
  item("O02","옆 서랍","현재 화면을 유지한 보조 상세","핵심 작업 전체","<aside class=\"drawer\">...</aside>",renman,{preview:"drawer"}),
  item("O03","모바일 하단판","모바일의 짧은 선택·확인","긴 문서","<dialog class=\"bottom-sheet\">...</dialog>",renman,{preview:"sheet"}),
  item("O04","도움말","짧은 보충 설명","필수 정보 숨김","<span role=\"tooltip\">...</span>",erp,{preview:"tooltip"}),
  item("V01","알림","본문 안의 중요한 상태 안내","일반 보조 문장","<div role=\"alert\">...</div>",work,{preview:"alert"}),
  item("V02","토스트","실행 직후 짧은 결과 알림","확인이 필요한 오류","<div role=\"status\">저장됨</div>",renman,{preview:"toast"}),
  item("V03","진행률","시간이 걸리는 작업 진행","즉시 끝나는 작업","<progress value=\"65\" max=\"100\"></progress>",work,{preview:"progress"}),
  item("V04","뼈대 화면","레이아웃을 유지한 초기 로딩","오래 걸리는 작업의 설명 대체","<div class=\"skeleton\"></div>",erp,{preview:"skeleton"}),
];

const patterns = [
  item("P01","검색+필터","목록을 빠르게 좁힘","작은 고정 목록","S03 + S04 + 결과 수",sales,{preview:"search-filter"}),
  item("P02","선택","한 행을 고르고 다음 실행","선택 즉시 파괴적 실행","L01 + 선택 배경 + M02",sales,{preview:"selection"}),
  item("P03","비교","2~3개 상품 조건을 나란히 확인","항목 하나 상세","선택 → 비교표 → 선택",erp,{preview:"compare"}),
  item("P04","업로드","파일 선택·진행·실패·재시도","읽기 전용 문서","C04 + V03 + V01",work,{preview:"upload-flow"}),
  item("P05","검수","원본과 추출값을 대조","자동 확정","원본 → 값 확인 → 보류/확정",work,{preview:"review"}),
  item("P06","승인","검토 근거와 결정 기록","단순 저장","검토 → 승인/반려 → 기록",erp,{preview:"approval"}),
  item("P07","접수증","완료 결과와 식별번호 제공","처리 전 상태","결과 → 번호 → 다음 이동",sales,{preview:"receipt"}),
  item("P08","빈·오류·로딩","데이터 상태를 같은 자리에서 전달","빈 화면 방치","loading / empty / error / populated",sales,{preview:"states"}),
  item("P09","활동 이력","시간순 업무 기록 확인","현재 값만 필요한 화면","시간 + 수행자 + 변경",work,{preview:"timeline"}),
];

const templates = [
  item("T01","홈","오늘 할 일과 주요 이동","상세 정보 과다 표시","상단 + 요약 + 목록 + 하단 이동",sales,{preview:"home"}),
  item("T02","목록","검색하고 한 건 선택","한 건만 처리","H01 + P01 + L01/L02",sales,{preview:"list-page"}),
  item("T03","상세","한 건의 사실과 상태 확인","대량 비교","H02 + C01 + P09 + M02",sales,{preview:"detail-page"}),
  item("T04","입력 폼","관련 값을 등록·수정","탐색 중심 화면","H02 + S10 + M02",[...sales,...erp],{preview:"form-page"}),
  item("T05","대시보드","여러 지표의 이상과 우선순위 확인","장식용 숫자 나열","요약 + 추이 + 예외 목록",erp,{preview:"dashboard"}),
  item("T06","단계형 작업","순서가 있는 복잡한 신청","한 화면에 끝나는 입력","현재 단계 + 내용 + 이전/다음",erp,{preview:"wizard"}),
  item("T07","업로드·검수","원본을 올리고 값 대조","파일만 저장","P04 + P05",work,{preview:"review-page"}),
  item("T08","문서 보기","PDF·근거 문서와 목차 확인","짧은 본문","문서 + 목차 + 확대/쪽 이동",["docshub/양식/toolbar.js","docshub/양식/workspace.css","docshub/양식/workspace.js"],{preview:"document"}),
  item("T09","상품 카탈로그","검색·필터·정렬로 상품 탐색","내부 업무 표","P01 + 상품 목록 + 비교 담기",[...sales,"docshub/양식/workspace.css","docshub/양식/workspace.js"],{preview:"catalog"}),
  item("T10","비교·선택·신청","상품 비교 후 하나를 골라 신청","단순 목록","P03 + 선택 + T06 + P07",sales,{preview:"commerce"}),
  item("T11","로그인","계정 확인 후 진입","앱 안 일반 폼","식별자 + 비밀번호 + 오류",erp,{preview:"login"}),
  item("T12","활동 이력","변경과 처리 흐름 추적","현재 상태만 표시","필터 + P09 + 상세",work,{preview:"timeline-page"}),
];

const profiles = [
  item("PR01","FreePass","판매·ERP·데이터 화면에 Sales 규격 적용","미승인 CI 자산 사용","body class=\"ui-profile-freepass\"",sales,{preview:"profile-freepass"}),
  item("PR02","TeamJPK","과태료·내부 업무에 공통 구조 적용","별도 CI라고 추정","body class=\"ui-profile-jpk\"",work,{preview:"profile-jpk",status:"READY_WITHOUT_CI"}),
  item("PR03","Mewcar","상품 탐색·비교·신청 구조 적용","승인 전 색·로고 확정","body class=\"ui-profile-mewcar\"",["freepasserp4 상품 화면 후보"],{preview:"profile-mewcar",status:"HOLD_BRAND"}),
  item("PR04","AI Core","제품 중립 조립표·개발자 도구","제품 브랜드처럼 외부 노출","body class=\"ui-profile-ai-core\"",["AI Core UI starter"],{preview:"profile-ai-core",status:"READY_NEUTRAL"}),
];

const catalog = {
  contract: "ai-core-ui-template-catalog/v1",
  version: "1.0.0",
  baseline: { repository:"freepass-sales", commit:"28db91f284f84ad49a588ef504cac15e52d1acb0", rule:"시각 규격은 FreePass Sales, 접근성 동작은 공식 표준" },
  official_foundations: [
    {name:"WCAG 2.2",url:"https://www.w3.org/TR/WCAG22/",role:"접근성 성공 기준"},
    {name:"WAI-ARIA APG",url:"https://www.w3.org/WAI/ARIA/apg/",role:"복합 위젯 키보드·역할 참고"},
    {name:"ISO 9241-210:2019",url:"https://www.iso.org/standard/77520.html",role:"사용자 중심 설계 과정, 2025 확인된 현행판"}
  ],
  reference_systems: [
    {name:"Material 3",url:"https://m3.material.io/",policy:"구성요소 범위만 비교, 시각 복사 금지"},
    {name:"Apple HIG",url:"https://developer.apple.com/design/human-interface-guidelines/components/",policy:"플랫폼 관습만 비교"},
    {name:"IBM Carbon",url:"https://carbondesignsystem.com/components/overview/",policy:"기업용 상태·데이터 패턴만 비교"},
    {name:"Microsoft Fluent 2",url:"https://fluent2.microsoft.design/components/web/react/core/button/usage",policy:"행동 우선순위만 비교"},
    {name:"USWDS",url:"https://designsystem.digital.gov/components/overview/",policy:"접근 가능한 구성요소 범위만 비교"}
  ],
  layers: { foundation:foundations, component:components, pattern:patterns, template:templates, profile:profiles }
};

writeFileSync(resolve("registry/ui-template-catalog.json"), `${JSON.stringify(catalog,null,2)}\n`);
console.log(Object.fromEntries(Object.entries(catalog.layers).map(([key,value])=>[key,value.length])));

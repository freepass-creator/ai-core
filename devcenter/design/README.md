# design — Design Hub backing assets

상태: Development Center **Design Hub**의 기존 backing asset 경로. Hub 조직 진입점은 `../hubs/design/README.md`다. 실행 기능 구현·검수 완료 선언은 아니다.

## AI Designer 공통 SSOT

- [AI_DESIGNER_OPERATING_GUIDE.md](AI_DESIGNER_OPERATING_GUIDE.md) — GPT·Claude·Codex·Gemini 등 모든 AI가 디자인 작업 시작 전에 먼저 읽는 공통 운영 기준.
- [AI_EDITORIAL_LAYOUT_COMPILER.md](AI_EDITORIAL_LAYOUT_COMPILER.md) — Claude 등 제작 AI가 코딩으로 비율·정보밀도·텍스트 정확성을 안정적으로 구현하기 위한 PAGE_SPEC, Grid, Density Budget, HTML/CSS/SVG 렌더링, Visual QA Loop 기준.
- 특정 브랜드 전용 규칙이 아니라 내부기획안·보고서·제안서·계약서·웹·앱·ERP/UI 등 Design Hub 전체 작업에 적용한다.
- 핵심 흐름: `내용 이해 → 정보구조 설계 → PAGE_SPEC → 브랜드 적용 → 대표 시안 승인 → Design Lock → HTML/CSS/SVG 렌더 → Visual QA → 전체 제작 → 검수`.

## 현재 디자인 자산 구조

- `tokens`: 색·글꼴·간격·크기·반응형 기준
- `components`: 버튼·드롭다운·표·입력·박스와 상태·접근성·사용 예제

구현된 [CSS·원자 부품 창고](components/CATALOG.md): 버튼 조합과 CSS/인라인 스타일 원본 검색·코드 보기.
- `patterns`: 검색·목록·상세·편집의 재사용 화면 조합

사용자 채택 패턴: [개발센터 반응형 작업 화면 v1](patterns/RESPONSIVE-SHELL.md). 현재 portal의 메뉴·카드·미리보기 구조를 실제 코드에 연결한다. 테마 전역 통일이나 전체 검수 완료와는 구분한다.

파트를 활성화할 때 책임자·입출력·원본 참조·실행 진입점·완료 기준을 명시한다. 기존 원본은 이동·복제하지 않는다.

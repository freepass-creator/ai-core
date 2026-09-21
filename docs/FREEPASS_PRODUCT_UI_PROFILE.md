# FreePass Product UI Profile — 2026-09-21

상태: **USER-LOCKED MOBILE + WEB BASELINE**

2026-09-21 사용자 확정 원문 규칙:
- `docs/UI_UX_USER_DECISION_2026-09-21_MOBILE_BASELINE.md`
- `docs/UI_UX_USER_DECISION_2026-09-21_WEB_PANEL_EXTENSION.md`

상위 접근성 정본은 `docs/SCREEN_DESIGN_STANDARD.md`다.
모바일↔웹 업무 이식 규격은 `docs/PORTABLE_TASK_PANEL_STANDARD_2026-09-21.md`를 따르고, 웹 생산성 확장은 `docs/ADAPTIVE_WEB_STANDARD_2026-09-21.md`를 따른다.
이 문서는 FreePass Sales / Estimate / ERP4에서 반복 확인된 **FreePass 제품군 전용 UI/UX 문법**을 모은다.
모든 픽셀을 강제하는 전사 표준이 아니라, 새 FreePass 화면이 먼저 참조할 profile이다.

## 1. 상단은 상태/정보, 하단은 실행

- 상단은 제목, 상태, 짧은 맥락/건수 등 표시 중심
- 제품 UI의 뒤로가기/앞으로가기/저장/완료/공유 등 navigation/task action을 상단에 두지 않는다
- 주요 업무 버튼은 하단 action boundary에 둔다
- dialog도 실행은 footer
- page header를 action toolbar로 사용하지 않는다

## 1.1 모바일 하단 영역 — 전역 메뉴와 로컬 액션을 섞지 않는다

FreePass 모바일은 하단을 두 종류로 구분한다.

### 깊이 0 — 전역 하단 메뉴

- 홈/목록 같은 최상위 화면에서만 노출
- AI Core `navigation.bottom-nav` 사용
- 최신 공통 규격의 모바일 업무행 최소 **64px** + safe-area
- 항목은 같은 폭으로 배치
- 선택 상태는 과한 테두리보다 옅은 면 + 문자 위계
- 상단 헤더와 역할이 겹치는 CTA를 넣지 않는다

### 깊이 1·2 — 로컬 하단 액션바

- 상세/검수/입력/업무 화면에서는 전역 하단 메뉴를 숨긴다
- AI Core `navigation.bottom-action` 사용
- 저장/반영/다음/완료/발송 같은 task CTA는 여기 둔다
- 화면당 Primary action은 하나
- Primary는 **48px 권장**(44px 미만 금지)
- 단일 Primary만 필요한 화면은 전체 폭 사용
- 버튼 2개는 **Secondary 3 : Primary 7**
- 버튼 3개는 **Secondary 3 : Secondary 3 : Primary 4**
- 화면당 Primary는 1개이며 가장 강한 시각 위계를 가진다
- safe-area와 가상 키보드가 액션을 가리지 않게 한다
- disabled 상태는 이유를 화면 가까이에 함께 보여준다

이 규칙은 과거 FreePass 모바일 고도화에서 합의한 당근형 최신 모바일 문법을 현재 AI Core의
`Top is informational / Bottom is actionable` 원칙에 맞춰 고정한 것이다.

## 2. 단일선택은 즉시 전진

Estimate 모바일 기준:

- 제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림
- 단일선택 단계는 선택 즉시 다음으로
- 이전/다음 같은 명시적 이동이 필요하면 상단이 아니라 하단 action boundary에서 처리
- 옵션/조건처럼 여러 값을 확정해야 하는 단계만 명시적 Next

Navigation infrastructure는 유지하되 상단 back/next icon을 기본 문법으로 만들지 않고, auto-step에서 불필요한 Next를 노출하지 않는다.

## 3. 모바일은 PC 축소판이 아니다

- 한 화면 한 목적
- 최소 44px touch target
- safe-area/키보드/스크롤을 실제 상태로 검증
- hover 없이도 같은 기능 도달
- 긴 desktop table을 무조건 축소하지 않는다

## 3.1 웹은 모바일 업무모델의 Adaptive 확장

2026-09-21 사용자 확정:

- 모바일의 업무 단위는 웹에서 panel로 재사용하는 것을 기본으로 한다
- 웹은 2개, 3개 panel을 동시에 배치해 depth를 줄일 수 있다
- 단, 정산/대량비교/재고/반복처리처럼 desktop productivity가 중요한 화면은 table/grid를 적극 허용한다
- multi-select / bulk action / inline action / keyboard shortcut / utility toolbar를 생산성 accelerator로 허용한다
- desktop accelerator는 동일한 canonical command에 연결한다
- 웹은 모바일과 동일한 픽셀/interaction을 강제하지 않는다
- workflow state, authority, validation, completion, retry/result 의미는 모바일과 동일해야 한다
- 폭이 줄어들면 mobile-complete task flow로 수렴한다

## 3.2 Portable Task Panel

FreePass 업무화면은 PC와 모바일에 별도 business flow를 만들지 않는다.

- PC의 detail/task panel을 단독 모바일 화면으로 분리해도 같은 업무가 완료되어야 한다
- PC의 keyboard shortcut / hover / right-click / drag / adjacent panel은 accelerator일 뿐 필수 completion path가 아니다
- 필요한 context는 stable entity/work ID로 전달한다
- 하단 action bar가 업무 완료 command의 공통 진입점이다
- web multi-panel은 더 많은 context를 동시에 보여주기 위한 편의이며 business logic을 fork하지 않는다

## 4. 선택 상태는 과한 테두리보다 면/문자 위계

- 일반 버튼은 불필요한 border를 줄인다
- 입력창/검색/실제 데이터 박스처럼 경계가 필요한 곳은 border 허용
- selected는 옅은 면 + 글자 굵기/의미색
- red outline 같은 과한 선택 표시를 기본 문법으로 쓰지 않는다
- pressed / selected / focus-visible을 서로 다른 상태로 취급

## 5. 검색은 현재 작업을 파괴하지 않는다

Sales에서 검증된 규칙:

- 검색을 열어도 현재 화면/목록/분류를 유지
- 제목 아래 검색영역을 확장하고 입력에 focus
- 닫으면 원래 화면/스크롤로 복귀
- 상세에서 검색/이동해도 draft 보존
- 필터 dialog 종료 시 invoker로 focus 복귀

## 6. 모바일 목록은 card type을 기본으로 한다

2026-09-21 사용자 확정:

- 모바일 목록은 서로 맞닿은 dense row가 아니라 **간격이 있는 card list**
- 용도에 따라 **2줄 카드 / 3줄 카드**
- 첫 줄은 항상 가장 중요한 main 정보
- 둘째/셋째 줄은 상태, 금액, 날짜, 속성 등 secondary/meta 정보
- 실제 클릭 영역은 충분히 넓게
- 카드 전체가 하나의 명확한 목적지/행동일 때만 전체 카드를 interactive surface로 사용
- 카드 바깥 장식과 과도한 padding보다 정보 위계를 우선

이 규칙은 이전 문서의 “2줄 compact row” 표현을 대체한다.

ERP4 Product Browse처럼 공개 상품 탐색은 업무 카드보다 더 여유로운 밀도를 가질 수 있지만,
**card 기반 위계 자체는 유지**한다.

## 6.1 보조 기능은 icon action을 적극 활용

- filter / share / search / sort 등 짧고 반복적인 보조 기능은 적절한 icon action을 사용한다
- icon-only action에는 accessible name이 필요하다
- 의미가 불명확하면 텍스트/보조설명을 함께 제공한다
- 저장/접수/완료/반영 같은 Primary 업무 CTA를 icon-only로 축약하지 않는다
- icon 사용을 이유로 상단을 action toolbar로 되돌리지 않는다

## 7. 목록↔상세 header continuity

ERP4에서 잠긴 원칙:
- 목록과 상세의 상단 제목은 같은 크기/굵기/자간/줄높이 계열
- 페이지가 바뀐다고 header hierarchy를 새로 만들지 않는다

## 8. 데이터와 UI state는 같은 revision을 본다

- filter/facet/list/card가 같은 query snapshot 사용
- async save 응답은 원 entity/work-key에만 귀속
- local draft/cache를 server success로 오인하지 않음
- source selection은 stable id로 다음 화면에 전달

UI/UX 규격에는 시각뿐 아니라 **state continuity**가 포함된다.

## 9. 검증 profile

최소:
- 360 / 390 / 412px mobile
- 1280 / 1440px desktop
- keyboard-only
- focus-visible
- reduced-motion
- loading/empty/error/populated
- safe-area
- virtual keyboard
- scroll restore
- draft preservation
- async response identity
- selected/pressed/disabled/busy

## 10. 현재 근거

FreePass Sales:
- `docs/UI-STANDARD.md`
- `docs/SSOT.md`
- revision `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`

FreePass Estimate:
- `README.md`
- revision `d29daa37119bece0f3d1c9ddb38437de0175b11b`
- 현재는 제품 방향/흐름 근거이며 실행 UI 증거는 아직 migration 전

ERP4:
- `docs/ERP4-MAIN-UI-STANDARD.md`
- `docs/ERP4-MAIN-STABILITY-LOCK.md`
- revision `2d9fd07075aae7d6d64687fabbf61126e166c34c`

## 11. 적용 원칙

1. **2026-09-21 모바일 사용자 확정 규칙을 FreePass Sales 기반 기본 문법으로 사용한다.**
2. 기존 기능을 깨지 않는다.
3. 프로젝트 고유 브랜드/업무 밀도는 유지한다.
4. 공통 pattern을 쓰되 고정 px를 기계 복사하지 않는다.
5. 프로젝트에서 더 나은 패턴이 검증되면 AI Core profile에 역수입한다.
6. AI Core가 앞선 접근성/검증 규칙은 다시 각 프로젝트가 채택한다.
7. 웹은 모바일 business task model을 재사용하되, multi-panel·table/grid·bulk·shortcut 등으로 desktop productivity를 최적화한다.

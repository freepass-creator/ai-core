# FreePass UI Standard v1

상태: **DRAFT NORMATIVE / cross-product common design contract**  
기준일: 2026-09-19  
소유: AI Core Design System  
적용: FreePass 제품군의 신규/개선 UI. 제품별 업무 의미·브랜드·데이터 SSOT는 각 프로젝트가 계속 소유한다.

> 새 디자인을 발명하는 문서가 아니다. FreePass Estimate, Sales, Admin, ERP4/White Label에서 실제로 잘 작동한 규칙을 비교해 공통 contract로 승격한다.

## 1. Authority

충돌 시:
1. 사용자의 최신 명시 결정
2. 이 문서
3. `docs/SCREEN_DESIGN_STANDARD.md`
4. 대상 프로젝트의 최신 UI/UX SSOT
5. 실제 공통 구현
6. mockup / history

제품 예외는 조용히 덮어쓰지 않고 Product Profile exception으로 남긴다.

## 2. 기준 프로젝트와 강점

### FreePass Estimate
- 모바일 **one-screen-one-choice**
- 단일선택은 선택 즉시 다음
- 이전 이동 시 기존 선택 보존
- 색상/옵션/조건처럼 복수선택·복수입력만 명시적 Next
- PC 화면 축소판이 아닌 모바일 정보구조
- 상단 정보 / 하단 행동
- Playwright 모바일 동선 회귀검증

### FreePass Sales
- 모바일 한손 사용
- 목록 전체 single tap
- 최소 64px 목록 터치영역
- 하단 global navigation
- context/scroll/draft 보존 검색
- pressed / selected / disabled / busy 상태 구분
- tabular 숫자 정렬
- 반복 한손 quick action은 48px hit-area까지 확보

### FreePass Admin
- LIST / DETAIL / WORK Panel 역할
- PanelHeader / ListRow / ActionBar / FilterSheet 공통 primitive
- 내부업무 18 / 14 / 12 타입 위계
- standard control 40 / task action 44
- Desktop multi-panel + Mobile one-panel
- 선택 상태와 업무 완료 상태 분리

### ERP4 / White Label
- 공개형 상품 탐색 / 비교
- product card / photo / filter sheet
- Public Product profile은 별도 세부 규격을 유지하되 공통 action/touch/state 계약을 따른다.

## 3. Common layer vs Product Profile

### Common layer
프로젝트가 임의 변경하지 않는다.
- page depth
- header 역할
- bottom navigation 역할
- local ActionBar 역할
- list interaction
- control/touch hierarchy
- search/filter 상호작용
- state 의미
- loading/empty/error/busy
- focus/reduced motion/keyboard
- safe-area
- numeric alignment

### Product Profile
프로젝트가 소유할 수 있다.
- brand color
- 메뉴 이름/업무축
- 카드/패널 밀도
- thumbnail 유무/크기
- 업무별 필터 내용
- 정보 우선순위
- 승인된 radius profile

## 4. Mobile shell

### MOB-SHELL-001 — one screen, one purpose
Desktop multi-pane을 모바일에서 세로로 쌓지 않는다.

```
depth 0  LIST / HOME
  → depth 1  DETAIL
    → depth 2  WORK / FORM / STEP
```

- 한 화면에 하나의 primary purpose
- 목록 진입은 single tap
- double-click / hover-only 금지
- depth는 DOM 추측 대신 명시적으로 선언
- 권장: `data-ui-depth="0|1|2"`

### MOB-TOP-001 — top is informational
모바일 top baseline: **52px**

허용:
- CI / product identity
- page title
- count / progress / passive status

기본 금지:
- Save / Submit / Share / Send
- Complete / Next / Back
- Delete / Cancel
- 페이지 이동 CTA

기존 제품의 특수 utility는 Product Profile exception으로 유지할 수 있으나 신규 공통 패턴으로 복제하지 않는다.

### MOB-NAV-001 — depth0 global bottom navigation
- depth 0에서만 global bottom nav
- 3~5개 권장, 5개 상한
- icon + label
- active는 icon/text 색·굵기 중심
- filled pill을 기본값으로 쓰지 않음
- **58~60px + safe-area**
- `env(safe-area-inset-bottom)` 필수

depth 1/2에서는 global nav를 숨기고 local ActionBar가 하단을 소유한다.

### MOB-ACTION-001 — local ActionBar
한 개:
```
[                 PRIMARY                 ]
```

두 개:
```
[ secondary 3 ] [         primary 7      ]
```

- task action: **44px**
- touch target: **44px minimum**
- primary: 한 시점 하나
- secondary: primary보다 약한 면
- destructive: 상시 primary로 두지 않음
- sticky/fixed이면 safe-area 포함
- 목록 복귀 / 취소 / 저장 / 다음 / 완료도 같은 문법

## 5. Header and typography

### TYPE-001 — internal app baseline
- Title: **18px**
- Main: **14px**
- Support: **12px**

같은 page level의 목록/상세/업무는 같은 title hierarchy를 사용한다.
count는 title보다 약하게 한다.
Header는 action area가 아니다.

제품 특성상 다른 typography profile을 쓰면 profile로 선언하되 같은 화면 안에서 임의 단계는 만들지 않는다.

## 6. Controls

### CTRL-001
- standard visible control: **40px**
- task action: **44px**
- touch target: **44px minimum**
- frequent one-hand action: **48px hit-area 권장**
- mobile text input: 필요 시 **16px minimum**(브라우저 자동확대 방지)

보이는 크기와 hit-area는 달라도 된다. 실제 hit-area가 계약을 만족해야 한다.

### CTRL-002 — surface grammar
- task button은 기본 flat surface
- search/input은 구조선 허용
- selected는 면 + 글자 위계
- border-only selected 금지
- pill shape는 기본값 아님

## 7. List standard

### LIST-001 — interaction
- row 전체 single tap
- 최소 interactive height **64px**
- gap baseline **8px**
- 고정 height 때문에 내용 자르지 않음
- row 내부 작은 기능버튼 난립 금지

### LIST-002 — density profiles
공통 contract 아래 두 density를 허용:
- Compact / 2-line: Sales
- Dense / 3-line: Admin

기본 의미 순서:
1. identity/title
2. status/context
3. main value/next meaning

### LIST-003 — numbers
금액·수량·날짜·횟수처럼 비교하는 값:
- tabular numerals
- aside/column은 우측정렬
- 목록 간 위치가 흔들리지 않게

## 8. Search / filter

### SEARCH-001
기본:
```
Header
Search
Quick / Facet
List
```

- search field 40px baseline
- 검색 중 context/scroll/draft 보존
- 검색 해제 시 이전 context 복원
- filter state와 count는 같은 조건 정의 사용
- filter 닫기 후 trigger로 focus 복귀
- 축이 많으면 2-column filter sheet 허용
- 즉시 반영 선택에 중복 Apply 버튼을 만들지 않음

상단 header icon search처럼 기존 제품에서 이미 검증된 예외는 Product Profile에 명시한다.

## 9. State grammar

### STATE-001
역할을 구분한다.
- Identity: 무엇인가
- Condition/Perk: 어떤 조건인가
- Status: 현재 상태
- Selection: 지금 고른 것
- Warning: 확인 필요
- Destructive: 취소/삭제/되돌림

금지:
- 모든 상태를 pill badge로 만들기
- 카드 전체를 의미색으로 칠하기
- 색만으로 의미 전달
- selected와 success를 같은 의미로 사용

## 10. Interaction states

### INTERACT-001
모든 interactive component:
1. default
2. hover (hover-capable pointer only)
3. focus-visible
4. pressed
5. selected/current
6. disabled
7. busy/loading
8. error/warn when applicable

- native disabled 우선
- busy = `aria-busy`
- current navigation = `aria-current`
- selected toggle = native semantics / `aria-pressed`
- reduced-motion에서 불필요한 transform/animation 제거

## 11. Feedback states

### FEEDBACK-001
모든 data surface:
- loading
- empty
- error
- populated

업무 write:
- saving
- success
- retryable failure
- terminal failure

Toast는 background-safe 완료 확인에만 사용한다. 계속 봐야 할 오류/경고는 inline으로 남긴다.

## 12. Desktop relation

Desktop:
- 여러 Panel 동시 노출 가능
- LIST / DETAIL / WORK 의미 유지
- primary action은 해당 panel bottom ActionBar

Mobile:
- 한 번에 한 Panel
- explicit depth
- global BottomNav와 local ActionBar가 동시에 주도권을 갖지 않는다

## 13. Common component contract

공통 역할 이름:
- PageShell
- PageHeader
- BottomNav
- ActionBar
- ListRow
- SearchField
- FilterSheet
- Tag
- Status
- EmptyState
- Notice
- SummaryGrid

당장 shared package 하나로 합칠 필요는 없다.
먼저 **같은 contract + 같은 gate**를 적용한다.

## 14. Product Profiles

### Estimate
- one-screen-one-choice
- single-choice auto advance
- multi-choice/multi-input explicit Next
- Back preserves selection
- mobile/desktop information architecture separate
- quote step order는 Estimate가 소유

### Sales
- one-hand mobile first
- row min 64
- bottom navigation
- frequent action 48 hit-area 권장
- 2-line list
- context/scroll/draft preserving search
- 기존 top-search utility는 product exception

### Admin
- LIST / DETAIL / WORK
- 18/14/12
- control 40 / action 44
- dense 3-line list
- desktop multi-panel

### ERP4 / White Label
- public discovery/comparison
- product/photo/filter density는 local profile
- 공통 action/touch/state/accessibility는 유지

## 15. Verification contract

DEVKIT식 요구↔검사 결속을 적용한다. **규칙이 문서에 있다는 것과 실제 화면이 준수하는 것은 별개다.**

각 공통 규칙 ID는 최소 하나의 현재 검증에 연결한다.

예:
```
MOB-TOP-001
requirement: mobile header has no task CTA
checks:
  - static header CTA selector scan
  - rendered 390px header interaction scan
```

### Static gate
- shared token 존재
- header task CTA 금지
- touch/action minimum
- explicit mobile depth
- duplicated local primitive
- stable inline hard-coded visual values
- focus-visible / reduced-motion

### Rendered mobile gate — 390px
- primary panel 하나
- header task CTA 0
- depth0 BottomNav
- depth1/2 local ActionBar
- task action 실제 높이 >=44
- safe-area 미침범
- list single tap
- horizontal overflow 없음
- list/detail title hierarchy 일치

### Rendered desktop gate — 1280px
- Panel 역할
- bottom ActionBar
- numeric alignment
- keyboard focus

**검사가 green이어도 해당 rule ID를 실제로 검증하지 않으면 완료로 세지 않는다.**

## 16. Design adoption states

프로젝트의 좋은 패턴은 자동 공통화하지 않는다.

```
CANDIDATE
→ PROJECT_VERIFIED
→ CROSS_PROJECT_VERIFIED
→ COMMON_ADOPTED
```

별도로 구현 상태는:
```
DOCUMENTED
→ STATIC_CHECKED
→ RENDER_VERIFIED
→ USER_APPROVED
```

상태를 서로 세탁하지 않는다.
- 문서 존재 ≠ 렌더 검증
- CI green ≠ 사용자 승인
- 한 프로젝트 성공 ≠ 공통 규격

## 17. Project learning loop

각 프로젝트가 AI Core보다 먼저 좋은 패턴을 발견하면 그 프로젝트가 원천이다.
AI Core로 코드 전체를 복사하지 않는다.

프로젝트는 Learning Packet에 남긴다:
- source project/revision
- 현재 실패/한계
- 바뀐 패턴
- 실제 검증
- 반례
- 적용/비적용 조건
- 제품 고유 요소
- 공통화 후보
- 아직 모르는 것

AI Core는 이를:
- `COMMON_CANDIDATE`
- `PRODUCT_PROFILE`
- `HOLD`
중 하나로 분류한다.

정식 intake 형식은 `docs/coordination/UI_LEARNING_INTAKE.md`를 따른다.

## 18. Adoption order

1. FreePass Estimate — step-flow/mobile reference
2. FreePass Sales — one-hand/list/detail/action reference
3. FreePass Admin — common mobile adoption + desktop panel reference
4. ERP4 / White Label
5. Homepage / Partner / 이후 신규 프로젝트

각 프로젝트:
- current inventory
- common contract 차이표
- Product Profile exception
- 최소 변경
- mobile 390 / desktop 1280 rendered verification
- regression gate

> **목표는 모든 화면을 똑같이 만드는 것이 아니라, 같은 회사가 만든 제품처럼 같은 행동 문법을 공유하게 하는 것이다.**

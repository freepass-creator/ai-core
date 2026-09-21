# FreePass Product UI Profile — 2026-09-19

상태: **CANDIDATE BASELINE / product adoption required**

상위 접근성 정본은 `docs/SCREEN_DESIGN_STANDARD.md`다.
이 문서는 FreePass Sales / Estimate / ERP4에서 반복 확인된 **FreePass 제품군 전용 UI/UX 문법**을 모은다.
모든 픽셀을 강제하는 전사 표준이 아니라, 새 FreePass 화면이 먼저 참조할 profile이다.

## 1. 상단은 정보, 하단은 실행

- 상단: 브랜드, 제목, 맥락, 진행상태
- 하단: 저장, 다음, 완료, 문자+저장 같은 task action
- dialog도 실행은 footer
- page header에 Save/Submit/Share 같은 CTA를 되돌려 놓지 않는다

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
- 보조 1개 + 주행동 1개 조합은 FreePass 기본 비율을 **3:7**로 둔다
- 단일 Primary만 필요한 화면은 전체 폭 사용
- safe-area와 가상 키보드가 액션을 가리지 않게 한다
- disabled 상태는 이유를 화면 가까이에 함께 보여준다

이 규칙은 과거 FreePass 모바일 고도화에서 합의한 당근형 최신 모바일 문법을 현재 AI Core의
`Top is informational / Bottom is actionable` 원칙에 맞춰 고정한 것이다.

## 2. 단일선택은 즉시 전진

Estimate 모바일 기준:

- 제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림
- 단일선택 단계는 선택 즉시 다음으로
- Back으로 수정
- 옵션/조건처럼 여러 값을 확정해야 하는 단계만 명시적 Next

Navigation infrastructure는 공통으로 유지하되 auto-step에서 불필요한 Next를 노출하지 않는다.

## 3. 모바일은 PC 축소판이 아니다

- 한 화면 한 목적
- 최소 44px touch target
- safe-area/키보드/스크롤을 실제 상태로 검증
- hover 없이도 같은 기능 도달
- 긴 desktop table을 무조건 축소하지 않는다

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

## 6. 목록은 정보밀도와 클릭영역을 분리

Sales 기준:
- 2줄 정보의 compact row
- 실제 클릭 영역은 충분히 넓게
- 카드 바깥 장식/패딩을 과도하게 키우지 않는다

ERP4 Product Browse:
- 공개 상품카드는 내부 ERP 콕핏보다 더 여유롭게
- 즉, **공통화할 것은 위계/상태/토큰 체계이지 모든 px 값이 아니다.**

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

1. 기존 기능을 깨지 않는다.
2. 프로젝트 고유 브랜드/업무 밀도는 유지한다.
3. 공통 pattern을 쓰되 고정 px를 기계 복사하지 않는다.
4. 프로젝트에서 더 나은 패턴이 검증되면 AI Core profile에 역수입한다.
5. AI Core가 앞선 접근성/검증 규칙은 다시 각 프로젝트가 채택한다.

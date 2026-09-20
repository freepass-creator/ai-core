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


## 12. Brand theme / Co-brand / White-label

FreePass UI Profile은 **interaction grammar와 semantic state를 고정**하지만 브랜드 컬러 자체를 전역 고정하지 않는다.

### 고정되는 것
- typography hierarchy
- spacing/radius/control size
- top-information / bottom-action placement
- selected / pressed / focus-visible / disabled / busy semantics
- haptic/motion timing
- success / warning / danger / focus / disabled 같은 semantic color role
- contrast/accessibility floor

### 교체 가능한 것
- brand primary
- brand strong
- brand soft/tint
- logo/wordmark
- partner accent
- campaign illustration/visual asset

### theme modes
- `freepass`: FreePass 기본 네이비
- `cobrand`: 파트너 브랜드 primary를 허용하되 공통 component/state grammar 유지
- `white-label`: 고객사 brand token을 사용하되 semantic state token은 변경 금지

파트너 컬러는 component 의미를 바꾸면 안 된다. 예를 들어 빨강을 브랜드 primary로 쓸 수는 있지만, 동일 화면에서 danger/error와 구분 가능한 label/icon/copy/boundary를 유지해야 한다.

Welrix 계열 화면은 neutral surface를 유지하고 brand/selection/primary-action 계층에 Welrix red family를 사용할 수 있다. FreePass 단독 화면은 FreePass navy를 기본으로 한다.


## 13. Text alignment grammar

정렬은 장식이 아니라 정보형에 따라 고정한다.

- **start/left**: page/section title, model/powertrain/spec/trim/option choice text, card narrative, field label, helper/explanation text
- **center**: manufacturer/logo selector, color swatch selector, short chips, compact period comparison tiles, standalone CTA label
- **end/right**: money, percentage, quantity, totals, definition values and table values where comparison benefits from a stable numeric edge

금지:
- 한 선택 리스트 안에서 어떤 행은 가운데, 어떤 행은 왼쪽으로 섞지 않는다.
- 굵은 글자라는 이유만으로 가운데 정렬하지 않는다.
- 숫자/금액을 문장형 텍스트와 같은 축에 흔들리게 두지 않는다.

FreePass mobile vehicle selection은 `model → powertrain → passenger/drive → trim → option`의 텍스트 축을 모두 start 정렬한다. 제조사와 색상처럼 시각적 객체를 고르는 grid만 center를 허용한다.


### Customer-facing trust default

신차 장기렌터카처럼 금액·심사·계약이 결합된 고객 화면의 기본 co-brand theme는 `welrix-trust`다.

- CTA / selected / progress: FreePass navy family
- neutral surface: white / cool gray
- Welrix red: logo, partner label, small co-brand accent
- full-red `welrix` theme: 브랜드 캠페인/특수 surface에서만 명시적으로 선택

즉 partner identity는 유지하지만, 고객이 행동하고 금액을 판단하는 핵심 UI는 trust-oriented cool palette를 기본으로 한다.

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

## 1-1. 공용 하단바는 유지되고 버튼 세트만 바뀐다

FreePass 모바일은 화면마다 서로 다른 CTA 영역을 새로 만들지 않는다.

- 같은 bottom action region을 계속 사용한다.
- depth 0에서는 제품이 정한 글로벌 하단 네비게이션을 표시할 수 있다.
- 상세/업무 depth로 들어가면 같은 자리가 contextual action bar로 바뀐다.
- 기본 contextual 비율은 보조 3 : 주행동 7.
- 한 boundary 안의 primary는 하나만 둔다.
- 화면/상태가 바뀌면 버튼 label/action만 교체한다.
- 상단은 정보/상태 중심이며 Save/Submit/Complete 같은 업무 CTA를 올리지 않는다.

FreePass Admin 현재 승인 예:
- 상품 상세: `공유 | 이 조건으로 접수하기`
- 신규 접수: `그만두기 | 접수 저장`
- 접수 진행: `접수 취소 | 현재 다음 업무`
- 실적 검토: `이견/이슈 | 확인/공급사 확인/정산 확정`
- 청구: `계산서 처리 | 수금 등록`
- 지급: `지급 보류 | 지급 등록`

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

## 5-1. 검색·필터 composition은 AI Core 공식 mode를 선택한다

상위 정본: `docs/UI_COMPOSITION_STANDARD.md`

FreePass 화면도 검색창·세부필터·퀵필터를 임기응변으로 조합하지 않는다.

- 기본은 가장 가벼운 mode부터 선택한다.
- 관리자 상품찾기 기본값은 **SEARCH_FILTER**.
- 세부필터 trigger는 검색창과 같은 row의 trailing 위치.
- quick filter는 반복 사용 근거가 있을 때만 검색창 아래 별도 row.
- 검색 parser가 읽은 structured condition은 적용 조건으로 되돌려 보여 주며 detailed filter와 별도 state로 충돌시키지 않는다.
- 상품찾기의 1/6/12/24/36/60개월 shortcut은 현재 FreePass Admin 공통 quick filter로 보지 않는다.
- 접수/정산의 상태 탭은 상품 검색 shortcut과 구분되는 workflow 상태 navigation/filter다.

## 5-2. 상품 기간은 Quick Filter가 아니라 Variant Selector

FreePass 상품의 계약기간은 고정 목록이 아니다.

- 공급사 Offer에 실제 존재하는 `termMonths`만 표시한다.
- 13개월·27개월 등 비정형 기간도 그대로 표시한다.
- 같은 기간에 주행거리·보증금·가격·정책이 다르면 하위 Offer variant로 분리한다.
- 기간 선택줄은 AI Core `data.variant-selector`를 사용한다.
- 최종 선택 Offer ID가 접수 Snapshot으로 이어진다.
- 12/24/36/48/60 같은 관행값을 UI가 임의 생성하지 않는다.

## 5-3. Admin 모바일은 목록 → 상세 drill-in

PC의 목록/상세/업무 3패널을 모바일에서 세로로 이어 붙이지 않는다.

- 상품 목록 카드 터치 → 상품 상세 단일 화면
- 상세 뒤로가기 → 기존 목록 문맥 복원
- 상세의 CTA → 접수 단일 화면
- 목록/상세 상단 제목의 크기·굵기·줄높이 계열 유지
- AI Core `data.master-detail` 사용

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

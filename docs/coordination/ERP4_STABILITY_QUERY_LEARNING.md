# ERP4 Stability / Query Integrity Learning — 2026-09-19

- 상태: `LEARNING_CANDIDATE / PROJECT-LOCKED`
- 원천: `freepass-creator/freepasserp4`
- 관측 revision: `2d9fd07075aae7d6d64687fabbf61126e166c34c`
- 핵심 정본: `docs/ERP4-MAIN-STABILITY-LOCK.md`, `docs/ERP4-PRICE-ROW-CONTRACT.md`
- 목적: “기능을 더 만드는 것”보다 “이미 자리 잡은 제품 구조를 기계적으로 잠그는 방법”을 AI Core가 학습한다.

## 1. Product boundary를 코드로 잠근다

ERP4 MAIN의 역할은 공개 Product Browse다.

잠긴 경계:
- 공개 MAIN에서 AuthProvider를 마운트하지 않음
- `/login`은 상품 호스트 경로가 아니며 404
- 로그인/회원/세션은 별도 레거시/업무 인증
- 공개 목록은 ERP5 canonical catalog 사용
- 레거시 ERP4 RTDB/store fallback 금지

공통 교훈:
- 제품 역할을 문서만으로 정의하지 않고 route/provider/fallback까지 검사
- “파일이 남아 있음”과 “현재 제품 기능임”을 구분
- deprecated path가 존재해도 main IA authority를 주지 않는다

## 2. Same-row query integrity

ERP4의 중요한 도메인 무결성 규칙:

**계약기간 · 월 대여료 · 보증금은 같은 `price[term]` 행에서 동시에 판정한다.**

여러 기간에 흩어진 값을 합쳐 존재하지 않는 offer를 만들면 안 된다.

이 동일행 후보를:
- 목록 필터
- facet count
- 카드 대표가격
- 월 대여료 정렬
- 보증금 정렬

모두가 공유한다.

공통 학습:
- 독립 field match가 아니라 semantic row/offer continuity를 보존
- filter/count/sort/render가 같은 후보집합을 소비
- 서로 다른 UI 계층이 같은 query engine을 쓴다

## 3. Deferred UI state도 같은 revision을 본다

목록은 `liveQuery`로 계산하면 카드 `displayPrice`도 반드시 같은 `liveQuery.sel`을 사용한다.

즉 한 프레임이라도:
- 목록은 새 조건
- 카드 가격은 옛 조건

처럼 갈라지지 않게 한다.

공통 후보:
- derived state revision identity
- query/result/render same-snapshot contract
- async/deferred rendering parity test

## 4. List payload와 detail payload를 분리

공개 목록은:
- 첫 화면 카드 우선
- 상세 갤러리용 전체 사진 배열 제외
- guest sanitize
- 반복 고비용 계산 억제

를 잠근다.

공통 교훈:
- list projection은 detail aggregate를 그대로 싣지 않는다
- public projection은 auth/internal data와 분리
- performance requirement도 제품 계약의 일부로 둔다

## 5. Stability lock

ERP4는 현재 구조를 “재설계 대상”이 아니라 “안정화 대상”으로 선언했다.

허용:
- 오류
- 데이터 정합성
- 성능
- 접근성
- 모바일 safe-area/키보드/스크롤
- 로딩/오류/빈 상태

금지:
- 로그인 재결합
- legacy fallback 회귀
- web/mobile 비즈니스 로직 분기
- 가격행 혼합
- IA 재설계

공통 학습:
**mature project에는 innovation mode와 stabilization mode를 구분하는 lifecycle flag가 필요하다.**

## 6. Machine gate

상위 게이트:
- `npm run check:erp4-main`

하위 검증:
- `check:design`
- `check:deposit`
- `check:speed`
- `check:guest`
- `check:shop-data-parity`
- `check:tokens`
- `check:ui`

공통 후보:
- project stability manifest
- locked invariants
- forbidden regression checks
- acceptance evidence binding

## 7. AI Core가 가져갈 것

- product boundary lock
- canonical-source-only / no-legacy-fallback policy
- semantic same-row/offer query contract
- filter/facet/sort/render candidate unification
- list/detail projection split
- stabilization lifecycle mode
- machine-enforced stability gate

ERP4 고유 가격정책/차량업무는 가져가지 않는다.

## 8. 한 줄 결론

> **ERP4가 앞선 부분은 새 기능 수가 아니라, 제품 역할·데이터 정본·동일 가격행 의미·웹/모바일 query를 하나의 기계식 안정화 계약으로 잠근 점이다.**

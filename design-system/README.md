# AI Core Design System

상태: **공통 참조 허브**

AI Core의 `design-system/`은 각 제품의 실제 UI를 복제해 보관하는 곳이 아니다.  
공통 설계 원칙, 제품 프로필, 재사용 가능한 토큰 방향과 **기준 구현의 위치**를 알려 주는 참조 허브다.

## 정본 계층

### 1. 프로젝트 정본

실제로 운영되는 화면의 세부 규격과 회귀 가드는 해당 프로젝트 저장소가 소유한다.

현재 Public Product UI의 기준 구현:

- Repository: `freepass-creator/freepasserp4`
- Product: `freepasserp.com` / ERP4 White Label
- Project canon: `docs/ERP4-MAIN-UI-STANDARD.md`
- Runtime tokens: `components/shop/shop-ui.tsx`
- Responsive/public styles: `app/whitelabel.css`
- Brand palette source: `lib/domain/corporate-ci.ts`
- White-label palette bridge: `lib/whitelabel.ts`
- Regression guard: `scripts/check-design-locked.mts`

AI Core 문서와 ERP4 구현이 충돌하면 **현재 운영 프로젝트 정본이 우선**한다.

### 2. AI Core 공통 참조

- `tokens.css` — 공통 토큰 베이스
- `components.css` — 공통 UI 샘플/원자
- `PUBLIC_PRODUCT_UI_STANDARD.md` — 공개형 상품 탐색 UI 프로필

AI Core는 여기서 “무엇을 공통으로 지킬지”를 정리한다.  
프로젝트별로 확정된 px 값, 화면 구조, 예외를 다시 복사하여 두 번째 SSOT로 만들지 않는다.

## Public Product UI 현재 기준

ERP4 White Label을 기준으로 다음 원칙을 재사용한다.

- Desktop: 3열 → wide web 4열
- Mobile: 1열, 좌우 16px, 카드 간격 24px
- Mobile card type: 차량명 15 / 대여료 18 / 보조정보 13 / 캡션 12
- Main control: mobile 44px, touch target 최소 44px
- Quick filter: 32px
- Search input: mobile 16px 유지
- Primary: FreePass navy `#1B2A4A`
- Secondary response accent: ERP BI blue `#5B9FD4`
- 의미색(green/red/orange)은 상태 표현에만 사용
- 반복 장식 애니메이션보다 hover/focus/press 반응 우선
- 목록 카드 사진 넘김/별도 썸네일 탐색은 기본 표준에서 제외
- 상세는 내용을 숨기는 탭 대신 긴 페이지 + 가벼운 anchor navigation

## 새 프로젝트에서 사용하는 법

1. 먼저 제품 성격을 구분한다: `Admin` / `Public Product` / 기타.
2. Public Product면 `PUBLIC_PRODUCT_UI_STANDARD.md`를 기본 설계 입력으로 사용한다.
3. ERP4 기준 구현에서 필요한 세부 규격을 확인한다.
4. 프로젝트 특성상 달라야 하는 값만 그 프로젝트에 별도로 정의한다.
5. 프로젝트에서 검증된 개선이 공통 원칙이 되면 AI Core 문서에 **원칙만** 승격한다.

## 금지

- ERP4 CSS/컴포넌트를 AI Core에 통째로 복제
- AI Core 문서만 보고 ERP4 운영 규격을 덮어쓰기
- 프로젝트마다 임의의 파랑/간격/폰트 사다리를 새로 생성
- Admin 치수를 Public Product에 그대로 적용
- 프로젝트별 예외를 공통 규격인 것처럼 승격

## 한 문장

> **AI Core는 디자인의 공통 언어와 참조 지도를 관리하고, 실제 제품 규격의 정본은 각 운영 프로젝트가 가진다.**

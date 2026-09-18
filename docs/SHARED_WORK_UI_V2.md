# Shared Work UI v2 — AI Core pilot

기준: 2026-09-18  
파일럿: `web/orders`

## 목적

FreePass Admin의 고밀도 업무형 규격을 공통 기준으로 삼고, FreePass Sales의 모바일 동선과 견적기의 조건형 UI 장점을 합친다. 서비스별 브랜드 색은 유지하되 레이아웃, 간격, 버튼, 검색, 상태, 상세 패널의 행동 규칙은 공유한다.

## 제품 원칙

1. **Calm Dense** — 정보량은 유지하고 시각적 소음만 줄인다.
2. **Structure by Surface** — 선은 검색·입력·패널처럼 구조를 설명하는 곳에만 쓴다.
3. **Action by Color** — 주 행동은 면 색, 보조 행동은 틴트/ghost, 위험 행동은 낮은 빈도로 표현한다.
4. **Progressive Disclosure** — 새 오더 폼, AI 설명, 사용 안내와 긴 이력은 필요할 때만 연다.
5. **Context Panel** — 데스크톱은 목록 7 : 상세 3, 모바일은 목록 → 상세 페이지 전환.
6. **AI Transparency** — AI가 담당하는 작업은 AI임을 명시하고 근거·결과와 함께 보여준다.

## 핵심 토큰

- 높이: chip 22 / control 30 / row 34 / action 38 / topbar 46
- 간격: 6 / 12 / 16
- radius: 3 / 5 / 8
- desktop: left rail + 7:3 list/detail
- mobile: stacked panels 금지, page transition 사용

## 버튼

- Primary: 브랜드 면, border 없음
- Secondary: 브랜드 tint, border 없음
- Ghost/Icon: 평소 투명, hover에서만 surface 표시
- Danger: 상시 빨간 외곽선 버튼 금지. 필요한 위치에서만 danger tint/text
- Outlined: 업로드/특수 선택처럼 경계 자체가 의미일 때만 예외

## 검색·입력

- 검색과 입력은 클릭 가능 영역과 경계를 설명해야 하므로 1px line 사용
- focus는 브랜드 ring으로 표시
- 상단 검색은 `Cmd/Ctrl+K`로 포커스
- 필터/탭은 border box보다 text/tint hierarchy 우선

## AI Core 파일럿 변경

- 상시 노출되던 신규 오더 폼 → modal/sheet
- 소개·AI 카드 → 접히는 보조 모듈
- 오더 목록 → 고밀도 list
- 선택 오더 → 우측 context panel
- mobile → list/detail page transition
- 담당 AI → AI label
- API, ledger pin, request idempotency 계약은 변경하지 않음

## 다음 적용 순서

1. FreePass Sales: 기존 모바일 장점을 유지하고 token 이름/높이/상태 규칙 통합
2. Estimator: 상단 action, segment, search, result/summary panel을 공통 규격으로 정리
3. FreePass Admin: 최신 mockup과 실제 Next 화면의 차이를 해소하고 shared token을 원본으로 승격
4. 이후 ERP/AIOps/정산 등은 위 템플릿을 재사용

## 금지

- 페이지마다 임의의 새로운 높이/간격/radius 추가
- 모든 버튼에 outline 추가
- 상태별 카드 전체 배경색 변경
- desktop panel을 mobile에서 단순 세로 적층
- AI 표현을 장식용 gradient/glow로 사용

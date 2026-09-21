# UI/UX User Decision — Mobile Baseline — 2026-09-21

Status: **USER-LOCKED BASELINE**
Decision date: **2026-09-21**
Scope: **AI Core UI/UX / mobile-first company baseline**
Reference product: **FreePass Sales**

## 0. Intent

FreePass Sales의 현재 모바일 UI/UX를 앞으로 개발하는 화면들의 기본 시각·상호작용 문법으로 사용한다.

목표는 프로젝트마다 새 디자인을 만드는 것이 아니라, 같은 기본 골격에 업무 데이터와 workflow만 바꾸어 끼우는 것이다.

- 디자인 장식을 늘리는 방향보다 정보 위계와 행동 구조를 우선한다.
- 새로운 화면은 FreePass Sales와 다른 이유가 있을 때만 다르게 만든다.
- 이 문서는 2026-09-21 사용자가 직접 확정한 모바일 규칙의 기록이다.
- 웹 대응 규격은 사용자가 별도로 정의하기 전까지 임의로 확정하지 않는다.

## 1. Top area — status/display only

모바일 상단은 **상태·제목·맥락 표시 영역**이다.

기본 규칙:

- 페이지 제목, 현재 상태, 짧은 맥락/건수 등 표시 중심
- 제품 UI 차원의 뒤로가기 / 앞으로가기 / 저장 / 완료 / 공유 / 기타 task CTA를 상단에 두지 않는다
- 상단은 행동 영역이 아니라 정보 영역으로 취급한다
- OS/browser 자체 navigation은 이 규칙의 대상이 아니다

한 문장:

> **Top = status/display. Bottom = action.**

## 2. Bottom action bar — all task actions

주요 업무 버튼은 하단 고정 action bar에 둔다.

### 버튼 1개

- Primary 100%

### 버튼 2개

- Secondary 30%
- Primary 70%
- 비율: **3 : 7**

### 버튼 3개

- Secondary 30%
- Secondary 30%
- Primary 40%
- 비율: **3 : 3 : 4**

추가 규칙:

- 한 action boundary 안의 Primary는 1개
- Primary는 시각적으로 가장 강하게 표현
- Secondary는 Primary보다 한 단계 낮은 위계
- safe-area와 virtual keyboard에 가려지지 않아야 함
- 업무 결과를 바꾸는 저장/접수/완료/반영 등의 행동은 icon-only로 축약하지 않음

## 3. Mobile list — separated card list

모바일 목록의 기본 표현은 서로 맞닿는 dense row가 아니라 **간격이 있는 card list**다.

기본 구조:

- 카드와 카드 사이에 명확한 간격
- 용도에 따라 **2줄 카드** 또는 **3줄 카드**
- 첫 줄은 항상 가장 중요한 메인 정보
- 둘째/셋째 줄은 상태, 금액, 날짜, 속성 등 보조정보
- 카드 외곽 장식보다 정보 위계와 읽기 속도를 우선
- 카드 전체가 하나의 명확한 목적지/행동일 때만 전체 카드를 interactive surface로 사용

### 2줄 카드

1. Primary line
2. Secondary/meta line

### 3줄 카드

1. Primary line
2. Secondary detail line
3. Status/meta line

이 결정은 기존 FreePass UI 문서의 “compact row” 표현보다 우선한다. 모바일 목록은 기본적으로 **card type**으로 본다.

## 4. Icon usage — auxiliary actions

필터, 공유, 정렬, 검색 등 의미가 짧고 반복적인 보조 기능은 적절한 아이콘을 활용해 시각적 부담을 줄인다.

규칙:

- 아이콘의 의미가 충분히 명확한 경우 icon action 사용 가능
- 접근 가능한 이름(accessible name)은 반드시 제공
- 의미가 불명확하면 텍스트 또는 보조 설명을 제공
- icon action도 touch target 규격을 지킨다
- 업무 완료 의미를 가진 Primary CTA를 icon-only로 대체하지 않는다
- 상단을 action toolbar로 되돌리는 근거로 사용하지 않는다

## 5. Design hierarchy

앞으로 모바일 화면은 다음 순서로 설계한다.

1. **상단:** 제목·상태·맥락
2. **본문:** 카드형 정보 / 입력 / 선택
3. **보조기능:** 필요한 곳에 최소한의 icon action
4. **하단:** Primary + Secondary task actions

즉:

> **상단은 상태, 가운데는 카드형 정보, 하단은 행동. 보조 기능은 아이콘으로 최소화한다.**

## 6. Reuse model

업무가 바뀌어도 기본 화면 문법은 바꾸지 않는다.

예:

- FreePass Admin = 같은 UI 문법 + 상품/접수/정산 데이터
- 과태료 = 같은 UI 문법 + 과태료 데이터/처리 workflow
- JPK Work = 같은 UI 문법 + 업무/담당자/기한 데이터
- 계약 = 같은 UI 문법 + 계약 데이터/workflow

업무가 달라서 화면이 달라지는 것은 허용한다.
개발자나 AI의 취향 때문에 기본 문법을 새로 만드는 것은 허용하지 않는다.

## 7. Relationship to AI Core

이 결정은 다음 AI Core 문서와 함께 읽는다.

- `docs/UI_UX_START_HERE.md`
- `docs/UI_UX_CONSTITUTION.md`
- `docs/SCREEN_DESIGN_STANDARD.md`
- `docs/FREEPASS_PRODUCT_UI_PROFILE.md`
- `design-system/interaction.contract.json`

2026-09-21 이후 모바일 신규 설계/고도화에서는 이 문서를 사용자 확정 baseline으로 우선 확인한다.

## 8. Pending

아직 사용자가 직접 확정하지 않은 항목:

- 이 모바일 문법에 대응하는 웹 layout 규격
- 웹에서의 action bar 폭/정렬/고정 방식
- 웹 카드 밀도와 multi-column 전환 규칙
- 모바일/웹 breakpoint별 구체적 변환 규칙

위 항목은 기존 표준의 접근성/반응형 최소 기준은 지키되, 사용자가 웹 규격을 정의하기 전까지 새로운 “사용자 확정 규칙”으로 추정하여 고정하지 않는다.

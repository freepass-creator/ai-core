# UI/UX User Decision — Web Panel Extension — 2026-09-21

Status: **USER-LOCKED BASE INTENT / IMPLEMENTATION REFINED BY ADAPTIVE WEB STANDARD**
Decision date: **2026-09-21**
Scope: **AI Core UI/UX / web extension of mobile baseline**
Base reference: `docs/UI_UX_USER_DECISION_2026-09-21_MOBILE_BASELINE.md`

## Implementation refinement

The original intent remains: reuse mobile task units on web and use wide screens to reduce depth.

Implementation is now refined by:
- `docs/ADAPTIVE_WEB_STANDARD_2026-09-21.md`

Therefore:
- multi-panel is the preferred default when it helps
- web may use grid/table, multi-select, inline actions, keyboard shortcuts and utility toolbars when they materially improve desktop productivity
- web presentation may differ from mobile
- canonical state/command/workflow meaning must not fork

## 0. Core principle

웹은 모바일의 business task model을 재사용하되, desktop productivity를 위해 presentation과 interaction을 적응시킬 수 있다.

> **모바일의 업무 의미와 command/state contract는 유지하고, 웹 구조는 생산성에 맞게 적응시킨다.**

차이는 화면 폭을 활용하는 방식뿐이다.

모바일에서 하나의 화면 단위가 웹에서는 하나의 **panel**이 된다.
웹은 이 panel을 한 화면에 여러 개 배치하여 더 많은 정보를 동시에 볼 수 있게 한다.

## 1. Mobile screen = Web panel

기본 변환 규칙:

- 모바일의 1개 화면 단위 → 웹의 1개 panel
- 모바일의 카드, 헤더, 상태표시, 입력, 보조 icon action, 하단 action hierarchy는 그대로 유지
- 웹이라고 해서 별도의 table-first / toolbar-first / dashboard-first 디자인을 새로 만들지 않는다
- 모바일에서 이미 확정된 정보 위계와 action 의미를 그대로 보존한다

즉 웹은 새로운 디자인이 아니라 **모바일 문법의 multi-panel expansion**이다.

## 2. Multi-panel layout

웹은 넓은 화면을 활용해 필요에 따라 panel을 동시에 여러 개 보여준다.

예:

```text
[목록 panel] [상세 panel]
```

또는

```text
[목록 panel] [상세 panel] [보조정보/이력 panel]
```

핵심은 한 panel 내부의 UI를 다시 설계하지 않는 것이다.

- panel 내부는 모바일과 동일한 component hierarchy
- 필요할 때만 좌우/다중 panel 배치
- 업무 흐름에 따라 panel 추가/교체/축소
- 한 화면에서 context를 유지하면서 다음 단계 정보를 옆 panel에 열 수 있음

## 3. Purpose of web extension

웹 multi-panel의 목적은 장식이 아니라 **depth 감소와 업무 편의성 향상**이다.

- 목록 → 상세 → 추가정보 이동을 여러 페이지로 깊게 들어가지 않도록 한다
- 기존 context를 유지한 채 옆 panel에서 다음 정보를 확인한다
- 불필요한 back/forward navigation을 줄인다
- 정보 비교와 반복 업무 속도를 높인다
- 모바일과 웹의 기능/상태/버튼 의미를 다르게 만들지 않는다

## 4. Action behavior

모바일에서 확정된 action hierarchy를 웹에서도 유지한다.

- 상단은 상태/정보 중심
- task action은 panel 하단 action boundary
- Primary는 panel당 1개
- 2개 버튼: Secondary 3 : Primary 7
- 3개 버튼: Secondary 3 : Secondary 3 : Primary 4
- filter/share/search/sort 등 보조 기능은 적절한 icon action 사용

웹에서는 panel 폭에 맞게 action bar가 panel 하단에 붙을 수 있지만,
상단 toolbar로 이동시키지 않는다.

## 5. List behavior

모바일의 card list를 웹에서도 기본적으로 유지한다.

- 카드 구조와 2줄/3줄 정보 위계 유지
- 첫 줄이 main 정보
- 웹이라고 해서 자동으로 dense table로 바꾸지 않는다
- 관계형 비교/대량 데이터처럼 table이 본질적으로 더 적합한 경우에만 table 사용
- 카드형 목록 + 상세 panel 조합을 우선 고려

## 6. Responsive relationship

웹과 모바일은 두 개의 별도 제품이 아니라 하나의 responsive UI family다.

기본 관계:

```text
Mobile
1 screen = 1 panel
        ↓ width expansion
Web
multiple panels = multiple mobile-equivalent surfaces
```

좁아지면 panel 수를 줄이고,
더 좁아지면 다시 모바일의 1-panel 흐름으로 수렴한다.

정보 의미, 상태, action 우선순위는 변하지 않는다.

## 7. Anti-patterns

아래는 기본적으로 허용하지 않는다.

- 웹이라는 이유로 새 header toolbar 생성
- 모바일 카드 목록을 근거 없이 전부 table로 전환
- 웹에서만 별도 CTA 위치/버튼 위계 생성
- 동일 기능을 모바일/웹에서 서로 다른 interaction model로 구현
- nested page depth를 늘리는 대신 panel로 해결 가능한데 새 페이지를 계속 추가
- panel마다 제각각 다른 디자인 체계 사용

## 8. One-line rule

> **모바일 화면을 그대로 웹 panel로 확장하고, 웹의 추가 폭은 더 많은 panel을 동시에 보여주는 데 사용한다.**

웹 고도화의 핵심은 새로운 디자인이 아니라 **multi-panel로 depth를 줄이고 context를 유지하는 것**이다.

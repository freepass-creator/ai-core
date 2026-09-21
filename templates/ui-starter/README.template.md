# {{PRODUCT_NAME}} 화면 기본 규격

이 폴더는 AI Core UI/UX 규격 `{{AI_CORE_REVISION}}`에서 생성했습니다.

- 화면 유형: `{{PROFILE_ID}}` ({{PROFILE_LABEL}})
- buttons: borderless; fill, text and spacing express hierarchy
- search: visible input boundary; opening and closing must preserve current work
- lists: compact card rows with a full-row action target
- actions: one primary action in the bottom action area
- states: loading, empty, error and populated must be separate
- responsive checks: 360 / 390 / 412 / 1280 / 1440 px

## Start

Import `ai-core-ui.css` once in the application root. Use `starter.html` and `starter.js` as structure and behavior references; adapt them to the project's framework rather than shipping the sample unchanged.

새 화면을 다시 디자인하지 않습니다. 상단 정보, 검색·필터, 목록·상세, 상태, 하단 실행 블록을 업무 순서대로 배열하고 데이터와 문구만 바꿉니다. 선택 표시는 옅은 배경 변화만 사용합니다.

## Required verification

Keyboard-only navigation, visible focus, 44px minimum touch targets, reduced motion, forced colors, safe area, virtual keyboard, scroll restoration and draft preservation remain required. A generated starter is a baseline, not a conformance receipt.

# {{PRODUCT_NAME}} UI baseline

이 폴더는 AI Core UI/UX 규격 `{{AI_CORE_REVISION}}`에서 생성했습니다.

- profile: `{{PROFILE_ID}}` ({{PROFILE_LABEL}})
- buttons: borderless; fill, text and spacing express hierarchy
- search: visible input boundary; opening and closing must preserve current work
- lists: compact card rows with a full-row action target
- actions: one primary action in the bottom action area
- states: loading, empty, error and populated must be separate
- responsive checks: 360 / 390 / 412 / 1280 / 1440 px

## Start

Import `ai-core-ui.css` once in the application root. Use `starter.html` as a semantic reference; copy its structure into the project's framework rather than shipping the sample unchanged.

## Required verification

Keyboard-only navigation, visible focus, 44px minimum touch targets, reduced motion, forced colors, safe area, virtual keyboard, scroll restoration and draft preservation remain required. A generated starter is a baseline, not a conformance receipt.

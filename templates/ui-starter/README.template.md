# {{PRODUCT_NAME}} UI baseline

이 폴더는 AI Core UI/UX 규격 `{{AI_CORE_REVISION}}`에서 생성했습니다.
생성 시 AI Core checkout은 clean 상태였으며, 위 값은 exact Git revision이다.

- profile: `{{PROFILE_ID}}` ({{PROFILE_LABEL}})
- layout: cards `{{CARD_LAYOUT}}`; bottom actions `{{BOTTOM_ACTION_LAYOUT}}`
- buttons: borderless; fill, text and spacing express hierarchy
- search: `starter.js` preserves the live draft and restores scroll/focus when the search region closes
- lists: compact card rows with a full-row action target
- actions: one primary action in the bottom action area
- states: loading, empty, error and populated must be separate
- responsive checks: 360 / 390 / 412 / 1280 / 1440 px

## Start

Import `ai-core-ui.css` once in the application root. `starter.html` and `starter.js` are an executable semantic reference; port their structure and state behavior into the project's framework rather than shipping the sample unchanged.

## Required project bindings

- Replace neutral Core presentation tokens only from the project's actual brand/CI SSOT.
- Record that brand source in the consumer manifest. Missing brand evidence is `HOLD`; do not invent a logo, wordmark or product color.
- Keep the generated feature IDs and four data states bound to the same consumer revision.
- Product-specific brand and density may vary. Search restoration, action placement, state meaning and accessibility may not.

## Required verification

Keyboard-only navigation, visible focus, 44px minimum touch targets, reduced motion, forced colors, safe area, virtual keyboard, scroll restoration and draft preservation remain required. A generated starter is a baseline, not a conformance receipt.

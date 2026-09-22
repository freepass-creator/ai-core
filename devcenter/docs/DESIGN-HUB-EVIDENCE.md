# Design Hub Evidence & Feedback v2

## Source-level adoption receipt

대상:
`freepass-creator/freepass-admin@92e2838b6da2df5f0b8733db494e879bd25d2e74`

사용자 승인 시각 기준:
- `docs/ui/mockups/admin-product-to-application.html`
- SHA-256 `6d2c26dc171d0c519d8ba5d8f9d7ab4be29cfeb371f6c8e639606863b62cef7d`

Receipt:
`evidence/design/freepass-admin-approved-shell.json`

PASS 범위:
- legacy quick-filter row 제거
- left business rail
- floating desktop panels
- vertical whole-Offer rows
- explicit mobile view navigation
- bottom action boundary

HOLD:
- controlled browser visual QA
- locale/input/focus/zoom/reflow conformance

따라서 source migration은 증명하지만 PILOT/CONFORMANT는 주장하지 않는다.

## Project → Design Hub feedback

`hubs/design/feedback.json`은 프로젝트 피드백을 전부 공통화하지 않는다.

ADOPT:
- approved visual authority hash pinning
- mobile multi-panel → explicit task view transition
- whole semantic tuple option selection

HOLD_LOCAL:
- Admin quick-filter removal

이렇게 해서 프로젝트 취향이 전사 Design Hub 규칙으로 자동 번지는 것을 막는다.

## Readiness 의미

이 receipt가 생기면 Design Hub의 evidence와 feedback loop 자체는 실제 revision-bound 증거를 갖는다.

하지만 runtime/validation/consumer conformance는 browser receipt가 생기기 전까지 PARTIAL을 유지한다.

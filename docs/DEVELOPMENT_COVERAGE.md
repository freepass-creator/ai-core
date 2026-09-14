# Development Coverage

Every change starts with seven simple decisions. Select `IN_SCOPE`, `OUT_OF_SCOPE` or `UNKNOWN`; detail is required only for included layers.

| Layer | User-facing question | Typical details | Proof examples |
|---|---|---|---|
| Frontend | Does browser/app code change? | components, state, routing | component/integration test |
| Backend | Does server business logic change? | permissions, calculations, jobs | API/service test |
| API | Does a system boundary change? | request, response, compatibility | contract test |
| Database | Is stored data read or written differently? | schema, IDs, migration, history | migration/readback test |
| Infrastructure | Does runtime or delivery change? | environment, domain, queue, CI | build/deployment evidence |
| UI | Does what the user sees change? | layout, buttons, states, devices | screenshots/visual checks |
| UX | Does the task flow change? | steps, feedback, recovery | end-to-end journey trace |

The form also captures one primary journey, UI surfaces and their default/loading/empty/error/disabled/success states, data flow, and security/performance/accessibility/observability obligations. `UNKNOWN` is visible work, not an implicit exclusion.

Recommended UI is a seven-card coverage screen. Selecting a card reveals only that layer's change, affected references and verification references. This keeps a small change short while preserving full-stack coverage for larger work.

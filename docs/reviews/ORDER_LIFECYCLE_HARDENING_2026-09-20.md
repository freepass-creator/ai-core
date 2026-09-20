# Order lifecycle hardening review — 2026-09-20

## Fixed source state

- Repository: `freepass-creator/ai-core`
- Base: `f8833a0e1974e5267be4dd3bf8f74fc48c13568c` (`origin/main` at review start)
- Branch: `codex/order-lifecycle-hardening-20260920`
- Shared `C:/dev/ai-core` remained untouched; its untracked attachment directory was not read or changed.

## Independent review availability

- Claude Code: `UNAVAILABLE`, weekly usage limit; reset response is availability evidence only, not PASS.
- Gemini CLI: `UNAVAILABLE`, account service returned HTTP 403 disabled; not PASS.
- Neither reviewer produced findings. There is no multi-AI agreement to report, and production activation remains HOLD.

## Codex counterexample and change

Existing intake idempotency was bound only to `requestId`. Two sessions could submit one source instruction with different request IDs and create two orders. The change adds optional opaque `sourceRef` identity:

- atomically binds one source reference to the normalized intake digest and first order ID;
- returns that order for the same source and same intake across request IDs;
- rejects same-reference/different-intake reuse with `SOURCE_REF_CONFLICT`;
- makes the binding update/delete resistant;
- does not infer duplicates from text, create Work identity, claim work, or grant execution/completion authority.

## Verification and HOLD

Focused OrderStore, HTTP, multi-process, shared-client and order-task workflow tests pass, including a real two-process/different-request-ID source collision. Workflow and bridge registries validate after refreshing the exact source blob pin.

Broader integration tests on current `main` contain pre-existing fixture drift: project registry status/head changes make historical synthetic `ai-core` fixtures return `PROJECT_NOT_ACTIVE` or `PROJECT_REVISION_CHANGED`. A separate Windows path separator mismatch remains in capability execution parity. These were not weakened or rewritten in this change and remain HOLD for their owners.

Production app-conversation capture, live database migration, real order/work mapping, deployment, external sending and permission changes were not performed.

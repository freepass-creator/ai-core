# Core Port Runtime v1

Status: **C POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

AI Core already defines Engine, Port, Adapter and Binding Profile contracts. This runtime closes the gap between those contracts and actual adapter invocation.

The runtime does not grant execution authority and does not own workflow retry policy.

## Runtime

- implementation: `src/engine/port-runtime.mjs`
- binding resolver: `src/contracts/engine-adapter-contract.mjs`
- tests: `test/port-runtime.test.mjs`

## Invariants

1. `PURE` engines do not require synthetic port bindings.
2. `PORT_MEDIATED` engines must resolve every declared required port exactly once.
3. Runtime invocation requires a binding profile in `PASSED_WITHIN_SCOPE` when strict execution is requested.
4. Project-scoped adapters cannot silently bind into another project profile.
5. Side-effect adapters with `idempotency=REQUIRED` require an idempotency key before invocation.
6. Adapter timeout is enforced at the adapter boundary.
7. Provider failures are mapped through the adapter's declared `failure_mapping`.
8. The runtime returns the canonical `core-adapter-result/v1` envelope.
9. The runtime exposes retryability but does **not** perform workflow retries. D owns retry/backoff/resume policy.
10. The runtime never grants authority. Authorization remains an upstream execution boundary.

## Separation of responsibilities

- Engine owns domain meaning and invariants.
- Port owns the semantic dependency contract.
- Adapter owns provider/project mapping and technical failure mapping.
- Port Runtime owns binding resolution and one adapter invocation boundary.
- D Workflow owns retry timing, escalation, compensation and state transitions.
- Result/Receipt contracts own durable evidence semantics.

## Current verification state

Code and tests are implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions were intentionally not used by user direction. Therefore the implementation is **NOT CI VERIFIED** and no canonical promotion is claimed.

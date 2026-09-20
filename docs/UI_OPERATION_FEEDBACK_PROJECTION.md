# UI Operation Feedback Projection v1

Status: **B POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

B renders execution/workflow outcomes without redefining C adapter semantics or D workflow semantics.

Implementation: `src/engine/ui-operation-feedback.mjs`
Tests: `test/ui-operation-feedback.test.mjs`

## Input authority

- C provides technical adapter/result facts.
- D provides workflow action such as `CONTINUE`, `HOLD`, `RETRY`, `WAIT_MANUAL_RETRY`, escalation/failure.
- D or the authoritative completion layer supplies explicit business completion verification and allowed actions.
- B only projects those facts into UI feedback features.

## Projection rules

- `CONTINUE` + completion not verified → `COMPLETION_PENDING` + `feedback.progress`
- `CONTINUE` + completion verified → `COMPLETED` + `feedback.toast`
- `HOLD` → `BLOCKED` + `feedback.alert`
- `RETRY` → `RETRY_SCHEDULED` + progress/retry feedback, no invented action
- `WAIT_MANUAL_RETRY` → `RETRY_AVAILABLE`; retry button appears only when D supplied an allowed RETRY action
- terminal/escalated/partial outcomes → blocking alert + inline error

## Critical invariant

**Adapter success is not business completion.**

A successful technical call may still require downstream receipt, observation or workflow transition before the UI may show completion.

B may not invent retry, cancel, approve, resume or other business actions. Those actions come from D.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`. GitHub Actions intentionally not used.

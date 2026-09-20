# Workflow Compensation Receipt Lineage v1

Status: **C/D POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

Compensated multi-write already defines D semantics:

- execute effects sequentially;
- stop on the first HOLD/FAILED effect;
- compensate only already-applied effects;
- compensate in reverse applied order;
- preserve the original failure;
- escalate explicit partial state when compensation is missing or fails.

This document binds those semantics to C-owned `core-receipt/v1` evidence without moving workflow meaning into C.

## Runtime

- D semantic runtime: `src/workflow/compensation.mjs`
- C/D receipt wrapper: `src/workflow/compensation-receipt-runtime.mjs`
- receipt builders: `src/contracts/workflow-execution-receipt.mjs`
- tests: `test/workflow-compensation-receipt.test.mjs`

## Receipt hierarchy

```
Compensated Multiwrite Parent Receipt
  ├─ EFFECT receipt
  │    └─ optional downstream Service / Repository / Adapter receipt
  ├─ EFFECT receipt
  │    └─ optional downstream receipt
  └─ COMPENSATION receipt
       └─ optional downstream compensation execution receipt
```

The parent uses `child_receipts[].relation`:

- `EFFECT`
- `COMPENSATION`

An EFFECT/COMPENSATION receipt may itself reference a lower-level execution receipt as `OTHER` when the lower layer already owns a more specific receipt.

## Result semantics

### All effects succeed

Parent receipt:

- `status = SUCCEEDED`
- `reason_code = null`
- child lineage contains EFFECT receipts only.

### Later effect fails, all required compensations succeed

D still preserves the original failure.

Parent receipt:

- `status = FAILED`
- `reason_code = original_error_code`
- child lineage includes both EFFECT and COMPENSATION receipts.

Successful compensation does not rewrite history into success.

### Compensation fails or is missing

D returns `PARTIAL_STATE / ESCALATE`.

C receipt projection uses:

- `status = PARTIAL`
- `reason_code = original_error_code`
- failed compensation receipt remains linked.

This gives later recovery/escalation code exact evidence of what was applied and what could not be undone.

## Evidence boundary

Receipt creation proves execution evidence only.

It does not prove:

- business workflow completion;
- retry eligibility;
- recovery eligibility;
- approval;
- authorization;
- compensation policy correctness.

D owns those meanings.

## Downstream receipt preservation

If an effect executor already returns:

- `receipt`; or
- `receipt_ref`

the workflow action receipt references it instead of copying its payload.

This preserves the evidence chain while keeping each layer responsible for its own execution detail.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions intentionally not used. No CI PASS or canonical promotion is claimed.

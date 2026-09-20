# Effect Receipt Bridge v1

Status: **D EXPERIMENTAL IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

Effect resume must not depend on a human manually re-entering which lower-level writes succeeded.

This bridge converts explicit C receipt evidence from:

- Application Service;
- Repository;
- Adapter;
- other approved execution boundaries

into D-owned `workflow.effect` or `workflow.compensation` evidence.

The bridge does **not** infer an effect from similar names. A machine binding must exist first.

## Machine assets

- binding schema: `contracts/workflow-effect-receipt-binding.schema.json`
- bridge: `src/workflow/effect-receipt-bridge.mjs`
- composed planner/runtime: `src/workflow/effect-receipt-resume-runtime.mjs`
- bridge tests: `test/workflow-effect-receipt-bridge.test.mjs`
- end-to-end resume tests: `test/workflow-effect-receipt-resume.test.mjs`

## Explicit binding

One binding declares:

- stable `binding_id`;
- D-owned `effect_id`;
- phase: `EFFECT | COMPENSATION`;
- exact source `operation_kind`;
- optional exact executor/source revision;
- child receipt relation;
- mandatory execution identity requirement;
- `PARTIAL -> HOLD`;
- proof-input binding preservation and re-verification.

A source receipt can belong to only one effect binding.

The same effect/phase may not have two independent selectors in v1. If OR semantics are required later, they need a separate explicit contract rather than implicit matching.

## Projection

Example:

```
Repository receipt
  operation_kind = application.create
  status = SUCCEEDED
  execution = logical-X / attempt-1
        |
        v
explicit receipt binding
        |
        v
workflow.effect receipt
  metrics.effect_id = create-application
  status = SUCCEEDED
  execution = logical-X / attempt-1
  child_receipt = original Repository receipt
```

The projected effect receipt is deterministic from:

`binding_id + source receipt id`.

It references the source receipt instead of copying its payload.

## Status preservation

- source `SUCCEEDED` -> effect `SUCCEEDED`
- source `FAILED` -> effect `FAILED`
- source `HOLD` -> effect `HOLD`
- source `PARTIAL` -> bridge `HOLD`; no effect projection is trusted

A failed Repository write therefore remains runnable in the resume planner. It is never converted into an applied effect.

## Identity

The source receipt must carry `core.execution-identity/v1` attempt binding.

Missing execution binding:

`HOLD / SOURCE_RECEIPT_EXECUTION_BINDING_MISSING`

Receipts from another logical execution are ignored, not imported into the current effect history.

## Ambiguity rules

Automatic projection is blocked when:

- one selector finds multiple source receipts in the same attempt;
- one source receipt is claimed by two different effects;
- source receipt is PARTIAL;
- execution identity is missing.

This keeps ambiguous evidence from becoming fabricated effect completion.

## Proof freshness

If the source receipt contains `proof_input_binding`, the projected effect receipt preserves that exact binding.

Current proof inputs are forwarded into the effect resume planner.

Therefore:

- unchanged inputs -> evidence may remain CURRENT;
- changed inputs -> `EFFECT_EVIDENCE_STALE / HOLD`;
- no current inputs -> `EFFECT_EVIDENCE_UNVERIFIED / HOLD`.

The bridge cannot strip proof freshness requirements.

## Automatic resume composition

`planEffectResumeFromReceipts()`:

```
raw Service/Repository/Adapter receipts
 -> explicit effect receipt bridge
 -> effect evidence records
 -> effect resume planner
```

`executeEffectResumeFromReceipts()` continues:

```
safe resume plan
 -> skip already-applied effects
 -> execute only runnable effects
 -> cross-attempt compensation if a later effect fails
```

If bridge or planner returns HOLD, the executor is not called.

If every effect is already proven applied, result is COMPLETE and executor call count is zero.

## Registry policy

No company-wide effect binding registry is created from this implementation alone.

A real project/workflow must first provide a revision-bound mapping from D effect meaning to C operation receipt semantics. Only then should a project binding artifact be registered.

This prevents the Core from inventing business-effect meaning merely because a Repository operation exists.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions intentionally not used. Tests are included by the normal `test/*.test.mjs` runner but remain NOT CI VERIFIED.

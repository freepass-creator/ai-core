# Effect Resume Plan Freshness v1

Status: **D POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

A recovery plan can be correct when it is prepared and unsafe a moment later.

Examples:

- a new success receipt arrives after planning;
- proof inputs change;
- an effect definition changes;
- a receipt is corrected or replaced;
- the effect-to-receipt binding changes;
- another recovery attempt starts;
- the prepared plan artifact itself is modified.

Executing the old plan would recreate the same class of stale-recovery bugs that no-replay is designed to prevent.

## Machine assets

- contract: `contracts/workflow-effect-resume-plan.schema.json`
- guard: `src/workflow/effect-resume-plan-guard.mjs`
- composed execution: `src/workflow/effect-receipt-resume-runtime.mjs`
- tests: `test/workflow-effect-resume-plan-guard.test.mjs`

## Prepared plan contract

A prepared plan is:

`workflow-effect-resume-plan/v1`

Algorithm:

`EFFECT_RESUME_PLAN_SHA256_V1`

The plan pins these independent digests:

- target attempt execution binding;
- ordered effect definitions;
- canonicalized receipt-binding definitions;
- canonicalized source receipt set;
- current proof input set;
- planner result.

The final `plan_digest` covers all component digests plus logical execution identity.

`plan_id` is deterministically derived from the plan digest.

## Meaningful vs non-meaningful ordering

Effect order is business-significant and is preserved.

These are set-like and canonicalized before hashing:

- receipt list;
- receipt-binding list;
- current proof inputs inside each receipt.

Reordering the same receipt/binding/proof-input set does not stale a plan.

Changing effect order does.

## Prepare / execute separation

Two-phase API:

```
prepareEffectResumeFromReceipts()
  -> prepared plan artifact

...time passes / evidence may change...

executePreparedEffectResumeFromReceipts()
  -> verify plan freshness
  -> execute only if CURRENT
```

The one-shot API internally uses the same prepare/verify path.

## Stale reasons

Verification reports explicit change classes:

- `TARGET_EXECUTION_CHANGED`
- `EFFECTS_CHANGED`
- `BINDINGS_CHANGED`
- `RECEIPTS_CHANGED`
- `PROOF_INPUTS_CHANGED`
- `PLANNER_RESULT_CHANGED`
- `PLAN_DIGEST_CHANGED`

Artifact integrity checks additionally detect:

- `PLAN_ARTIFACT_TAMPERED`
- `PLAN_COMPONENT_DIGEST_MISMATCH`
- `PLAN_ID_MISMATCH`

Any change makes the prepared plan `STALE`.

## Execution rule

A stale prepared plan returns:

`HOLD / STALE_RESUME_PLAN`

and the effect/compensation executor call count is exactly zero.

The caller must re-read evidence and prepare a new plan.

## Attempt binding

The plan is bound to the complete target attempt execution object, not only the logical execution id.

Therefore a plan prepared for:

`logical-X / attempt-2`

cannot be reused by:

`logical-X / attempt-3`.

A new attempt requires a fresh plan.

This closes one class of concurrent recovery reuse.

## Receipt integrity

The receipt set digest contains a canonical digest of every full receipt, keyed by receipt id.

Therefore these both stale the plan:

- a new receipt id appears;
- an existing receipt id keeps its name but its content changes.

Duplicate receipt ids are rejected before planning.

## Proof freshness

The plan separately pins current proof inputs.

A proof input order-only change is ignored after canonicalization.

A digest/revision/content change makes the plan stale before execution.

This is separate from the effect planner's own proof-freshness HOLD rule: the plan guard protects the gap between planning and execution.

## Scope boundary

This guard prevents stale prepared-plan execution.

It does not by itself provide a distributed lease or mutex around the final verification-to-first-side-effect interval.

Cross-worker exclusive execution remains a separate execution-coordination concern.

## Maturity

This is a Core post-baseline implementation.

It is intentionally **not** added as a COMMON/PILOT workflow primitive without independent project evidence.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions are intentionally not used. Tests are included in `test/*.test.mjs` but remain NOT CI VERIFIED in this mode.

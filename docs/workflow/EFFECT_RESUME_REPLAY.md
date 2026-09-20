# Effect Resume / Replay Planner v1

Status: **D POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

A logical multi-effect execution can fail after some effects have already succeeded. Recovery must not blindly replay the whole sequence.

This runtime reconstructs effect state from C-owned receipts and produces a safe D resume plan.

## Runtime

- planner: `src/workflow/effect-resume-planner.mjs`
- executor: `src/workflow/effect-resume-runtime.mjs`
- receipt lineage: `src/contracts/workflow-execution-receipt.mjs`
- tests: `test/workflow-effect-resume.test.mjs`

## Planning rules

For each effect in declared order:

### Existing successful effect, not compensated

`SKIP_ALREADY_APPLIED`

The effect is not called again.

### Existing successful effect, later successfully compensated

`RUN / PRIOR_EFFECT_COMPENSATED`

The earlier side effect was undone, so the effect may be executed again when recovery is otherwise allowed.

### Prior failed effect

`RUN / PRIOR_EFFECT_FAILED`

A prior failure does not prove application of the effect.

### No evidence

`RUN / NOT_YET_OBSERVED`

### Failed compensation

`HOLD / COMPENSATION_EVIDENCE_FAILED`

### Stale or unverified proof-bound evidence

`HOLD`

### Later effect success while an earlier effect remains runnable

`HOLD / OUT_OF_ORDER_EFFECT_SUCCESS`

This prevents the planner from inventing an execution order that contradicts observed evidence.

### Multiple uncompensated successes for the same effect across attempts

`HOLD / DUPLICATE_EFFECT_SUCCESS_EVIDENCE`

This indicates replay may already have occurred. The runtime does not hide it by simply choosing the latest receipt.

## Cross-attempt compensation

The executor carries forward prior applied effects.

Example:

```
attempt 1:
  A = SUCCEEDED
  B = FAILED

attempt 2 resume:
  A = SKIP
  B = SUCCEEDED
  C = FAILED
```

The compensation plan is built from the full currently-applied set:

```
A + B
```

and required compensation runs:

```
undo B
undo A
```

This is critical: skipping A during replay does not remove A from rollback responsibility.

For effects with `NOT_REQUIRED` or `FORBIDDEN` compensation, the retained-effect reason remains explicit.

## Receipt lineage

The resume parent receipt references:

- prior successful effect receipts used for `SKIP_ALREADY_APPLIED`;
- new EFFECT receipts from the current attempt;
- new COMPENSATION receipts from the current attempt.

New action receipts bind to the current attempt identity. Prior receipts keep their original attempt identity.

This preserves one logical execution across multiple actual attempts without rewriting history.

## Safety boundary

The planner does not:

- authorize recovery;
- decide whether a failed effect is retryable;
- override D retry policy;
- convert ambiguous evidence into success;
- infer workflow completion.

It assumes higher-level recovery/retry guards have already allowed execution.

## Current verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions are intentionally not used. The tests are included in the normal `test/*.test.mjs` suite but remain NOT CI VERIFIED in this mode.

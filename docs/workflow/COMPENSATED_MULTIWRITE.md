# Compensated Multiwrite Workflow Pilot

Status: **D SESSION PILOT / PROJECT_VERIFIED**

## Purpose

Sequential side effects are not a transaction. If effect 1 succeeds and effect 2 fails, retrying blindly or pretending the whole operation failed atomically can leave hidden partial state.

The reusable workflow rule is:

1. every effect declares whether it requires domain compensation;
2. if compensation is not required or is forbidden, the domain reason is explicit;
3. after a later failure, only effects that were actually applied are considered;
4. required compensations execute in reverse applied order;
5. successful compensation does not erase the original failure;
6. compensation failure or missing compensation produces explicit `PARTIAL_STATE` escalation;
7. every effect/compensation remains auditable.

## Machine assets

- `contracts/workflow-compensation.schema.json`
- `registry/workflow-compensation-policies.json`
- `src/workflow/compensation.mjs`
- `scripts/validate-workflow-compensation-policies.mjs`
- `test/workflow-compensation.test.mjs`

## Source evidence

Reverse-imported from `freepass-creator/renman@262e06de09db94a116fa377ea2f5dbe024bb086b`.

Renman proves reverse-order compensation of already-applied effects, skipping domain effects that intentionally have no undo, and surfacing compensation failure as remaining partial state rather than swallowing it.

Product-specific patches, entity names and storage code are not imported.

## Maturity

This remains `PILOT / PROJECT_VERIFIED` until a second independent project demonstrates the same generic pattern. It must not be promoted to COMMON_ADOPTED from one implementation alone.


## Executable runtime

`src/workflow/compensation.mjs` now exposes `executeCompensatedEffects()`.

Runtime semantics:
- effects execute sequentially;
- only `SUCCEEDED` effects enter the applied set;
- first HOLD/FAILED effect stops forward execution;
- only already-applied effects are considered for compensation;
- required compensation runs in reverse applied order;
- successful compensation preserves the original failure and returns `RETHROW_ORIGINAL_FAILURE`;
- failed/missing compensation returns explicit `PARTIAL_STATE / ESCALATE`;
- effect and compensation results may carry receipt references; the runtime preserves them instead of collapsing evidence.

The runtime does not choose business effects or grant authority. The caller supplies the effect executor and compensation executor.

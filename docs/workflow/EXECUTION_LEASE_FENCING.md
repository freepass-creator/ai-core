# Execution Lease & Fencing v1

Status: **C EXPERIMENTAL CONTRACT / D POST-BASELINE RUNTIME / NOT CI VERIFIED**

## Purpose

Resume-plan freshness closes the gap between planning and execution inputs, but two workers can still observe the same CURRENT plan at nearly the same time.

This layer prevents both workers from treating themselves as the active executor for the same logical execution.

## Ownership

### C owns

- `core-execution-lease/v1`
- logical execution / attempt identity fields
- fencing token representation
- lease state and timestamps

### D owns

- lease acquisition policy
- renewal/heartbeat
- pre-side-effect fence checks
- stale-owner HOLD behavior
- recovery execution gating

## Machine assets

- contract: `contracts/core-execution-lease.schema.json`
- helpers: `src/contracts/execution-lease.mjs`
- runtime: `src/workflow/execution-lease-runtime.mjs`
- fenced resume: `src/workflow/execution-fenced-resume-runtime.mjs`
- tests:
  - `test/workflow-execution-lease.test.mjs`
  - `test/workflow-execution-fenced-resume.test.mjs`

## Lease key

The lease key is derived from:

`logical_execution_id + identity_digest`

Different attempts for the same logical execution therefore compete for the same execution lease.

This is intentional.

## CAS requirement

The lease store must provide atomic compare-and-swap semantics.

The runtime requires:

- `read(key)`
- `compareAndSwap(key, expectedVersion, nextState)`

A read-then-write store without CAS is not accepted for this execution boundary.

## Fencing token

Every successful new acquisition increments a monotonic integer:

`fencing_token = previous_max + 1`

Example:

```
worker A -> token 1
lease expires
worker B -> token 2
```

Worker A can no longer:

- renew token 1;
- pass `assertFence()`;
- release B's lease;
- safely begin another guarded effect.

A normal release does not reset the token sequence. The next acquisition still receives a larger token.

## Same-owner duplicate protection

An existing live lease owned by the same owner/attempt returns:

`ALREADY_OWNED`

The fenced resume runtime does not piggyback that lease automatically.

This prevents duplicate calls from the same process/session from silently sharing one execution right.

## Prepared-plan sequence

Fenced resume follows:

```
1. verify prepared plan = CURRENT
2. acquire execution lease using CAS
3. verify prepared plan again
4. assert fence
5. before every effect:
     assert fence
     renew lease
     pass fencing token into executor context
6. before every compensation:
     assert fence
     renew lease
     pass fencing token into executor context
7. release lease
```

If the plan changes while lease acquisition is happening, execution stops before any effect.

## Gate loss semantics

### Fence lost before a new effect

No new effect is executed.

The resume runtime returns:

- `HOLD`
- gate error code
- all receipts already created before the gate loss

Compensation is not started merely because coordination ownership was lost.

### Fence lost before required compensation

At this point domain state may already be partially applied.

The runtime returns:

- `PARTIAL_STATE`
- `ESCALATE`
- applied-effect evidence
- compensation plan
- missing/unfinished compensation evidence

It does not execute compensation under a stale fencing token.

## Lease renewal

The fenced runtime renews the live lease before each side effect and compensation.

The fencing token remains unchanged during renewal.

If another worker has already obtained a higher token, renewal fails instead of reclaiming ownership.

An expired lease cannot be renewed back into ownership. A new acquisition is required and receives a higher token.

## External sink requirement

Core-side `assertFence()` closes the coordination race inside AI Core, but a fully fenced external write requires the actual side-effect sink to honor the token.

The effect/compensation executor receives:

- `execution_lease`
- `fencing_token`

A database/API/provider integration that can perform the write atomically with a fencing condition should reject stale tokens at the storage/provider boundary.

If an external provider cannot support fencing, the Core lease still reduces duplicate execution risk but cannot mathematically eliminate the tiny check-to-write race outside the Core process.

That limitation must remain explicit.

## Release semantics

Release is CAS-protected.

A stale token cannot release a newer worker's lease.

If release fails after work has already executed, the result is preserved and a coordination warning is returned. The runtime does not rewrite a successful/failed business execution merely because cleanup failed.

## Maturity

This is a Core implementation and remains EXPERIMENTAL.

It is not promoted to a company-wide Workflow primitive without independent project/runtime evidence.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions are intentionally not used. Tests are part of the normal `test/*.test.mjs` suite but remain NOT CI VERIFIED.

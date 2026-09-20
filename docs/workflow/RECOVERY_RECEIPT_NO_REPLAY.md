# Recovery Receipt No-Replay v1

Status: **D PILOT IMPLEMENTATION / C IDENTITY BOUND / NOT CI VERIFIED**

## Purpose

Ordinary request idempotency is not enough when one logical execution can travel through:

- native execution;
- retry;
- fallback;
- downstream continuation;
- manual recovery.

The failure class this contract prevents is:

```
logical execution succeeds
  -> recovery misses the success
  -> fallback/retry executes the same logical work again
```

## Ownership

### C owns

- `core.execution-identity.v1`
- logical execution identity digest
- attempt identity
- receipt execution binding
- receipt proof-input freshness
- receipt lineage

### D owns

- whether retry/recovery is allowed
- no-replay suppression
- HOLD on ambiguous/partial evidence
- retry/backoff/resume/escalation
- recovery eligibility

C evidence never decides the workflow by itself.

## Runtime

Machine implementation:

- `src/workflow/recovery-receipt-reconciler.mjs`
- `src/workflow/recovery-execution-guard.mjs`
- `src/workflow/retry-receipt-guard.mjs`
- `test/workflow-recovery-receipt-reconciler.test.mjs`

Compensated execution integration:

- `src/workflow/compensation-receipt-runtime.mjs`
- `test/workflow-compensation-receipt.test.mjs`

## Canonical logical identity

Recovery policy now binds to:

`core.execution-identity.v1`

Dimensions:

1. `operation_kind`
2. `logical_slot`
3. `subject_scope`
4. `semantic_input_digest`

Native, fallback, recovery and downstream paths must carry the same logical identity when they represent the same business execution.

Each actual run has a distinct attempt identity.

## Receipt evidence records

Recovery reconciliation receives receipt evidence plus recovery-specific metadata:

- evidence source:
  - `NATIVE_EXECUTION`
  - `RECOVERY_HISTORY`
  - `DOWNSTREAM_TERMINAL_EVIDENCE`
  - `EXTERNAL_AUTHORITY`
- `terminal_authority`
- current proof inputs when the receipt has a proof-input binding.

A child EFFECT receipt may prove an effect happened without proving the whole logical execution completed.

Therefore only `terminal_authority=true` evidence may suppress whole-execution replay.

## Decision rules

### 1. Current authoritative success exists

Result:

`SUPPRESS_REPLAY`

A prior successful fallback/manual recovery is classified separately as:

`SUCCESSFUL_PRIOR_RECOVERY`

The executor is not invoked.

### 2. Authoritative PARTIAL or HOLD exists

Result:

`HOLD / AMBIGUOUS_OR_PARTIAL_OUTCOME`

Blind retry is forbidden.

### 3. Proof-bound authoritative evidence is stale or cannot be reverified

Result:

- `AUTHORITATIVE_EVIDENCE_STALE`; or
- `AUTHORITATIVE_EVIDENCE_UNVERIFIED`

Both produce HOLD.

A caller cannot override a proof-bound receipt by merely declaring `proof_status=CURRENT`. Current proof inputs must actually verify against `core-proof-input-binding/v1`.

### 4. Same attempt has conflicting authoritative terminal receipts

Example:

- same attempt receipt A = SUCCEEDED
- same attempt receipt B = FAILED

Result:

`HOLD / CONFLICTING_TERMINAL_EVIDENCE`

No retry or replay suppression is guessed from inconsistent evidence.

### 5. Only terminal failure evidence exists

Result:

`ALLOW_RECOVERY`

This only means no success/partial evidence currently suppresses recovery. It does not itself schedule or authorize execution.

### 6. Current attempt was already observed

Result:

`HOLD / CURRENT_ATTEMPT_ALREADY_OBSERVED`

A caller must reconcile that attempt rather than launching it again.

## Retry guard

A normal D retry decision is also receipt-guarded.

```
D resolveFailure() -> RETRY
  -> receipt reconciliation
     -> success evidence: SUPPRESS_RETRY
     -> partial/ambiguous/stale: HOLD
     -> only safe failure/no success: keep RETRY
```

Non-retry decisions such as ESCALATE remain unchanged.

## Execution guard

`executeWithRecoveryGuard()` invokes the recovery executor only when reconciliation returns `ALLOW_RECOVERY`.

For:

- `SUPPRESS_REPLAY`
- `HOLD`

executor call count is exactly zero.

## Compensation receipt integration

Compensated multi-write parent, EFFECT and COMPENSATION receipts may carry the same C execution binding.

This permits the parent terminal receipt to directly feed recovery reconciliation.

Important:

- EFFECT child success is not whole-execution success.
- compensated original failure remains FAILED.
- failed compensation remains PARTIAL and forces HOLD/escalation.
- successful parent execution suppresses duplicate logical execution replay.

## Maturity

The recovery policy remains:

- adoption: **PILOT**
- evidence: **PROJECT_VERIFIED**
- source project: FreePass ERP4

The C identity dependency is now structurally **BOUND** to `core.execution-identity.v1`.

This does **not** promote the workflow primitive to COMMON_ADOPTED. A second independent project remains required.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions are intentionally not used. Tests are included in the normal `test/*.test.mjs` suite but have not been CI executed in this mode.

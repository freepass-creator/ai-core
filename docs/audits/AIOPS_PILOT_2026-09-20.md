# AIOps — AI Core 8-axis Pilot Audit

Status: `READ_ONLY_AUDIT_COMPLETE_WITH_GAPS`

Subject:
- repository: `freepass-creator/aiops`
- main revision: `c37a422765e784cdd843f36efb4be5328d7df4bb`
- exact-revision workflow: `AI Core Penalty Adapter #35419155299 = PASS`
- branch protection observed: `false`

No AIOps source or runtime state is changed by this audit.

## Result

| Axis | Verdict | Meaning |
|---|---|---|
| UI/UX | UNKNOWN | audited surface is operational automation/CLI, not a material product UI |
| Data / SSOT | CORE_MATCH | freshness-aware canonical summaries and append-only history align |
| Engine / Adapter | CORE_MATCH | existing engines are reused behind Core adapters with authority/lease/terminal proof |
| API / Event / Error | CORE_MATCH | applicable result/blocker/event semantics align; no public HTTP surface scored |
| Workflow | MIGRATION_GAP | strong lifecycle semantics exist but no D SHADOW consumer binding is established |
| Security / Audit | RESEARCH_ADVISORY | AIOps contains some of the strongest reverse-import evidence in the group |
| QA / Observability | RESEARCH_ADVISORY | health/freshness/terminal proof are strong, but enforcement coverage is incomplete |
| Build / Deploy / Governance | MIGRATION_GAP | CI path asymmetry, omitted suites and unprotected main remain |

## Strongest reverse-import candidate — exact-subject authority

AIOps does not treat “approval” as a reusable boolean.

An approval is bound to:

```
action class
+ plan SHA
+ template SHA
+ target digest/count
+ optional command hash
+ TTL
```

If the plan, template or target changes, old approval no longer opens the gate.

This is the exact behavior AI Core Security/Audit needs for protected execution.

### Separation of duties

- executor cannot count their own review;
- one independent reviewer may substitute for another approved reviewer role;
- a BLOCK verdict wins;
- owner approval is separately required for higher-risk actions.

### Emergency boundary

Emergency approval exists for selected reversible classes, but **protected actions cannot be opened by emergency override**.

That distinction is more valuable than a generic “emergency bypass allowed” flag.

### Tamper evidence

The approval ledger is append-only and hash chained.

AIOps also records approval facts in a second audit ledger. This matters because a hash chain alone can be reconstructed from GENESIS after deleting unwanted rows. Cross-checking the second ledger exposes that rewrite.

That is a concrete implementation lesson worth carrying into the future AI Core audit profile.

## Important enforcement gap

The strongest security mechanism is **not currently a required CI gate**.

Existing tests:
- `test/seungin.test.mjs`
- `test/with-lease-seungin.test.mjs`

cover:

- stale subject binding;
- self-review rejection;
- BLOCK precedence;
- emergency command binding;
- protected non-bypass;
- TTL expiry;
- hash-chain tampering;
- full-ledger reconstruction detection;
- real `with-lease` execution gating.

But current:

- `npm test`
- `.github/workflows/ai-core-penalty.yml`

do not execute those suites.

So the correct statement is:

> **AIOps has strong approval code and regression evidence, but that evidence is not yet continuously enforced by the current CI path.**

## QA / Observability reverse-import candidates

### 1. Health is not binary

Penalty health distinguishes:

- OK
- REVIEW_PENDING
- TRANSITION_FAILED
- QUOTA_BLOCKED
- WORK_SERVER_FAILED
- task disabled

A review wait is not mislabeled as a system crash.

### 2. Freshness fail-closed

Finance/receivable adapters refuse to present stale sources as current truth.

That should become a reusable Core health/freshness rule.

### 3. Terminal manifest

A child process returning exit 0 does not prove the business operation succeeded.

The AI Core penalty executor requires a newly created terminal run manifest and maps:

- COMPLETED → SUCCEEDED
- COMPLETED_WITH_HOLD → HOLD
- FAILED → FAILED
- no new manifest → HOLD

This is a strong completion-evidence pattern.

## Concrete project-local gaps

### CI push path asymmetry

`ai-core-penalty.yml`:

- PR paths include `lib/ai-core-finance-adapters.mjs` and its test.
- push-to-main paths omit them.

The current finance commit triggered the workflow because another watched file changed, but a future finance-only main change can miss the dedicated gate.

### Approval tests omitted

The exact-subject authority and with-lease integration tests are not in the required workflow.

### Main unprotected

Current GitHub observation reports `protected=false`.

### Scheduler proof remains external

Code contains a read-only scheduler health model, but GitHub cannot prove the actual Windows Task Scheduler Enabled/LastRun/LastTaskResult values.

## Workflow migration candidate

AIOps already has rich workflow semantics. Do not migrate all of them at once.

Good first D SHADOW candidates:

1. penalty review → dispatch transition;
2. hold/defer → resume schedule;
3. human completion claim → evidence-verified completion.

Keep AIOps runtime authority while proving D parity.

## No-touch boundary

This audit does not:

- enable/disable Windows scheduled tasks;
- write Drive/Sheets/Firestore;
- change approvals;
- touch coordination ledgers;
- change AIOps CI;
- activate insurance adapter PR #6.

Machine-readable source:
`docs/audits/aiops-pilot-2026-09-20.json`.

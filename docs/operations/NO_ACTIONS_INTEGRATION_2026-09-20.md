# No-Actions Integration Log — 2026-09-20

## Operating mode

User direction: do not use GitHub Actions for the current AI Core work. Continue implementation on branch-only work without opening a PR.

Working branch: `work/ai-core-no-actions-20260920`

GitHub Actions: **NOT USED**
PR for this branch: **NONE**
Canonical promotion: **NOT CLAIMED**

## Integrated A/B/C/D work

### A — review allocator
Integrated from #139:
- deterministic `review_revision`
- allocator policy
- allocator runtime
- allocator tests
- package commands

Not copied:
- generated historical B/C/D queue snapshots
- Actions workflow wiring
- ORDER-DESK changed-file inventory

### B — UI/UX
Integrated from #127 and #136:
- `ui-ux-machine-conformance` schema
- machine conformance engine
- validator CLI
- tests
- UI/UX Constitution linkage
- Feature Registry invariant
- FreePass Sales consumer mapping
- package command `uiux:machine`

Not copied:
- Actions workflow wiring

### C — Core Contract
Integrated from #129, #130, #131:
- `core-proof-input-binding/v1`
- `core-fact-evidence/v1`
- `core-schedule-observation/v1`
- runtime helpers/tests
- consolidated Core Contract Registry
- consolidated Core Contract Standard
- additive `core-receipt/v1.proof_input_binding`

### D — Workflow
Integrated from #133 and #134:
- compensated multi-write policy/schema/runtime/validator/test
- schedule timing policy/schema/runtime/validator/test
- consolidated Workflow Registry
- consolidated State Machine specification
- package commands

Cross-lane refinement:
- C `core.schedule-observation.v1` is present on this branch.
- D schedule timing policy therefore marks its observation contract `AVAILABLE`.
- D remains `PROPOSED` because company-wide late/missed thresholds and project-verified policy implementation are still absent.

## Deliberately excluded

- every `.github/workflows/*` change
- all CI-triggering PR creation for this branch
- PR-specific ORDER-DESK inventory mutations
- stale/generated queue snapshots
- any claim that unexecuted tests passed

## Verification state

- source branch implementations and tests were preserved.
- GitHub Actions were intentionally not run.
- Current integration is **IMPLEMENTED / NOT CI VERIFIED**.
- Validation can be run later locally or in a single controlled verification pass when the user chooses.

## Next-cycle runtime convergence

Added after the initial A/B/C/D bundle:

### C runtime convergence
- `src/engine/port-runtime.mjs`
  - verified binding/profile enforcement
  - project-scoped adapter enforcement
  - side-effect idempotency guard
  - adapter timeout/failure normalization
  - declared Connector facade
  - `invokeWithReceipt()`
- `src/engine/connector-runtime.mjs`
  - low-level transport only
  - timeout/abort and transport failure normalization
  - no retryability/business semantics
- `src/contracts/adapter-receipt.mjs`
  - deterministic input/output digest
  - adapter-result → core receipt
  - proof-input binding support

### D runtime convergence
- adapter result → workflow retry/hold/failure bridge
- executable sequential compensated effects
- reverse compensation of applied effects only
- compensation failure → explicit PARTIAL_STATE / ESCALATE

### B runtime convergence
- operation feedback projection from D outcome to canonical feedback features
- technical success is not displayed as business completion without verified completion evidence

### A adoption evidence
FreePass Estimate current shadow evidence refreshed to:
`b526fdc73e812dcb0594d10caf2123bbade1d38b`

Shadow chain now includes:
Engine → Port → Adapter → Connector → Adapter Result → Receipt / Proof Input Binding.

Current branch audit:
- GitHub workflow changes: none
- contract duplicate ids: none observed
- workflow primitive duplicate ids: none observed
- canonical promotion: not claimed
- CI: not run by user direction



## Repository / Service separation cycle

Non-overlap target: FreePass Admin + C runtime only.

Added:
- `core-repository/v1`
- `core-repository-result/v1`
- `src/contracts/repository-contract.mjs`
- `src/engine/repository-runtime.mjs`
- Service Binding support for exactly one Adapter or Repository target per Port
- Application Service Runtime routing to Adapter or Repository runtime
- per-Repository-operation Connector least-privilege mapping

FreePass Admin current source:
`2aede7df82591470308f25bd3ccd4e5358aa7c3c`

Current Admin Service SHADOW:
- `application.repository` -> `freepass-admin.application-repository`
- `product.read` -> `freepass-admin.product-repository`
- `actor.provider` -> unresolved

Therefore strict Service Runtime remains HOLD.

Admin file persistence facts preserved:
- process-local write serialization
- temp-file + rename write path
- submissionId duplicate protection for application create
- monotonic product version increment
- development filesystem evidence only; no production Firestore behavior inferred

Actions: NOT USED.


## Receipt lineage cycle

Scope: C runtime + FreePass Admin SHADOW only. No Sales/ERP4/Workflow ownership changes.

Added:
- Repository `invokeWithReceipt()`
- `src/contracts/repository-receipt.mjs`
- `src/contracts/service-receipt.mjs`
- Application Service `runWithReceipt()`
- optional `core-receipt/v1.child_receipts[]`

Lineage:
`Service Receipt -> child Adapter/Repository Receipts -> Result/Evidence/Proof Inputs`

Revision semantics:
- receipt `source_revision` = implementation/source revision
- Repository entity/storage revision = `metrics.repository_revision`

Current Admin receipt/proof adoption stays SHADOW.
No workflow completion is inferred from receipt creation.

Actions: NOT USED.


## Compensation receipt lineage cycle

Scope: C receipt evidence + D compensated-effect wrapper only.

Added:
- `src/contracts/workflow-execution-receipt.mjs`
- `src/workflow/compensation-receipt-runtime.mjs`
- `test/workflow-compensation-receipt.test.mjs`
- `docs/workflow/COMPENSATION_RECEIPT_LINEAGE.md`

Receipt chain:
`multiwrite parent -> EFFECT/COMPENSATION receipt -> optional lower-level execution receipt`

Semantics:
- all effects success -> parent SUCCEEDED
- original failure + successful compensation -> parent FAILED; original failure preserved
- compensation failure -> parent PARTIAL; D action remains ESCALATE
- lower-level receipts are referenced, not copied

Actions: NOT USED.


## Recovery receipt no-replay cycle

Scope: D recovery/retry evidence gate + C execution identity binding.

Added:
- `src/workflow/recovery-receipt-reconciler.mjs`
- `src/workflow/recovery-execution-guard.mjs`
- `src/workflow/retry-receipt-guard.mjs`
- `test/workflow-recovery-receipt-reconciler.test.mjs`
- `docs/workflow/RECOVERY_RECEIPT_NO_REPLAY.md`

Recovery policy:
- remains PILOT / PROJECT_VERIFIED
- C identity dependency: PENDING -> BOUND
- contract: `core.execution-identity.v1`
- canonical dimensions: operation_kind / logical_slot / subject_scope / semantic_input_digest

Rules:
- authoritative success suppresses replay/retry
- PARTIAL/HOLD/conflicting evidence -> HOLD
- proof-bound success must be reverified from current proof inputs
- same attempt already observed -> HOLD
- only safe failure/no-success evidence -> recovery may proceed
- executor is never called when suppression/HOLD applies

Compensation parent receipts now carry execution identity and can directly feed recovery reconciliation.

Actions: NOT USED.


## Effect resume replay cycle

Scope: D effect-level recovery planning only.

Added:
- `src/workflow/effect-resume-planner.mjs`
- `src/workflow/effect-resume-runtime.mjs`
- `test/workflow-effect-resume.test.mjs`
- `docs/workflow/EFFECT_RESUME_REPLAY.md`

Rules:
- prior successful/uncompensated effect -> SKIP
- prior successful/compensated effect -> RUN again
- prior failed/unobserved effect -> RUN
- failed compensation, stale/unverified proof, out-of-order success, duplicate uncompensated success -> HOLD
- resumed failure compensates the full applied set across attempts, including prior skipped successes
- retained non-compensatable effects remain explicit

Actions: NOT USED.


## Effect receipt bridge cycle

Scope: C execution receipt lineage -> D effect evidence/resume only.

Added:
- `contracts/workflow-effect-receipt-binding.schema.json`
- `src/workflow/effect-receipt-bridge.mjs`
- `src/workflow/effect-receipt-resume-runtime.mjs`
- `test/workflow-effect-receipt-bridge.test.mjs`
- `test/workflow-effect-receipt-resume.test.mjs`
- `docs/workflow/EFFECT_RECEIPT_BRIDGE.md`

Also completed execution identity propagation through:
- Service parent receipt
- Repository child receipt

Rules:
- explicit binding only; no name-based inference
- source receipt belongs to one effect only
- missing execution identity / PARTIAL / ambiguous source -> HOLD
- proof binding is preserved and must be reverified
- Repository/Service success can automatically become effect success evidence
- Repository/Service failure remains failed effect evidence
- composed runtime can skip proven writes and execute only unfinished effects

No global project effect-binding registry was invented without project evidence.

Actions: NOT USED.


## Resume plan freshness cycle

Scope: D prepared effect-resume plan integrity only.

Added:
- `contracts/workflow-effect-resume-plan.schema.json`
- `src/workflow/effect-resume-plan-guard.mjs`
- prepared-plan APIs in `src/workflow/effect-receipt-resume-runtime.mjs`
- `test/workflow-effect-resume-plan-guard.test.mjs`
- `docs/workflow/EFFECT_RESUME_PLAN_FRESHNESS.md`

Pinned inputs:
- complete target attempt binding
- ordered effects
- canonicalized receipt bindings
- full source receipt set
- current proof inputs
- planner result

Rules:
- any meaningful change -> STALE_RESUME_PLAN / HOLD
- stale plan executor call count = 0
- plan artifact tampering/component digest mismatch/plan id mismatch -> stale
- same logical execution with a different attempt requires a new plan
- array reordering for set-like receipt/binding/proof inputs does not stale the plan

Actions: NOT USED.


## Execution lease fencing cycle

Scope: prepared effect-resume execution coordination only.

Added:
- `core.execution-lease/v1`
- `src/contracts/execution-lease.mjs`
- `src/workflow/execution-lease-runtime.mjs`
- `src/workflow/execution-fenced-resume-runtime.mjs`
- `test/workflow-execution-lease.test.mjs`
- `test/workflow-execution-fenced-resume.test.mjs`
- `docs/workflow/EXECUTION_LEASE_FENCING.md`

Rules:
- logical execution lease store must support atomic CAS
- new acquisition increments monotonic fencing token
- expired/released lease never resets fencing sequence
- same-owner duplicate invocation does not piggyback a live lease
- prepared plan is reverified after lease acquisition
- lease/fence is checked and renewed before each effect/compensation
- stale fencing token blocks side effects
- gate loss before effect -> HOLD with prior receipt evidence preserved
- gate loss before compensation -> PARTIAL_STATE / ESCALATE
- stale worker cannot release a newer worker's lease
- external sinks should enforce the passed fencing token when provider/storage supports it

Actions: NOT USED.

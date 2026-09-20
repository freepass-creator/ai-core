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

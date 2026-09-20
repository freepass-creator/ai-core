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

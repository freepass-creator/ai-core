# FreePass Sales Forward-Skip Workflow Shadow

Status: **D8 SHADOW / SOURCE-PARITY-VERIFIED**

Source:
`freepass-creator/freepass-sales@2ec46bb2e88b10a31915b68ec77b2eecbdac57bd`

## What D learned

Sales has two distinct concepts:

1. transient contact outcome;
2. durable business progress.

A later call result such as no-answer does not erase a previously proven quote, consent, screening or contract milestone.

Durable progress is monotonic.

The source also allows a later valid business fact to skip an intermediate UI milestone. The key integrity rule is that a skipped milestone does **not** receive fabricated completion evidence.

Example:

`INTERESTED -> PROCEEDING_AGREED`

may skip `QUOTE_PRESENTED` as a displayed milestone. Proceeding agreement logically implies that a quote was presented, so D may require an inferred prerequisite fact with provenance. It does **not** imply that a quote was actually sent, so `sales.quote-sent` must not be manufactured.

## D7 Core additions

- primitive: `workflow.forward-skip-evidence-integrity` — PILOT / PROJECT_VERIFIED
- contract: `workflow-progression.schema.json`
- registry: `workflow-progressions.json`
- runtime planner: `src/workflow/progression.mjs`
- validator: `validate-workflow-progressions.mjs`
- Sales SHADOW workflow: `freepass-sales.lead-progress-lifecycle`

## Boundary

Sales labels remain project-owned. D does not make `INTERESTED`, `QUOTE_PRESENTED` or `PROCEEDING_AGREED` company-wide states.

The reusable rule is:

- forward only;
- explicit forward skip;
- no fabricated completion for skipped states;
- inferred prerequisites require provenance;
- inferred prerequisite must remain distinct from stronger completion facts.

C owns the eventual typed provenance/evidence envelope. D owns when the workflow requires such provenance.

Promotion beyond PILOT requires a second independent project demonstrating the same forward-skip integrity rule.


## D8 source-side adoption evidence

FreePass Sales now contains its own D Workflow Progression SHADOW binding at merge revision:

`e8a96166e0961455119d9721501f26ecda229d03`

Project-side evidence:

- `contracts/ai-core/sales-workflow-progression.shadow.json`
- `웹/workflow-progression-shadow.js`
- `검토/workflow-progression-shadow.test.mjs`
- Sales CI run `35481914375` — SUCCESS

The source-side test executes the real Sales `deriveLead / transitionPlan / transitionPatch` behavior and proves forward skip, backward rejection, non-regression from later contact failures and the no-fabricated-quote-send boundary.

This advances both the Sales workflow and progression evidence to `SOURCE_PARITY_VERIFIED` while intentionally keeping `adoption_status=SHADOW`. Sales still owns runtime writes. D runtime PILOT requires an approved write-path integration plus rollback and exact runtime evidence.

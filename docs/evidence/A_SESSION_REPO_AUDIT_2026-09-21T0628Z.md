# AI Core A-session repository audit — 2026-09-21T06:28Z

## Scope and comparison baseline

- Previous A-session evidence revision: `337418e2dec7a7d1ec6a380e45996a2dfd172ce2`.
- AI Core canonical comparison target remains `ac8c502358c17613a712c9c7e1ab780f51f1eb97`.
- Repositories with material post-baseline revisions in this observation: `freepass-sales`, `freepasserp4`.
- No newer material revision than the prior observation was found for `freepass-data`, `devcenter`, `freepass-admin`, `freepass-estimate`, or `aiops`.
- This file is A-session evidence only. No B/C/D canonical standard is modified.

## 1. FreePass Sales

Observed exact head: `c56074765c3dbbb4e4044d041e9a5d085ee17b23`.
Previous A-session observed head: `28a78a67660b1db0e31ab54e4c2b2d402b706fa7`.

The post-baseline range introduces a versioned contact-report contract, deterministic current-state reconstruction from stored workflow evidence, a read-only reporting boundary, cross-field consistency reconciliation, product-specific Interest-tab filtering, and in-app operator manuals.

### 1.1 Project > Core → D candidate: evidence-ordered workflow projection reconstruction

The new report builder reconstructs the customer current state using explicit evidence precedence rather than treating the latest contact attempt as authoritative:

1. use the explicitly stored current state/stage when present;
2. otherwise use the newest persisted status event;
3. otherwise preserve the deepest reached workflow milestone derived from historical contacts and milestone fields;
4. allow a terminal outcome to override prior progress;
5. fall back to the latest low-level contact result only when no stronger workflow evidence exists.

Concrete source behavior at this revision includes:

- a later `안 받음` does not regress an earlier `관심있음` milestone;
- a later terminal `관심없음` does override an earlier positive milestone;
- an explicit stored `승인` remains authoritative despite a later no-answer contact;
- a recent persisted status event such as `진행동의` is preferred over reconstructed contact history;
- dependent contact-state projection is reconciled so a progressed/terminal workflow cannot simultaneously report `연락 안 됨`.

The contact-report contract now machine-encodes `progressImpliesConnected: true`; the builder applies it through `reconcile_contact_state`.

Generalized candidate:

**Evidence-Ordered Workflow Projection Reconstruction** — when a materialized workflow state is absent or incomplete, a read projection may reconstruct current state from multiple authoritative evidence classes only through an explicit precedence contract. Reconstruction must define monotonic milestone retention, terminal override semantics, deterministic fallback, and dependent-projection consistency so lower-signal late observations cannot silently regress stronger workflow evidence.

Route: **D / Workflow candidate**.

Why this is ahead of current Core: AI Core already has `workflow-projection.schema.json`, `registry/workflow-projections.json`, and a validator, but the canonical projection model is rule-priority over current `STATE_EQUALS` / `FACT_EQUALS` conditions. It does not model ordered historical evidence, newest-event precedence, deepest-reached milestone retention, terminal override, or event-history reconstruction. The existing canonical example is the FreePass Admin status projection over current lifecycle/facts, not historical replay/reconstruction.

Status: candidate only. D canonical files are unchanged.

### 1.2 Evidence level and verification gap

Exact-head Sales CI run `35568381412` completed `success` for `c56074765c3dbbb4e4044d041e9a5d085ee17b23`. The preceding exact-head run `35567990611` at `2bf23fbf...` also completed successfully. The current CI executes static/syntax checks, AI Core UI/UX mapping, customer-search adapter checks, Core receipt shadow, D workflow-progression shadow, Playwright browser regressions, and mobile capture.

The project also contains dedicated reconstruction assertions in `검토/contact_report_builder_test.py` covering monotonic progress, terminal override, status-event precedence, explicit-state precedence, no-answer/contact-loss derivation, and progress/contact reconciliation.

However, the current CI/package wiring only syntax-compiles that Python test file through `py_compile`; it does not execute those assertions directly. Therefore the candidate evidence level is:

**CODE + MACHINE-READABLE CONTRACT + TEST DEFINITIONS + EXACT-HEAD STATIC/BROWSER CI**, with a remaining **candidate-specific test-execution gap**.

Required verification before any D promotion:

- execute the reconstruction test file in CI rather than only compiling it;
- add out-of-order event timestamps and duplicate/replayed event cases;
- add explicit stale-materialized-state versus newer-event policy tests;
- prove deterministic output from the same evidence set independent of read order;
- keep the reporting projection read-only and verify it cannot become a competing writer.

### 1.3 Different: report authority/read-only boundary and product UI/manual changes

`contracts/contact-report.v1.json` now marks the Google Sheet report as `readOnly: true`, `dataValidation: false`, and `inputColumns: []`; the report is generated from Firestore and input remains in Sales. This is a good local authority boundary but does not require a new Core contract beyond existing source/authority principles.

The Interest tab now defines its local `전체` scope as `관심 있음 이상`, and the latest revisions add operator manuals/app usage guidance under Settings. These are product-specific UX/domain semantics, not new B/C/D canonical patterns.

Classification: **Different**.

## 2. ERP4 / ERP5 recovery plane

Current repository evidence head: `ca537fd388fe60cc9b2e07069d6c0d7198221d12`.
Recovery heartbeat revision: `a5a82c5817b29ddddd88aa7fe92b21db79691bcb`.
Recovered ERP5 run: `35566458884`.

Keep repository evidence head, application/runtime revision, recovery slot, and workflow run ID as separate coordinates.

### 2.1 Evidence-level change: 14:05 recovery is terminal green

The monitor snapshot committed at 14:58 KST recorded logical slot `2026-09-21T14:05:00+09:00` as `erp5-in-progress`, with settlement writes complete and ERP5/audits pending.

Authoritative GitHub Actions evidence later closed that run: ERP5 run `35566458884` completed `success` at 15:09:58 KST. The job completed the full production chain, including source-contract verification, current-source recrawl, ERP5 atom calculation, Core receipt shadow generation/preservation, policy reconciliation, release snapshot, public catalog publication, sales-sheet publication, F86 backup/publication, F86 freshness parity, Atom↔F01↔F86 cell parity, plate/photo audit, and evidence preservation.

Classification: **Different / evidence-level closure for the 14:05 downstream execution**.

This verifies the 14:05 ERP5 execution itself; it does not close recovery-control correctness.

### 2.2 Core > Project → D gap escalation: failed trigger suppresses recovery despite no success evidence

The refreshed monitor now records the 12:05 slot as:

- settlement production writes completed;
- downstream ERP5 `workflow_run` was cancelled before any job was created;
- ERP5 production writes/audits did not run;
- `automaticRetryPerformed: false`;
- fallback was considered ineligible because a chain trigger existed.

That suppression rule conflicts with the current AI Core recovery policy `workflow.recovery-slot-no-replay`. Core requires fallback eligibility to be decided after reconciling **success evidence** for the same logical execution identity. Its explicit eligibility is `slot_due + no_success_evidence + no_successful_prior_recovery`; successful native/prior-recovery/downstream terminal evidence suppresses replay, and ambiguous outcomes HOLD. Mere existence of a failed/cancelled trigger is not success evidence.

Classification: **Core > Project / D migration-backport gap, evidence escalated**.

Breaking impact:

- a downstream run cancelled before job creation can leave a logical slot permanently incomplete even though settlement writes already occurred;
- the existence of a trigger can suppress the only fallback despite zero successful downstream execution;
- persisted cursor/heartbeat state can advance while the end-to-end operation is not complete;
- the same rule can produce false confidence that replay prevention is working when it is actually suppressing required recovery.

Required migration/backport:

- key fallback suppression to reconciled terminal **success**, not trigger existence;
- classify cancelled-before-job and other non-success terminal outcomes explicitly;
- retry or HOLD according to policy while preserving the same logical execution identity/idempotency boundary;
- prove exactly-once recovery when a failed native/downstream attempt already exists;
- verify no replay after later terminal success arrives.

### 2.3 Contradiction / stale revision: monitor remains behind terminal Actions evidence

Repository monitor head `ca537fd...` still records run `35566458884` as `erp5-in-progress` and leaves `lastKnownGoodErp5RunId` at the prior run, while authoritative Actions says `35566458884` is terminal `success` and all production/audit steps passed.

Classification: **Core > Project / D reconciliation gap remains open**.

Required closure evidence:

- idempotently reconcile run `35566458884` into the 14:05 slot as terminal success;
- advance `lastKnownGoodErp5RunId` and the logical recovery cursor monotonically;
- retain successful run evidence without replaying 14:05;
- test delayed/out-of-order `workflow_run` completion, process restart, and concurrent monitor writers.

The previously recorded ERP4 Core > Project C gap around pinned runtime source/status semantics versus current-main source registry/verifier remains open but has no new material evidence in this revision range, so it is not reclassified here.

## 3. Routing summary

- **Project > Core → B:** none.
- **Project > Core → C:** none.
- **Project > Core → D:** Sales Evidence-Ordered Workflow Projection Reconstruction.
- **Core > Project → D:** ERP4 failed-trigger recovery suppression contradicts Core success-reconciliation semantics; terminal monitor reconciliation is still stale.
- **Different:** Sales read-only report boundary/product-specific Interest/manual UX; ERP4 14:05 downstream execution terminal-success closure.

No B/C/D canonical file was changed by this audit.

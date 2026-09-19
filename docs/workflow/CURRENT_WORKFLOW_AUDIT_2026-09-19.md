# Current Workflow Audit — 2026-09-19

Status: **D SESSION REVISION-BOUND AUDIT**

Audited AI Core base revision:

`444066bea9ac00e4cf4ba539c7b5344154bd407e`

This audit distinguishes existing runtime authority from new D-session common contracts.

## 1. Existing authorities found

### 1.1 AI Core Work lifecycle

Current business-state authority:

- `scripts/work-ledger.mjs`
- schema: `contracts/work-ledger-event.schema.json`

The current domain lifecycle is hard-coded in `scripts/work-ledger.mjs`.

Observed state family:

- RECEIVED
- PLANNED
- IN_PROGRESS
- VERIFYING
- AWAITING_AUTHORIZATION
- READY
- EXECUTED
- OBSERVING
- CLOSED
- BLOCKED
- CANCELLED

Important existing strengths:

- append-only event ledger
- hash-linked event chain
- expected-head optimistic concurrency
- duplicate event-id detection
- explicit transition map
- closure evidence requirement
- REOBSERVED revision-change semantics
- fail-closed invalid history

Decision:

**Preserve as current domain authority during D v1. Do not promote these status strings as company-wide states.**

### 1.2 Durable order/work coordination

Existing implementation:

- `src/integration/durable-order-work-sandbox.mjs`
- `docs/integration/DURABLE_COORDINATION.md`

Important strengths:

- immutable command/payload identity
- order requirement revision binding
- outbox/ledger reconciliation
- full-payload matching rather than event-id-only matching
- sticky HOLD after ambiguous failure
- explicit head revalidation
- lost append response -> re-read authoritative ledger, never blind replay
- coordination history separated from canonical business-state ledger

Decision:

Extract duplicate/retry/reconciliation semantics into D primitives, but **do not treat PREPARED/OBSERVED coordination states as business lifecycle states**.

### 1.3 Execution receipt

Existing implementation:

- `src/engine/execution-receipt.mjs`

Observed result semantics:

- SUCCEEDED
- HOLD
- FAILED
- unreadable/missing/ambiguous/non-terminal -> HOLD

Decision:

Treat this as **execution evidence/result interpretation**, not a generic workflow state machine. D transitions may consume verified receipt evidence.

### 1.4 Control Tower / projections

Existing structures:

- `contracts/control-tower.schema.json`
- `docs/CONTROL_TOWER.md`
- `scripts/derive-control-snapshot.mjs`
- `scripts/run-control-tower.mjs`

Decision:

Control Tower projection is an operational read/evaluation layer. Workflow meaning remains D-owned; current projection must not become a second mutable workflow authority.

### 1.5 Order intake

`WORK_READ_FIRST.md` already establishes:

- OrderStore is intake/requirement record.
- Work Ledger is business-state authority.
- work-intake writes immutable binding/outbox and RECEIVED history.
- intake does not grant execution/completion authority.

Decision:

D keeps that boundary. CRUD/intake record mutation and workflow state transition remain separate concepts.

## 2. Cross-project evidence imported from A session

Revision-bound A-session evidence used by D:

- `6bf646778baf177de3583e943997435447976b67`
  - workflow/state-machine cross-repo findings
- `6aa2a5e70775a8f312a7d50ee71f364ee2613441`
  - promotion candidate classification
- `42674d126d85296b4ddbe6a3ae6a02190da51275`
  - cross-project contract evidence promotion
- `444066bea9ac00e4cf4ba539c7b5344154bd407e`
  - hold/resume evidence promotion

Cross-project verified candidates adopted by D v1:

- fact vs state
- multi-axis state
- guard vs evidence
- launch/human-report vs verified completion
- idempotent transition
- append-only history
- current projection vs history
- hold/resume

Still PILOT:

- open/close obligation pair

## 3. Structural gaps before D v1

Before this branch, AI Core had good workflow behavior but no single common machine-readable workflow contract covering:

- reusable orthogonal state axes
- generic transition schema
- transition-level command/event mapping
- guard/evidence separation
- reusable approval policy
- reusable retry/failure policy
- timeout/SLA/escalation metadata
- manual override policy
- company-wide workflow primitive registry
- generic semantic workflow validator
- reusable state-transition engine
- standard UI action projection

The existing ledger therefore had stronger runtime semantics than the reusable common workflow layer.

## 4. D v1 implementation

Branch:

`work/gpt/workflow-standard-v1-20260919`

Added:

- `contracts/workflow.schema.json`
- `registry/workflows.json`
- `src/workflow/engine.mjs`
- `scripts/validate-workflows.mjs`
- `test/workflow-state-machine.test.mjs`
- `docs/workflow/WORKFLOW_CONSTITUTION.md`
- `docs/workflow/STATE_MACHINE_SPECIFICATION.md`
- `docs/workflow/MIGRATION_GUIDE.md`
- CI command `npm run workflow:validate`

## 5. Key D decisions

### Common primitive vs domain workflow

Common standard owns semantics such as HOLD, evidence, idempotency and audit.

Domain workflows own actual state names and transitions.

Therefore:

`접수 -> 계약완료 -> 인도완료 -> 계산서`

is never copied verbatim into the Core primitive set merely because one product uses it.

### UI boundary

B may render current state and available actions.

B does not own:

- valid from/to states
- guard truth
- approval rules
- retry rules
- state mutation

### C boundary

C owns API/Event/Error transport contracts.

D owns:

- business command meaning
- event semantic meaning
- transition meaning
- state-machine error reason codes

### External effects

The D engine returns effect descriptors. It does not claim an external action succeeded.

External success/failure must return through evidence/event/reconciliation.

### Duplicate and retry

Idempotency identity includes canonical command payload digest.

Same key + same intent replays prior result even if projection has already advanced.

Same key + changed intent conflicts.

A lost external response is not automatically retried until authoritative reconciliation determines whether the effect happened.

## 6. Migration risk and required next gate

The highest-risk change would be replacing `scripts/work-ledger.mjs` with the generic engine too early.

Required gate:

1. model exact Work Ledger behavior as SHADOW domain workflow
2. replay existing ledger regression suite
3. prove state/transition parity
4. prove REOBSERVED parity
5. prove hash-chain/evidence requirements remain intact
6. prove durable lost-response reconciliation remains intact
7. only then replace the hard-coded transition lookup

Until that gate passes:

**Existing Work Ledger remains canonical for AI Core Work business state.**

## 7. Concurrency note

A/B/C work is active in parallel. D uses a separate branch and primarily D-owned paths.

Shared files touched intentionally:

- `package.json` — validator command only
- `.github/workflows/main-state.yml` — validator CI gate only

These shared edits should be reconciled if another standard session modifies the same areas before merge.

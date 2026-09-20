# Workflow Migration Guide

## Goal

Move business state changes out of scattered UI handlers and if-statements into explicit AI Core workflow definitions without changing live behavior blindly.

## Phase 0 — inventory

For each project locate:

- stored status/state fields
- UI buttons that directly mutate them
- backend functions with state if/switch logic
- approval gates
- retries/timeouts
- scheduled automations
- external provider status maps
- audit/history collections
- correction/cancel/restore behavior

Classify every candidate as CRUD, fact capture, derived display state or business transition.

## Phase 1 — model, do not replace

Create a domain workflow in `registry/workflows.json` with `adoption_status=SHADOW`.

Model the **current actual behavior**, including ugly exceptions. Do not “clean up” semantics while discovering them.

Map:

- existing status -> axis/state
- existing action -> command + transition
- existing completion proof -> evidence
- existing role check -> transition permission/approval
- existing callbacks/webhooks -> event adapters
- existing retry/cron -> retry/automation
- existing log -> audit/event history

## Phase 2 — validator + shadow comparison

Run:

`npm run workflow:validate`

Then replay representative production-safe fixtures through the D engine and compare its allowed/rejected transitions against existing code.

Required negative tests:

- stale revision
- duplicate idempotency key
- same key/different intent
- invalid from-state
- missing permission
- missing/weak evidence
- missing approval
- separation-of-duties violation
- timeout/retry exhaustion
- partial-effect failure
- cancelled/final state mutation

## Phase 3 — engine authority

Only after shadow parity:

1. UI requests a command; it does not write state.
2. API/service calls D transition decision.
3. Accepted decision is persisted atomically with event/audit/outbox as appropriate.
4. Side effects execute outside the pure transition decision.
5. Verified result/failure returns as evidence/event.
6. Projection is rebuilt/reconciled from authoritative history where applicable.

## Phase 4 — remove duplicate workflow logic

Delete project-local transition maps only after:

- all consumers use the common contract
- migrations are reversible
- historical states are mapped
- provider adapters are pinned
- dashboards/queues use the new projection
- negative tests pass

Do not delete historical event/audit data.

## AI Core Work Ledger migration

Current authority remains `scripts/work-ledger.mjs`.

Specific sequence:

1. Encode the existing ledger transition map as `ai-core.work-lifecycle` SHADOW workflow.
2. Replay existing ledger tests against both implementations.
3. Preserve REOBSERVED revision semantics and hash-chain validation.
4. Preserve evidence-required closure.
5. Keep durable coordination's “lost response -> reconcile, never blind replay” rule.
6. Only then replace the hard-coded transition map with registry-backed lookup.
7. Run full `npm test`, ledger verification and main-state verifier.
8. Promote the domain workflow from SHADOW only after parity evidence is revision-bound.

## Project state example

A sequence such as:

`접수 -> 계약완료 -> 인도완료 -> 계산서`

must not be copied into Core as universal states.

Instead determine:

- which are facts
- which are lifecycle states
- whether finance/invoice is another axis
- which transitions need evidence
- who can execute/approve
- what happens on cancel/hold/failure
- which side effects are compensatable

Then register the domain machine.


## AI Core three-machine migration order

The second-pass audit found three different workflow classes that must not be collapsed.

### A. Order / Task coordination

Source: `src/orders/store.mjs`

Model separately:

- Order aggregate projection: NEW / ACTIVE / BLOCKED / REVIEW / CANCELLED
- Task lifecycle: PENDING / RUNNING / BLOCKED / REPORTED
- lease facts: token / owner / expiresAt / attempt
- requirement revision
- user-acceptance evidence

Do not treat heartbeat as a business transition. It extends a lease fact.

Before migration, resolve the current CLOSED compatibility state explicitly: the store guards it as terminal, while current tested close behavior intentionally remains REVIEW with USER_ACCEPTED_NOT_CANONICAL.

### B. Capability execution coordination

Source: `src/engine/capability-execution-coordinator.mjs`

Persistent coordination states:

- RESERVED
- RESULT

Reconciliation result statuses:

- SUCCEEDED
- FAILED
- HOLD

These states describe execution delivery/outcome observation. They do not own Work business lifecycle.

### C. Canonical Work lifecycle

Source: `scripts/work-ledger.mjs`

This remains the canonical AI Core Work business lifecycle.

Migration order:

1. model A and B as coordination/derived contracts without changing C authority
2. model C exactly as SHADOW
3. prove parity with existing Work Ledger revision/evidence rules
4. connect the three through Command/Event contracts
5. only then remove duplicated imperative transition logic

The target architecture is three explicit related machines, not one mega-state enum.


### Current D checkpoint

Completed:

- Work lifecycle state graph promoted to `ai-core.work-lifecycle` CANONICAL and consumed by Work Ledger
- REOBSERVE modeled explicitly without making it a global adopted primitive
- full Work Ledger state-pair parity regression implemented
- verification-context and closure edge cases covered
- Work lifecycle integration provenance pinned to exact source blobs
- OrderStore child-task lifecycle promoted to `ai-core.order-task-lifecycle` CANONICAL and consumed through D Engine
- claim/reclaim, blocked resume, assignment, report, block and parent-revision invalidation parity implemented
- heartbeat classified as lease FACT_UPDATE rather than business transition
- parent Order NEW/ACTIVE/BLOCKED/REVIEW projection reproduced as a derived aggregate
- Order Task integration provenance pinned to exact OrderStore blob

Completed additionally:

- Capability execution coordination promoted to `ai-core.capability-execution` CANONICAL and consumed through D Engine
- RESERVED/RESULT persistence separated from reconciliation HOLD projection
- reserve replay/conflict, safe RESULT persistence and terminal receipt reconciliation parity covered
- Capability Execution integration provenance pinned to exact coordinator/receipt-reader blobs
- cross-machine `workflow-bridges.json` registry added
- parent revision -> child invalidation bridge locked
- child task -> parent Order derived projection bridge locked
- Capability RESULT / reconciled RESULT -> Work evidence-feed-only bridges locked
- bridge semantic validator + negative tests + CI gate added

Current authority status:

- Work lifecycle state graph: CANONICAL in D Registry; every new Work Ledger append now requires D Workflow Engine admission, while Work Ledger retains append-only history/evidence enforcement
- Order Task lifecycle: CANONICAL in D Registry and D Engine authoritative for target state
- Capability Execution lifecycle: CANONICAL in D Registry and D Engine authoritative for RESERVED -> RESULT
- Workflow bridges: SHADOW until project-level bridge evidence and dispatch semantics mature

Still not completed:

- move remaining duplicated pre-validation/guard logic out of runtime if-branches where safe
- finish Work lifecycle migration from dual admission (D Engine + Ledger verifier) toward full generic D-engine decision execution without weakening Ledger evidence/hash/revision rules
- migrate business-project domain workflows into the Registry
- validate domain bridges across FreePass Sales / ERP / Admin / Self Quote and other projects


### Recovery no-replay pilot gate

`workflow.recovery-slot-no-replay` is PROJECT_VERIFIED from FreePass ERP4 and is intentionally PILOT.

Promotion gate:

1. C defines/binds the common logical execution identity shared across native/fallback/downstream paths.
2. A/D obtain an independent second-project implementation or failure case.
3. Native-success and recovery-history reconciliation are proven in that second project.
4. Ambiguous outcome remains HOLD/reconcile-first.
5. Negative tests prove successful logical work cannot be replayed by another execution path.

Until all gates pass, projects may adopt the pilot explicitly, but D must not claim it as company-wide common behavior.

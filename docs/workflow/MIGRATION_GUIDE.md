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

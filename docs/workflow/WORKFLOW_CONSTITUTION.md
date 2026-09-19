# Workflow Constitution

Status: **D SESSION CANONICAL STANDARD v1.0 — contract layer**

This document defines the ownership boundary and non-negotiable semantics of AI Core Workflow Standard.

## 1. Ownership

D owns the meaning of:

- State and orthogonal state axes
- State Machine and State Transition
- Transition Guard and completion Evidence
- Command-to-Event mapping
- Approval / Reject / Hold / Cancel / Fail / Retry / Resume
- Rollback / Compensation / Restore / Correction
- Timeout / SLA / Escalation
- Automation and Manual Override
- Workflow Audit Trail

C owns transport/API/event/error envelopes. D uses those envelopes but owns the **business meaning** of state and transition.

B receives a read contract: current state, available actions, eligibility and reasons. UI never invents workflow rules.

A supplies revision-bound evidence. A does not declare D canonical rules.

## 2. Constitutional rules

1. A button does not define a workflow. The State Machine exists before UI.
2. Project code must not invent shared status strings when an adopted primitive or domain machine exists.
3. CRUD is not a business transition. Updating a memo is CRUD; approving, cancelling or delivering is a transition.
4. Command is intent. Event is a fact that occurred. They are never aliases.
5. Automation and manual work use the same transition contract.
6. Retry, duplicate delivery, timeout and partial failure are normal design cases.
7. Exception handling is explicit workflow, not scattered catch/if logic.
8. Every accepted transition emits an auditable result containing who, when, why, from, to and revision.
9. Facts, authoritative state, derived state and display state are separate.
10. Current projection and append-only history are separate and reconcilable.
11. Guards answer “may this start?” Evidence answers “what actually happened?”
12. Human report and system/external verification are different evidence levels.
13. Hold is open work, not completion. Deferred work carries a resume condition/time.
14. Cancellation is not deletion. Correction and restore append history.
15. State transition is bound to an expected revision; stale writers fail closed.
16. Same idempotency key + same intent replays the prior result. Same key + different intent conflicts.
17. External provider states are adapted before entering the domain machine.
18. Multi-aggregate effects declare transaction/outbox/compensation/reconciliation semantics.
19. Manual override never bypasses concurrency, idempotency or audit, and may bypass only explicitly listed guards/evidence.
20. Common primitives and domain workflows are distinct. A project state sequence is not automatically a company-wide state sequence.

## 3. Adopted primitives

The machine-readable authority is `registry/workflows.json`.

Immediately adopted because they are cross-project verified:

- fact vs state vs derived/display state
- multi-axis state
- guard vs evidence
- launch/human report vs verified completion
- idempotent transition
- append-only history
- current projection vs history
- hold/resume

`open-close obligation` is supported but remains PILOT until a second independent domain verifies it.

## 4. Existing AI Core compatibility

The existing `scripts/work-ledger.mjs` remains the current authority for the AI Core Work Ledger lifecycle during migration. Its hard-coded states are **domain states**, not global primitives.

D v1 extracts its strongest properties into reusable contracts:

- optimistic head/revision check
- append-only chained history
- evidence-required closure
- fail-closed invalid history
- explicit BLOCKED/HOLD semantics
- durable reconciliation instead of blind replay

The generic workflow engine does not silently replace the ledger in this checkpoint.

## 5. Runtime rule

A transition decision is pure domain work:

`projection + command + context + expected revision -> accepted decision OR stable failure code`.

External side effects are returned as declared effect descriptors. The workflow engine does not pretend that an external effect succeeded. A runner/outbox/adapter executes effects, then supplies verified evidence or a failure result back into the workflow.

## 6. Audit minimum

Every accepted transition records at least:

- workflow/version
- entity
- axis
- transition
- command
- event type/event occurrence id
- from/to
- actor
- reason when required
- occurred/recorded time
- expected/resulting revision
- idempotency/request id
- evidence refs
- approval actors
- manual override use

The audit record is append-only. Corrections are new records.

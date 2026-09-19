# L4 — Workflow / State Standard

## Mission
Standardize how business work moves, fails, retries, pauses and completes.

## Scope
- state machine definition format
- allowed transitions
- transition guards
- actor/authority requirements
- command vs event distinction
- draft/pending/active/hold/completed/cancelled/failed semantics
- retryable vs terminal failure
- timeout/expiry
- idempotent transition handling
- compensation/rollback policy
- reopen/recovery
- history/audit projection
- human approval and review states
- external side-effect boundary

## Key principle
UI labels may differ by product; transition semantics may not silently differ when the same canonical workflow is claimed.

## Inputs
- Order / Work / Control Tower runtime
- sales call/contact flow
- application/contract/delivery/invoice flows
- estimate lifecycle
- penalty-processing lifecycle

## Required artifacts
- canonical state-machine contract
- transition table template
- workflow registry
- conformance tests
- migration guidance for legacy status values

## Definition of done
For each adopted workflow, the current state plus event history is sufficient to determine which transitions are legal, who may execute them and whether replay is safe.

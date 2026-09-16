# AI Core Control Tower

The control tower is a decision surface over authoritative systems. It keeps revision-bound pointers and current observations; it does not copy project, operational, document or business SSOTs into AI Core.

For each work item it derives whether the system may prepare, execute or close. Every disabled action includes deterministic reasons. The evaluator never grants authority and always returns `execution_authorized: false`.

`confirmed intent → current observations → accepted commitment → satisfied dependencies → available capacity → authority when required → verification → confirmed execution → observed outcome`

## Precision rules

- AI-inferred intent cannot become controlling intent.
- Every source observation has a revision, observation time and validity window.
- Critical and material source drift blocks execution. Advisory drift is reported as a warning.
- A structurally or semantically invalid snapshot disables every state-changing action.
- An active commitment needs acceptance, owner and due time.
- Unsatisfied dependencies and overlapping allocations block execution.
- Authorization is independent from readiness and is bound to action, target, revision, scope, issuer and validity window.
- Closure requires revision-bound verification, execution and outcome receipts; state labels alone are insufficient.
- A snapshot is an observation input; this evaluator does not monitor providers itself.

## Run

```powershell
npm run control:evaluate -- examples/control-tower.json
```

`scripts/run-control-tower.mjs` composes the registry, snapshot and append-only ledger. Execution readiness is held when the project is absent/inactive, the project or work revision is stale, the work revision is absent, the work is absent, or its ledger state is not `READY`. A `READY` ledger without a subject revision is held rather than accepted; an unspecified revision cannot carry an execution decision. A ledger carrying observations later than the snapshot `as_of` holds both execution and closure for the affected work, because that snapshot cannot represent the state at that time. The boundary is strict, so an observation equal to `as_of` remains valid, and the hold is isolated per `work_id`.

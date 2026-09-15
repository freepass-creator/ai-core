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
- Authorization is independent from readiness.
- Closure requires verification PASS, confirmed execution and observed success.
- A snapshot is an observation input; this evaluator does not monitor providers itself.

## Run

```powershell
npm run control:evaluate -- examples/control-tower.json
```

# A Session Routing Receipt Registry v1

Status: **RESEARCH ROUTING CONTROL / NOT CANONICAL**

The A Evidence Registry answers **what A found**. The Routing Receipt Registry answers **what happened after A routed it to B, C or D**.

## Closed-loop states

- `SENT` — A recorded the route; no finding-specific receiver evidence exists yet.
- `RECEIVED` — the target session explicitly acknowledged the finding at an exact AI Core revision.
- `UNDER_REVIEW` — the target session is actively evaluating it with revision-bound evidence.
- `CLOSED` — the target session made an explicit decision.

A CLOSED route must record one outcome:

- `ADOPTED`
- `HOLD`
- `REJECTED`
- `SUPERSEDED`

and A must record the feedback back into its own research state.

## Fail-closed rules

Every `finding.routes[]` entry must have exactly one receipt. A route may not be marked RECEIVED/UNDER_REVIEW/CLOSED without exact receiver revision evidence. A route may not be CLOSED without an explicit receiver decision and A feedback.

Adjacent canonical work is not enough to infer receipt. Existing A routes without finding-specific receiver evidence are deliberately initialized as SENT.

## Boundary

Routing receipts do not grant canonical authority. B/C/D remain the only owners of their canonical standards. A only records delivery, receiver evidence, decision and feedback.

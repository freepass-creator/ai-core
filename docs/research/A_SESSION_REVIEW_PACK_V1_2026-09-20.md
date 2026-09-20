# A Session Review Queue / Evidence Pack v1

Status: **DERIVED REVIEW SUPPORT / NOT CANONICAL**

Receiver Intake proves that B/C/D received A's routed findings. Review Pack v1 removes the next manual burden: collecting the evidence needed to decide each route.

## What is generated

A separate derived queue is generated for each receiver:

- `a-session-review-queue-B.v1.json`
- `a-session-review-queue-C.v1.json`
- `a-session-review-queue-D.v1.json`

Each pack contains:

- finding classification and evidence maturity;
- exact source revisions and evidence types;
- migration impact and verification needs when Core > Project;
- difference reason when classification is Different;
- current receiver acknowledgement/review/decision snapshot;
- route priority when present;
- receiver-specific review questions;
- explicit authority boundary.

## Queue states

- SENT -> WAITING_ACK
- RECEIVED -> READY_FOR_REVIEW
- UNDER_REVIEW -> IN_REVIEW
- CLOSED -> RESOLVED

Resolved routes stay in the generated queue as immutable decision history rather than disappearing.

## Non-authority rule

The generator cannot:

- write REVIEWING;
- write DECIDED;
- choose ADOPTED / HOLD / REJECTED / SUPERSEDED;
- change an Evidence classification;
- change B/C/D canonical standards.

It only assembles source evidence into a receiver-facing pack.

## Drift gate

`npm run a:review:check` rebuilds the queues in memory from the current Evidence Registry, Routing Receipts and Receiver Inboxes and compares them with the tracked generated files.

If a source finding, route, acknowledgement, review or decision changes without regenerating the review queue, CI fails.

`npm run a:review:build` regenerates all three derived queues.

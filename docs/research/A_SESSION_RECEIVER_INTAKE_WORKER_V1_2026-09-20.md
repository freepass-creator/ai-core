# A Session Receiver Intake Worker v1

Status: **COORDINATION AUTOMATION / NOT CANONICAL**

Receiver Inbox v1 separated receiver-side evidence from A's routing claims. Intake Worker v1 automates only the safe mechanical part of that loop.

## What the worker may do

For a route delivered to B, C or D:

1. ensure the route exists in the target inbox;
2. read the PENDING item;
3. bind that acknowledgement to an exact AI Core revision and observation time;
4. move the inbox item to ACKNOWLEDGED;
5. reconcile A's central Routing Receipt from SENT to RECEIVED with the same evidence.

ACKNOWLEDGED means only **the receiver intake process has read and bound the delivery**.

It does not mean the target session agrees with A's classification or recommendation.

## What the worker may never do

The worker is hard-locked against:

- automatic REVIEWING;
- automatic DECIDED;
- automatic ADOPTED;
- automatic HOLD;
- automatic REJECTED;
- automatic SUPERSEDED;
- any B/C/D canonical standard mutation.

Substantive review and decision still require explicit session evidence.

## Commands

Dry-run/check whether intake work remains:

`npm run a:receiver:intake:check`

Apply all mechanical acknowledgements:

`node scripts/a-session-receiver-worker.mjs --all --write --revision <40-hex-ai-core-sha> --at <ISO-8601>`

A single session can be processed with `--session B|C|D`.

## Why this is safe

The worker reuses the existing receiver inbox sync and A routing reconciliation engines. It cannot create a route that A did not already record, and it cannot make a substantive receiver decision. The central A receipt is allowed to advance only to RECEIVED from a worker acknowledgement.

This removes the manual “C세션 이거 봐” delivery acknowledgement step without manufacturing agreement.

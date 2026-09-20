# A Session Receiver Inbox + Acknowledgement v1

Status: **CROSS-SESSION COORDINATION / NOT CANONICAL**

A already records what it found and where it routed the finding. Receiver Inbox v1 adds the missing receiver side without giving A authority over B/C/D.

## Separate inboxes

Each target session owns a separate coordination file:

- `a-session-receiver-inbox-B.v1.json`
- `a-session-receiver-inbox-C.v1.json`
- `a-session-receiver-inbox-D.v1.json`

This avoids one shared hot file when B/C/D work in parallel.

## Receiver states

`PENDING → ACKNOWLEDGED → REVIEWING → DECIDED`

A session may also move from ACKNOWLEDGED directly to DECIDED when no separate review phase is needed.

Receiver evidence is revision-bound:

- ACKNOWLEDGED requires session + exact AI Core revision + observed time + evidence refs.
- REVIEWING additionally requires review revision, start time, evidence refs and note.
- DECIDED requires outcome, exact decision revision, time, evidence refs and reason.

Decision outcomes are:

- ADOPTED
- HOLD
- REJECTED
- SUPERSEDED

## Asynchronous rule

The receiver inbox is allowed to be ahead of A's central Routing Receipt. This is intentional: B/C/D can acknowledge or decide without also editing A's central file.

The opposite is forbidden. A's central receipt may never claim RECEIVED/UNDER_REVIEW/CLOSED before the receiver inbox contains enough evidence.

## Sync + reconcile

`sync-a-session-receiver-inboxes.mjs`

- seeds newly routed findings into the correct receiver inbox;
- preserves prior receiver history;
- refuses to silently delete orphaned history.

`reconcile-a-session-routing.mjs`

- imports receiver progress back into A's central Routing Receipt;
- ACKNOWLEDGED → RECEIVED;
- REVIEWING → UNDER_REVIEW;
- DECIDED → CLOSED;
- copies exact receiver revision/evidence;
- records A feedback without automatically changing the Evidence Registry's substantive classification.

The Evidence Registry remains separately reviewable because a receiver decision does not always mean the underlying project gap is fixed.

## Boundary

These inboxes are coordination evidence only. They do not modify B, C or D canonical standards. A records and reconciles their explicit decisions; it does not manufacture them.

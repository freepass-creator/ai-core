# A Session Review Allocator v1

Status: **RESEARCH COORDINATION / NOT CANONICAL**

Review Pack v1 prepares the evidence. Review Allocator v1 decides only **who reviews which READY item next**.

It does not decide the finding.

## Reuse of the existing claim protocol

The allocator does not create a second lease system.

Each review claim uses the existing A work-claim registry:

- repository: `freepass-creator/ai-core`
- subject revision: the review item's deterministic 40-hex `review_revision`
- scope: `review/<route_id>`
- owner: the B/C/D review session
- lease / heartbeat / stale reaper: existing A claim machinery

`review_revision` is a coordination fingerprint of the derived evidence pack. It is not source proof and is not a Git revision. If the review evidence changes, the fingerprint changes and the old completed claim does not suppress a genuinely new review.

## Priority order

Only `READY_FOR_REVIEW` items are candidates.

Default scoring favors:

1. Core > Project migration/backport gaps;
2. Project > Core reusable candidates;
3. Different research items.

Additional weight is given to:

- stronger evidence maturity;
- PRIMARY route ownership;
- number of breaking impacts;
- number of verification requirements.

Tie-break:

1. higher score;
2. older receiver acknowledgement;
3. route id.

The weights live in `a-session-review-allocation-policy.v1.json`.

## Commands

Local invariant check:

`npm run a:review:allocator:check`

Preview a receiver's ranked queue without claiming:

`node scripts/a-session-review-next.mjs --session C --owner C-review --dry-run`

Claim the next available item:

`node scripts/a-session-review-next.mjs --session C --owner C-review`

B, C and D can run independently and safely in parallel.

## Stale guard

After a claim is acquired, the allocator re-reads the receiver queue.

If the route is no longer READY or `review_revision` changed, the claim is immediately SUPERSEDED and allocation continues.

## Authority boundary

Allocation is ownership only.

It cannot write:

- REVIEWING;
- DECIDED;
- ADOPTED;
- HOLD;
- REJECTED;
- SUPERSEDED receiver decisions;
- B/C/D canonical standards.

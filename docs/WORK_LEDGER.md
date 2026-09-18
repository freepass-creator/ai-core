# Work Ledger

The work ledger is an append-only local JSONL record for control-tower state changes. Each event includes its prior hash and its own content hash. A writer must provide the head it read; a changed head or an active lock rejects the append instead of overwriting another worker.

State flow:

`RECEIVED → PLANNED → IN_PROGRESS → VERIFYING → AWAITING_AUTHORIZATION/READY → EXECUTED → OBSERVING → CLOSED`

Blocking, resuming and cancellation use explicit events. Closing requires a subject revision and evidence reference. The ledger records coordination state; it does not grant authority or prove that an evidence reference is authentic.

```powershell
node scripts/work-ledger.mjs verify ledger.jsonl
node scripts/work-ledger.mjs append ledger.jsonl event.json <expected-head-or-null>
```

## Where the operating ledger lives

`<the order store's directory>/work-ledger.jsonl` — beside the order database, not
at an independently chosen path. The order record and the ledger event must come
from the same deployment; if they do not, they still compose into a projection
that looks coherent and is about nothing. Anchoring the ledger to the database's
own directory makes that mismatch impossible to configure by accident.

So `orders.connection.json`'s `workSources` does **not** need a `ledger` entry.
`npm run orders:sources` prints the resolved path. An explicit entry still wins.

The default location sits under `.local/`, which is gitignored, and that is also
correct: the ledger is append-only operating data. Committing it would put work
history into git and make every parallel session conflict on the same lines.

★`verify` on a path with no file answers `MISSING` / `LEDGER_FILE_MISSING` and
exits 1 — **a ledger that is not there is not an empty ledger.** Until 2026-09-17
it read the absent file as `''` and answered `VALID`, so any path at all, a typo
included, came back green. An empty file is still `VALID`; that part istrue and unchanged.

## `REOBSERVED` — the subject moved, the work follows with evidence (2026-09-18)

A work item is observed against one subject revision. The subject does not wait:
on 2026-09-18 aiops landed 7 commits and freepasserp4 204 in a day. Until then a
work item could follow only by changing state, and an order↔work binding — which is
immutable and made once — went `SUBJECT_REVISION_STALE` for good on the first commit.

`REOBSERVED` carries a work item to a new revision **without moving it**:

- `from_state` = `to_state` = the current state; a new, different 40-hex `subject_revision`
- `evidence_refs` required (the recorder uses `work:observe`'s measured compare)
- only in `RECEIVED` / `PLANNED` / `IN_PROGRESS` — a verified or authorized item must
  not ride onto code nobody verified; that path stays `BLOCKED → VERIFYING`
- `verify` now also returns `work[id].revisions` — every revision the item was observed at

The projection adapter then checks two things instead of one: registry head,
snapshot and ledger agree on the **current** revision, and the binding's revision is
in the item's own `revisions`. A **new** binding must still be made at the current
revision. The binding itself is untouched — it pins identity, not a revision forever.

```
npm run work:observe                              measure what landed
npm run work:reobserve                            show what would be written (default)
npm run work:reobserve -- --work <ID> --write     append REOBSERVED
npm run control:snapshot                          the snapshot follows the ledger
```

★Readers older than this change reject a ledger that contains `REOBSERVED`
(`EVENT_SCHEMA_INVALID`). Do not append one to an operating ledger until every
reader of that ledger runs this version.

## The verified revision is frozen (2026-09-18)

Every event carries its own `subject_revision`, and until 2026-09-18 the verifier
never compared it with the previous one. `VERIFYING(A) → READY(B) → EXECUTED(C)`
was `VALID`, so the ledger could not tell that the code executed was not the code
verified. `REOBSERVED` stops before `VERIFYING` so it does not widen this. The plain
transitions stayed open.

The rule: **the revision an item enters `VERIFYING` at binds every later step**
until the item re-enters `VERIFYING` or goes back to `RECEIVED` / `PLANNED` /
`IN_PROGRESS`.

- Any event from a verified item into `AWAITING_AUTHORIZATION`, `READY`, `EXECUTED`,
  `OBSERVING`, `CLOSED`, `BLOCKED` or `CANCELLED` must carry that same revision, or it
  fails with `REVISION_CHANGED_AFTER_VERIFICATION`. A `null` revision is a change too.
- The check applies to every event type, not only `TRANSITIONED`. The verifier does
  not tie `type` to the state move, so a check on `TRANSITIONED` alone could be
  bypassed by labelling the same move `RESUMED`.
- `BLOCKED` keeps the verified revision, so `READY(A) → BLOCKED(B) → READY(B)` is
  closed at its first step.
- An item that was never verified cannot reach `AWAITING_AUTHORIZATION` / `READY` /
  `OBSERVING` through `BLOCKED`: `VERIFICATION_SKIPPED`. Before this, `IN_PROGRESS(A) →
  BLOCKED(B) → READY(B)` put READY on a revision nobody verified. Going back to
  `IN_PROGRESS` voids an earlier verification, even at the same revision.

There are two ways to change the revision: re-verify (`BLOCKED → VERIFYING` at the new
revision), or void the verification (`VERIFYING → IN_PROGRESS`), carry the item with
`REOBSERVED` and its evidence, and verify again. Steps before verification are outside this rule.
Revisions may still move there without evidence. The operating ledger's
`RECEIVED(null) → PLANNED(c72e…)` is one such move and stays `VALID`.

The frozen revision is internal to `verify`. Its output shape is unchanged. A writer
must pass the same `subject_revision` on each step after verification. `work-recorder`
defaults an omitted revision to `null`, so it rejects such a step with this code before
anything is written.

Known limit: the revision after `EXECUTED` is the verified one, not a merge commit
the execution produced. A landed commit belongs in `evidence_refs`.

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


## Revision continuity — 2026-09-19

새로 쓰는 사건에서 `subject_revision`을 바꾸는 유일한 경로는 `REOBSERVED`다.

- 일반 상태 전이는 직전 `subject_revision`을 그대로 유지해야 한다.
- 새 revision을 관측하려면 상태를 `RECEIVED / PLANNED / IN_PROGRESS` 중 하나에 둔 채 `REOBSERVED + evidence_refs`를 기록한다.
- `VERIFYING`에 들어간 뒤에는 그 revision이 READY/EXECUTED/OBSERVING/CLOSED 경로를 묶는다.
- 검증 뒤 revision을 바꾸려면 IN_PROGRESS로 돌아가 기존 검증을 버리고, REOBSERVED로 새 revision을 증거와 함께 기록한 뒤 다시 VERIFYING한다.
- 과거 원장에 존재하는 일반 전이 기반 revision 부착은 읽기 호환을 위해 INVALID로 만들지 않지만, `revisions` 증거 이력에는 넣지 않는다. 따라서 새 binding provenance로 사용할 수 없다.

이 경계는 기존 원장을 다시 쓰거나 수정하지 않는다.

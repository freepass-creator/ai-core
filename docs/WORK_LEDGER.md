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

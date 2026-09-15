# Work Ledger

The work ledger is an append-only local JSONL record for control-tower state changes. Each event includes its prior hash and its own content hash. A writer must provide the head it read; a changed head or an active lock rejects the append instead of overwriting another worker.

State flow:

`RECEIVED → PLANNED → IN_PROGRESS → VERIFYING → AWAITING_AUTHORIZATION/READY → EXECUTED → OBSERVING → CLOSED`

Blocking, resuming and cancellation use explicit events. Closing requires a subject revision and evidence reference. The ledger records coordination state; it does not grant authority or prove that an evidence reference is authentic.

```powershell
node scripts/work-ledger.mjs verify ledger.jsonl
node scripts/work-ledger.mjs append ledger.jsonl event.json <expected-head-or-null>
```

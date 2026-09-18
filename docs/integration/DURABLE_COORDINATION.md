# Durable coordination laboratory

Status: isolated synthetic implementation; production activation HOLD. No real database, ledger, account, deployment or external executor is connected.

## Contract

`openDurableOrderWorkSandbox({registry, asOf})` creates an OS temporary `ai-core-durable-*` directory. Reopen accepts only an existing direct child of that temporary directory with its coordination database present. Missing history, invalid ledger and observed events that disappear fail closed. This is a laboratory path restriction, not protection against a hostile process with the same filesystem privileges.

The original JSONL ledger remains the only canonical business-state history. SQLite `coordination_commands`, `coordination_bindings` and append-only `coordination_history` contain transport and identity metadata, not a parallel READY/completion state machine. SQL triggers preserve mapping and semantic command history.

- `prepare(payload)` binds command ID to canonical JSON SHA-256 of its complete payload. The existing OrderStore transaction saves the order, receipt, intake event, immutable requirement mapping and outbox together. The optional synchronous `onRequirementSaved` hook defaults to unused and performs no external I/O. Failed hooks roll back all six records.
- Every changed requirement gets a new work ID and a new CREATED → RECEIVED event. Old mappings remain immutable. Notes only change the current intake record version.
- `PREPARED_NOT_SENT` means coordination persisted; it does not mean the captured ledger head remains current. Head capture is optimistic and may become stale before commit. Dispatch checks again.
- `flush(commandId)` uses the original append function and expected head. A SQLite writer lock spans the worker's local ledger read/append to prevent a concurrent requirement revision from passing the active-binding check. This bounded laboratory I/O can block other writers; it is not a production throughput design. The save hook itself does not hold external I/O.
- `reconcile(commandId)` verifies the ledger and matches the full canonical event payload, excluding only the original ledger's previous/event hash fields. Event ID alone is insufficient. A lost append response is re-read, never blindly replayed.
- HOLD is sticky for dispatch. `revalidateHead(commandId, expectedHead)` explicitly checks current requirement digest, project revision, exact ledger head and absent event/work before preparing another attempt. Semantic command/event digests remain immutable; the audited attempt head is a mutable precondition.
- `readWorkProjection` uses original adapter/evaluator functions and fresh order/ledger observations. All receipts deny execution/completion authority. There is no external execution API or automatic retry of unobserved external effects.

## Reproducible evidence

`node --test test/durable-order-work.test.mjs` covers 18 cases using original storage/ledger functions. Six real child-process exits test before SQLite commit, after commit, before append, after append, before observation save and after observation save. Reopen plus repeated dispatch yields one canonical event. Two simultaneous processes test duplicate intake/dispatch. Other cases cover supersession races, full-payload collisions, immutable history, transaction rollback, missing database/history, partial JSON, orphan locks and explicit head revalidation. Locks and damaged ledgers are not automatically removed or repaired.

## Independent review and disposition

Checkpoint verification: full `npm test` passed 290/290, failed 0, skipped 0. Main-state verifier, module syntax check and diff whitespace check passed. The transaction preflight regression asserts the original `OrderError.code`, not its localized message. Existing UI was not changed in this stage; earlier browser evidence remains scoped to its prior checkpoint.

CI follow-up: a simultaneous-process test exposed a transient read-only SQLite probe failure while another process opened the same initialized database. Reopen now retries only errors explicitly reported as locked/busy, with eight bounded attempts; a genuinely missing database/table or any other error still fails closed as `COORDINATION_HISTORY_MISSING`. The race test passed 12 consecutive focused repetitions after the change. This improves laboratory determinism and does not enable production use.

Risk: high, because this changes a storage boundary. Cursor independently reviewed the design and source. Agreement: atomic mapping/outbox, full payload reconciliation, immutable identity, sticky HOLD and real process tests are necessary. Its ambiguous `persisted` receipt concern was addressed as `coordination_persisted` with a next action.

The suggested concerns about a stale head at prepare and explicit recovery are retained as documented optimistic-concurrency behavior, not silently retried. Creating a new RECEIVED work on revision is the approved requirement, not a same-work revision bug. Original-function tests supply evidence that the in-process pending callback is not the durability mechanism and that append adds only the two hash fields excluded from payload comparison.

Claude's actual invocation failed on its weekly usage limit. Gemini's actual invocation failed because this worktree is untrusted; no trust bypass was used. Neither counts as a passing review. Two successful independent high-risk reviews have not been obtained. Production readiness is therefore unverified, even with passing synthetic tests. Live registry refresh, hostile filesystem races, migrations, operator authorization and actual external-effect recovery remain outside this checkpoint.

## Next single action

Obtain the missing independent source review against this exact checkpoint before considering any production design. Continue only read-only review or explicitly authorized temporary-fixture work; real connection/migration requires a separately verified target, recovery plan and user approval.


## Controlled operating wiring — 2026-09-18

The durable submitter now has two explicit path policies instead of a laboratory-only hard-code:

- `synthetic` remains the default and preserves the existing OS-temp containment tests.
- `trusted` accepts a real configured root only when the caller explicitly selects that mode. A new trusted outbox is never created by merely naming a directory; first creation requires `initialize:true`.
- `openOperatingOrderWorkSubmitter()` does not invent paths. It resolves the canonical ledger from the same `workSources`/orders DB convention used by the live work projection and places `submission.sqlite` beside that ledger.
- An immutable absolute `submission_location_binding` records both root and ledger path. Reopening against another path fails closed even when the ledger basename matches.
- The operating factory defaults to `enabled:false`. This change adds an operating-capable code path; it does **not** activate or migrate the current service.

Existing digest-bound commands, event uniqueness, reconcile-after-lost-response, sticky HOLD, expected-head revalidation and crash/restart behavior are reused unchanged. Production activation remains a separate operational decision and still requires an independent review of this new trusted-path change plus an observed recovery/preflight on the actual configured files.

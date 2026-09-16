# Order-to-projection demo: what it proves, and what it does not

`scripts/demo-order-to-projection.mjs` is a small, runnable, read-only script
written in response to a review comment on PR #29: that this integration
effort had so far proven folder/registry/test *counts*, but not one real,
working, natural-language-request -> canonical-record -> processing ->
verification -> result round trip.

Run it with:

```
node scripts/demo-order-to-projection.mjs
```

## What it does

It takes one hardcoded Korean natural-language order request and walks it
through four already-real, already-tested pieces of this repository, calling
only their real exported functions — it adds no new canonical logic of its
own:

1. **INTENT** — `normalizeOrderIntent` (`src/intake/normalize-order-intent.mjs`)
   validates the raw request's structure and evidence spans and returns a
   structured, unauthorized intent (`execution_authorized: false`).
2. **FIXTURE** — builds a throwaway `registry/projects.json`-shaped object
   (one `ACTIVE` project) and a temporary work ledger containing one real
   `CREATED` (`RECEIVED`-state) event, written with the real
   `appendLedgerEvent` (`scripts/work-ledger.mjs`) so the hash chain is
   genuinely valid — not hand-written JSONL. Both are verified with the real
   `verifyLedgerText`.
3. **MAPPING** — wires a `{ order_id, requirement_revision, record_version,
   work_id, project_id, subject_revision }` mapping connecting the normalized
   intent to that fixture work item.
4. **PROJECTION** — calls the real `createOrderWorkAdapter(...).readWorkProjection(orderId)`
   (`src/integration/order-work-adapter.mjs`) against that fixture and prints
   the actual returned projection: `status`, `canonical_state`,
   `control_status`, `control_result`, and the authorization flags. The
   adapter internally re-runs the real `runControlTower`
   (`scripts/run-control-tower.mjs`), which re-validates the registry, the
   ledger, and the control-tower snapshot from scratch.

Everything is confined to a single `os.tmpdir()` `mkdtemp()` root, created
and removed by the script itself. No real `.local` DB, no real ledger path,
no network access, no persistence outside that temp root — matching the
safety posture of the existing disposable
`src/integration/order-intake-sandbox.mjs` laboratory that this demo borrowed
its wiring shape from (without promoting it to a production connector).

## Observed result of a real run

For the hardcoded fixture, the real adapter returns:

```
status: LINKED
canonical_state: RECEIVED
control_status: HOLD
execution_authorized: false
completion_authorized: false
```

`LINKED` means the adapter's own validation chain (mapping shape, ledger
chain validity, project ACTIVE, subject-revision agreement across project /
work item / ledger event, and a control-tower re-evaluation) all passed for
this fixture. `control_status: HOLD` is expected and correct: the fixture
work item is deliberately left at `RECEIVED` (not carried through
`PLANNED -> IN_PROGRESS -> VERIFYING -> READY`), and the control tower
correctly reports it as not execute-eligible
(`WORK_STATE_RECEIVED`, `AUTHORIZATION_REQUIRED`, etc.). The adapter never
sets `execution_authorized` or `completion_authorized` to `true` regardless
of ledger state — that is enforced by the real adapter code, not by this
script.

## What this does NOT prove

- **Not a production connector.** The `readContext` closure inside the demo
  is a literal in-memory function returning the exact fixture just built. No
  coordinator, order store, durable mapping persistence, or outbox is
  involved. `src/integration/order-work-adapter.mjs` explicitly documents
  that its dependencies are "trusted application wiring, never
  request-supplied functions" — this demo satisfies that by construction,
  not by exercising a real caller.
- **Not real intake.** The natural-language request is hardcoded in the
  script, not received from a user, chat, or document pipeline. No
  conversation ingestion, no live source of `message_id`/`origin` is
  involved.
- **Not authentication, authorization, or execution.** Every status printed
  keeps `execution_authorized: false` and `completion_authorized: false`.
  Nothing is submitted, sent, or claims completion. `prepareWorkCommand` /
  `submitWorkCommand` (the next step toward an actual review request) are
  not exercised by this demo at all.
- **Not a durable or canonical ledger.** The ledger file lives only inside
  the temp root for the duration of the script and is deleted immediately
  afterward. It is never the project's real `work-ledger` file.
- **Not evidence that `READY`/execution-eligible work behaves correctly.**
  This fixture intentionally stops at `RECEIVED` to keep the demo minimal
  and honestly labeled; `test/order-work-adapter.test.mjs`'s
  "real-contract integration" tests already carry a fixture through to
  `READY` and exercise `prepareWorkCommand` against the real ledger/control
  tower — this demo does not duplicate that coverage, it demonstrates the
  wiring shape end to end in one readable, runnable script.

In short: this proves the *contract shape* between intake normalization, the
order-work adapter, the work ledger, and the control tower actually fits
together for one real request, using only real functions. It does not prove
that a real user, a real coordinator, or a real production ledger is
connected to anything.

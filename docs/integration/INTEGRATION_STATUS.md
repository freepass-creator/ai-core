# Order/control integration — synthetic verification boundary

Status: synthetic integration implemented; durable mapping/outbox and production activation HOLD.

## Pinned inputs and ownership

- Dedicated checkout: `C:/Users/admin/.codex/worktrees/1e61/ai-core`, branch `codex/order-control-integration`. Initial tree clean, detached at `8c61a6c`; available RAM about 6.2 GiB of 31.7 GiB. Tests limited to two workers, no concurrent builds.
- PR20: `b438fca22bd60ac7f6efa1d509c701897e821e76`.
- PR21: `58f360bba9d2eafc28146efec334b120c13fc5df`.
- Local `e8e6662` integration policy restored: new work per requirement revision, immutable history, record version as current observation.
- Adapter through `c1cb32c0916c518680c872c52d4c90e123069474`; intake through `ba82f26265c5fccebdebf1f9368d584d70f95fb0`; improvement through `2b14b4e7f222c8f44b85b999b068c0d6c05bf8f8`. Owners frozen via coordinator. Adapter test integration now imports this tree's original functions by default; historical pinned-checkout mode remains available.
- Mail handoff document `d608c3dc1f2ebd5c1005a9ac242b0de5a1a429b0` accepted as design only. Mail digest remains distinct from Git SHA; unknown sends cannot be replayed; SENT does not mean delivered/opened. No mail implementation or sending added.
- Shared checkout, actual `.local` DBs, live ledgers, deployments, main and existing PR21 head/base untouched.

## Behavior

`runControlTower` previously returned READY and execute enabled when a valid READY ledger contained null subject_revision. Regression failed before correction; `49420bd` requires SHA presence and exact equality. Schema already rejects malformed non-null SHA.

Ledger chain order determines state. `observed_at` is compared against the evaluation snapshot's `as_of`: any target-work event after that horizon holds execute and close. Equality is allowed. No wall-clock freshness window or global monotonic timestamp rule is imposed: delayed earlier observations can still appear later in the chain. Future events belonging to another work do not contaminate this work's decision. The evaluator does not silently filter a full supplied ledger to simulate a historical ledger.

`createOrderIntakeSandbox` allocates a temporary SQLite intake DB and canonical JSONL ledger itself; it accepts no DB path. Caller-supplied synthetic source must match the candidate source, then the original normalizer validates evidence. Host-confirmed proposal pins interpreted request, criteria, project and current target revision/version. This is semantic confirmation only. It does not authenticate users and is not exposed as a production intake endpoint.

Confirmation is serialized and bound to token + proposal digest. A repeat returns the same result; a conflicting digest fails. A changed requirement creates a distinct RECEIVED work using original `appendLedgerEvent`, then prepares a mapping with the original adapter, `verifyLedgerText` and `runControlTower`. Mapping history includes requirement digest outside the unchanged six-field adapter contract. Notes update current record_version without remapping. History copies cannot mutate internal mappings. No source validity, commitment acceptance, authorization, verification receipt or READY is manufactured.

Replayed confirmation receipts refresh their projection; a prior receipt does not freeze current work state. The synthetic evaluation snapshot is an explicit separate input required by the existing PR20 contract, not another work-state ledger. It keeps intent INFERRED/AI_INFERRED until a future canonical evidence workflow establishes provenance. Both nested actions also include the durability HOLD blocker.

Mapping and confirmation receipts are volatile. Every external lab result remains HOLD with `DURABLE_MAPPING_OUTBOX_UNAVAILABLE`, even when its nested read-only projection is LINKED/RECEIVED. Partial writes stay HOLD without blind retry. Restart recovery, durable uniqueness, digest-bound command/event outbox and reconciliation are not implemented. Do not connect this laboratory to real data or infer production readiness.

HTTP `/api/orders/:id/work` reads an injected trusted projection; absent integration returns HOLD, read failure returns HOLD without a stale projection. Existing UI and CLI acceptance records `USER_ACCEPTED_NOT_CANONICAL`, retains REVIEW, and keeps old events. A requirement revision clears the prior acceptance summary while preserving history. Existing stored CLOSED records are shown as historical intake closure, never canonical business completion. Claim remains an intake lease only.

## Independent review

Risk: medium reversible synthetic code integration, with authority boundaries requiring adversarial review. Cursor read-only, tools-disabled-by-instruction design review succeeded. It supported digest-bound idempotency, fresh post-append reads, new identity per requirement and REVIEW-only acceptance. Its suggestion to use `as_of` as a tip hash was not adopted: existing contracts distinguish the timestamp `as_of` from `expected_head`. Production durability cannot be replaced by volatile re-projection.

Claude was actually called with tools disabled and returned weekly usage limit, reset 13:00 Asia/Seoul. This is unavailable review, not PASS. Code review and final test evidence are recorded in the final handoff; no automatic multi-AI approval or live verification is claimed.

Cursor's source review raised partial writes, nested projection readiness, snapshot intent promotion and empty-input READY. Nested actions are now explicitly held and inferred intent is not promoted by confirmation. Partial writes are reproduced as HOLD and remain a release blocker, not a completed durable mapping feature. Empty-input READY was not reproduced: the original schema requires at least one item and returns INVALID first. The snapshot itself remains an existing required evaluation input, while ledger transitions remain the sole work state; removing the existing contract was not adopted.

## Mail connection reuse integration

Accepted owner commits `84c0abec79d00a390ae11777bfb9fe70abf0ada5` and documentation follow-up `90dad053af5a00baad73e80faeb31199caf4cb27`. The existing `memory/TOOL_CONNECTIONS.md` is now linked from session startup and mail intake/guide consumers. It points to the existing profiles and aiops procedures; no credential registry or default sender was created. Source review found no install/login/send call paths and no raw auth/error/secret output. Account metadata counts are not valid-connection counts; host-provided executable paths still require trust.

This integration ran the default local presence/version inspector: existing gws 0.22.5 and three profile paths present; auth intentionally UNVERIFIED in this run, no auth/API/send invoked. Owner-reported auth observations remain attributed and time-stamped. Ten synthetic inspector tests passed, including no auth by default, no secret getters, multiple versions AMBIGUOUS, and no install on missing paths. This establishes a repository consumer path and bounded inspector, not all-account setup, automatic adoption by already-running sessions, or working remote profiles.

## Next single task

Design and implement durable mapping history plus digest-bound outbox/reconciliation against the existing canonical work ledger, in isolated fixtures first. Include crash/restart, lost append response, same-ID/different-payload, concurrent revision changes, missing history and stale-head recovery before any real DB migration or service activation.

## Validation at integration checkout, 2026-09-15

- Full `npm test`: 261 passed, 0 failed, 0 skipped (Node 24.19.0). Includes current-tree original-function adapter tests, temporary DB/ledger integration, inspector and existing regression suites. No build script exists; module syntax and behavior tests are the applicable checks.
- `node scripts/verify-main-state.mjs`: PASS after rebuilding historical and successor file inventories from exact Git diffs. Historical observation remains pinned; no verifier rules were relaxed. Historical changed-file inventory is 37, successor inventory 78 at this checkpoint.
- `git diff --check`: PASS. The initial full run found inventory drift and a Windows test cleanup path mismatch; both were corrected. Test fixtures now live outside the checkout, so they cannot transiently pollute inventory checks. One leftover synthetic fixture was moved intact to a temporary preservation directory.
- Browser on isolated loopback port 56421 with `:memory:` DB: empty state, create, claim, report, user acceptance, canonical HOLD and reload verified. API readback after acceptance: REVIEW / USER_ACCEPTED_NOT_CANONICAL. No browser application errors reported. Injected fetch failure displayed an error and set detail.inert=true; reload recovered. Desktop 1440×1000 and mobile 390×844 inspected; mobile scrollWidth=390. Screenshots: `docs/evidence/integration-desktop.png`, `docs/evidence/integration-mobile.png`.
- Repository entrypoint path: WORK_READ_FIRST and ORDER_GUIDE → existing TOOL_CONNECTIONS → existing aiops procedures and MAIL_CONNECTION_REUSE / inspector; MAIL_ORDER_HANDOFF points to the same SSOT. Installed route reused; no login, setup, new credential store or mail send invoked.
- Remaining release blockers: persistent mapping/outbox/restart reconciliation, production source authentication, canonical authorization workflow and actual deployment. Later portfolio/context/cross-AI packet owner tasks are separate pending inputs, not included in this checkpoint.

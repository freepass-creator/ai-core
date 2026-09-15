# Order/control integration — synthetic verification boundary

Status: synthetic integration implemented, including a separate temporary durable coordination laboratory. Production activation and the missing independent high-risk review remain HOLD.

Current checkpoint: see [durable coordination](DURABLE_COORDINATION.md) for atomic mapping/outbox, full-payload reconciliation and real process crash tests. The older volatile sandbox below remains unchanged. No production endpoint uses the new laboratory; the OrderStore hook defaults to unused. Next single action: obtain the missing independent source review against the committed checkpoint. Live migration, authorization and external execution are unapplied.

## Conversation-to-history audit — 2026-09-15

The request to preserve instructions, corrections and work history is accepted as a continuity requirement. It is **not yet an automatic end-to-end capture guarantee**. No conversation body or sensitive source has been copied into this repository.

| Stage | Actual observation | Boundary / gap |
|---|---|---|
| App conversation | The coordinator's recent instruction and delegation were retrieved through the app's task reader. | Retrievability at this observation is proven; full history coverage, retention, backup and access policy are not independently verified. |
| Conversation → intake/correction | Original intake store supports request receipts, revisions and events. | No automatic app-conversation consumer was found in inspected `src`, `scripts` and workflows. No source-message-to-real-order mapping was supplied or verified. |
| Central API | Existing shared checkout connection policy/config produced a successful read-only `meta` response with matching pinned ledger ID. | This integration checkout alone has no endpoint configured. API reachability does not prove that this conversation became an order. No bulk order contents were read. |
| Assignment / handoff | App delegation was retrieved; common packet code and manual handoff instructions exist. | An app delegation is not a verified central claim or canonical work event. |
| Result / evidence | Development checkpoints and CI evidence are recorded in this document and related evidence paths. | Per-source-message completion/coverage remains unverified. Temporary durability tests do not prove live capture. |
| GitHub | Remote integration ref was re-read as `60b82d645fae953f9ec773fc9621711c1a2bd26a`; main as `8c61a6cd6ae25d5cf6ee093062d84ebb1e008f21`. The integration status and durable laboratory documents are in that branch checkpoint. | Branch publication is distinct from main. This observation precedes this audit addition; the new commit must be checked separately. GitHub does not contain all app conversations. |

Existing `docs/context/SESSION_HISTORY.md` ownership remains with the context coordinator in its own checkout; that path is absent from this integration branch at the audit base. Do not create a competing session ledger here. Its current local/committed/remote coverage must be supplied by that owner and read back before use. Existing `WORK_READ_FIRST.md`, context history, OrderStore events, canonical work ledger and GitHub evidence keep their distinct roles.

Context owner report at this audit: `C:/Users/admin/.codex/worktrees/293f/ai-core/docs/context/SESSION_HISTORY.md` and seven companion context files are untracked/local-only; no artifact commit, push or PR exists. The checkout base `8c61a6c` is not a version of those files. The owner directly observed main's `docs/context` Contents API returning 404, without claiming absence on every branch/path. Coverage is selected summaries of three archived tasks and later corrections, not all conversations. The owner's latest ten-turn comparison found missing instructions and is supplementing existing files; `COVERAGE.md` records the gap. This is attributed owner evidence, not independent file-content or completeness verification by integration. No raw business details are reproduced here.

Prepared follow-up, not deployed: record a minimal instruction/correction summary in the existing context history with source task/message ID, source timestamp, capture timestamp, owner, related order/work/revision if verified, superseded instruction pointer, result and verification references, and coverage boundaries/missing links. Distinguish source time from capture time and app messages from inferred summaries. Do not fabricate missing identifiers. Track local-only, committed and remote-confirmed stages; exact remote commit/path readback is required before saying GitHub stored the record. Raw content remains in its existing restricted source pending retention/access verification; Git ignore alone is not access control. No full transcript, credentials or sensitive attachments are authorized for GitHub publication.

Next bounded action: obtain the context owner's exact checkpoint and the relevant real order ID, if one exists; reconcile only those source references. Automatic capture, redaction enforcement, durable checkpoint/coverage tracking and live write authorization remain design work. The existing manual CI workflow's opt-in `record_result` note is not a conversation synchronization service.

Cursor independently reviewed this anonymized audit plan in read-only ask mode without tools. Agreement: app retrieval, API reachability and source/order binding are separate claims; source ACL/retention and capture coverage remain unverified. Added requirements: record who/when confirmed a binding and the artifact path/hash/commit; explicitly limit the negative consumer finding to inspected code. Other runtime services and unrelated repositories were not searched. Its table grouped app/API readback under remote evidence; this audit retains a separate GitHub ref/object readback requirement because app/API retrieval cannot prove GitHub publication. This documentation review does not satisfy the durable implementation's missing independent high-risk source review.

## Pinned integration inputs

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

In the original `createOrderIntakeSandbox`, mapping and confirmation receipts remain volatile. Its outputs remain HOLD with `DURABLE_MAPPING_OUTBOX_UNAVAILABLE`, even when the nested read-only projection is LINKED/RECEIVED. The separate durable laboratory now tests restart recovery, durable uniqueness and digest-bound reconciliation; it does not replace or production-enable the original sandbox. Do not connect either laboratory to real data or infer production readiness.

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

## Cross-AI read-packet follow-up

After the `5282f2d` core checkpoint, accepted `0dad6ac4ffc247afa156a16fb41262f4285f7eee` and added a real pinned HTTP client/server integration check (6 packet tests pass). The original RemoteOrderClient methods are reused; no new claims, locks, ledgers or execute endpoints are introduced. Two GETs are not atomic and every packet remains HOLD. Actual central duplicate-execution prevention remains unimplemented.

WORK_READ_FIRST now links the common entrypoint. Minimal CLAUDE.md/GEMINI.md project files point to the same shared instructions; Cursor's documented CLAUDE.md support avoids another copied rules file. Official source links and local invocation outcomes are recorded in CROSS_AI_ENTRYPOINT.md. Gemini startup failed due to untrusted directory, with no bypass or global change. Claude startup verification is unavailable due to the previously observed usage limit. These limits do not invalidate the synthetic packet tests and do block any claim that all tools have adopted or executed the common workflow.

Cursor's actual noninteractive startup returned both pointer paths and rejected execution for the synthetic HOLD packet. It explicitly reported pointers only, contents not read. This is local entrypoint recognition, not a three-tool execution PASS. The successor inventory is now 83 files after this follow-up; the earlier 78 count remains the core checkpoint observation.

Follow-up full validation: `npm test` 267 passed / 0 failed / 0 skipped, main-state verifier PASS, module syntax PASS and diff check PASS. GitHub Main State Consistency passed for the earlier `5282f2d` PR22 head; subsequent head CI is reported separately rather than inheriting that success.

Final branch-wide diff audit also found inherited CRLF line endings reported as whitespace in two JSON files: ORDER-DESK-VERIFICATION and C-DEV inventory. Only CRLF→LF was normalized; parsed JSON equality was checked, content/history unchanged and original bytes remain in the pinned source commits. No whitespace rule was disabled. GitHub CI subsequently passed the `00b2391` follow-up head; the newline-only successor is separately checked.

## Independent file-input follow-up

Accepted `267028c5b79e423ff02ec0a57ddf33fb7c10ad88` as a separate four-file change. Source review confirmed createReadStream feeds the original evaluator, without writes or stdin fallback. Focused original-evaluator/runner suite: 28 PASS; full suite: 272 PASS, 0 failed/skipped. Exact input-byte equality, Unicode/space paths, BOM/CRLF, file errors, conflicting options, explicit stdin and unchanged authorization flags are covered. Successor inventory is 84 files. Durable-coordination work begins only after preserving this checkpoint.

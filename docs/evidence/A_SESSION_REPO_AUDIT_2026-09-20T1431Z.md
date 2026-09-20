# A Session Repository Audit — 2026-09-20T14:31Z

## Scope

Evidence-only A-session delta audit. This record does **not** modify B/C/D canonical standards.

Baseline:
- AI Core A evidence head before this audit: `f8833a0e1974e5267be4dd3bf8f74fc48c13568c`
- Previous audited FreePass Data revision: `99071c966453f36c10bd39799949e57bdca41944`
- Previous FreePass Data evidence level: `DESIGN_BASELINE / DOC_ONLY`

Observed current revision:
- `freepass-creator/freepass-data@86c602898c65ce575ac5890b8e4114b4bbc1dd51`

Connected-repository recent-commit scan found no repository with a commit newer than the prior A evidence commit `f8833a0e...` other than `freepass-creator/freepass-data`.

Evidence:
- https://github.com/freepass-creator/freepass-data/commit/86c602898c65ce575ac5890b8e4114b4bbc1dd51
- https://github.com/freepass-creator/freepass-data/compare/99071c966453f36c10bd39799949e57bdca41944...86c602898c65ce575ac5890b8e4114b4bbc1dd51
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/docs/IMPLEMENTATION-STATUS.md
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/contracts/update-offer-price.schema.json
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/contracts/shadow-v1.schema.json
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/src/application/catalog.ts
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/src/infra/firestore-store.ts
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/src/migration/shadow.ts
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/tests/catalog.test.ts
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/tests/legacy-normalizer.test.ts
- https://github.com/freepass-creator/freepass-data/blob/86c602898c65ce575ac5890b8e4114b4bbc1dd51/tests/shadow.test.ts

## Classification 1 — Different — evidence-level upgrade

FreePass Data is no longer `DOC_ONLY`.

Between `99071c...` and `86c602...`, the repository added a TypeScript/Node executable Catalog V1 vertical slice, JSON Schemas, memory and Firestore adapters, command API, optimistic revision handling, idempotency receipts, append-only audit, durable outbox, projection release activation, legacy normalization/ingestion, shadow comparison logic, Firestore rules/indexes, and Vitest suites.

Repository status now describes the project as `ACTIVE / EXECUTABLE BASELINE`, while explicitly keeping production Firebase binding/IAM/writer cutover/real-data writes and deployment automation outside the approved baseline.

Evidence level is therefore upgraded to:

`CODE + SCHEMA + TEST_DEFINITIONS / EXECUTABLE_BASELINE`

It is **not** upgraded to CI, deployment, or production-runtime proof. GitHub Actions has zero exact-head workflow runs for `86c602...`; the implementation status also keeps production/deployment activation gated.

A-session action:
- update the stale FreePass Data project observation from `99071c...` to exact head `86c602...`;
- keep execution/runtime readiness non-production until exact-head CI and deployment/runtime receipts exist.

## Classification 2 — Core > Project — C migration/backport gap

### Partial adoption of Core request/error/result contracts

FreePass Data is pinned to AI Core revision `f8833a0e...` in `packages/ai-core/ai-core.lock.json` and has adopted meaningful parts of Core C semantics:

- actor identity
- optimistic `expectedRevision`
- idempotency key
- deterministic SHA-256 semantic request digest inside the command handler
- fail-closed rejection when the same idempotency key is reused with a different payload
- revision conflict as HTTP 409

However this is still a project-local command contract, not a full `core-request-context/v1` / `core-error/v1` / `core-result/v1` binding.

Current gaps versus Core:
- no first-class `correlation_id` on the inbound command contract;
- `commandId` is project-local rather than an explicit Core `request_id` binding;
- semantic payload digest is computed internally and persisted with the receipt rather than represented through the Core request idempotency envelope;
- HTTP error responses are project-local objects and omit Core error fields such as `type`, `title`, `category`, `correlation_id`, and `retryable`;
- success responses are raw receipts rather than `core-result/v1` envelopes.

Breaking impact:
- making the full Core request context mandatory immediately would break existing callers using the current command schema;
- replacing public success/error response shapes in one step may break existing consumers.

Verification required:
1. introduce an adapter/compatibility layer that accepts the current command shape while projecting Core request context internally;
2. propagate one correlation ID through command, audit, outbox event, result, and errors;
3. verify semantic idempotency conflict behavior with the persistent Firestore receipt store, not only the memory test adapter;
4. add contract tests for Core error/result projection without changing existing client behavior prematurely;
5. obtain exact-head CI and exact-revision runtime evidence before claiming Core contract adoption beyond SHADOW/compatibility status.

## Classification 3 — Project > Core — C candidate, CODE + TEST DEFINITIONS

### Atomic canonical-write evidence bundle + durable outbox

FreePass Data implements a stronger concrete consistency pattern than the current Core machine contracts expose as one transaction boundary.

Inside one Firestore transaction, the price command:
- reads the idempotency receipt;
- verifies semantic request digest;
- verifies expected revision;
- writes the new canonical Offer revision;
- appends an immutable audit record;
- appends an outbox event carrying source/target revision plus correlation/causation identifiers;
- persists the command receipt.

This prevents the canonical write from committing without its audit/event/idempotency evidence being committed in the same transaction.

Generalized C candidate:
- `core-transactional-command-commit/v1`
- canonical mutation + audit evidence + event outbox + idempotency receipt share one atomic commit boundary
- receipt references the semantic request digest and committed entity revision
- event publication is decoupled from commit but cannot be silently omitted by a successful canonical write

Current Core has request, event, result, snapshot and data-pipeline contracts, but the audited machine schemas do not currently express this four-part atomic commit invariant or a transactional outbox contract.

Verification required before C canonical consideration:
1. Firestore emulator/integration test proving transaction rollback leaves no partial offer/audit/outbox/receipt state;
2. duplicate command race test;
3. crash-after-commit / before-delivery recovery test;
4. schema-level mapping from project outbox event to `core-event/v1`;
5. receipt/evidence references that make the atomic bundle independently auditable;
6. exact-revision runtime evidence.

No C canonical artifact is changed by this audit.

## Classification 4 — Project > Core — D candidate, CODE + TEST DEFINITIONS

### Durable outbox delivery workflow

The outbox worker implements an explicit operational state machine:

`PENDING -> PROCESSING -> DONE`

with failure branches:

`PROCESSING -> PENDING (retry with exponential backoff)`

and

`PROCESSING -> DEAD_LETTER (max attempts reached)`.

It also uses a worker lease and reclaims expired `PROCESSING` work. This is a concrete workflow implementation layered over the C atomic outbox candidate.

Generalized D candidate:
- durable delivery state machine with lease ownership/expiry;
- bounded retry/backoff policy;
- terminal dead-letter state;
- replay/recovery must preserve event identity and correlation lineage;
- canonical command success and asynchronous delivery success remain separately observable.

Evidence level: source implementation plus unit-level test definitions. No exact-head CI or runtime worker evidence exists yet.

Verification required before D canonical consideration:
1. concurrent-worker lease claim test;
2. expired-lease recovery test;
3. retry scheduling/backoff test;
4. max-attempt dead-letter test;
5. process crash/restart recovery on the persistent adapter;
6. duplicate delivery/replay consumer safety;
7. runtime metrics/receipt for pending, retry, dead-letter and recovery.

No D canonical artifact is changed by this audit.

## Classification 5 — Project > Core — C candidate, CODE + TEST DEFINITIONS

### Fail-closed semantic tuple publication

Legacy normalization and the ERP public projection now distinguish an unknown deposit from a zero deposit and refuse to publish price terms whose deposit semantics remain `UNKNOWN`.

The important generalized pattern is not deposit-specific:
- a group of fields that jointly carries one business meaning is treated as a semantic tuple;
- blank/unknown members are not silently coerced to a business value such as zero;
- an incomplete tuple is not exposed as authoritative public projection data;
- source uncertainty remains explicit until normalization/authority resolves it.

Current `core-data-pipeline/v1` provides generic `NORMALIZE`, `VALIDATE`, `PROJECT` and fail-before-commit mechanics, but does not express field-group completeness rules at the projection boundary.

Generalized C candidate:
- semantic field-group completeness constraint;
- explicit `UNKNOWN` distinct from `ZERO` / `NOT_APPLICABLE`;
- fail-closed public projection policy for incomplete authoritative tuples;
- provenance must preserve the unresolved source value/reason rather than synthesize a business value.

Verification required before C canonical consideration:
- machine-readable group constraint;
- tests for blank/null/zero/not-applicable/unknown variants;
- provenance linkage for withheld tuples;
- at least one additional domain beyond deposit/price to prove generality.

No C canonical artifact is changed by this audit.

## Classification 6 — Project > Core — D candidate evidence upgrade

### Revision-aligned shadow parity avoids false migration mismatches

The previous FreePass Data migration candidate was `DESIGN_ONLY`. The SHADOW/PARITY slice now has schema, code and tests.

`shadow-v1` records source identity, optional source revision/checksum, observation time and a settled window. The comparison logic:
- fails with comparison error when source identities differ;
- returns `PENDING_LAG` instead of a mismatch while both sides are at different known source revisions;
- when revisions are unavailable, waits until both checkpoints pass the settled window;
- distinguishes `SOURCE_INCOMPLETE` from a true record mismatch;
- reports `MATCH` only after an aligned/settled comparison.

Generalized D candidate refinement:
- parity is a transition guard, not a raw diff;
- a migration must first prove that the compared snapshots represent the same source position or an agreed settled window;
- lag, incomplete source evidence, comparison failure and true data mismatch are different workflow states.

Evidence upgrade:
`DESIGN_ONLY -> CODE + SCHEMA + TEST_DEFINITIONS` for the SHADOW/PARITY slice only.

The full previously proposed migration sequence (`OBSERVE -> SHADOW_READ -> PARITY_VERIFIED -> READ_CUTOVER -> WRITE_CUTOVER -> DIRECT_ACCESS_BLOCKED`) is **not** proven by this implementation. No consumer cutover/runtime evidence exists yet.

Verification required before D canonical consideration:
1. exact-head CI for shadow tests;
2. persisted parity receipt bound to exact legacy and target revisions/checksums;
3. out-of-order and delayed-source cases;
4. real consumer shadow run;
5. read-cutover rollback and write-cutover evidence;
6. CI proof that direct legacy access is denied after cutover.

No D canonical artifact is changed by this audit.

## Previous candidates not promoted

The earlier FreePass Data C candidates are not all implementation-proven yet:
- Field Authority Registry + command enforcement remains explicitly listed as a current implementation gap.
- Consumer acknowledgment watermark / downstream consumed-revision proof has not gained runtime evidence in this revision.

They remain at their previous evidence level and are not re-promoted by this audit.

## Routing summary

- C review candidate: atomic canonical mutation + audit + outbox + idempotency receipt transaction — **new CODE evidence**.
- C review candidate: fail-closed semantic tuple publication — **new CODE/TEST evidence**.
- D review candidate: durable outbox lease/retry/dead-letter workflow — **new CODE evidence**.
- D review candidate: revision-aligned shadow parity guard — **evidence upgrade from DESIGN_ONLY to CODE + SCHEMA + TEST_DEFINITIONS for SHADOW/PARITY only**.
- Core > Project C migration gap: project-local request/error/result shapes must be compatibility-mapped to Core context/envelopes before stronger adoption status.
- Different: FreePass Data evidence maturity is now executable implementation baseline, but not CI/deployment/runtime proof.

B has no new candidate in this revision range.

B/C/D canonical standards were not modified.

## A-session follow-up

1. Re-observe/register `freepass-creator/freepass-data@86c602898c65ce575ac5890b8e4114b4bbc1dd51`; the prior `99071c...` observation is stale.
2. Preserve `EXECUTABLE_BASELINE` rather than production/runtime-ready status until exact-head CI and runtime/deployment receipts exist.
3. Route the new C/D candidates for review using this exact revision evidence; do not change canonical standards from A.
4. Backport Core request/error/result context through a compatibility layer rather than a breaking public API replacement.
5. Require persistent-adapter integration tests for atomic rollback, idempotency races, worker recovery and shadow parity before evidence promotion.

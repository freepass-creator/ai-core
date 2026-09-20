# A Session Repository Audit — 2026-09-20T15:54Z

## Scope

Evidence-only A-session delta audit. This record does **not** modify B/C/D canonical standards.

Baseline:
- AI Core A evidence head before this audit: `01e6bb7e0cd08e6390b452892516fd204ed64090`
- Previous audited FreePass Data revision: `86c602898c65ce575ac5890b8e4114b4bbc1dd51`
- Previous FreePass Data evidence level: `CODE + SCHEMA + TEST_DEFINITIONS / EXECUTABLE_BASELINE`

Observed current revision:
- `freepass-creator/freepass-data@5f794ae232cf9870b2873fcde9a99cdd688c3c38`

Connected-repository recent-commit scan found no material repository revision newer than the prior A evidence head other than `freepass-creator/freepass-data`.

FreePass Data is six commits ahead of the previous audited revision:
- `4cc684cb9ee3535c1c98eb5800ebaae3251f0cbb` — field authority enforcement
- `cb808604dc43f94199c9a06893545b7800bd4f65` — persistent RAW→normalized field lineage
- `1d864d13ab0041960f79b8517b2f4b8597e3e73f` — machine-enforced repository architecture boundaries
- `2a22b2cc80fe6b755f74803d721e29cc0b0016cd` — source-run completeness / accepted-head safety
- `650610a8a8bd5b40fb76e5a5b57fca6c60770c31` — reviewed candidate canonicalization
- `5f794ae232cf9870b2873fcde9a99cdd688c3c38` — append-only/queryable canonical revision history

Evidence:
- https://github.com/freepass-creator/freepass-data/compare/86c602898c65ce575ac5890b8e4114b4bbc1dd51...5f794ae232cf9870b2873fcde9a99cdd688c3c38
- https://github.com/freepass-creator/freepass-data/commit/4cc684cb9ee3535c1c98eb5800ebaae3251f0cbb
- https://github.com/freepass-creator/freepass-data/commit/cb808604dc43f94199c9a06893545b7800bd4f65
- https://github.com/freepass-creator/freepass-data/commit/2a22b2cc80fe6b755f74803d721e29cc0b0016cd
- https://github.com/freepass-creator/freepass-data/commit/650610a8a8bd5b40fb76e5a5b57fca6c60770c31
- https://github.com/freepass-creator/freepass-data/commit/5f794ae232cf9870b2873fcde9a99cdd688c3c38

Exact-head GitHub evidence status:
- GitHub check-runs for `5f794...`: zero.
- `.github/workflows` is not present at `5f794...`.
- Repository provides local `npm run check` (`check:arch + build + test`) but no exact-head CI receipt was found.
- No production-runtime receipt was discovered in the changed revision range.

Evidence level therefore remains `CODE + SCHEMA/DOC + TEST_DEFINITIONS / EXECUTABLE_BASELINE`, not CI/runtime verified.

## Classification 1 — Project > Core → C — field authority evidence upgrade

The earlier FreePass Data field-authority concept now has executable enforcement rather than design-only intent.

`4cc684...` implements a field-level authority registry carrying:
- domain / aggregate / field path;
- semantic owner;
- allowed commands;
- allowed writers;
- approval policy;
- conflict policy;
- override policy;
- effective-time policy;
- source-refresh policy.

Unknown fields, commands and unregistered service writers fail closed. The selected authority rule is retained in audit and command receipt evidence.

Current AI Core C source authority is primarily source/subject scoped (`core-source-registry/v1`) and does not express this field-level semantic write matrix as a reusable machine contract.

Generalized C candidate:
- `core-field-authority/v1` candidate;
- authority is evaluated at semantic field/command/writer scope, not only source/repository scope;
- authority decision evidence is retained with audit/receipt;
- authentication/IAM remains separate from semantic field authority;
- unknown/unregistered authority fails closed.

Evidence upgrade:
`DESIGN_ONLY → CODE + TEST_DEFINITIONS` for the field-authority slice.

Verification required before C canonical consideration:
1. authenticated actor binding rather than caller-supplied identity;
2. wildcard/precedence conflict tests across multiple overlapping rules;
3. explicit override/effective-time behavior tests;
4. cross-project second implementation;
5. exact-head CI and runtime denial/allow receipts.

Route: **C review candidate**. No C canonical artifact changed.

## Classification 2 — Project > Core → C — staged immutable field lineage

`cb8086...` persists field provenance as an append-only chain with explicit stages:

`RAW_TO_NORMALIZED → NORMALIZED_TO_CANONICAL → CANONICAL_TO_PROJECTION`

Each record carries source identity/fingerprint, observation time, source and target field paths/values, transform ID/version, stable lineage identity, and optional parent lineage reference. The current revision implements RAW→normalized persistence; `650610...` extends the chain to NORMALIZED→canonical and blocks canonical promotion when critical lineage is missing.

AI Core `core-provenance/v1` already provides source provenance plus a `field_provenance` array, so this is not a replacement for Core provenance. The project is ahead specifically in the **persistent staged chain and promotion-gate semantics**: Core provenance does not currently express immutable stage-to-stage lineage records or require lineage completeness before a canonical promotion.

Generalized C candidate refinement:
- persistent append-only field-lineage chain;
- parent evidence references between transformation stages;
- transform identity/version on every stage;
- critical-field lineage completeness as a canonicalization guard;
- unresolved/unknown source evidence remains inspectable rather than rewritten.

Verification required:
1. complete canonical→projection stage implementation;
2. hash/digest binding for source/target values where raw values are sensitive;
3. replay and duplicate-lineage idempotency on persistent Firestore;
4. lineage query integrity across source refresh and rollback;
5. exact-head CI/runtime evidence.

Route: **C review candidate**. No C canonical artifact changed.

## Classification 3 — Project > Core → C + D — completeness-qualified accepted source head

`2a22b2...` introduces a source-run safety contract that separates technical completion from authoritative completeness.

The project records:
- coverage mode: `FULL | DELTA | PARTIAL | UNKNOWN`;
- completeness: `COMPLETE | INCOMPLETE | UNKNOWN`;
- head state: `PENDING | CURRENT | STALE | INELIGIBLE`;
- one accepted current source head per source.

A completed run advances the accepted head only when it is complete and its **source observation time** is strictly newer than the current head. Completion time is explicitly not the freshness ordering key. Late older runs become STALE, invalid observation timestamps fail closed, and incomplete runs remain evidence but cannot become authoritative head.

The project also defines a strong absence rule: only a run that is `COMPLETED + FULL + COMPLETE + CURRENT` may assert that a missing source record is meaningful absence. Partial, delta, incomplete, stale or failed runs cannot drive mass deletion/retirement.

AI Core `core-source-registry/v1` has source freshness/fallback policy, and `core-data-pipeline/v1` has pipeline/partial-failure policy, but neither currently models run coverage/completeness, a monotonic accepted observation head, or absence authority as one machine contract.

Generalized C candidate:
- `core-source-run-evidence/v1` candidate with coverage/completeness/head status;
- observation-time monotonic head advancement;
- replay-safe immutable completion result;
- authoritative absence/delete assertions require explicit full-complete-current evidence.

Generalized D candidate:
- source-run promotion workflow `PENDING → CURRENT | STALE | INELIGIBLE`;
- current-head replacement must be transactional and monotonic;
- late/out-of-order completion must not regress the accepted head.

Verification required:
1. persistent Firestore concurrent completion race test;
2. same-observed-time tie behavior;
3. partial-page and source timeout fixtures;
4. explicit deletion/retirement consumer test proving non-authoritative absence cannot propagate;
5. clock/observation-source policy for sources without trustworthy timestamps;
6. exact-head CI/runtime receipt.

Route: **C + D review candidate**. No C/D canonical artifact changed.

## Classification 4 — Project > Core → C + D — evidence-qualified reviewed canonical promotion

`650610...` adds a controlled candidate→Canonical promotion command.

Promotion requires:
- reviewed candidate identity;
- expected accepted source-head run ID;
- explicit CREATE/LINK identity decisions;
- supplier identity;
- approval of warning issues;
- actor/reason;
- source run/head/checkpoint identity agreement;
- complete/current source evidence;
- source fingerprint consistency;
- critical field-lineage evidence.

The expected source head is rechecked inside the same persistence transaction as canonical persistence. Same source record + same fingerprint becomes `NO_CHANGE`; a changed fingerprint does not overwrite canonical data and instead returns `SOURCE_CHANGED_REVIEW_REQUIRED`.

The transaction also extends the previously-routed atomic command candidate by coupling canonical entities, source binding, normalized→canonical lineage, audit, durable outbox and canonicalization receipt.

Generalized C refinement:
- canonical promotion requires an exact evidence checkpoint/head, not merely a valid payload;
- identity resolution decisions and source binding are first-class persisted evidence;
- changed upstream evidence requires explicit reviewed update rather than silent overwrite;
- canonical state and provenance/receipt evidence share a transaction boundary where possible.

Generalized D candidate:
- promotion workflow separates candidate validity from review approval and current-evidence eligibility;
- source change reopens review instead of treating a refreshed source as implicit authorization to mutate canonical state.

Verification required:
1. persistent Firestore race where accepted source head changes during attempted canonicalization;
2. concurrent duplicate canonicalization/idempotency test;
3. reviewed update path for an existing binding after fingerprint change;
4. rollback/compensation and outbox recovery evidence;
5. actor authentication/approval proof;
6. exact-head CI/runtime evidence.

Route: **C + D review candidate**. No C/D canonical artifact changed.

## Classification 5 — Core > Project — C migration/backport gap on revision snapshots

`5f794...` adds append-only queryable `EntityRevisionRecord` history for canonical entities, with previous revision, full snapshot, actor, reason, origin, command ID, occurrence time and optional source binding/run references.

This is valuable project evidence, but the new revision record is **not currently a `core-snapshot/v1` binding**.

Core immutable snapshot v1 requires, among other fields:
- `schema_version`;
- stable `snapshot_id`;
- subject type/id/revision;
- `source_revision` (nullable but required as a field);
- `created_at`;
- payload;
- `payload_digest`.

The project revision record does not currently carry a snapshot schema marker or payload digest and uses project-local history identifiers/origin fields. Therefore it must not be reported as Core snapshot adoption yet.

Breaking impact:
- making Core snapshot fields immediately mandatory on existing history records can break historical readers/indexes;
- adding a required payload digest without a backfill/versioning strategy can make existing revision history unverifiable or unreadable;
- replacing the project history record shape in place can break control-plane/history consumers as they appear.

Verification / migration needs:
1. define a compatibility projection from `EntityRevisionRecord` to `core-snapshot/v1` rather than destructive replacement;
2. deterministically compute and verify payload digest;
3. define `source_revision=null` semantics for manual/non-source canonical mutations;
4. version/backfill existing revision records before any required-field enforcement;
5. test entity revision ↔ history revision continuity and snapshot replay;
6. preserve project-only actor/reason/origin/source-binding metadata as extensions outside the Core envelope;
7. obtain exact-head CI/runtime history read/replay evidence.

This is a **Core > Project migration/backport gap**, not a reason to weaken Core snapshot requirements.

## Classification 6 — Different — repository architecture boundary enforcement

`1d864d...` adds a local architecture checker that rejects reverse dependencies between Domain / Ports / Application / Adapter / Infra / API/Job/Migration layers and bans Firebase SDK imports from Domain/Ports/Application.

This is a useful project governance implementation, but it is tied to FreePass Data's modular-monolith layout and does not map cleanly to B UI/UX, C Core Contract or D Workflow canon. It is recorded as `Different` rather than promoted merely because it is stricter locally.

No B route is created from this revision range.

## Existing Core > Project gap remains open

The prior C migration gap for request/error/result binding remains open at `5f794...`:
- project command/API still lacks first-class Core `correlation_id` propagation;
- success/error responses remain project-local rather than `core-result/v1` / `core-error/v1` envelopes.

The new field-authority denial path adds another project-local 403 error shape, so the compatibility requirement is more important, not less.

Breaking-safe migration remains:
- accept current external shapes;
- project internally to Core request context;
- propagate correlation through command/audit/outbox/receipt/error;
- expose Core result/error through compatibility/versioned boundaries before making it mandatory.

## Evidence-level conclusion

FreePass Data has materially advanced from a basic executable baseline into a more strongly governed data-control implementation, but this run does **not** promote it to CI/runtime verified status.

Current exact-head evidence grade:
`CODE + DOC/SCHEMA + TEST_DEFINITIONS / NO EXACT-HEAD CI OR RUNTIME RECEIPT`.

## Routing summary

- **C**: field-level semantic authority — implementation evidence upgrade.
- **C**: staged immutable field lineage + critical lineage gate.
- **C + D**: completeness-qualified accepted source head and absence authority.
- **C + D**: evidence-qualified reviewed canonical promotion / re-review-on-source-change.
- **C migration gap**: project revision ledger must compatibility-map to `core-snapshot/v1` with digest/version/backfill semantics.
- **Existing C migration gap remains**: project-local request/error/result shapes.
- **Different**: local repository architecture checker.
- **B**: no new candidate.

B/C/D canonical standards were not modified.

## A-session follow-up

1. Re-observe/register `freepass-creator/freepass-data@5f794ae232cf9870b2873fcde9a99cdd688c3c38`; `86c602...` is now stale by six commits.
2. Keep candidate evidence at source/test-definition level until exact-head CI and persistent-adapter/runtime evidence exists.
3. Send C/D reviewers this exact revision packet; canonical adoption remains their decision.
4. Backport Core request/error/result and Core snapshot compatibility without destructive public/storage shape replacement.
5. Prioritize Firestore concurrency tests for source-head promotion and candidate canonicalization because both new guarantees depend on transactional race safety.
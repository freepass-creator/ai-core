# A Session Repository Audit — 2026-09-20T22:56Z

## Scope

Evidence-only A-session audit against the connected GitHub repositories. This record does **not** modify B/C/D canonical standards.

Baseline:
- latest prior A-session evidence commit: `0bb9f73a2c1a3bcba9d85a18662c5eb8a00ab1b2`
- baseline commit time: `2026-09-20T18:12:58Z`

Material revisions observed after the baseline:
- AI Core: `76b4c05f0b99a80033aa9d65030ac97df0f649e9`
- Development Center: `29acf6717a850f8a3e1adf0eaec07ce984861343` → `05e1513af9f2bab3b3ecb1ab580bcc9b6dfd6ecd` → `283bff85224ea4b0eddef467e7aa2f252e617781` → `927dcd35a761dcf6f9fe511eef54af150da07130`
- FreePass Data: `5f794ae232cf9870b2873fcde9a99cdd688c3c38` → `0dc53d825650f30aa8e7661ac74f5ee24f9b95fa`

Other previously tracked primary/legacy repositories inspected in this pass did not expose a newer material commit than the baseline.

## 1. Development Center — execution plane became machine-executable

### Evidence

`devcenter@05e1513af9f2bab3b3ecb1ab580bcc9b6dfd6ecd` added:
- `devcenter-hub-routing-rules/v1`
- deterministic Hub router runtime
- Hub registry validator
- regression test definitions
- fail-closed outcomes for unknown Hub, malformed 7-Hub registry, no match, tie and Control Plane misuse

The router keeps exactly seven registered Hubs and keeps the Control Plane outside the Hub count.

AI Core then adopted that execution boundary in `ai-core@76b4c05f0b99a80033aa9d65030ac97df0f649e9`, explicitly retaining normative B/C/D ownership in AI Core while delegating project implementation routing/evidence to Development Center.

Classification: **Different / execution-plane realization**.

Reason:
- this does not redefine B/C/D canonical semantics;
- it machine-enforces the Development Center execution topology that AI Core now explicitly delegates to;
- the Project > Core loop for the 7-Hub router is effectively already consumed by AI Core handoff `76b4c05...`.

No new B/C/D canonical routing is required for the router itself.

## 2. Development Center — evidence-based Hub readiness model

### Evidence

`devcenter@283bff85224ea4b0eddef467e7aa2f252e617781` added `devcenter-hub-readiness/v1` with eight evidence axes:
- contract
- source
- runtime
- validation
- consumers
- evidence
- recovery
- feedback

`READY` requires at least 90% and all four critical axes (`contract/source/runtime/validation`) to be VERIFIED. Documentation alone cannot promote a Hub to VERIFIED.

Classification: **Different / execution-governance model**.

Reason:
- this is Development Center operational readiness, not a product/domain workflow state machine;
- it should not be imported into D merely because it has READY/PARTIAL/HOLD labels.

### New evidence contradiction

At current DevCenter head `927dcd35a761dcf6f9fe511eef54af150da07130`, `hubs/readiness.json` still says:
- `assessed_against.devcenter_revision = 283bff85224ea4b0eddef467e7aa2f252e617781`
- `assessed_against.freepass_data_revision = 5f794ae232cf9870b2873fcde9a99cdd688c3c38`

But the same current file marks Quality Hub contract VERIFIED using `contracts/quality-receipt.schema.json` and `docs/QUALITY-RECEIPT.md`, which were introduced only by `927dcd...`. FreePass Data has also advanced to `0dc53d...`.

Classification: **Different / stale revision evidence**.

Action:
- regenerate the readiness snapshot against exact current DevCenter and current consumer/source revisions;
- do not treat the current readiness percentages as exact-revision evidence until the assessed revisions match the artifacts used by the score;
- preserve historical baseline snapshots separately if needed instead of silently rewriting what they represented.

## 3. Development Center — Quality Receipt v1

### Project > Core candidate → C

`devcenter@927dcd35a761dcf6f9fe511eef54af150da07130` added a machine schema/runtime/test baseline for `devcenter-quality-receipt/v1`.

Reusable pattern beyond the current generic Core receipt:
- exact repository + 40-char subject revision
- explicit `scope.claims` and `scope.exclusions`
- actual runner and commands
- check-level `PASS / NOTICE / HOLD / FAIL`
- PASS requires evidence
- HOLD/FAIL require evidence + remediation + recheck
- whole-result precedence is derived from checks (`FAIL > HOLD > NOTICE > PASS`)
- deterministic semantic receipt ID
- optional source hashes

Generalized C candidate:

> **Scope-bounded verification receipt** — a verification claim is valid only for an exact subject revision and explicit claim/exclusion scope; each blocking check must carry evidence plus a remediation/recheck path, and the aggregate result must be mechanically derived rather than manually asserted.

This is a candidate only. **Do not change C canonical standard from this A-session record.**

### Core > Project migration gap — receipt envelope composition

AI Core already has `core-receipt/v1`, which requires generic execution fields including actor, executor, correlation ID, input/output digests, source revision and reproducibility metadata. DevCenter Quality Receipt currently defines a parallel top-level envelope and does not compose/project those generic Core receipt fields.

Breaking impact:
- replacing `devcenter-quality-receipt/v1` outright with `core-receipt/v1` would break the current finalizer, schema tests and future Quality-Hub consumers;
- leaving both unrelated risks two competing receipt dialects at the company execution boundary.

Backport/migration requirement:
- keep Quality-specific check/scope semantics;
- add a compatibility projection or explicit embedding/composition with `core-receipt/v1` rather than destructive replacement;
- propagate correlation/execution identity and input/output digests;
- add conformance tests proving deterministic mapping in both PASS and blocking outcomes.

Verification needed:
- exact-head executed tests;
- at least one real project Quality Receipt;
- Core receipt projection validation for the same subject revision;
- HOLD/FAIL remediation/recheck round trip.

Current evidence level: **SCHEMA + CODE + TEST DEFINITIONS; no exact-head GitHub Actions run observed for `927dcd...`.**

## 4. AI Core ↔ DevCenter handoff pin is already stale

AI Core `76b4c05...` pins Development Center baseline `05e1513af9f2bab3b3ecb1ab580bcc9b6dfd6ecd` and says a later revision may supersede it only after the same seven-Hub/control-plane invariant is rechecked.

Current DevCenter head is `927dcd35a761dcf6f9fe511eef54af150da07130`.

The current `hubs/registry.json` still contains exactly:
- Design
- Data
- Document
- Engineering
- Integration
- Quality
- Delivery

and still marks Control Plane `is_hub=false`.

Classification: **Different / stale pinned revision requiring action**.

Action:
- run `validate-hubs`, Hub router regression, readiness regression and Quality Receipt regression on exact head `927dcd...`;
- once those exact-head checks execute successfully, repin the AI Core handoff baseline to the verified DevCenter revision;
- until then keep the structural recheck as observed code evidence, not CI/runtime verification.

## 5. FreePass Data — controlled Manual Catalog Source

### Evidence

`freepass-data@0dc53d825650f30aa8e7661ac74f5ee24f9b95fa` added a controlled direct-entry vertical slice.

The command is not a direct Canonical/Firestore editor. It performs:

`CREATE_MANUAL_CATALOG_ENTRY → semantic writer gate → immutable MANUAL source → FULL/COMPLETE/CURRENT SourceRun + SourceHead → RAW evidence → normalized candidate → field-level RAW_TO_NORMALIZED lineage → SOURCE_ACCEPTED receipt → reviewed Canonicalization → Canonical commit → outbox → ACTIVE release`

Important implementation details:
- submission identity is derived from the idempotency key;
- source content fingerprint is a separate SHA-256 of the entry payload;
- actor and reason are preserved in the receipt;
- idempotency replay returns the existing receipt without duplicating source evidence;
- same key + different semantic payload fails;
- unregistered SERVICE writer fails;
- source definition/run/head/raw/candidate/lineage/receipt are written through the same Catalog transaction boundary;
- tests cover immutable source evidence, replay, conflict, invalid deposit fail-before-write, writer rejection and direct-input → Canonical → ACTIVE release.

### Project > Core candidate → C

Generalized pattern:

> **Human/manual mutation is a first-class provenance source, not a privileged Canonical bypass.** A controlled manual change should create immutable RAW evidence, separate submission identity from content fingerprint, preserve actor/reason, produce field lineage and enter the same Canonical promotion path used by machine sources.

Current AI Core source registry models canonical owner/writer, source role/priority/authority/freshness, but does not machine-model this complete manual-submission evidence lifecycle.

Route this as a **C candidate** only; do not change C canonical standard here.

### Project > Core candidate → D

Generalized workflow pattern:

> **Manual input must not jump directly to authoritative state.** Separate `SOURCE_ACCEPTED` from reviewed Canonical promotion so that rejected/ambiguous review leaves submitted evidence intact without partially creating Canonical entities; only the ordinary outbox/projection path may make it ACTIVE.

This extends the earlier reviewed-canonicalization D candidate with a concrete human-entry path and executable regression tests.

Route this as a **D candidate** only; do not change D canonical standard here.

### Core > Project migration gap — new manual command context

The new `manual-catalog-entry.schema.json` carries `commandId`, `idempotencyKey`, actor and reason, but does not carry/project the full `core-request-context/v1` (`request_id`, `correlation_id`, Core actor shape, `expected_revision`, semantic idempotency object).

The project documentation also explicitly says the current USER actor is semantic identity and that authenticated user/service identity must be derived later. No public manual-write HTTP route is exposed yet, which limits current runtime risk.

Breaking impact:
- low while the command remains internal;
- becomes breaking/security-sensitive once Console/API callers depend on the current request-body actor/command shape.

Backport/migration requirement before public write activation:
- derive ActorRef from authenticated identity rather than trust body identity;
- project the inbound request into `core-request-context/v1`;
- propagate request/correlation identity through source receipt, canonicalization, audit/outbox/result evidence;
- retain current command fields behind a compatibility adapter if an internal caller already depends on them.

Verification needed:
- authenticated USER and approved SERVICE cases;
- unauthorized SERVICE rejection;
- same idempotency key/same digest replay;
- same key/different digest conflict;
- correlation continuity from manual acceptance through canonical/outbox/release;
- Firestore transaction race test, not memory-only validation.

Current evidence level: **SCHEMA + CODE + MEMORY TEST DEFINITIONS + FIRESTORE TRANSACTION IMPLEMENTATION; no exact-head GitHub Actions run observed for `0dc53d...`.**

## 6. Unchanged evidence condition not reclassified

AI Core `Main State Consistency` for `76b4c05...` again failed before workflow steps executed. This is the same already-known runner-entry failure class and is not a new B/C/D defect signal, so it is not promoted as a new discovery in this audit.

## Result

- Project > Core:
  - DevCenter Quality Receipt scope/check/remediation semantics → **C candidate**
  - FreePass Data first-class manual source/provenance → **C candidate**
  - FreePass Data no-bypass manual promotion workflow → **D candidate**
- Core > Project:
  - DevCenter Quality Receipt needs additive composition/projection with `core-receipt/v1`
  - FreePass Data manual command needs Core request-context/auth/correlation backport before public write activation
- Different:
  - DevCenter executable 7-Hub router / readiness governance
  - DevCenter readiness `assessed_against` is stale relative to evidence contained in the same current file
  - AI Core handoff pin `05e1513...` is stale vs DevCenter `927dcd...`
- B candidate routing: none
- B/C/D canonical standards changed: **no**

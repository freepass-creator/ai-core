# A Session Repository Audit — 2026-09-20T23:37Z

Status: **A-SESSION EVIDENCE ONLY**

This record captures revision-bound observations and reverse-import candidates. It does **not** modify or promote B/C/D canonical standards.

## Baseline

- Previous A-session evidence commit: `9e08095814fe627f6b8b0d98e891593914adc364`
- AI Core observed main during this audit: `0c1d729cfc35a0b37481f71b9770567fa27fe416`
- Material post-baseline project heads observed:
  - FreePass Data: `0dc53d825650f30aa8e7661ac74f5ee24f9b95fa` -> `0e40e6461959027022e079fdffa1af3513fed6ec`
  - Development Center: `927dcd35a761dcf6f9fe511eef54af150da07130` -> `ef11c4c47b19712f1c678196aaee4a592a135fef`
  - FreePass Admin: implementation/mapping advanced to `02deb4df0fcb123a478519e3cbb408cd5e2ad7c6`
  - FreePass ERP4: prior A/B observation -> live main `2b3f680b246302470e451bba0acfbaf1afbd1665`
  - FreePass Sales: `e98e3e9854012b9043f7fbe7b4168ce772047e39` -> `60d086dda9df1da3e7bacf155574554f23d1340d`

## 1. FreePass Data — evidence-gated Projection Release

**Classification:** `Project > Core`

**Route:** C candidate + D candidate. No canonical change performed.

### Project evidence

At `0e40e6461959027022e079fdffa1af3513fed6ec`, Catalog V1 now implements a consumer release evidence chain:

`Source -> RAW -> Normalized Candidate -> Canonical revision -> Projection field -> Release Manifest -> ACTIVE release`

The Release Manifest binds the release to the exact Canonical input set and records `inputDigest` / `dataDigest`. Field evidence records `CANONICAL_TO_PROJECTION` lineage. Activation is fail-closed through `BUILDING -> VALIDATING -> READY -> ACTIVE`; evidence is staged before the ACTIVE pointer switches, and the previous ACTIVE release remains last-known-good if evidence staging fails.

`tests/catalog.test.ts` defines cases for exact input manifests, snapshot drift rejection, last-known-good retention after evidence-stage failure, equivalent-release reuse, out-of-order event convergence, and acknowledgement retry without duplicate release creation.

### Generalized candidate

C candidate: **revision-addressed consumer release evidence** — a published projection should be attributable to the exact canonical input revisions, deterministic input/output digests, and field provenance used to build it.

D candidate: **evidence-gated activation with last-known-good retention** — staged output is not user-visible completion until validation/evidence succeeds and the activation pointer changes atomically; failure leaves the previous ACTIVE state intact.

### Evidence level

`CODE + SCHEMA/DOC + TEST DEFINITIONS`. Exact-head GitHub Actions runs observed: **0**. Do not treat as CI/runtime verified.

## 2. FreePass Data — reviewed source refresh and delivery convergence

**Classification:** `Project > Core` plus an expanded `Core > Project` migration gap.

**Route:** C candidate + D candidate. No canonical change performed.

### Project > Core pattern

A changed source fingerprint no longer overwrites Canonical automatically. The project creates a review packet that separates REVIEWABLE changes from BLOCKED structural/identity changes, requires the complete current approval set, pins the accepted source head plus binding and affected entity revisions, and applies the accepted packet atomically. Any blocked structural change prevents partial application of otherwise safe fields.

The outbox remains at-least-once, but delivery is convergent: a `ProjectionDeliveryReceipt` is keyed to the event, retries dedupe against the receipt, equivalent canonical/output digests reuse the ACTIVE release, and a late older event rebuilds from current Canonical state rather than replaying stale payload.

Generalized C candidate: **multi-resource reviewed mutation precondition** — approval must name the complete reviewed diff set and expected revisions of every bound resource that makes the decision valid.

Generalized D candidate: **review-before-authority transition + convergent delivery recovery** — changed upstream evidence re-enters review rather than mutating authoritative state, and delivery retries/out-of-order events converge on current authoritative state.

### Core > Project gap

`contracts/reviewed-source-change.schema.json` requires project-local `commandId`, idempotency key, expected revisions, actor and reason, but does not yet compose the AI Core request-context identifiers such as `request_id` / `correlation_id` across the new mutation surface.

**Breaking impact:** replacing the project command schema outright with a new public envelope can break existing callers, tests and persisted command/receipt assumptions.

**Migration/backport:** preserve the existing command shape at the compatibility boundary, project it internally into Core request context, then propagate correlation through review command -> audit/revision -> outbox -> delivery receipt/release evidence.

**Verification needed:** persistent Firestore idempotency/collision tests, concurrent multi-resource revision races, command-to-release correlation checks, exact-head CI, and runtime evidence.

## 3. Development Center — Design Hub execution evidence layer

**Classification:** `Different` / evidence-level advancement.

DevCenter advanced to `ef11c4c47b19712f1c678196aaee4a592a135fef` with executable Design Hub contracts and runtimes: pinned Core binding, Design Job/Plan, browser-capture manifest, visual job/plan/receipt, Design Lock, compiler, capture adapter, visual-QA runtime and regression definitions.

The implementation explicitly separates three claims: compile validity, browser capture existence, and actual visual review. A screenshot alone cannot produce a Visual QA PASS. This operationalizes the existing B verification boundary; it is not a competing UI/UX standard, so no new B canonical candidate is routed from this delta.

Exact-head GitHub Actions runs observed: **0**. DevCenter itself still states that real revision-bound project browser captures and reviewed receipts are missing.

### Stale evidence contradiction

`hubs/readiness.json` at current head still declares `assessed_against.devcenter_revision = 4f4e0cc5279f921f8cb74c6ae77252f08c1abf3c` while the actual DevCenter head is `ef11c4c47b19712f1c678196aaee4a592a135fef`. It also pins FreePass Data at `5f794ae232cf9870b2873fcde9a99cdd688c3c38`, while current FreePass Data is `0e40e6461959027022e079fdffa1af3513fed6ec`.

Because the same readiness snapshot cites Design Hub runtime/evidence added after its declared DevCenter revision, the snapshot cannot be used as an exact-revision readiness receipt. Regenerate it against exact current refs and attach executed validation/browser evidence before raising readiness.

## 4. FreePass Admin — mapped implementation, conformance still unearned

**Classification:** `Different` / Core-adoption evidence change.

FreePass Admin now carries `.ai-core/ui-ux.consumer.json` at `02deb4df0fcb123a478519e3cbb408cd5e2ad7c6`, maps the approved shell implementation, and remains explicitly `MAPPED`. Its own pending-conformance list requires browser visual proof at 360/390/412/1280/1440, locale/input/zoom/reflow/focus verification, and exact-revision Design Visual + Quality Receipts.

AI Core `0c1d729c...` already records this revision as `MAPPED`, not CONFORMANT. Therefore no new Project > Core candidate or Core > Project semantic gap is inferred.

Exact-head Admin workflow run `35544815968` failed before any step executed (`steps=[]`, `runner_id=0`). This is not evidence of an Admin code/test failure, but it means exact-head CI verification is absent.

## 5. FreePass ERP4 — revision moved beyond Core observation; verification is not yet promotable

**Classification:** `Different` / stale revision + evidence hold.

ERP4 main is now `2b3f680b246302470e451bba0acfbaf1afbd1665`. The material range since the earlier observation is concentrated in white-label UI/design-lock changes and audit/deploy-recovery evidence. A recent audit records that one main CI run stopped at the confirmed-design gate, causing later SSOT guards/build to be skipped; a Production Deploy Recovery run also failed before deployment because its declared Vercel credential path was unavailable. That recovery failure is not proof about an external/native Vercel Git deployment.

The current exact-head CI run `35545118476` was still `in_progress` at observation time. Do not promote the current revision as exact-head green until that run (or a later exact-head run) completes successfully through the downstream gates.

AI Core's current UI/UX consumer registry still observes ERP4 at `de8823e754ee9f03c9d95a62fc031610cb7859c2`, so the Core observation is stale relative to live main. Re-observe after an exact-head verification result; do not infer conformance from revision movement alone.

The compact list-only rental display changes are treated as product presentation specialization for now because exact canonical money remains preserved in detail/contract/settlement and no cross-project verification justifies B promotion in this audit.

## 6. FreePass Sales — live lead counts and Welrix sheet handoff

**Classification:** `Different` / product operation delta + stale Core observation.

Sales main advanced to `60d086dda9df1da3e7bacf155574554f23d1340d`. The change derives live `전체/관심/진행/거부` counts from Firestore lead state through the existing pipeline model, surfaces active/connected counts in partner reporting, and links a Welrix Google Sheet from Settings. The sheet is explicitly documented as a paste-time snapshot, not a live Firestore authority.

No new B/C/D reusable contract is established by this delta. The important action is evidence freshness: AI Core's current UI/UX consumer registry still observes Sales at `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`, not the live `60d086d...` revision.

Exact-head Sales CI run `35545140604` failed before any step executed (`steps=[]`, `runner_id=0`). Therefore the new revision is not exact-head CI verified, but this failure is also not evidence that the Sales code/tests themselves failed.

## 7. Cross-repository runner-entry evidence change

**Classification:** `Different` / infrastructure evidence.

The same zero-step GitHub Actions failure signature is now observed on three private repositories at current/recent exact heads:

- AI Core `0c1d729...`: Main State Consistency, `steps=[]`, `runner_id=0`
- FreePass Admin `02deb4d...`: backend-check, `steps=[]`, `runner_id=0`
- FreePass Sales `60d086d...`: Sales CI, `steps=[]`, `runner_id=0`

This broadens the prior AI-Core-only observation into a cross-repository execution-entry problem. Do not classify these runs as product test regressions without a job step having started. Private-repo exact-head claims that depend on Actions remain unverified until runner execution resumes.

## Action summary

1. Re-observe/update A evidence for FreePass Data `0e40e646...`, DevCenter `ef11c4c...`, Admin `02deb4df...`, ERP4 `2b3f680b...`, and Sales `60d086dd...`.
2. Route FreePass Data release-evidence / reviewed-mutation candidates to C and activation/review-delivery candidates to D as **candidates only**.
3. Keep B unchanged; DevCenter Design Hub changes execute existing B authority rather than replacing it.
4. Regenerate DevCenter readiness with exact current DevCenter/Data refs and executed receipts.
5. Backport Core request/correlation context into the new FreePass Data reviewed-source-change surface through a compatibility projection, not a breaking schema replacement.
6. Refresh stale AI Core consumer observations for ERP4 and Sales only after revision-bound verification evidence is available.
7. Treat current zero-step private-repo Actions failures as runner-entry/infrastructure evidence, not product-code failure.

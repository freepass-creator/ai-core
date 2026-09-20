# A Session Repository Audit — 2026-09-20T13:14Z

## Scope

Evidence-only A-session delta audit. This record does **not** modify B/C/D canonical standards.

Baseline:
- AI Core A evidence head before this audit: `96d590df35c2329e80cb73ffbf543291d0bf9ccf`
- Previous audited FreePass ERP4 revision: `0cf39d7c639b8583c5d1244cff1ea8ce51a07329`
- Previous audit identified **FreePass Data** only as a logical project identity inside `freepass-creator/freepasserp4`.

Observed current revisions:
- `freepass-creator/freepass-data@99071c966453f36c10bd39799949e57bdca41944`
- `freepass-creator/freepasserp4@2f3eab3e24b9550c06405d510c6cc855c19ad8d2`

Evidence:
- https://github.com/freepass-creator/freepass-data/commit/99071c966453f36c10bd39799949e57bdca41944
- https://github.com/freepass-creator/freepass-data/blob/99071c966453f36c10bd39799949e57bdca41944/docs/ARCHITECTURE.md
- https://github.com/freepass-creator/freepass-data/blob/99071c966453f36c10bd39799949e57bdca41944/docs/MIGRATION-PLAN.md
- https://github.com/freepass-creator/freepass-data/blob/99071c966453f36c10bd39799949e57bdca41944/docs/CONSOLE-UX.md
- https://github.com/freepass-creator/freepasserp4/commit/971599bca495294ac33f74e77e67a0f092b07d82
- https://github.com/freepass-creator/freepasserp4/commit/2f3eab3e24b9550c06405d510c6cc855c19ad8d2
- https://github.com/freepass-creator/freepasserp4/actions/runs/35512763129

## Classification 1 — Different

### FreePass Data is now a standalone repository

A material identity change occurred after the prior audit. `freepass-creator/freepass-data` now exists as its own repository. It was created on 2026-09-20 and current main is `99071c966453f36c10bd39799949e57bdca41944`.

The repository currently contains only:
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/MIGRATION-PLAN.md`
- `docs/CONSOLE-UX.md`

No implementation code, package manifest, tests, CI workflow, deployment definition, or runtime evidence is present. GitHub Actions currently reports zero workflow runs. Therefore its current evidence level is **DESIGN_BASELINE / DOC_ONLY**, not implementation or runtime proof.

The repository is currently public. Its own architecture document also calls out that repository visibility and secret policy must be rechecked before production connectors or internal schemas are added.

### A-session stale registry impact

Current A `registry/projects.json` does not contain `freepass-data`, while the existing `freepasserp4` row is still revision-bound to an older ERP4 revision. This is now more than a naming ambiguity: there is a distinct repository identity.

Action required:
1. Add/re-observe a distinct A project capsule/registry identity for `freepass-creator/freepass-data`.
2. Do not rename or collapse the existing ERP4 application/runtime project into FreePass Data.
3. Keep FreePass Data execution readiness non-active until implementation, test, deployment and runtime bindings exist.
4. Re-observe ERP4 separately at its current exact revision.
5. Recheck FreePass Data repository visibility before any connector secret, internal schema, or production integration work lands.

This is `Different`, not `Project > Core` or `Core > Project`, because it changes project/repository identity and evidence readiness.

## Classification 2 — Project > Core — C candidate, DESIGN_ONLY

### Pattern A — Field authority + non-destructive override materialization

FreePass Data architecture makes a stronger explicit contract than current Core C machine schemas in one area:

- RAW snapshots remain immutable.
- Human/operator corrections do not rewrite RAW.
- Each canonical field can have an authority policy such as `SOURCE_WINS`, `FREEPASS_WINS`, `CALCULATED`, `SYSTEM`, `MANUAL_OVERRIDE_ALLOWED`, or `REVIEW_REQUIRED`.
- An override is a separate revision-guarded object carrying before/after, reason, authority, actor, effective/expiry time and `expected_revision`.
- Canonical materialization is explicitly modeled as:
  `normalized candidate + authority rule + active override = canonical value`.

Current Core C already has canonical owner/writer, source priority, field provenance, revision and optimistic concurrency, so this is not a replacement. The delta is a **first-class field-level arbitration and non-destructive override contract** that prevents later source synchronization from silently erasing an approved correction.

Generalized C candidate:
- `core-field-authority/v1`
- `core-canonical-override/v1`
- deterministic materialization precedence
- authority/override provenance binding

Evidence level: `DESIGN_BASELINE / DOC_ONLY`.

Verification required before C canonical consideration:
1. Machine-readable schema with compatibility tests.
2. Deterministic materializer implementation.
3. Unit tests for source refresh vs active override precedence.
4. Revision-conflict tests for concurrent override edits.
5. Effective/expiry and revoke behavior tests.
6. Provenance/receipt projection proving which source/override produced each canonical field.
7. Runtime evidence on at least one real domain.

No C canonical artifact is changed by this audit.

### Pattern B — Consumer revision acknowledgment watermark

FreePass Data also specifies consumer-side observability beyond Core C's current generic projection/event/receipt skeleton:

- consumer contract version
- canonical revision
- consumed revision
- `last_ack_revision`
- lag
- health state
- explicit events such as `projection.published`, `consumer.acknowledged`, `delivery.failed`
- completion semantics that distinguish `CANONICAL_COMMITTED`, `PROJECTION_PUBLISHED`, and `CONSUMER_VISIBLE / ACKNOWLEDGED`

Generalized C candidate:
- projection/distribution receipt bound to canonical revision
- consumer acknowledgment watermark
- lag/health semantics
- delivery retry/duplicate semantics tied to revision

This makes “canonical write succeeded” and “downstream consumer has observed that revision” independently provable.

Evidence level: `DESIGN_BASELINE / DOC_ONLY`.

Verification required before C canonical consideration:
- event/schema artifacts
- duplicate/replay tests
- out-of-order acknowledgment tests
- consumer lag recovery tests
- projection rebuild/resend tests
- runtime evidence across at least two consumers

No C canonical artifact is changed by this audit.

## Classification 3 — Project > Core — D candidate, DESIGN_ONLY

### One-way strangler migration with separate read/write cutovers

FreePass Data's migration plan makes the migration workflow more operationally explicit than the current generic Core compatibility sequence:

`LEGACY_DIRECT -> OBSERVE -> SHADOW_READ -> PARITY_VERIFIED -> DATA_GATEWAY_READ -> COMMAND_WRITE -> DIRECT_ACCESS_BLOCKED`

Material aspects:
- read authority moves before write authority
- each consumer migrates independently
- shadow parity is measured before read cutover
- write cutover requires idempotency, revision conflict handling, audit, recovery, permission and receipt
- after cutover, CI blocks forbidden Firebase SDK imports, collection/path strings and RTDB access except migration adapters
- retirement requires runtime evidence; a legacy file existing is not treated as proof of runtime use, and its absence is not treated as proof of retirement

Generalized D candidate:
- migration state machine that separates `READ_CUTOVER`, `WRITE_CUTOVER`, and `LEGACY_ACCESS_BLOCKED`
- transition guards based on parity receipts and runtime smoke
- rollback/recovery path before legacy retirement

C remains the owner of wire/schema compatibility; D candidate is only the transition/workflow semantics around the migration.

Evidence level: `DESIGN_BASELINE / DOC_ONLY`.

Verification required before D canonical consideration:
1. Execute one real consumer through every state.
2. Persist parity evidence for the exact source/target revisions.
3. Verify read rollback before write cutover.
4. Verify idempotent command write and conflict recovery.
5. Demonstrate CI denial of a deliberate reintroduction of direct legacy access.
6. Obtain exact-revision runtime smoke before retirement.

No D canonical artifact is changed by this audit.

## Classification 4 — Project > Core — B candidate, CODE + CI

### Separate semantic interaction-mode breakpoint from layout-density breakpoints

FreePass ERP4 advanced from the previous audited `0cf39d7...` to `2f3eab3...`. Commit `971599b...` introduces a concrete responsive pattern:

- one shared semantic mobile-mode threshold: `SHOP_MOBILE_BP = 600`
- all shop interaction components use the same threshold through `useIsMobile(SHOP_MOBILE_BP)`
- CSS layout density changes independently:
  - 600–759: web behavior, one-column layout
  - >=760: two columns
  - >=1024: three columns
  - >=1280: four columns
  - <600: dedicated mobile interaction flow

Current Core B already says breakpoints should follow content pressure and that the 640px shared breakpoint is only a compatibility reference. The material delta here is stronger: **semantic interaction-mode switching is centralized and explicitly separated from layout-density/reflow thresholds**.

Generalized B candidate:
- `semantic_mode_breakpoint` is distinct from `layout_density_breakpoints`
- one surface must not let JS interaction mode and CSS layout mode drift independently
- content-driven density tiers may change without changing interaction semantics
- surface-level mode threshold is centralized and shared across components

Evidence level: `CODE + EXACT_HEAD_CI + DEPLOYMENT_STATUS`.

Exact-head ERP4 CI run `35512763129` succeeded at `2f3eab3e24b9550c06405d510c6cc855c19ad8d2`, including typecheck, design/token guards, ERP4 MAIN stability lock and production build. Vercel commit status also reports deployment completed successfully. This is deployment evidence, not browser/runtime behavior proof.

Verification required before B canonical consideration:
1. Browser-level probes around 599/600, 759/760, 1023/1024 and 1279/1280.
2. Verify selection, search/filter state, scroll and draft continuity across resizing.
3. Keyboard, zoom/reflow and safe-area checks.
4. Confirm no component uses a conflicting private semantic-mode threshold.
5. Verify actual deployed UI behavior at the exact revision.

No B canonical artifact is changed by this audit.

## Classification 5 — Different

Commit `2f3eab3...` removes agent/contact/ownership attribution from the ERP4 standard label while retaining channel/supplier label behavior. The design-lock checker now prevents phone or business attribution from returning to the standard label.

This is a deliberate product/branding boundary and has exact-head CI/deployment evidence, but it is not generalized into AI Core because the distinction between ERP4 standard/channel/supplier labels is product-specific.

No B/C/D routing is created for this item.

## Core > Project

No new `Core > Project` delta was found in the newly changed revisions inspected in this audit.

The previously recorded ERP4 settlement optimistic-concurrency migration remains a separate existing gap and is not repeated here because the new ERP4 commits do not materially change it.

## Routing summary

- B candidate: semantic interaction-mode breakpoint vs layout-density breakpoint separation — `CODE + CI`, from ERP4.
- C candidate: field authority + non-destructive canonical override materialization — `DESIGN_ONLY`, from FreePass Data.
- C candidate: consumer revision acknowledgment watermark / projection delivery visibility — `DESIGN_ONLY`, from FreePass Data.
- D candidate: staged read-cutover / write-cutover / direct-access-blocked migration workflow — `DESIGN_ONLY`, from FreePass Data.
- Different: standalone FreePass Data repository identity and A registry staleness.
- Different: ERP4 standard-label contact attribution removal.

B/C/D canonical standards were not modified.

## A-session follow-up

1. Re-observe and register `freepass-creator/freepass-data@99071c966453f36c10bd39799949e57bdca41944` as a distinct project/repository identity.
2. Re-observe ERP4 at `2f3eab3e24b9550c06405d510c6cc855c19ad8d2` rather than the stale registry revision.
3. Preserve candidate evidence levels: FreePass Data patterns stay `DESIGN_ONLY` until code/test/runtime proof exists.
4. Route the B/C/D candidates for review without changing canonical standards.
5. Recheck FreePass Data repository visibility before production connectors/internal schemas/secrets are introduced.

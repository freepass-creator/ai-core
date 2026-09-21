# A-session repo audit — 2026-09-21 00:44Z

Status: **A-SESSION EVIDENCE ONLY**  
Previous A-session evidence: `267c87dc5b0517c071153ed42d996db12d401530`  
AI Core canonical revision observed before this evidence write: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`  
B/C/D canonical standards changed by this audit: **NO**

## Scope and method

This audit re-observed connected repositories with material revisions newer than the previous A-session evidence, then inspected changed code, Markdown, schemas/contracts, tests, GitHub Actions/check evidence, and available runtime/deployment evidence. Classification is relative to the exact AI Core revision above.

Material heads observed:

- `freepass-creator/freepass-data@a1a4cc66f4acbbf53b08b7d59551c4130b1bd202`
- `freepass-creator/devcenter@41fcdd6afe0c816d5681a9e4aa468da9c5126409`
- `freepass-creator/freepasserp4@8cfa9f9c79addb01b96682433453e441c61a61fb`
- `freepass-creator/freepass-sales@e2b7fb0077a23c9e9bb2db4635e80cd4ba175492`

Unchanged repositories were not re-promoted. No new Project > Core canonical candidate was strong enough to route to B/C/D in this cycle.

## A-11-01 — Core > Project — FreePass Data mobile bottom-area adoption

### Delta

AI Core added the FreePass product profile rule that separates depth-0 global bottom navigation from depth-1/2 local task actions: global nav is top-level only, local task bars hide global nav, primary actions are one-per-screen, 48px recommended / 44px minimum, default secondary:primary ratio 3:7, with safe-area/keyboard handling.

FreePass Data subsequently implemented the same semantics in `preview/index.html`:

- mobile global nav is five equal columns and `min-height:64px`;
- `review-detail` hides `.mobile-nav`;
- review-detail uses a fixed `.local-actionbar` with safe-area padding;
- task buttons are 48px high;
- mobile tables become card-like rows rather than compressed desktop tables.

### Classification

`Core > Project` — adoption/backport is present at source/preview level.

### Breaking impact

If this behavior is enforced without migration/browser verification, depth changes can hide a navigation route or move task CTAs, and safe-area/virtual-keyboard behavior can make actions unreachable. Existing preview consumers may also assume that global nav is always available.

### Verification still required

- exact-head browser probes at 360/390/412px;
- top-level vs review-detail navigation reachability;
- back/state restoration when global nav is hidden;
- safe-area and virtual-keyboard overlap checks;
- disabled-reason proximity and no duplicate header CTA;
- exact-head CI or Design/Quality receipt.

Evidence level: **SOURCE/PREVIEW CODE; NO EXACT-HEAD ACTIONS RUN**.

## A-11-02 — Core > Project — DevCenter Design Hub UI/UX preflight adoption

### Delta

AI Core introduced the canonical `UI_UX_START_HERE` entrypoint and made product/profile resolution a fail-closed preflight. DevCenter now pins Design Hub directly to `ai-core@ac8c502358c17613a712c9c7e1ab780f51f1eb97`, includes `registry/ui-ux-entrypoint.json`, `docs/UI_UX_START_HERE.md`, and `docs/FREEPASS_PRODUCT_UI_PROFILE.md` in its binding, and requires a product profile before compile.

### Classification

`Core > Project` — the source contract and binding have caught up with the new Core preflight.

### Breaking impact

Legacy Design Job producers/fixtures that omit `product_profile.ui_profile_ref`, or jobs bound to older Core snapshots, can now fail closed/HOLD instead of compiling. Treating this as non-breaking would allow unpinned design work to bypass Core authority.

### Verification still required

- migrate all Design Job producers/fixtures to the new required field;
- run exact-head Design Hub validator/compiler/regression suite;
- prove stale Core binding produces HOLD;
- attach revision-bound adoption/quality receipt.

Evidence level: **CODE/SCHEMA/TEST-DEFINITION + EXACT CORE PIN; NO EXACT-HEAD ACTIONS RUN**.

## A-11-03 — Different — DevCenter readiness snapshot is stale and internally contradictory

`devcenter@41fcdd6.../hubs/readiness.json` still declares:

- DevCenter `e3aa339c873ba212cd604c7fc86079cfaf01ed9a`
- AI Core `0c1d729cfc35a0b37481f71b9770567fa27fe416`
- FreePass Data `bd75b604fcd06358dedaa77edf62284cf0d17ae9`

while the actual observed heads are `41fcdd6...`, `ac8c502...`, and `a1a4cc...`. The same readiness snapshot references Design feedback/runtime evidence that post-dates its declared DevCenter assessment revision.

### Classification

`Different` — evidence integrity/freshness contradiction, not a B/C/D standard delta.

### Required action

Do not hand-edit only the SHA fields. Re-run readiness generation/validators against the exact current repository heads, then emit a new revision-bound readiness receipt. Until then, the readiness percentages/statuses must not be treated as exact-head proof.

## A-11-04 — Different — ERP4 shadow-read non-interference contract vs synchronous latency path

ERP4 added the FreePass Data ERP.com shadow consumer contract:

- active customer read remains `freepasserp5`;
- target `freepass-data/erp-public` is `SHADOW_READ`;
- sequence is `OBSERVE -> SHADOW_READ -> PARITY_VERIFIED -> FREEPASS_DATA_READ`;
- shadow failure policy is `DO_NOT_AFFECT_CUSTOMER_READ`;
- writer cutover remains out of scope.

The implementation performs the observer from the customer full-catalog path with a bounded target request. Errors/mismatch do not replace customer-visible data, but because the observer is awaited, target timeout can still add customer-response latency. That is weaker than a broad reading of `DO_NOT_AFFECT_CUSTOMER_READ`.

### Classification

`Different` — contract/runtime semantics need reconciliation before enabling the production shadow flag.

### Required action / verification

Prefer non-blocking/out-of-band observation so shadow failure cannot affect customer latency. If synchronous behavior is intentionally retained, narrow the contract wording to data non-interference rather than read non-interference. Before flag enablement, inject target timeout/failure and compare p50/p95 customer latency, prove current ERP5 values remain authoritative, and attach parity receipts.

Evidence change: exact-head ERP4 CI `verify` is green on `8cfa9f9...`, but the separate ERP5 canonical refresh for the same head was still in progress when observed. Do not use the in-progress refresh as terminal runtime proof.

## A-11-05 — Different — FreePass Sales now has a real browser regression, not runner-entry failure

Sales advanced to `e2b7fb0077a23c9e9bb2db4635e80cd4ba175492` with the full-contact partner report and current-status / three-call work. The exact-head Sales CI runner now executes setup, dependency install, static checks, AI Core mapping, customer-search adapter, receipt shadow, and D workflow progression shadow successfully, then fails the **Browser regression suite**.

This changes the evidence classification from the earlier zero-step/runner-entry infrastructure failure: the current Sales failure is an executed product test failure and must not be dismissed as runner infrastructure.

### Classification

`Different` — project regression/evidence-level change. The new domain policy/reporting itself is not a new Core B/C/D pattern.

### Required action

Reconcile the browser flow/test expectation and re-run exact-head CI before treating `e2b7fb...` as verified. In parallel, AI Core's `registry/ui-ux-consumers.json` is stale: Sales is still observed at `fe69f76...`, and ERP4 at `de8823e...`, while live heads are `e2b7fb...` and `8cfa9f9...`. Re-observe only after the relevant exact-head evidence is terminal.

## A-11-06 — Different — AI Core Actions evidence changed from runner-entry failure to real test failure

At current Core head `ac8c502358c17613a712c9c7e1ab780f51f1eb97`, `Main State Consistency` no longer fails before runner entry. The Ubuntu runner starts, checkout/setup/npm install succeed, and `npm test` itself fails; all downstream validators are then skipped.

This invalidates the previous blanket interpretation that current Core red Actions are merely zero-step runner-entry failures. Exact-head Core is **not CI verified**.

Observed failure clusters in the executed test log include stale/invalid project registry revision expectations, changed UI/B2 probe expectations, and main-state/successor-episode diff expectations. Those clusters must be reconciled before downstream registry/contract/workflow/UI validators can provide current evidence.

### Classification

`Different` — Core-internal evidence/state contradiction, not a Project > Core candidate.

### Required action

Repair the first failing `npm test` layer against the current canonical files and repository/project revision pins, then re-run `Main State Consistency`. Do not promote downstream validator status from a run in which those steps were skipped.

## Routing result

### Project > Core

No new Project > Core candidate was promoted in this cycle. Therefore **no new B/C/D candidate routing entry was created**.

### Core > Project

- FreePass Data: mobile product-profile adoption is source-level; runtime/browser verification gap remains.
- DevCenter: UI/UX preflight binding is source-level; producer migration and exact-head execution verification remain.

### Different

- DevCenter readiness snapshot stale/self-contradictory.
- ERP4 shadow non-interference contract vs synchronous latency behavior.
- Sales exact-head browser regression and stale Core consumer observation.
- AI Core current Actions changed from runner-entry failure to executed `npm test` failure.

## Canonical-change guard

This evidence record does **not** modify B, C, or D canonical standards. Any later canonical change requires the corresponding B/C/D session to review an explicitly routed candidate with stronger revision-bound execution evidence.
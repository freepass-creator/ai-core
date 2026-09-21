# AI Core A-session repository audit — 2026-09-21T05:28Z

## Scope and comparison baseline

- Previous A-session evidence revision: `c42f1bbcc44dac78ad7193116f3e995d20820924`.
- AI Core canonical comparison target remains `ac8c502358c17613a712c9c7e1ab780f51f1eb97`.
- Repositories with material post-baseline revisions in this observation: `freepass-sales`, `freepasserp4`.
- `freepass-data`, `devcenter`, `freepass-admin`, `freepass-estimate`, and `aiops` had no newer material revision than the preceding A-session observation.
- This file is A-session evidence only. No B/C/D canonical standard is modified.

## 1. FreePass Sales

Observed exact head: `28a78a67660b1db0e31ab54e4c2b2d402b706fa7`.
Previous A-session observed head: `a720a04ec796dab5f890c2edb17f574a345dd6aa`.

### 1.1 Project > Core → D candidate: guarded client update handoff

Commit `223ec1eed9393ccabb169cafaff2d485455e7140` turns installed-PWA update activation into an explicit guarded transition instead of unconditional reload:

- service worker updates are fetched without cache reuse;
- first installation does not force a reload;
- an `UPDATE_READY` transition is deferred while persistence writes are in flight;
- the current local draft is preserved before the reload handoff;
- activation/reload is constrained to one transition for the new shell;
- cache cleanup is namespace-scoped so unrelated application caches survive;
- Playwright regression explicitly exercises first-install, update activation, one-reload, shell replacement, and unrelated-cache preservation.

Generalized candidate:

**Guarded Client Update Handoff** — a client/runtime update that can reload or replace the application shell must be treated as a state transition with an in-flight-write guard, local draft preservation, exactly-once activation semantics, and cache ownership boundaries. First install and upgrade must be distinct states.

Route: **D / Workflow candidate**.

Why this is ahead of current Core: the current canonical contracts cover workflow/recovery and UI interaction generally, but the audited Core revision has no service-worker/PWA client-update contract or explicit rule that a shell update must wait for persistence completion and preserve local draft state.

Status: candidate only. D canonical files are unchanged.

### 1.2 Project > Core → C candidate: contextual normalization of ambiguous authorization errors

Commit `23044a5ef91d5b8d7d2b12dfae46a14e34f8014f` distinguishes two conditions that can arrive through the same Firestore `permission-denied` surface:

- authenticated principal is not an approved/authorized product user → user authorization denial; offer account switch / access remediation;
- authenticated principal is already an approved product user but the provider still returns permission denial → service/rules configuration failure; do not falsely tell the user to request access again.

The same revision adds rules tests proving status-event writer identity, append-only behavior, role-based reads, and denied writes.

AI Core `core-error/v1` already provides `USER / SYSTEM / PROVIDER` categories, and `security-authz-context/v1` carries authenticated principal context. What is missing is a canonical normalization rule for an ambiguous provider error whose causal category changes when expected local authorization state is known.

Generalized candidate:

**Contextual Provider Error Normalization** — adapter/error normalization may combine a provider error with trusted authorization context to classify the actual causal domain. An identical provider code must not automatically map to the same user remediation when one case is user denial and another is service-policy/configuration failure.

Route: **C / Core Contract candidate**.

Status: candidate only. C canonical files are unchanged. The user-facing copy/action difference is a consequence of the C classification; no separate B candidate is opened in this audit.

### 1.3 Different: contact-report terminology cleanup

The remaining observed Sales commits normalize reporting terminology from call-centric labels to contact-centric labels and align CTA/report wording. These are product/domain semantics and do not independently redefine B/C/D.

Classification: **Different**.

### 1.4 Evidence level

Exact-head Sales CI run `35564473814` completed `success` for `28a78a67660b1db0e31ab54e4c2b2d402b706fa7` on a real GitHub runner. Static checks, AI Core UI/UX mapping, customer-search adapter checks, Core receipt shadow, D progression shadow, Playwright browser regressions, and mobile capture all passed.

Evidence level for the two candidates: **CODE + TEST DEFINITIONS + EXACT-HEAD CI/BROWSER**.

The previously recorded Core > Project gap for 40px icon-only action targets is not closed by this green run; no observed commit in this range provides evidence of migration to the Core 44px minimum.

## 2. ERP4 / ERP5

Current repository evidence head: `17927a45d5f27366789a22884bafc2f2267a8de8` (Audit 91 recorder/documentation).
Current application/runtime main merge under audit: `1fa36da21b087aabbb2c0cd2a1cfd493437ae8bf`.
Current pinned production engine: `c3838708b84527db241f1985c140a3ec6ece6bff`.

Keep repository evidence head, application/runtime head, pinned-engine revision, and runtime run ID as separate coordinates.

### 2.1 Evidence-level closure: Audit 89 cross-projection red was resolved before the next pin

Audit 90 records that the prior Atom↔F01↔F86 cross-audit failure was resolved by engine `99167ee27a825e7f8588e49c004297fb019da17f`; production run `35561514414` completed the full chain through cross-audit and photo audit successfully.

This closes the preceding operational red for that engine. It does not verify later pins.

Classification: **Different / evidence-level closure**.

### 2.2 Core > Project → C migration gap: pinned runtime semantics are ahead of the main source registry and verifier

Audit 90 first observed that production engine `2478900272eb742035db5c3743c45a3683161219` uses three RP012 request buckets:

- `LOW_SONOKONG_DAILY` → 중고렌트;
- `LOW_SONOKONG` → 오공구독;
- `LOW_TCAR` → 픽업구독.

The new production pin `c3838708b84527db241f1985c140a3ec6ece6bff` preserves that three-bucket model and adds source-specific status semantics: Sonogong ERP API `계약중` remains `계약중` and listable, while ordinary-sheet `계약중` remains conservatively normalized to `출고불가`.

Current main at application merge `1fa36da...`, however, still declares only `LOW_SONOKONG` and `LOW_TCAR` and retains the obsolete HOLD that the ordinary-rent ERP bucket is not confirmed. Current main also does not contain the pinned engine's `direct-source-status.ts` helper.

The current `source-contract` checker validates source kind/adapter/URL and allows the pinned SHA, but does not fail closed on RP012 channel/hold/status-listability parity. Its adjacent validated-engine comment also says the collector is unchanged from `cf940df6...`, while the pinned engine actually changes `scripts/ingest-supplier-to-firestore.mts` status semantics.

AI Core C already has a revision-bound `core-transformer` contract with source revision, input/output contracts, deterministic semantics, issue codes and verification profiles, plus an SSOT source-registry contract. The project currently has a green main verifier without proving that the main registry/normalizer describes the pinned production transform.

Classification: **Core > Project / C migration-backport gap**.

Breaking impact:

- green `source-contract` / generic CI can be mistaken for semantic parity even when the production engine has additional source channels and different status/listability normalization;
- consumers or operators reading current-main registry truth can make decisions against a stale channel/hold model;
- a future unpinned/main migration could silently change Sonogong `계약중` availability semantics;
- comments/evidence can assert unchanged collector lineage while the actual pinned collector changed.

Verification required before closing:

1. align current-main RP012 registry to the actual three-channel production semantics and remove/replace the obsolete HOLD;
2. represent the source-specific status/listability transform in current-main code or a revision-bound transformer contract instead of leaving it only inside the pinned engine;
3. make Source Contract fail closed on channel/hold/status-listability parity against the pinned engine contract;
4. correct stale validated-engine lineage comments;
5. rerun exact-head `source-contract` and generic verify;
6. obtain a terminal production ERP5 refresh on the same pin, including snapshot, F01/F86 publish, cross-projection parity and photo audit.

### 2.3 Different: explicit default-off Sonogong manual registration writer

PR #450 / merge `f3daed073f4f348be6d947c08e3b8051901938f3` adds `register_sonogong_current`, gated by `workflow_dispatch && apply && register_sonogong_current`, to run RP012 direct ingest with `--apply` against `freepasserp5`.

It uses the same authoritative Sonogong ERP API, so it is a new opt-in writer mode, not a second source authority. Existing Core action/authority principles are sufficient; no new C/D canonical candidate is opened here.

Classification: **Different / writer-topology change**.

The first post-pin run `35564286647` skipped this manual-registration step, so its existence must not be reported as an executed registration.

### 2.4 Core > Project → D gap: recovery evidence improved but continuity is not yet proven closed

Audit 90 records meaningful progress after the previously missed 12:05 logical slot:

- 12:05 recovery ERP5 run `35562037889` ended cancelled;
- 13:05 recovery `35562059650` completed full green;
- a native ERP5 schedule reappeared and run `35562733391` completed successfully at 14:06:54 KST.

This narrows the prior D recovery incident, but it does not by itself close the canonical recovery gap: persisted monitor reconciliation/timeliness remained stale/HOLD, and one later successful native run does not prove monotonic slot reconciliation or exactly-once fallback behavior.

Classification: **Core > Project / D migration gap remains open, evidence improved**.

Required closure evidence remains authoritative terminal reconciliation into monitor state, monotonic logical-slot progression, no replay after known success, and delayed/out-of-order/restart/concurrent-writer tests.

### 2.5 Current exact-head execution evidence

At application/runtime merge `1fa36da...`:

- `verify`: success;
- `source-contract`: success, but semantically incomplete for the mismatch above;
- ERP5 SSOT refresh run `35564286647`: in progress at observation time.

The refresh had completed runner setup, pinned-engine checkout, OIDC, install, source-contract check, source recrawl, T-car audit and ledger-lock sync; the explicit Sonogong manual-registration step was skipped; current atom calculation was still in progress. Therefore `c3838708...` is **not yet terminal production-verified** in this evidence snapshot.

## 3. Routing summary

- **Project > Core → B:** none in this revision range.
- **Project > Core → C:** Sales contextual provider-error normalization.
- **Project > Core → D:** Sales guarded client update handoff.
- **Core > Project → C:** ERP4 pinned runtime source/status semantics are not represented or fail-closed verified by current-main source registry/transformer checks.
- **Core > Project → D:** ERP4 recovery continuity/reconciliation gap remains open, though 13:05 recovery and a later native run improve evidence.
- **Different:** Sales report terminology; ERP4 Audit-89 closure; ERP4 default-off manual registration writer topology.

No B/C/D canonical file was changed by this audit.
# AI Core A-session repository audit — 2026-09-21T04:28Z

## Scope and comparison baseline

- Previous A-session evidence revision: `fe7589def35ffa0bde4e4df7714e8f4b5abae534`.
- AI Core canonical comparison target: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`.
- Repositories with material post-baseline revisions in this observation: `freepass-sales`, `freepasserp4`.
- `freepass-data`, `devcenter`, `freepass-admin`, `freepass-estimate`, and `aiops` had no newer material revision than the previous A-session observation.
- This file is A-session evidence only. B/C/D canonical standards are not modified by this audit.

## 1. FreePass Sales

Observed exact head: `a720a04ec796dab5f890c2edb17f574a345dd6aa`.
Previous A-session observed head: `18a324021a783bdfa7abf33f521542ae7c0a4338`.
The range is four commits ahead and changes UI standard documentation, CSS/JS, static validators, and browser regressions.

### 1.1 Project > Core → B candidate: semantic icon glyph scale by UI role

Project evidence now defines and machine-verifies a role-bound icon system:

- action glyph: 20px;
- bottom-tab glyph: 22px;
- empty-state glyph: 28px;
- brand glyph: 32px;
- shared icon stroke weight: 1.9;
- arbitrary per-call SVG numeric sizing is rejected by static checks;
- browser regressions verify visible glyph dimensions for the declared roles.

The reusable pattern is not the literal Sales pixel set by itself. The generalized candidate is:

**Semantic icon glyph scale by UI role** — products should bind common icon roles to explicit design tokens, keep visual glyph sizing separate from interactive hit-target sizing, and verify the mapping in static/browser checks rather than allowing arbitrary local icon dimensions.

Route: **B / UI-UX candidate**.
Status: candidate only; no B canonical file changed.

### 1.2 Core > Project migration gap: 40px icon-only action target is below Core minimum

The same Sales revision explicitly standardizes icon-only action buttons on a 40px press area, and browser regression asserts 40x40 for settings and search icon buttons.

AI Core canonical UI/UX currently defines a 44 CSS px touch-target minimum for controls / FreePass mobile. Therefore the project is behind Core on interactive target size even though its visual icon system is more explicit.

Classification: **Core > Project / B migration-backport gap**.

Breaking impact:

- a locally enforced 40px target can produce false conformance while violating the canonical accessibility/touch baseline;
- increasing the visual glyph itself is unnecessary and could disrupt density; the migration should preserve the role glyph and enlarge the interactive wrapper/hitbox to at least 44px, preferably 48px where the existing FreePass quick-action profile calls for it;
- neighboring target spacing, focus indication, and layout density must be rechecked because hitbox growth can create overlap or accidental activation if done only with CSS expansion.

Verification required before closing the gap:

1. migrate all icon-only interactive targets to >=44px while preserving role glyph size;
2. verify 360/390/412 mobile widths and keyboard/focus-visible behavior;
3. verify no overlap or horizontal overflow with adjacent controls;
4. rerun static checks, Playwright browser regressions, and mobile capture at the exact revision;
5. register a documented exception only if a real platform/accessibility justification exists; none is evidenced in the observed revision.

### 1.3 Different: search active-state visual parity with bottom navigation

The project now makes the expanded top search action use the same selected-state color/icon-fill language as the active bottom tab while keeping its background transparent. Browser regression compares those computed styles and also preserves focus, list identity, and scroll restoration.

This is useful local consistency evidence, but it does not independently redefine AI Core. Core already owns distinct active/selected/focus semantics and search state continuity; exact color/fill parity is project styling.

Classification: **Different**.

### 1.4 Evidence level

Exact-head Actions run `35560069189` completed successfully for `a720a04ec796dab5f890c2edb17f574a345dd6aa` on a real GitHub runner. Syntax/static checks, AI Core UI/UX mapping, customer-search adapter, Core receipt shadow, D workflow-progression shadow, Playwright browser regression, and mobile capture all completed successfully.

Evidence level for the B candidate is **CODE + DOC + MACHINE CHECK + EXACT-HEAD CI/BROWSER**.

## 2. ERP4 / ERP5 publication and recovery plane

Observed exact head: `6691b0f27c3df91ab07f3e0078903c69a1471f5e`.
Previous A-session observed head: `257e742d73781af89c94809770f1d4208900fba9`.
The range is eight commits ahead and changes recovery audit evidence, the pinned ERP5 publication engine, pipeline source revision, Core shadow revision, and source-contract validation.

### 2.1 Core > Project → D evidence escalation: recovery continuity actually missed 12:05 beyond grace

Audit 88 records that the 2026-09-21 12:05 KST logical settlement slot had neither a native scheduled run nor a heartbeat fallback by 12:53 KST, despite a configured 20-minute missing-schedule grace. The monitor/heartbeat was still stopped at 11:05.

This strengthens the prior D gap. The problem is no longer only stale reconciliation after an authoritative success; the fallback continuity itself failed to protect a due logical slot beyond its declared grace.

Classification: **Core > Project / D migration-backport gap (strengthened evidence)**.

Breaking impact:

- a due settlement can be omitted beyond the promised recovery window even while the control plane appears to have a watchdog;
- stale monitor truth can suppress a needed fallback or authorize replay from obsolete evidence;
- downstream ERP5 refresh timeliness can therefore be broken without an application/business-code regression.

Verification required before closing the gap:

1. reconcile authoritative terminal outcomes into monitor state idempotently;
2. reconcile native/recovery/downstream evidence for the 12:05 logical identity before making a fallback decision;
3. if truly absent, recover that logical identity exactly once and advance cursor/heartbeat monotonically;
4. prove no replay after native or prior-recovery success;
5. test delayed/out-of-order `workflow_run`, process restart, and concurrent monitor writers;
6. keep native scheduler restoration as a separate HOLD from fallback correctness.

### 2.2 Different: ERP5/F86 engine repin changes project projection semantics

The production refresh pin advanced to engine revision `0c31f98d412d9e006e1894804ebe767fc91683f1`, and the pipeline source plus AI Core shadow constant were advanced with it.

That engine fixes the first four F86 tabs to:

1. `상품리스트`
2. `손오공상품`
3. `픽업구독`
4. `오플구독`

It also separates Sonogong low-credit rent/subscription from T-car pickup subscription and keeps F86 as a projection from ERP5 rather than an input authority.

These are project/domain publication semantics, not a reusable AI Core B/C/D pattern.

Classification: **Different**.

### 2.3 Different / evidence-level contradiction: static/source-contract green, exact-head production refresh red after writes

At exact head `6691b0f...`:

- general `verify` check: success;
- `source-contract` check: success;
- production ERP5 refresh run `35560321553`: failure.

The production job successfully completed source recrawl, current atom calculation, Core ingest receipt creation/preservation, policy reconciliation, snapshot capture, public-catalog reconciliation, F01 publication, F86 backup, F86 publication, and the first F86↔atom freshness/column gate.

It then failed at **`원자 ↔ F01 ↔ F86 칸 단위 대조`**. Plate-photo checking and evidence artifact preservation still completed afterward.

This means the new engine pin is **not production-verified**, despite green static/source-contract checks and a successful first F86 canonical/freshness gate. The available evidence does not establish the exact mismatch cause, so the failure must not be downgraded to a harmless audit-only issue.

Required action/evidence:

1. inspect the failed cross-projection parity output and identify the exact field/tab/value mismatch class;
2. compare the new fixed-tab partition against F01 and the canonical atom using the same snapshot identity;
3. determine whether the already-written F01/F86 live projections are semantically valid; if not, restore/republish from the retained F86 backup or last-known-good snapshot according to existing recovery policy;
4. rerun the exact pinned engine to terminal green with the cross-projection gate passing;
5. only then treat `0c31f98...` / `6691b0f...` as production-verified publication evidence.

Classification: **Different / operational evidence change and contradiction**.

## 3. Routing summary

- **Project > Core → B:** one candidate from FreePass Sales: semantic icon glyph scale by UI role.
- **Project > Core → C:** none in this revision range.
- **Project > Core → D:** none in this revision range.
- **Core > Project:** FreePass Sales 40px icon-only target vs Core 44px minimum; ERP4 D recovery reconciliation/continuity gap strengthened by the missed 12:05 slot.
- **Different:** Sales search selected-state visual parity; ERP4 fixed F86 business-tab semantics; ERP4 exact-head post-publish cross-projection parity failure.

No B/C/D canonical standard was changed by this audit.

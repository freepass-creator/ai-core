# AI Core A-session repository audit — 2026-09-21T1000Z

Status: **EVIDENCE ONLY**. This record does **not** modify AI Core B/C/D canonical standards.

Previous A evidence revision: `bca95ab388aedf5301c67648564283f1fb0a61bf` (`A_SESSION_REPO_AUDIT_2026-09-21T0821Z.md`).

AI Core functional comparison revision remains `ac8c502358c17613a712c9c7e1ab780f51f1eb97`; later A commits are evidence records unless separately promoted through the canonical lanes.

## Repositories with material new revisions

- `freepass-creator/freepass-estimate`: `a8fe8bd6...` → `2b7e4d841ba94e2491a7f185d34a9872a402757d`
- `freepass-creator/freepass-sales`: `c1c787ca...` → `7ad07a19b99e6ad5919428eb1cdc120210cb378e`
- `freepass-creator/welrixtable`: material paired consumer changes through `7a072f37feba83b851f278300d03cb50dc389932`
- `freepass-creator/freepasserp4`: application/runtime behavior remained on the previously audited production topology, while recovery/evidence state advanced through Audit 101 (`07a332ec...` evidence head observed after the 18:05 continuity finding).

No material post-baseline revision was observed in FreePass Data, DevCenter, FreePass Admin, AIOps or fp-settlement during this scan. Do not infer conformance changes for those repositories.

## 1. AI Core exact-head evidence changed: A evidence commit is terminal RED

`Main State Consistency` run `35577915105` for exact head `bca95ab388aedf5301c67648564283f1fb0a61bf` completed `failure`.

- runner entry, checkout, Node setup and `npm ci` completed;
- `npm test` failed;
- observed test summary: 888 tests, 787 pass, 100 fail, 1 skip;
- subsequent main-state, registry, A-evidence, contract, workflow and UI/UX validators were skipped;
- failures include project-registry / staged-order consistency and stale exact-revision expectations (including AIOps and Sales examples), so this is not a zero-step Actions infrastructure failure.

**Classification:** `Different / evidence-level change`.

**Action:** AI Core exact-head remains unverified. Restore Core internal registry/test-state consistency before using an A evidence commit as a green canonical observation point.

## 2. FreePass Estimate → B candidate: Activation-Bound Tactile Feedback

Revision `bc2ef7ebf82e57aaea7a91251caa05e55218b641` adds reusable touch/keyboard feedback behavior and dedicated regression tests.

Generalized pattern:

1. visual pressed feedback may begin on a primary press;
2. drag, scroll, pointer cancel, secondary pointer and release outside cancel speculative pressed state;
3. a stale release timer cannot clear a newer press;
4. keyboard activation receives equivalent visual pressed lifecycle;
5. disabled/opt-out controls receive no feedback;
6. device vibration is optional and fires **once only after a trusted completed activation**, never on pointer-down/cancel/untrusted activation.

AI Core B currently requires semantic active/focus/disabled states and modality-equivalent business outcomes, but has no explicit tactile-feedback timing/cancellation contract.

**Classification:** `Project > Core`.

**Route:** **B candidate — `Activation-Bound Tactile Feedback`**.

**Evidence:** implementation + Node test definitions + project `verify` integration + documented browser/production rollout. Exact-head `2b7e4d...` has no GitHub Actions run, and the project documentation explicitly does not claim physical-device vibration verification.

**Promotion gate:** physical-device haptic check where supported; 360/390/412 responsive checks; keyboard/focus parity; feature-unavailable/disabled/opt-out cases; no duplicate feedback for synthetic or retried activation.

## 3. FreePass Estimate → B candidate: Progressive Selection Context Outside the Action Boundary

The same revision introduced an accumulated selection resolver with tests for full exterior/interior/options context, stale-descendant invalidation after an upstream model change, immutable shared-confirmed snapshot usage and empty-selection suppression.

Follow-up `cfc34a60f0737c6e89a7582bff2bb2af3adba468` moved the compact selection context **out of the fixed action footer** and adjacent to the active task/vehicle breadcrumb. Final head `2b7e4d841ba94e2491a7f185d34a9872a402757d` removed sticky positioning so the summary scrolls normally with task content while keeping the bottom action area action-only.

Generalized pattern:

- progressive configuration surfaces expose compact accumulated context near the active task, not inside the action boundary;
- changing a parent selection invalidates stale child context;
- confirmed/shared state renders from an immutable confirmed snapshot rather than mutable draft state;
- empty context is not rendered;
- the context participates in normal document flow unless a separately justified sticky behavior is required.

**Classification:** `Project > Core`.

**Route:** **B candidate — `Progressive Selection Context`**.

**Evidence:** code + resolver regressions + documented production/browser verification on the prior deployed revisions + latest build pass statement. Exact-head GitHub Actions evidence is absent.

**Authority note:** project docs currently call the haptics/selection modules “canonical” and distribute them byte-identically to a consumer. This is acceptable as project evidence distribution only; it must **not** become a second B authority. If B adopts the pattern, AI Core/DevCenter must become the standards source. Otherwise scope the module explicitly to the estimator family.

## 4. Sales + Welrix → B candidate: Bound Cross-Surface Return Context

Sales revision `b7b6ea2c16d9d60d9f7508cafb2dd162a878963c` launches the estimator with `from=promotion`, `force=mobile`, `returnCar`, and existing vehicle-selection keys.

Welrix revision `640aafda4c15541d44aefc2836ba5329d8252859` implements the return edge by constructing the destination locally:

- return origin is fixed to the promotion application;
- `returnCar` is accepted only from a known model allowlist;
- invalid, path-like, protocol-relative, script-like and unknown values fall back to the fixed promotion list;
- referrer fallback is accepted only for the exact expected origin and root path;
- arbitrary redirect URLs are never accepted;
- documented 320/390/1280 list→quote→list and detail→quote→same-detail probes passed.

AI Core B has a generic `navigation.restore` contract-only feature but does not currently express a cross-surface handoff contract that binds return origin + entity context while rejecting arbitrary redirect input.

**Classification:** `Project > Core`.

**Route:** **B candidate — `Bound Cross-Surface Return Context`**.

**Evidence:** paired producer/consumer code + dedicated `check-promotion-return.mjs` assertions + documented browser probes. Current Welrix head `7a072f3...` has a green `Mobile UX QA` run, but `package.json` does not wire `check-promotion-return.mjs` into its normal CI script set.

**Promotion gate:** put the return-contract test into exact-head CI; verify direct-entry fallback, stale/deleted entity fallback, encoded/unicode values, same-origin path restrictions, history/back behavior and 360/390/412/1280 layout.

## 5. Welrix Core > Project migration gap: promotion return target is below Core minimum

In `640aafd...`, `.m-promotion-back` is rendered with `flex: 0 0 32px; height: 40px`. AI Core B locks the touch target baseline at **44 CSS px** (`control.touch_minimum_px = 44`, preferred quick action 48).

**Classification:** `Core > Project`.

**Breaking impact:** accessibility/touch reliability; the new cross-surface return affordance can be visually correct and still fail Core conformance on its hit area.

**Backport:** preserve the visual glyph if desired, but provide a minimum 44×44 CSS-px interactive box (prefer 48 for a mobile quick action) without header collision.

**Verification:** 360/390/412/1280, keyboard focus-visible, accessible name, adjacent-target spacing, zoom/reflow and no brand/header overlap.

## 6. ERP4 evidence improved: `0e0bfb3...` now has a full-green production-equivalent chain

The recovered 17:05 KST chain produced settlement run `35580899275` and downstream ERP5 run `35580953322`. The downstream run completed `success` through pinned engine/source contract, source recollection, settlement lock, Atom calculation, Core receipt shadow, policy reconciliation, fixed snapshot, public catalog, F01 publish, F86 backup/publish, F86 freshness/Atom parity, Atom↔F01↔F86 cell cross-audit, photo-link audit and evidence retention. `register_sonogong_current` remained skipped.

Persistent monitor state was subsequently updated so 17:05 is `success`, production writes are true, audits pass, and `lastKnownGoodErp5RunId = 35580953322`.

**Classification:** `Different / evidence-level improvement`.

**Impact:** the prior production-equivalent validation HOLD on configured engine `0e0bfb3a6e227fd65b754c1d74f7ca5c8b1c327e` can be considered resolved for the observed data-plane path. This does **not** close the separately recorded RP012 current-main Source Registry/normalizer semantic-parity gap.

## 7. ERP4 Core > Project D gap strengthened: final 18:05 slot is unprotected beyond grace

Recovery quality remains materially behind AI Core D.

- 17:05 itself required a recovery commit at 18:00:37 KST, ~55 minutes after the logical slot and well beyond the repository’s 20-minute recovery grace, even though its eventual downstream result became full-green.
- Audit 101 then observed the next/final 18:05 KST slot at ~18:44 KST with **no native scheduled run and no fallback recovery**.
- `.automation/safe-chain-monitor.json` still ended at `lastHeartbeatSlot = 17:05`, `lastCheckedThroughSlot = 17:05`, with its last check before the 18:25 recovery-eligibility threshold.

**Classification:** `Core > Project` — existing **D** migration/backport gap, evidence escalated.

**Breaking impact:** a logical slot can remain completely unprotected after the declared grace even though the previous slot eventually succeeded. Last-known-good data remains valid, but scheduler/recovery continuity cannot be claimed.

**Verification/backport needs:** authoritative terminal reconciliation; monotonic slot cursor; evaluate each due slot after grace; exactly-one recovery per logical identity when no success evidence exists; no replay after native/recovery success; cancelled/failed/ambiguous outcome handling; restart/delayed/out-of-order/concurrent-monitor tests; explicit recovery-latency SLO assertion.

## 8. ERP4 contradiction: dedicated Source Contract verifier is still a latent main-branch writer

Current `.github/workflows/ssot-source-contract.yml` still declares `permissions: contents: write` and includes an `audit95-recorder` job that:

- checks out full history;
- `git reset --hard origin/main`;
- writes audit content;
- restores the workflow file itself from historical commit `cf71d4c...`;
- commits; and
- pushes `HEAD:main`.

This is unrelated to inventory source-contract verification and can mutate `main` whenever the dedicated verifier runs.

**Classification:** `Different / authority contradiction` (action required). It is not promoted as a new C/D candidate.

**Impact:** a green Source Contract run cannot be treated as a pure fail-closed verification receipt while the workflow also contains a historical repository writer. The job can also reintroduce old workflow content.

**Action:** remove/neutralize `audit95-recorder`, reduce verifier permissions to read-only where possible, and obtain a clean exact-head Source Contract run whose jobs only verify the current source/contract state. Keep the existing Core > Project C RP012 semantic-parity gap open until the checker also fail-closes on the actual source-specific channel/status/listability semantics.

## 9. Sales/Welrix remaining deltas

Sales exact head `7ad07a19b99e6ad5919428eb1cdc120210cb378e` has a green `Sales CI` run (`35582302320`) through static checks, AI Core UI/UX mapping, customer-search adapter, receipt shadow, D workflow progression shadow, Playwright browser regression and mobile capture.

Welrix exact head `7a072f37feba83b851f278300d03cb50dc389932` has a green `Mobile UX QA` run (`35584614078`) through quote adapter contract, production build, Playwright mobile simulation and screenshot artifact upload.

Promotion theme/delivery-estimate copy, condition-table placement and secondary-action styling are product-specific or ordinary B-aligned implementation deltas and are classified `Different`; they do not create additional Core candidates in this scan.

## Routing summary

- **B candidates (Project > Core):**
  1. Activation-Bound Tactile Feedback — FreePass Estimate.
  2. Progressive Selection Context — FreePass Estimate.
  3. Bound Cross-Surface Return Context — Sales + Welrix.
- **C candidates (Project > Core):** none new.
- **D candidates (Project > Core):** none new.
- **Core > Project gaps:**
  - Welrix promotion-return touch target < 44 CSS px (B backport/conformance gap).
  - ERP4 recovery continuity / monotonic slot protection remains open and is stronger at 18:05 (D backport gap).
  - Previously recorded ERP4 RP012 source semantic-parity gap remains open; no duplicate reclassification in this scan.
- **Different requiring action:** AI Core exact-head Main State Consistency red; ERP4 Source Contract latent `audit95-recorder` main writer.

No B/C/D canonical file was changed by this audit.
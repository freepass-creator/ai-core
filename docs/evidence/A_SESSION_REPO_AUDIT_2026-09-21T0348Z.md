# AI Core A-session repository audit — 2026-09-21T03:48Z

## Scope and comparison baseline

- Previous A-session evidence revision: `7ed56835c2a2434877f6c20ee6d49e73a2323ef4`.
- AI Core canonical comparison target: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`.
- Repositories with material post-baseline revisions in this observation: `freepass-sales`, `freepasserp4`.
- `freepass-data`, `devcenter`, `freepass-admin`, `freepass-estimate`, and `aiops` had no newer material revision than the previous A-session observation.
- This file is A-session evidence only. B/C/D canonical standards are not modified by this audit.

## 1. FreePass Sales

Observed exact head: `18a324021a783bdfa7abf33f521542ae7c0a4338`.
Previous A-session observed head: `6557807e19b7dc0da7b08622aeb8301218ec256f`.
The range is ten commits ahead and changes UI standard documentation, CSS/JS, static validators, browser regressions, and operator-facing copy.

### 1.1 Project > Core → B candidate: Borderless control semantics with accessibility exception

Project evidence now makes the following rule explicit and machine-verifiable:

- buttons, button-like links, selection chips, and status badges do not use visual border or box-shadow as their primary state language;
- selection/state is communicated with background, text color, and contrast;
- keyboard `focus-visible` outline remains mandatory and is not treated as a forbidden visual border;
- form input borders and structural information-card separators are outside this rule;
- browser/static validation checks the rule across responsive and theme cases.

Generalized candidate: **Borderless control semantics with accessibility exception**.
Route: **B / UI-UX candidate**.
Status: candidate only; no B canonical file changed.

### 1.2 Project > Core → B candidate: Operator-facing copy boundary / implementation-leak gate

Project evidence now makes the following UI boundary explicit and partially machine-enforced:

- operator/customer UI uses business terms immediately understandable to the user;
- internal implementation/operations vocabulary such as server, validator, canonical/SSOT implementation wording, or raw failure prose must not leak into user-facing guidance;
- error copy gives a safe next action rather than guessing a technical root cause;
- helper prose is omitted when action/state already communicates the meaning;
- forbidden-phrase/static checks and browser assertions cover this boundary.

Generalized candidate: **Operator-facing copy boundary / implementation-leak gate**.
Route: **B / UI-UX candidate**.
Status: candidate only; no B canonical file changed.

### 1.3 Evidence level

Exact-head Actions run `35558475135` completed successfully for head `18a324021a783bdfa7abf33f521542ae7c0a4338` on a real GitHub runner. Static checks, AI Core UI/UX mapping, Core receipt shadow, D workflow-progression shadow, Playwright browser regression, and mobile capture all completed successfully.

Evidence level for the two B candidates is therefore **CODE + DOC + MACHINE CHECK + EXACT-HEAD CI/BROWSER**. This raises confidence for review, but does not automatically promote either rule into B canonical.

## 2. ERP4 recovery plane

Observed exact head: `257e742d73781af89c94809770f1d4208900fba9`.
Previous A-session observed head: `8cd07e22d5aef97fe64af6f568a3de2246be9457`.
The observed range changes recovery heartbeat/audit state and audit documentation only; no application/business code or business schema change was found.

### 2.1 Different: 10:05 and 11:05 downstream outcomes

The 10:05 KST fallback settlement chain reached ERP5 production writes but the ERP5 run `35556005697` failed post-publish canonical tab-order checks. Evidence states F01↔F86 row/value parity had zero missing/extra/value mismatches while the same tab-order assertion failed.

The 11:05 KST fallback downstream ERP5 run `35556051763` subsequently completed with `success` at the GitHub Actions authority.

This is operational evidence, not a new Core candidate.

### 2.2 Core > Project → D backport gap: terminal reconciliation and monotonic next-slot progression

The persistent `.automation/safe-chain-monitor.json` at exact head still records the 11:05 slot as `erp5-in-progress` and still points `lastKnownGoodErp5RunId` to the older 09:05 success, despite authoritative Actions evidence that ERP5 run `35556051763` terminated successfully.

The monitor also remains checked through/heartbeat at 11:05. The native `schedule` event has still not produced a current 2026-09-21 settlement cadence. By the observation point, the 12:05 logical slot had exceeded the configured 20-minute grace window, but no 12:05 fallback/recovery evidence was present in the repository state.

AI Core D recovery policy already requires authoritative terminal reconciliation, same-logical-identity reconciliation before fallback, known-success replay suppression, monotonic cursor progress, and HOLD for ambiguous outcomes. ERP4 therefore remains behind Core in the recovery plane.

Classification: **Core > Project / D migration-backport gap**.

Breaking impact:

- stale last-known-good and in-progress state can lead the recovery controller to suppress a needed fallback or make a replay decision from obsolete evidence;
- failure to advance the next logical slot can leave the scheduled operation without evidence of execution while the native scheduler is absent;
- impact is isolated to recovery/control-plane correctness; no new ERP application/business semantic regression was found in this revision range.

Verification required before closing the gap:

1. reconcile the authoritative 11:05 terminal success into the persistent monitor idempotently;
2. reconcile native/recovery/downstream evidence for the 12:05 logical identity before any fallback decision;
3. if 12:05 is truly absent, recover it exactly once and advance the cursor monotonically;
4. prove no replay after native or prior-recovery success;
5. test delayed/out-of-order `workflow_run`, process restart, and concurrent monitor writers;
6. track native scheduler restoration as a separate HOLD from fallback correctness.

## 3. Routing summary

- **Project > Core → B:** two candidates from FreePass Sales: borderless control semantics with accessibility exception; operator-facing copy boundary / implementation-leak gate.
- **Project > Core → C:** none in this revision range.
- **Project > Core → D:** none in this revision range.
- **Core > Project:** ERP4 D recovery reconciliation / next-slot progression gap.
- **Different:** ERP4 10:05 post-publish tab-order failure and 11:05 authoritative downstream success; Sales local motion/copy refinements that do not independently redefine Core.

No B/C/D canonical standard was changed by this audit.
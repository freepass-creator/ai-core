# A-session repo audit — 2026-09-21 02:35Z

Status: **A-SESSION EVIDENCE ONLY**  
Previous A-session evidence: `513656b5571614ecea5250f28b8b408a68ff06c1`  
AI Core canonical revision used for comparison: `ac8c502358c17613a712c9c7e1ab780f51f1eb97`  
B/C/D canonical standards changed by this audit: **NO**

## Scope and revision scan

Connected repositories were re-scanned for revisions newer than the previous A-session evidence write. Material new heads were found in:

- `freepass-creator/freepass-sales@6557807e19b7dc0da7b08622aeb8301218ec256f`
- `freepass-creator/freepasserp4@8cd07e22d5aef97fe64af6f568a3de2246be9457`

No newer material revision was found in FreePass Data, DevCenter, FreePass Admin, FreePass Estimate, AIOps, or AI Core canonical code during this scan. AI Core main before this evidence write remained `513656b5...`; canonical comparison remains `ac8c5023...`.

## A-13-01 — Project > Core — editable seeded draft protected before external handoff

### Project delta

FreePass Sales advanced from the previously audited `e2b7fb0077a23c9e9bb2db4635e80cd4ba175492` to `6557807e19b7dc0da7b08622aeb8301218ec256f` through six commits focused on status labels and SMS composition.

The resulting interaction is materially stronger than the prior direct external-action flow:

- the first SMS action opens an in-app preview/composition surface and does **not** immediately open the OS SMS composer;
- a template/type selector seeds a draft body;
- the seeded body is editable;
- after the user edits the body, changing the related sales progress status does **not** overwrite the dirty draft;
- explicit send/handoff passes the exact edited body, including leading/trailing line breaks, to the OS SMS composer;
- browser regression tests exercise the behavior at 360px and 390px widths.

Exact-head Sales CI run `35554408956` is green. The job entered a real GitHub-hosted runner and passed dependency/setup, static checks, AI Core UI/UX mapping, customer-search adapter, receipt shadow, D workflow progression shadow, the Browser regression suite, mobile capture, and artifact upload.

This is also an evidence-level change from the previously audited `e2b7fb...` head, where the runner executed but the Browser regression suite failed.

### Core comparison

AI Core B already defines:

- generic `workflow.draft` / textarea draft preservation;
- recoverable-input preservation;
- `integration.external-action` semantics where requested/launched/server-committed/business-confirmed are distinct and opening SMS/phone/email is not completion.

However, the current common interaction contract does not explicitly define a reusable **template-seeded dirty-draft ownership barrier**: after generated/context-derived content has seeded an editable draft, subsequent upstream context/status changes must not overwrite user-owned dirty content unless the user explicitly resets/reapplies a template.

This Sales implementation therefore contributes a narrower reusable behavior rather than a new external-action completion model.

### Classification

`Project > Core`

### Generalized candidate

**Seeded Draft Ownership Before External Handoff**

A reusable UI contract should distinguish:

1. generated/template seed state;
2. user-dirty draft state;
3. upstream context/template refresh; and
4. explicit external handoff.

Once the user has modified a seeded draft, automatic context refresh must fail-safe toward preserving the user's draft. Replacing it should require an explicit user action or a conflict/reset affordance. External handoff should use the exact current draft payload, not silently regenerate from current status at launch time.

### Routing

- **B candidate — UI/UX:** seeded draft ownership, dirty-draft overwrite protection, explicit preview/edit/handoff boundary, and exact-payload handoff verification.
- **C:** no new Core Contract candidate from this delta.
- **D:** no new Workflow candidate. Draft composition is local interaction state; Core D already requires that UI not invent business workflow and already separates external launch from verified completion.

No B canonical file is changed by this audit.

### Promotion verification

Before B promotion beyond candidate status, verify the same behavior in a second independent domain or common component and add cases for explicit template reset/reapply, recipient/entity switch, navigation/back restoration, IME composition, virtual-keyboard/safe-area behavior, and stale async template refresh arriving after the user has edited.

Evidence level: **CODE + BROWSER TEST + EXACT-HEAD CI GREEN**. No separate production-delivery receipt was established in this audit.

## A-13-02 — Different + Core > Project — ERP4 recovery evidence closed, but monitor/recovery continuity diverges from Core D

### Evidence delta

ERP4 advanced from `b5734e4d0f7dc1f248ab40bd45b94fda3dbac1bd` to `8cd07e22d5aef97fe64af6f568a3de2246be9457`. The net application/business-code diff is zero; the 13-commit range adds audit evidence only, with temporary one-shot recorder workflows created and removed.

The prior audit left ERP5 recovery run `35550547914` in progress. It is now terminal **success** (`completed`, `conclusion=success`, updated `2026-09-21T01:32:58Z`). Therefore the earlier 09:05 KST recovered chain can now be treated as terminal success evidence rather than pending.

A new operational contradiction then appeared:

- the next expected settlement logical slot, `2026-09-21 10:05 KST`, was still not observed as a native scheduled run after the 20-minute grace;
- no heartbeat fallback for the 10:05 slot was observed by the project audit cutoff;
- `.automation/heartbeats/settlement-intake-sync.txt` still points to `09:05`;
- `.automation/safe-chain-monitor.json` still says the already-successful ERP5 run `35550547914` is `erp5-in-progress`, keeps production writes/audits pending, and leaves `lastKnownGoodErp5RunId` on an older run;
- the newest repository-wide native `event=schedule` remains `35447185563` from 2026-09-19;
- current exact-head generic CI `35554285951` is green, but that does not repair or prove scheduler/recovery continuity.

### Classification

The 09:05 chain completion is `Different` — operational evidence change.

The persistent monitor/recovery behavior is `Core > Project` — migration/backport gap against AI Core D recovery-pilot semantics.

### Core comparison

AI Core D recovery policy already requires a participating recovery implementation to:

- correlate execution paths to one logical execution identity;
- reconcile authoritative success before fallback;
- suppress fallback after known success;
- preserve monotonic recovery progress; and
- HOLD ambiguous outcome rather than blindly replay.

ERP4's current persistent monitor has not reconciled authoritative success for `35550547914` and has not advanced beyond the prior logical slot, while the next missing slot also failed to produce a recovery heartbeat. That is weaker than the current Core D recovery contract and is now an actionable backport gap rather than only a scheduler observation.

### Breaking impact

A naive fix that simply advances `lastHeartbeatSlot` or marks the last run successful can skip an unprocessed slot, replay an already-successful slot, or incorrectly treat settlement success as downstream ERP5 completion. Recovery state must preserve separate identities and terminality for logical slot, settlement execution, downstream ERP5 execution, and audit completion.

### Migration / backport requirement

Backport Core D recovery semantics into the safe-chain monitor without changing canonical D:

- derive reconciliation from authoritative Actions/run evidence rather than stale local monitor flags;
- update completed downstream state idempotently with compare-and-set/expected-state protection;
- advance logical slots monotonically only after the required terminal evidence for the previous slot is known;
- recover a missing next slot exactly once after grace;
- retain HOLD when run discovery/outcome is ambiguous;
- preserve no-replay protection for already-successful native or recovered executions.

### Verification required

- deterministic replay of the `09:05` case: downstream Actions success while monitor still says in-progress, followed by idempotent reconciliation;
- `10:05` missing native trigger → one fallback after grace → one downstream chain;
- no duplicate fallback for an already-successful native slot;
- out-of-order run discovery and delayed workflow_run completion;
- process restart with persisted monitor state;
- stale/parallel monitor writers and compare-and-set conflict handling;
- exact revision-bound runtime receipt proving slot progression and monitor reconciliation.

## A-13-03 — Different — Sales Core consumer observation is now materially stale but re-observation is unblocked

AI Core `registry/ui-ux-consumers.json` still observes FreePass Sales at `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`, while the live Sales head is now `6557807e19b7dc0da7b08622aeb8301218ec256f`.

The prior reason to defer re-observation — an executed Browser regression failure on `e2b7fb...` — is no longer present at the new head because exact-head CI and Browser regression are green. Therefore this stale revision now requires action: re-observe Sales at `6557807...`, capture the new B-candidate behavior as evidence only, and do not mark conformance until B decides whether the candidate belongs in the common standard.

ERP4's UI/UX consumer observation also remains stale (`de8823e...` vs live `8cd07e...`), but the new ERP4 delta is audit-only and does not provide new UI/UX conformance evidence; no B registry mutation is warranted from this A audit.

## Routing result

### Project > Core

- FreePass Sales `6557807...` → **B candidate:** Seeded Draft Ownership Before External Handoff.
- No new C candidate.
- No new D candidate.

### Core > Project

- ERP4 `8cd07e...` → safe-chain recovery monitor reconciliation/monotonic slot progression gap against current D recovery-pilot semantics.

### Different

- ERP4 prior `09:05` downstream ERP5 run is now terminal success.
- Sales exact-head evidence changed from Browser regression failure to green full browser CI.
- Sales Core consumer observation is stale and re-observation is now unblocked.

## Canonical-change guard

This evidence record does **not** modify B, C, or D canonical standards. B receives a candidate only; ERP4 receives a backport gap only. Any canonical promotion remains owned by the receiving B/C/D session.
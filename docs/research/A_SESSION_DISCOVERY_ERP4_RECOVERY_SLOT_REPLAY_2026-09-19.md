# A Session Discovery Delta — ERP4 Recovery Slot Replay

상태: **PROJECT_VERIFIED / ROUTED_TO_D_C / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: FreePass ERP4
- Repository: `freepass-creator/freepasserp4`
- Source path:
  - `.automation/safe-chain-monitor.json`
  - `docs/AI-SSOT-AUDIT-LOG.md`
  - `docs/ai-ssot-audit/2026-09-19-chatgpt-audit76-false-settlement-recovery-replayed-successful-native-slot.md`
- Revision:
  - current observed source head: `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`
  - audit evidence: `1cf94b788a204777109cf2031b1f518fbcd99b01`
  - fallback-chain success state: `159b1970d5751386136ff9a58797b86a443087ee`
  - fallback trigger commit: `a6293e5845adde5bf4a86e384fc025bbf4fc73d8`
  - AI Core comparison baseline observed before this delta: `444066bea9ac00e4cf4ba539c7b5344154bd407e`
- Category: Workflow / Recovery / Idempotency, with Core Contract support
- Current implementation:
  - logical settlement slot `2026-09-19 18:05 KST` had a successful native schedule run `35434637121`.
  - downstream ERP5 run `35434667030` also succeeded.
  - later recovery logic still classified the same logical slot as missing and triggered fallback settlement run `35439018911`.
  - that fallback triggered a second downstream ERP5 run `35439046831`, also successful.
- AI Core equivalent:
  - Workflow research already defines idempotent transition using `transition_request_id`, `idempotency_key`, `source_event_id`, and revision binding.
  - Engine/Adapter research already requires write retry to carry an idempotency contract.
  - Recovery exists only as a generic workflow contract area; no explicit cross-path logical schedule-slot identity and pre-recovery success reconciliation rule is recorded.
- Gap:
  - generic transition/write idempotency does not by itself prevent a native path and a fallback path from executing the same logical scheduled work twice.
  - recovery eligibility needs evidence reconciliation against successful native execution and prior recovery history before fallback.
  - recovery cursor/slot state needs monotonic no-replay semantics across native, fallback, and downstream chains.
- Project ahead / Core ahead / Different:
  - **Project ahead on this specific failure-derived recovery contract.**
  - AI Core is broader on generic idempotency, but the ERP4 production incident exposes a missing specialization that is reusable beyond ERP4.
- Evidence:
  - native success: settlement `35434637121` + downstream ERP5 `35434667030`
  - fallback replay: settlement `35439018911` + downstream ERP5 `35439046831`
  - audit explicitly does **not** claim duplicate rows or data corruption; the verified defect is redundant same-slot production replay caused by recovery eligibility/reconciliation drift.
- Generalizable: Yes
  - extract: **logical execution identity + success-evidence reconciliation + recovery no-replay**
  - do not import ERP4-specific times, workflow names, run IDs, or settlement semantics.
- Destination:
  - D — primary: recovery/fallback state-machine semantics and guards
  - C — secondary: logical execution identity/idempotency contract shared by native/fallback/downstream paths
- Recommended action:
  - D should evaluate a machine-readable recovery contract that can bind all execution paths to one logical work identity and make fallback eligibility evidence-driven.
  - C should evaluate the minimum identity/idempotency fields needed so those paths can correlate the same logical execution.
  - Exact field names and final semantics remain B/C/D canonical-owner decisions, not A-session decisions.
- Migration impact:
  - AI Core: additive candidate; no canonical breaking change until C/D adoption.
  - ERP4: recovery decision should reconcile known successful native runs and prior recovery state before fallback.
  - Cross-project promotion requires an independent second-project implementation or failure case.
- Status: `PROJECT_VERIFIED / SECOND_PROJECT_REQUIRED`

## Reverse Import Pipeline

- Discover: DONE
- Evidence: DONE
- Compare: DONE
- Extract Pattern: DONE
- Generalize: DONE
- Assign B/C/D: DONE — D primary, C secondary
- Create Core Candidate: DONE — `workflow.recovery-slot-no-replay`
- Core adoption 확인: PENDING — C/D owner decision required
- Source revision 기록: DONE
- 완료: PENDING until canonical adoption or rejection is recorded

## Adjacent evidence — not counted as second project

AIOps contains related mechanisms:

- `lib/gwataeryo-run-manifest.mjs`: runId/input fingerprint/stage-state based resume semantics and a deterministic `requestKey`.
- `lib/lease.mjs`: single-writer lease/heartbeat/lost semantics.
- completed manifest stages cannot be silently rewritten.

These support the general direction, but they do not yet prove the exact rule “successful native schedule execution suppresses fallback for the same logical slot.” Therefore this discovery remains **PROJECT_VERIFIED**, not CROSS_PROJECT_VERIFIED.

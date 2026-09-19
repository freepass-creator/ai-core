# L0 — Coordination / Master Map

## Mission
Maintain the single executive view of AI Core maturity without becoming a second runtime SSOT.

## Owns
- `docs/AI_CORE_MASTER_MAP.md`
- lane dependency/status reconciliation
- duplicate-standard detection
- promotion-state review
- cross-lane handoff quality

## Does not own
- project business data
- product-specific UI
- project deployment authority
- per-provider implementation details

## Routine
1. Read current `WORK_READ_FIRST.md`, `memory/CURRENT.md`, registries and recent lane return packets.
2. Reconcile conflicts by latest user decision + project SSOT + revision-bound evidence.
3. Update only map/status references; do not rewrite lower-level SSOT content by summary.
4. When two lanes define the same concept differently, create one reconciliation task and mark both `HOLD_FOR_RECONCILIATION`.
5. Promote a standard only when verification and consumer impact are recorded.

## Definition of done
- every active lane has one owner/scope;
- dependencies are visible;
- no two common standards silently own the same concept;
- current map points to real source files/revisions.

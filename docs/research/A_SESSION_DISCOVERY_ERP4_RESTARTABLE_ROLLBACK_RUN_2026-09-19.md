# A Session Discovery — ERP4 Restartable Rollback Run

상태: **PROJECT_VERIFIED / ROUTED_TO_D / CLOSEOUT_HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

> Phase 1 closeout freeze 적용: 이 기록은 `research/a-session-post-phase1-c-v1` branch에만 둔다.

## Discovery

- Project: FreePass ERP4
- Repository: `freepass-creator/freepasserp4`
- Revision: `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`
- Evidence:
  - `lib/domain/ironrentcar-rollback.ts@d99bd80fae96d9479e4aff673bd33e384cdaf633`
  - `app/api/inventory/ironrentcar/rollback/route.ts@68f2dc72b4275533d229be2d72e8e1220638cd36`
  - `scripts/sim-ironrentcar-rollback.mts@b77e4ea32fe503bb81444efed0eaf42224ec8bbf`
- Category: Workflow / Rollback / Compensation / Recovery

## Current implementation

ERP4 models one synchronization run with explicit rollback lifecycle:

`prepared → apply_failed | applied → rollback_products_restored → rolled_back`

The run preserves affected-key preimages/postimages, partner/control snapshots, before/after digests, revision, actor, audit IDs and rollback timestamps.

Rollback preconditions verify:
- explicit confirmation;
- expected revision and after digest;
- latest applied run identity;
- exact control/partner/post-apply product state;
- absence of new contract locks.

Stage 1 restores products and persists `rollback_products_restored`.
Stage 2 restores partner/control and persists `rolled_back`.

If stage 2 fails, the API exposes the intermediate rollback state and later requests can resume from it.

Simulation verifies exact restoration, concurrent-change blocking, contract-lock blocking, stale revision/digest rejection, latest-run guard, restartability, double-rollback prevention, audit binding and unrelated-state preservation.

## Comparison

This is related to Renman `workflow.compensated-multiwrite` but is not counted as the same exact implementation:
- Renman = automatic compensation after forward-write failure.
- ERP4 = explicit rollback of an already applied run using persisted preimages/CAS and restartable phases.

## Generalized pattern

**rollback is a revision-bound workflow, not a button that writes old values**

1. stable forward-run identity;
2. exact rollback preconditions/evidence;
3. revision/digest-bound rollback request;
4. current state must still match expected post-apply state;
5. domain safety guards may veto rollback;
6. phases are atomic where possible;
7. intermediate rollback state is persisted;
8. retry resumes from persisted phase;
9. no completion claim until all phases finish;
10. each phase is audited;
11. repeated rollback is idempotently blocked.

## Candidate

- id: `workflow.restartable-rollback-run`
- evidence: `PROJECT_VERIFIED`
- destination: D
- next gate: `SECOND_PROJECT_REQUIRED`

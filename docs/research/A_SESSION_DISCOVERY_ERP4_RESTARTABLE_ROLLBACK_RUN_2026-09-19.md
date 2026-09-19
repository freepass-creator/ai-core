# A Session Discovery — ERP4 Restartable Rollback Run

상태: **PROJECT_VERIFIED / ROUTED_TO_D / CLOSEOUT_HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

> Phase 1 closeout freeze 적용: 이 기록은 `research/a-session-post-phase1` branch에만 둔다.

## Discovery

- Project: FreePass ERP4
- Repository: `freepass-creator/freepasserp4`
- Source path:
  - `lib/domain/ironrentcar-rollback.ts`
  - `app/api/inventory/ironrentcar/rollback/route.ts`
  - `scripts/sim-ironrentcar-rollback.mts`
- Revision:
  - observed repository head: `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`
  - rollback domain blob: `d99bd80fae96d9479e4aff673bd33e384cdaf633`
  - rollback route blob: `68f2dc72b4275533d229be2d72e8e1220638cd36`
  - rollback simulation blob: `b77e4ea32fe503bb81444efed0eaf42224ec8bbf`
- Category: Workflow / Rollback / Compensation / Recovery

## Current implementation

ERP4 models one synchronization run with preserved before/after state and an explicit rollback lifecycle.

Run state includes:

- `prepared`
- `apply_failed`
- `applied`
- `rollback_products_restored`
- `rolled_back`

Each run stores:

- source/revision identity;
- affected keys;
- exact product before snapshots;
- exact product after snapshots;
- partner before/after snapshot;
- control before/after snapshot;
- before digest;
- after digest;
- audit identities;
- rollback reason/actor/timestamps.

Rollback is not a blind overwrite.

Before starting it verifies:

- explicit confirmation phrase;
- expected source revision;
- expected after digest;
- run is still the latest applied run;
- control state still matches the applied run;
- affected products still match the recorded post-apply snapshots;
- no new contract lock was added;
- partner state still matches the post-apply snapshot.

Rollback then executes as a restartable state machine.

### Stage 1 — product restoration

A root transaction:

- verifies run/revision/digest/control again;
- verifies the exact post-apply product snapshots;
- restores affected products to exact preimages;
- records an audit event;
- moves run to `rollback_products_restored`.

### Stage 2 — partner/control restoration

A second root transaction:

- only accepts `rollback_products_restored`;
- verifies restored product snapshots still match;
- verifies partner still matches post-apply state;
- restores partner/control preimages;
- records completion audit;
- moves run to `rolled_back`.

If stage 2 fails, the route returns:

- explicit error;
- `state: rollback_products_restored`.

A later request can resume from that intermediate state rather than pretending rollback is complete or starting from scratch.

Simulation verifies:

- exact preimage restoration;
- create rollback removes newly created child;
- concurrent/manual changes block rollback;
- contract locks block rollback;
- stale revision/digest blocks rollback;
- latest-run guard;
- two-stage resumability;
- double rollback is blocked;
- audit binds run/revision/digests;
- unrelated state remains unchanged.

## AI Core equivalent

Current AI Core Workflow research requires rollback/compensation, but on main it has not yet landed a generic machine-readable rollback run state machine.

Existing candidate `workflow.compensated-multiwrite` from Renman is related but different:

- Renman: forward write failure automatically compensates already-applied effects in reverse order.
- ERP4: an already applied synchronization run can be explicitly rolled back later using preserved snapshots, CAS and restartable rollback phases.

They should not be falsely merged as the same exact second-project implementation.

## Generalizable pattern

**rollback is its own revision-bound workflow, not a button that writes old values**

Reusable semantics:

1. forward run has stable run identity;
2. forward run records exact rollback preconditions/evidence;
3. rollback request binds to run identity + expected revision/digest;
4. current state must still equal the expected post-apply state;
5. domain safety guards can veto rollback;
6. each rollback phase is atomic where possible;
7. intermediate rollback state is persisted;
8. retry resumes from persisted phase;
9. rollback completion is not claimed until all phases finish;
10. every phase is auditable;
11. repeated rollback is idempotently blocked.

## Destination

- D — Workflow Standard primary
- C — Result/Receipt/Evidence may later define rollback receipt fields, but D owns rollback semantics.

## Candidate

`workflow.restartable-rollback-run`

Evidence level:
- `PROJECT_VERIFIED`

Next gate:
- `SECOND_PROJECT_REQUIRED`

## Migration impact

Additive as a new workflow contract.

Projects with existing destructive "restore old data" buttons should not be auto-migrated; they need:
- rollback precondition inventory;
- irreversible-side-effect inventory;
- concurrency/CAS behavior;
- failure-resume strategy.

## Reverse Import Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Extract Pattern → DONE
Generalize → DONE
Assign D → DONE
Create Core Candidate → DONE
Core adoption 확인 → PENDING
Source revision 기록 → DONE
완료 → PENDING

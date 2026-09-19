# A Session Discovery — Gukmincha Gimpo Derived State Evidence

상태: **SUPPORTING_CROSS_PROJECT_EVIDENCE / ROUTED_TO_D / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: 국민차매매단지 공항점 임대관리
- Repository: `freepass-creator/gukminchagimpo`
- Source path:
  - `lib/state.ts`
  - `lib/selectors.ts`
  - `lib/data-context.tsx`
  - `README.md`
- Revision:
  - observed repository head: `0e32380725cc2d98c93b5462b282ade52047c45a`
  - state implementation blob: `74eb5a0e10f48110727ec8fe9f147870167aa415`
  - selector implementation blob: `101588ba7a7bc5deaa39af94e1cb7c7af919d8a7`
- Category: Workflow / Data Projection / Derived State

## Current implementation

The repository explicitly documents and implements stall state as a **derived state**, not a separately persisted truth.

Current facts:

- Lease status and period
- Billing total / paid amount / due date
- Current date
- Configuration threshold

derive:

- vacant
- active
- overdue
- expiring
- reserved

`buildStallStateMap` precomputes indexes and projection results for performance, but the Map is not treated as a second canonical state source.

`lib/selectors.ts` follows the same pattern for arrears, charged/paid totals, active assignments, occupancy and move-in/out summaries: facts are stored; frequently used projections are computed/indexed.

## Comparison to existing candidate

Existing candidate:

`workflow.fact-vs-state` — CROSS_PROJECT_VERIFIED

Prior evidence:

- FreePass Admin
- JPKERP5
- AIOps

Gukmincha Gimpo independently demonstrates the same principle in a different domain (property/parking lease management):

**persist facts → derive business state → optionally materialize/cache/index projection for read performance**

## Decision

- Add Gukmincha Gimpo as supporting independent project evidence.
- Evidence level remains `CROSS_PROJECT_VERIFIED`; it is already at that level.
- No new D candidate is necessary.

## Generalizable reinforcement

D should preserve the distinction between:

1. source facts;
2. derived workflow/business state;
3. read-model/projection/index;
4. visual label/tone.

A performance index must not silently become the canonical business fact.

## Destination

- D — supporting evidence for `workflow.fact-vs-state`.
- C may reference the projection/SSOT boundary.

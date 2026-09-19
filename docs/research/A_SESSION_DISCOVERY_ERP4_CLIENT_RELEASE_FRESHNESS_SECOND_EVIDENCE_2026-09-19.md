# A Session Discovery — ERP4 as Second Client Release Freshness Evidence

상태: **CROSS_PROJECT_VERIFIED / ROUTED_TO_B / CLOSEOUT_HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

> Phase 1 closeout freeze 적용: 이 기록은 `research/a-session-post-phase1` branch에만 둔다. `main` canonical을 변경하지 않는다.

## Discovery

- Candidate: `ui.client-release-freshness`
- First project: FreePassERP3
- Second independent project: FreePassERP4

### First evidence — FreePassERP3

- Repository: `freepass-creator/freepasserp3`
- Revision introducing mechanism: `5344a5001a6d62d686c79090a250c9aa21b470c3`
- Current observed head: `8d8b7a559272a37823f879b77099b3bc17bf5a16`
- Files:
  - `src/core/version-watch.js`
  - `src/app.js`
  - `scripts/write-build-version.cjs`
- Mechanism:
  - stable-path build version file
  - no-store polling every five minutes
  - visibility-return check
  - release drift → reload

### Second evidence — FreePassERP4

- Repository: `freepass-creator/freepasserp4`
- Revision introducing mechanism: `c6b135bbec80d2ffb605a2ca1f68ad329196024f`
- Current observed head: `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`
- Files:
  - `components/VersionWatcher.tsx@1cdde34f5903c03c85a7d8f57d3c7df4c132bca0`
  - `app/api/version/route.ts@d46603c0d58534fb17e9c63c892e40cca75926d8`
  - `app/layout.tsx@90760cb2bffdf7574a701eb50a416be36022d58f`
- Mechanism:
  - client bundle stamp: `NEXT_PUBLIC_BUILD_STAMP`
  - server deployment stamp: `/api/version`, no-store
  - periodic check every 90 seconds
  - immediate check on focus / online / visibility return
  - stale bundle → reload
  - active INPUT/TEXTAREA/contenteditable delays reload to protect user input
  - sessionStorage stamp guard prevents repeated reload for the same served release
  - watcher is mounted on guest/public and authenticated application paths

## Independence assessment

This is not counted merely because the repositories are different.

The implementations differ materially:

- ERP3 uses a generated static version file and client baseline.
- ERP4 compares a build-time client stamp against a dynamic server deployment stamp.
- ERP4 independently adds dirty-input protection, online/focus triggers and same-stamp reload suppression.
- The implementation files are different modules/frameworks rather than byte-identical copied modules.

They implement the same generalized contract through distinct mechanics.

## Generalized pattern

`served release identity → running client identity → drift detection → safe update policy`

Common semantics:

1. long-lived clients must know which release they run;
2. they must be able to determine the currently served release;
3. equality means current; mismatch means stale;
4. stale state is not silently ignored;
5. update behavior must consider unsaved/dirty user state;
6. failed freshness checks mean UNKNOWN, not CURRENT;
7. retry/refresh loop must not create an infinite reload cycle.

## FreePass Sales supporting evidence

`freepass-sales` contains an independently evolved Service Worker cache-version mechanism:

- `웹/sw.js@sales-v240`
- old caches are deleted on SW activation;
- shell/assets use network-first handling;
- comments record real stale-cache incidents and version mismatch audits.

This is useful adjacent evidence for **cached shell freshness**, but it is not counted as the second exact `running client vs served release identity` implementation because it does not itself compare the current running client build identity to a server build identity.

## Evidence decision

- Previous: `PROJECT_VERIFIED`
- Now: **`CROSS_PROJECT_VERIFIED`**
- Projects counted: `freepasserp3`, `freepasserp4`
- Destination: B
- Next gate: `COMMON_ADOPTED_CANDIDATE`

## Closeout handling

B is currently HOLD in `registry/phase1-closeout.json` and Phase 1 integration freeze forbids non-blocking A discoveries from landing directly on `main`.

Therefore:
- evidence promotion is recorded on A research branch;
- no B canonical file is changed;
- merge/adoption waits for Order/B after `BASELINE_LOCKED` or an explicit closeout-blocker decision.

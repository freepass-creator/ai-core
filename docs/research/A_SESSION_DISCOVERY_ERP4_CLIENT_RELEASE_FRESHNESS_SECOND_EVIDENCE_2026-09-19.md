# A Session Discovery — ERP4 as Second Client Release Freshness Evidence

상태: **CROSS_PROJECT_VERIFIED / ROUTED_TO_B / CLOSEOUT_HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

> Phase 1 closeout freeze 적용: 이 기록은 `research/a-session-post-phase1-c-v1` branch에만 둔다. `main` canonical을 변경하지 않는다.

## Discovery

- Candidate: `ui.client-release-freshness`
- First project: FreePassERP3
- Second independent project: FreePassERP4

### First evidence — FreePassERP3
- Repository: `freepass-creator/freepasserp3`
- Revision introducing mechanism: `5344a5001a6d62d686c79090a250c9aa21b470c3`
- Current observed head: `8d8b7a559272a37823f879b77099b3bc17bf5a16`
- Files: `src/core/version-watch.js`, `src/app.js`, `scripts/write-build-version.cjs`
- Mechanism: stable-path build version + no-store polling + visibility-return check + release drift reload.

### Second evidence — FreePassERP4
- Repository: `freepass-creator/freepasserp4`
- Revision introducing mechanism: `c6b135bbec80d2ffb605a2ca1f68ad329196024f`
- Current observed head: `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3`
- Files:
  - `components/VersionWatcher.tsx@1cdde34f5903c03c85a7d8f57d3c7df4c132bca0`
  - `app/api/version/route.ts@d46603c0d58534fb17e9c63c892e40cca75926d8`
  - `app/layout.tsx@90760cb2bffdf7574a701eb50a416be36022d58f`
- Mechanism:
  - client bundle stamp vs no-store server deployment stamp
  - 90-second check plus focus / online / visibility return
  - stale bundle reload
  - active editor/input defers reload
  - sessionStorage same-stamp guard prevents reload loops
  - mounted on both guest and authenticated application paths

## Independence assessment

The implementations differ materially:
- ERP3 uses generated static build-version baseline.
- ERP4 uses build-time client stamp vs dynamic server stamp.
- ERP4 independently adds dirty-input protection and reload-loop suppression.
- Files/frameworks are not byte-identical copied modules.

## Generalized pattern

`served release identity → running client identity → drift detection → safe update policy`

Common semantics:
1. long-lived clients know which release they run;
2. currently served release can be resolved independently;
3. mismatch means stale;
4. stale state is not silently ignored;
5. update policy considers unsaved user state;
6. failed freshness checks mean UNKNOWN, not CURRENT;
7. update loops cannot cause infinite reload.

## FreePass Sales supporting evidence

`웹/sw.js` independently versions the cached shell, clears old caches and uses network-first asset handling after real stale-cache failures. This is adjacent cached-shell evidence, but it is not counted as the exact second `running client vs served release` implementation.

## Evidence decision

- Previous: `PROJECT_VERIFIED`
- Now: **`CROSS_PROJECT_VERIFIED`**
- Projects: `freepasserp3`, `freepasserp4`
- Destination: B
- Next gate: `COMMON_ADOPTED_CANDIDATE`

## Closeout handling

B remains outside canonical main while Phase 1 closeout is active. Evidence promotion is held on A research branch only.

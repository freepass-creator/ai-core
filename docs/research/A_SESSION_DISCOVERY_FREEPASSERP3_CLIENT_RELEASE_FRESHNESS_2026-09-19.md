# A Session Discovery — FreePassERP3 Client Release Freshness

상태: **PROJECT_VERIFIED / ROUTED_TO_B / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: FreePassERP3
- Repository: `freepass-creator/freepasserp3`
- Default branch: `master`
- Source path:
  - `src/core/version-watch.js`
  - `src/app.js`
  - `scripts/write-build-version.cjs`
  - `public/data/build-version.txt`
- Revision:
  - observed repository head: `8d8b7a559272a37823f879b77099b3bc17bf5a16`
  - version watcher blob: `381feed5740d9de3a1bbd33628710a728da35398`
  - runtime entry blob: `src/app.js@5b3fb36e8cb350c8e4b44eeaaabbc8d57cb5ecc9`
  - introducing commit: `5344a5001a6d62d686c79090a250c9aa21b470c3`
- Category: UI/UX / Client Runtime / Release Freshness

## Current implementation

The project solved a concrete production UX/runtime problem:

- users keep the SPA tab open for long periods;
- old hashed JS/CSS chunks remain loadable;
- therefore no chunk-load failure occurs;
- after a new deployment the open tab can continue running obsolete code indefinitely;
- this made already-fixed bugs appear to still exist.

The implemented mechanism:

1. build writes a stable-path `build-version.txt`;
2. client starts `version-watch` from the real application entrypoint;
3. watcher fetches the version with `cache: no-store`;
4. first observed value becomes the client baseline;
5. every 5 minutes it compares the live version with the baseline;
6. it also checks immediately when the tab returns to visible state;
7. a changed build version causes a client refresh.

The introducing commit explicitly records this as the fix for long-lived stale SPA tabs.

## AI Core equivalent

AI Core has strong revision/deployment freshness concepts for evidence and production proof, but no equivalent B-session candidate was found for **long-lived client release freshness behavior**.

## Project ahead / Core ahead / Different

- **Project > Core on concrete client-release freshness handling.**
- The exact auto-reload behavior should not be copied blindly because unsaved form state can exist.

## Generalizable pattern

**served build identity → client baseline → release drift detection → safe client update UX**

The reusable contract is not "reload every 5 minutes".

B should decide the UX profile:

- clean/read-only screen → automatic refresh may be acceptable;
- dirty form / active transaction → warn, preserve draft, or defer refresh;
- critical security/data-contract incompatibility → forced refresh may be required.

## Destination

- B — primary: Client Release Freshness UX
- C/Governance may expose build/release identity, but A does not define their final contract.

## Recommended action

B should evaluate candidate `ui.client-release-freshness`:

1. every long-lived client can identify the build/release it is running;
2. client can detect when the served release changes;
3. stale-client state is first-class, not invisible;
4. update behavior depends on dirty state and risk;
5. user data must not be silently lost by automatic reload;
6. freshness check failures do not falsely claim the client is current.

## Evidence level

- `PROJECT_VERIFIED`
- search across current FreePassERP4, Sales, Admin, TeamJPKWork, FP Settlement, Renman and JPKERP5 did not establish a second independent implementation.
- Next gate: `SECOND_PROJECT_REQUIRED`

## Reverse Import Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Extract Pattern → DONE
Generalize → DONE
Assign B → DONE
Create Core Candidate → DONE (`ui.client-release-freshness`)
Core adoption 확인 → PENDING
Source revision 기록 → DONE
완료 → PENDING

# A Session Incremental Repo Audit — AIOps cutover

Status: `PROJECT_VERIFIED / ROUTED_TO_D / NOT_CANONICAL`

Observed repository: `freepass-creator/aiops`  
Previous A observation: `c37a422765e784cdd843f36efb4be5328d7df4bb`  
Current exact head: `dd47662ec6e92a689cbc4b8a50504e6013845ff9`

## Delta inspected

AIOps advanced by 9 commits. This audit inspected the new RTDB backup ownership transfer and the related repository-retirement boundary.

Relevant source evidence:

- `scripts/backup-rtdb.mjs` — destination read-only backup engine now lives in AIOps and emits a local SHA-256 manifest.
- `docs/sop/AI운영/RTDB-백업.md` — explicit cutover gate: verify the legacy schedule/source, run the new path against the same source, do not dual-run schedules, disable the old workflow only after verification, then re-evaluate retirement.
- `docs/sop/AI운영/직원관제.md` — another capability moved from WorkControl to AIOps while the old repository becomes a retirement target.

## A finding

### `workflow.capability-cutover-no-dual-run`

Classification: `PROJECT_GT_CORE`  
Evidence level: `PROJECT_VERIFIED`  
Route: `D`

Reusable behavior:

1. identify the current execution owner and exact source/target;
2. establish the replacement capability before retiring the source;
3. verify source/path equivalence;
4. forbid overlapping scheduled execution during cutover;
5. observe the replacement execution successfully;
6. only then disable the former execution path;
7. re-evaluate repository/capability retirement after authority has moved.

## Why this is ahead of current Core

Current AI Core Workflow/Recovery contracts handle state transitions, replay suppression and recovery identity. Governance deprecation records lifecycle and affected consumers. Neither currently requires a **cutover-specific no-dual-run gate** that binds replacement verification to old-path disablement before retirement.

This audit does not modify D canon. It routes the project-verified candidate for D review. A second independent implementation remains required before broader/common adoption.

## Non-findings

- The new AIOps Security SHADOW work is already represented by the current Security canonical-partial baseline and is not duplicated here.
- No production scheduler state is inferred from documentation.
- No claim is made that the old jpkerp5 workflow has already been disabled.

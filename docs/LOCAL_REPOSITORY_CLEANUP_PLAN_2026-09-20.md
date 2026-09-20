# Local Repository Cleanup Plan — 2026-09-20

## Decision

This is the pre-move plan. It does not delete anything. ACTIVE, HOLD, REFERENCE, and UNKNOWN paths are immovable. A local move is allowed only for a clean RETIRED_CANDIDATE whose retirement gate is READY_FOR_ARCHIVE, with no process, recent Codex cwd, multi-worktree, unpushed, dirty, or untracked blocker.

## Inventory summary

| Classification | Count |
|---|---:|
| ACTIVE | 34 |
| HOLD | 2 |
| REFERENCE | 5 |
| RETIRED_CANDIDATE | 9 |
| UNKNOWN | 30 |

## Retirement candidates

| Absolute path | Classification | Gate | Dirty/untracked | Ahead/behind | Move eligible | Blockers |
|---|---|---|---:|---:|---|---|
| `C:\dev\-` | RETIRED_CANDIDATE | READY_FOR_ARCHIVE | 0/0 | / | True | none |
| `C:\dev\freeepasserp2` | RETIRED_CANDIDATE | READY_AFTER_DEPLOYMENT_CHECK | 0/1 | 0/0 | False | untracked files present; retirement gate: READY_AFTER_DEPLOYMENT_CHECK |
| `C:\dev\freepasserp` | RETIRED_CANDIDATE | READY_AFTER_DEPLOYMENT_CHECK | 0/1 | 0/0 | False | untracked files present; retirement gate: READY_AFTER_DEPLOYMENT_CHECK |
| `C:\dev\jpkerp` | RETIRED_CANDIDATE | READY_AFTER_EXTERNAL_BINDING_CHECK | 0/1 | 0/0 | False | untracked files present; retirement gate: READY_AFTER_EXTERNAL_BINDING_CHECK |
| `C:\dev\jpkerp-v4` | RETIRED_CANDIDATE | BLOCKED | 0/0 | 0/0 | False | retirement gate: BLOCKED |
| `C:\dev\jpkerp2` | RETIRED_CANDIDATE | READY_AFTER_EXTERNAL_BINDING_CHECK | 0/1 | 0/0 | False | untracked files present; retirement gate: READY_AFTER_EXTERNAL_BINDING_CHECK |
| `C:\dev\jpkerp5` | RETIRED_CANDIDATE | BLOCKED | 1/0 | 2/0 | False | tracked changes present; unpushed commits present; retirement gate: BLOCKED |
| `C:\dev\rentsafe` | RETIRED_CANDIDATE | READY_AFTER_EXTERNAL_BINDING_CHECK | 0/0 | 0/0 | False | retirement gate: READY_AFTER_EXTERNAL_BINDING_CHECK |
| `C:\dev\workcontrol` | RETIRED_CANDIDATE |  | 1/0 | 2/0 | False | tracked changes present; unpushed commits present; protected operational family pending explicit activity proof |

## Restore rule

No deletion is authorized. A moved checkout is restored with Move-Item -LiteralPath <archived-path> -Destination <original-parent> only after both paths are resolved and confirmed to remain under C:\dev. See docs/LOCAL_REPOSITORY_CLEANUP_RESULT_2026-09-20.md for exact commands after execution.

## Machine-readable evidence

See `examples/local-repository-cleanup-plan-2026-09-20.json`. Re-run this audit immediately before any move because process, session, dirty, and worktree state can change.

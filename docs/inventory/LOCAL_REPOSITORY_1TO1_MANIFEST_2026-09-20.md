# Local repository 1:1 manifest — 2026-09-20

## Required invariant

Each independent GitHub repository has exactly one standard first-level checkout named `C:\dev\<GitHub repository name>`. Other branches/worktrees use a gitignored `.worktrees` directory inside that checkout or a tool-owned location outside `C:\dev`. Non-repository wrappers, archives, and temporary material do not remain at the first level after their origin and references are verified.

## Phase 1 — ERP4

| Local path | Remote owner/name | Default branch | Canonical checkout | Extra checkouts | Disposition |
|---|---|---|---|---|---|
| `C:\dev\freepasserp4` | `freepass-creator/freepasserp4` | `main` | yes | `.worktrees`, `tmp`, and separately held paths below | KEEP; dirty/diverged canonical checkout |
| `C:\dev\freepasserp4\.worktrees\shop-main` | same | `main` | no | clean published worktree | KEEP internal |
| `C:\dev\freepasserp4\.worktrees\rp012` | same | `main` | no | clean published worktree | KEEP internal |
| `C:\dev\freepasserp4\.worktrees\f86check` | same | `main` | no | clean published worktree | KEEP internal |
| `C:\dev\_worktrees\freepasserp4\estimate-new-used` | same | `main` | no | ahead 13 | HOLD unpublished; prevents wrapper retirement |
| `C:\dev\.wt-test` | same | `main` | no | detached dirty | HOLD |
| `C:\dev\freepasserp4-rtdb-current` | same | `main` | no | dirty migration-debt worktree | HOLD; never reactivate RTDB |
| `C:\dev\freepasserp4-ui-deploy` | same | `main` | no | detached dirty | HOLD |
| `C:\dev\freepasserp4-ui-upload` | same | `main` | no | detached dirty | HOLD |
| `C:\dev\worktrees\freepass-source-registry-current` | same | `main` | no | dirty | HOLD |
| `C:\dev\freepasserp4-ui-source` | none | n/a | no | non-Git source snapshot | HOLD; differs from archived ZIP |

Remote evidence was read directly from GitHub: repository `freepass-creator/freepasserp4`, default branch `main`, URL `https://github.com/freepass-creator/freepasserp4`. The remaining rows are not claimed as 1:1-compliant until their HOLD conditions are resolved.

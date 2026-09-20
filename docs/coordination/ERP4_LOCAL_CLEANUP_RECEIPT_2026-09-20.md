# ERP4 local cleanup receipt — 2026-09-20

## Scope and authority

- Scope: ERP4-related paths directly under `C:\dev` and registered worktrees of `C:\dev\freepasserp4`.
- Canonical repository: `C:\dev\freepasserp4`.
- GitHub identity: `freepass-creator/freepasserp4`; remote read back as `https://github.com/freepass-creator/freepasserp4.git`; default branch read back as `main`.
- User authority: perform safe local organization, preserve dirty/unpublished/unknown work, delete nothing, keep RTDB retired.
- Safety rule: no RTDB path was enabled, restored, queried, or deployed. `freepasserp4-rtdb-current` is migration debt and remains HOLD.

## Completed reversible move

`C:\dev\freepasserp4-ui-source.zip` was moved intact to:

`C:\archive\dev-cleanup\2026-09-20\erp4\non-git\freepasserp4-ui-source.zip`

Evidence:

- source was resolved under `C:\dev` before the move;
- destination was normalized under the dedicated archive root before creation;
- no process command line, process/user/machine environment variable, or repository text reference to the ZIP filename was found;
- ZIP listing passed before and after the move;
- size: 10,607,238 bytes;
- SHA-256 before and after: `44F7449195D1F813CE02E62C95768F542FCF53E21F328BB4CA0EAC1652075320`;
- ZIP contents: 1,751 entries, 1,586 files, 27,981,235 uncompressed bytes;
- comparison with `C:\dev\freepasserp4-ui-source`: 1,559 files matched, 0 were missing, and 27 differed. The ZIP is therefore a distinct historical snapshot, not an exact duplicate;
- deletion: none;
- restore command and post-move receipt: `C:\archive\dev-cleanup\2026-09-20\erp4\MANIFEST.md` and `POST_MOVE.md`.

## Canonical checkout and extra worktrees

Final layout rule: the only standard first-level checkout for this GitHub repository is `C:\dev\freepasserp4`. Extra worktrees belong in its locally ignored `.worktrees` directory. `/.worktrees/` was added to `.git/info/exclude`; it is not a tracked repository change.

| Registered location | Branch | HEAD | Post-state |
|---|---|---|---|
| `C:\dev\freepasserp4\.worktrees\shop-main` | `main` | `96a24707ed8e769393f3a7cb6656de0f0c280f2d` | clean, behind remote 275; officially relocated with `git worktree move` |
| `C:\dev\freepasserp4\.worktrees\rp012` | `fix/rp012-deposit-column` | `d1fa2d5e2e035ca7e3f5cab873f8186ba2138835` | clean, published; officially relocated with `git worktree move` |
| `C:\dev\freepasserp4\.worktrees\f86check` | `claude/f86-freshness-checker-spec` | `f17747a549cf7857c28932373ada0bfb8eb7d7da` | clean, published; officially relocated with `git worktree move` |
| `C:\dev\_worktrees\freepasserp4\estimate-new-used` | `feat/estimate-new-used` | `fd8522a38c86298ae7b0113bccdc3b288ef97f8a` | clean, **ahead 13 / unpublished HOLD** |

Before the three safe relocations, a complete-history recovery bundle was created at `C:\archive\dev-cleanup\2026-09-20\erp4\freepasserp4-clean-worktrees.bundle`; SHA-256 is `52B83B767375ED138FEF3BB039D7576BFFDD4BFBEE3F26E4C51F01E3AFB4AEFB`. `git bundle verify`, post-move `git status`, HEAD identity, and `git worktree list` passed.

The unpublished `estimate-new-used` worktree was not moved again. Its current wrapper means `C:\dev\_worktrees` cannot yet be removed from the first level. This is an explicit structural HOLD, not final compliance.

## HOLD inventory

Snapshot taken after the reversible ZIP move:

| Path | Evidence | Decision |
|---|---|---|
| `C:\dev\freepasserp4` | 3 changes; branch ahead 16, behind 46 | HOLD — canonical dirty/diverged worktree |
| `C:\dev\.wt-test` | detached; 1 modified file | HOLD |
| `C:\dev\freepasserp4\tmp\deploy-31c8280` | detached; 3 changes | HOLD |
| `C:\dev\freepasserp4\tmp\deploy-9a70768` | detached; 18 changes | HOLD |
| `C:\dev\freepasserp4\tmp\deploy-cce3ce0` | detached; 18 changes | HOLD |
| `C:\dev\freepasserp4\tmp\deploy-photo-production` | 3 changes; configured upstream mismatch, ahead 1 / behind 1577 | HOLD |
| `C:\dev\freepasserp4\tmp\deploy-supplier-main` | 3 changes | HOLD |
| `C:\dev\freepasserp4\tmp\wt-stl-atoms` | 1 untracked file; behind 185 | HOLD |
| `C:\dev\freepasserp4-rtdb-current` | 2 untracked files | HOLD migration debt; never reactivate RTDB |
| `C:\dev\freepasserp4-ui-deploy` | detached; 3 modified files | HOLD |
| `C:\dev\freepasserp4-ui-upload` | detached; 3 modified files | HOLD |
| `C:\dev\worktrees\freepass-source-registry-current` | 5 changes | HOLD |
| `C:\dev\freepasserp4-ui-source` | non-Git; 27 files differ from archived snapshot | HOLD |

No service-account JSON content was read, printed, moved, or added to Git.

## Verification and review limits

- Re-read destination existence, size, SHA-256, and ZIP readability after the move: PASS.
- Re-read `git worktree list` and status/HEAD of concurrently relocated worktrees: PASS for current registration and preserved HEADs.
- Re-audited the remaining named ERP4 worktrees for dirty/ahead/behind state: completed; every uncertain or changed path remains HOLD.
- Claude Code independent review: unavailable because the account weekly limit was reached.
- Gemini CLI independent review: unavailable with a 403 account-service-disabled error.
- Cursor's installed command is an editor launcher, not a non-interactive review agent, so it was not counted as an independent review.

Because two requested independent reviewers were unavailable, this is a verified local receipt, not a declaration that ERP4 cleanup is complete. The remaining top-level directories and all dirty/unpublished work require a later evidence-backed pass.

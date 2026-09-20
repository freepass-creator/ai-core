# ERP4 local-root cleanup — 2026-09-20

## Scope and source of truth

- Canonical repository: `C:\dev\freepasserp4`
- Observed branch/commit: `feat/spring-atom-monitor` at `595abaefa72ab0d5ee14414fec8998fd632ec488`
- Canonical worktree state: 3 local changes; upstream divergence was 16 ahead / 46 behind at observation time.
- Ignore check: `tmp/` is ignored by `.gitignore`; `.worktrees/`, `archive/`, and `imports/` are not currently proven ignored. Those directories must not be created or populated until the canonical dirty worktree can be changed safely.
- Machine-readable record: `examples/erp4-local-root-cleanup-2026-09-20.json`
- This pass never enabled or restored Firebase Realtime Database.

## Executed reversible cleanup

Five empty shells containing only a `node_modules` junction to the canonical ERP4 repository were moved outside `C:\dev`:

| Original path | Result |
| --- | --- |
| `C:\dev\fp4-spring-pr` | archived, reversible |
| `C:\dev\fp4-spring-pr2` | archived, reversible |
| `C:\dev\.wt-est2` | archived, reversible |
| `C:\dev\.wt-newcar` | archived, reversible |
| `C:\dev\.wt-slim` | archived, reversible |

Archive manifest: `C:\Users\admin\DevArchive\erp4-root-cleanup\2026-09-20\reversible-stubs\manifest.json`

Manifest SHA-256: `5243C39C50120E6C0BE785ED96ADF339F01468891ECDB94E889686EEC0107169`

The manifest records each exact source, destination, junction target, metadata hash, and restore command. Post-move verification confirmed that every source path is absent, every archive path exists, and every junction still targets `C:\dev\freepasserp4\node_modules`.

Before the move, all five paths were confirmed to have no `.git` entry and were absent from `git -C C:\dev\freepasserp4 worktree list --porcelain`. Historical inventory described some `.wt-*` names as checkouts, so this fresh Git-registry exclusion is the controlling evidence for this execution. The repository JSON embeds the external manifest's per-item source, destination, hash, and restore command so recovery does not depend on a single external file.

## Duplicate decision

`C:\dev\freepasserp4-ui-upload` and `C:\dev\freepasserp4-ui-deploy` both point to the same Git worktree metadata directory. Their three modified files and binary Git patches are identical; the patch SHA-256 is `EA1CD6F00988E582C58519EB638F926EC0CB98FF82C68FC2137A78665439E7A9`.

They are not directory-identical. Excluding `.git`, `node_modules`, and `.next`, deploy has 34 additional paths (primarily Vercel output), while upload has `.env.local` and `.vercel/README.txt`.

The upload directory was not registered by `git worktree list`; its `.git` file merely aliased the registered deploy worktree metadata. Its 1,591 files were hashed without printing `.env.local`, and the whole directory was moved into a user-profile archive restricted to the current user, SYSTEM, and Administrators. The copied `.git` pointer was renamed to `.git.pointer.disabled` in the archive to prevent accidental Git operations against the live deploy metadata. The registered `freepasserp4-ui-deploy` worktree remains at HEAD `a466b0aa` with its original three modifications.

- Sensitive UI alias manifest SHA-256: `B19E5056CC47F3E5FFB5B88D51968BAA2F2D8A89CD2E5A9C33F07B9E3F92B761`
- `freepasserp4-ui-source` remains HOLD pending a full provenance comparison.
- The previously inventoried `freepasserp4-ui-source.zip` was absent on the follow-up pass; no deletion or move of that ZIP was performed by this task.

## Executed Git worktree relocation

After a fresh remote fetch, three clean worktrees had their exact HEAD reachable from the named remote branch. Each branch was exported to a verified Git bundle outside `C:\dev`, recorded in a restore manifest, removed with `git worktree remove`, and recreated with `git worktree add`:

| Old path | New path | Branch | HEAD |
| --- | --- | --- | --- |
| `C:\dev\.wt-rp012` | `C:\dev\_worktrees\freepasserp4\rp012` | `fix/rp012-deposit-column` | `d1fa2d5e` |
| `C:\dev\fp-shop-pr` | `C:\dev\_worktrees\freepasserp4\shop-main` | `main` | `96a24707` |
| `C:\dev\freepasserp4-wt-f86check` | `C:\dev\_worktrees\freepasserp4\f86check` | `claude/f86-freshness-checker-spec` | `f17747a5` |

All three recreated worktrees retained their exact HEAD and were clean. Git removal left a `node_modules` junction shell at two old paths; those shells were separately archived after confirming that they contained no other entry.

- Worktree manifest SHA-256: `80B8F1F0E2875D8252E77AE8ECEFF0B8CBC8131EC6CF425FE7F83C1CF874C27E`
- Residual-shell manifest SHA-256: `914CFBB0D09051775B2D71E4EE11D32E02AFBC2F1A0B73280C1C1513B0478852`

The clean `feat/estimate-new-used` worktree was subsequently relocated from `C:\dev\.wt-est` to `C:\dev\_worktrees\freepasserp4\estimate-new-used`. Its 13 commits were ahead of the remote branch, so the full branch history was first captured in a verified Git bundle. The recreated worktree retained HEAD `fd8522a3`, remained clean, and received a direct `node_modules` junction to the canonical ERP4 dependency directory.

The old `.wt-est` shell exposed a chained junction to the previously archived `.wt-newcar\node_modules` path. That old junction was already broken, so its exact metadata was recorded and archived instead of being reused. The replacement points directly to `C:\dev\freepasserp4\node_modules`.

- Unpublished-branch manifest SHA-256: `820FA4F30ED84A88D165CA3F75BD836D498EFF036F0A97298394AC46688A2540`
- Estimate residual-shell manifest SHA-256: `15A72EA9596FD5ECD8B33CFDF775B84C1E4DD78A0ABB79BDCB827E8F5BBE392A`

## HOLD set

- Dirty worktrees: canonical ERP4, `.wt-test`, `freepasserp4-rtdb-current`, both UI directories, `freepass-source-registry-current`, and every registered worktree under `freepasserp4\tmp`.
- The four clean root-level worktrees were safely relocated as recorded above. The unpublished estimate branch remains local-only but is protected by a complete verified bundle; publishing or merging those 13 commits is a separate code-review decision.
- `_wt-base` has historical ERP4 attribution but its current ownership still needs revalidation. Other generic `_wt*` directories were not proven to belong to ERP4. All remain untouched.
- `freepasserp4-ui-source` remains HOLD pending a secret-excluding full-tree comparison. The registered UI deploy worktree remains HOLD because it is dirty.
- `freepasserp4-rtdb-current` is migration debt. Firestore-only outputs must be extracted and verified before archival; RTDB remains permanently retired.
- Service-account JSON files remain untouched. Their consumers must be changed to an approved secure path before any credential file is moved.

The machine-readable record lists the credential paths and known consumer files without reading or exposing credential contents.

## Required next execution gate

For every remaining path, recheck dirty/untracked files, unpublished commits, registered worktree metadata, active Codex/Claude/Cursor sessions, running processes, links, and script/environment references. A clean worktree may then be recreated with Git's worktree commands. Do not use filesystem move commands for registered worktrees.

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

They are not directory-identical. Excluding `.git`, `node_modules`, and `.next`, deploy has 34 additional paths (primarily Vercel output), while upload has `.env.local` and `.vercel/README.txt`. Because `.env.local` can contain local configuration and the copied `.git` pointer creates alias risk, both directories remain **HOLD** until a secret-safe content backup and explicit canonical-copy choice are completed.

## HOLD set

- Dirty worktrees: canonical ERP4, `.wt-test`, `freepasserp4-rtdb-current`, both UI directories, `freepass-source-registry-current`, and every registered worktree under `freepasserp4\tmp`.
- Clean registered worktrees: `.wt-est`, `.wt-rp012`, `fp-shop-pr`, and `freepasserp4-wt-f86check`. These require branch publication checks plus a fresh active-session/process check immediately before `git worktree remove` and `git worktree add` recreation under `C:\dev\_worktrees\freepasserp4`.
- `_wt-base` has historical ERP4 attribution but its current ownership still needs revalidation. Other generic `_wt*` directories were not proven to belong to ERP4. All remain untouched.
- `freepasserp4-ui-source`, its ZIP, and the UI upload/deploy pair require a secret-excluding full-tree comparison before archival.
- `freepasserp4-rtdb-current` is migration debt. Firestore-only outputs must be extracted and verified before archival; RTDB remains permanently retired.
- Service-account JSON files remain untouched. Their consumers must be changed to an approved secure path before any credential file is moved.

The machine-readable record lists the credential paths and known consumer files without reading or exposing credential contents.

## Required next execution gate

For every remaining path, recheck dirty/untracked files, unpublished commits, registered worktree metadata, active Codex/Claude/Cursor sessions, running processes, links, and script/environment references. A clean worktree may then be recreated with Git's worktree commands. Do not use filesystem move commands for registered worktrees.

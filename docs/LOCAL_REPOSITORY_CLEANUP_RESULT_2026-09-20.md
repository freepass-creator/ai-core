# Local Repository Cleanup Result — 2026-09-20

## Outcome

One verified, reversible local move was completed. Nothing was deleted.

| Original path | Result | Archive path | Evidence |
|---|---|---|---|
| `C:\dev\-` | archived locally | `C:\dev\_archive\2026-09-20\repositories\-` | 18 source files, 18 ZIP entries, 18 post-move files, zero hash mismatches |

The checkout is the accidental `freepass-creator/-` repository. It had an unborn `main` branch, no commits, no tracked or untracked working-tree files, no running process reference, no recent Codex task cwd, and no reparse-point boundary. The 18 preserved files were Git's internal `.git` scaffolding. Its lifecycle record was `RETIRE`, and retirement wave 1 marked it `READY_FOR_ARCHIVE`.

## Backup receipt

- ZIP: `C:\dev\_archive\2026-09-20\backups\dash-empty-repository.zip`
- ZIP SHA-256: `1cdfc58f144d5ac2e9e771e0f21953ff22902fea0255addafd345b2c0f0a5b78`
- File manifest: `C:\dev\_archive\2026-09-20\backups\dash-empty-repository.manifest.json`
- GitHub evidence copy: `examples/dash-empty-repository-backup-manifest-2026-09-20.json`
- File count: 18
- Backup entry count: 18
- Post-move file count: 18
- Post-move hash mismatches: 0

The backup manifest records every file path, length, and SHA-256. It also records the remote, branch, unborn-HEAD state, and restore command.

## Restore

Before restoring, use the following PowerShell sequence. It checks the archive path, rejects a collision, confirms the archive is not a reparse point, performs a literal-path move, and verifies the restored path and file count.

```powershell
$dev = (Resolve-Path -LiteralPath 'C:\dev').Path
$archive = (Resolve-Path -LiteralPath 'C:\dev\_archive\2026-09-20\repositories\-').Path
if (-not $archive.StartsWith($dev + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'Archive escaped C:\dev' }
if (Test-Path -LiteralPath 'C:\dev\-') { throw 'Restore destination already exists' }
if ((Get-Item -LiteralPath $archive).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Archive is a reparse point' }
Move-Item -LiteralPath $archive -Destination $dev
$restored = (Resolve-Path -LiteralPath 'C:\dev\-').Path
if ($restored -ne 'C:\dev\-') { throw 'Restore path mismatch' }
if (@(Get-ChildItem -LiteralPath $restored -File -Recurse -Force).Count -ne 18) { throw 'Restored file count mismatch' }
```

After restoration, compare every file against `examples/dash-empty-repository-backup-manifest-2026-09-20.json`. The ZIP is a second recovery copy and can be expanded to a new empty directory with .NET ZIP APIs if the moved copy is unavailable. Do not delete either archive until the user chooses a retention period and a later verification confirms that the remote repository history is no longer needed.

## Held paths

All other `RETIRED_CANDIDATE` paths remain in place. The machine plan records deployment/external-binding gates for `rentsafe`, `freeepasserp2`, `freepasserp`, `jpkerp`, and `jpkerp2`; a `BLOCKED` retirement gate for `jpkerp-v4`; tracked changes, two unpushed commits, and a `BLOCKED` gate for `jpkerp5`; and tracked changes, two unpushed commits, protected-operation status, and no machine retirement gate for `workcontrol`. The lifecycle source documents explain the scheduled-runtime context behind the blocked gates; the machine plan does not independently re-prove those external facts.

All `ACTIVE`, `HOLD`, `REFERENCE`, `UNKNOWN`, operational-app, ERP, Sales, Admin, estimator, penalty, legal, and AI Core paths were left untouched.

## Scope and limitations

- The pre-move machine plan is `examples/local-repository-cleanup-plan-2026-09-20.json`.
- The human-readable pre-move table is `docs/LOCAL_REPOSITORY_CLEANUP_PLAN_2026-09-20.md`.
- The complete local inventory is a point-in-time observation. Process, session, branch, and dirty state must be re-read before any later move.
- GitHub repository archival was not performed. This result covers the local checkout only.
- GitHub Actions billing blockage, if any, is not treated as a passing CI result.
- Independent review: Cursor Agent returned `HOLD` on the first evidence set. Its reparse-point, in-repo manifest, restore-verification, and wording findings were accepted and corrected. Claude was unavailable due to weekly usage limit; Gemini CLI was unavailable with account-level 403. Those unavailable reviews are not PASS.

## Next start here

1. Re-run `scripts/audit-local-repository-cleanup.ps1`.
2. Resolve deployment/domain/scheduled-runtime gates one repository at a time.
3. Back up unpushed commits and untracked files before proposing another move.
4. Never move an `ACTIVE`, `HOLD`, `REFERENCE`, or `UNKNOWN` path.
5. Keep archive actions separate from permanent deletion and request a new explicit decision for deletion.

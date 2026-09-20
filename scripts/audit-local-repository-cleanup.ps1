param(
  [string]$DevRoot = 'C:\dev',
  [string]$ObservedAt = '2026-09-20T20:20:00+09:00',
  [string]$JsonOutput = 'examples/local-repository-cleanup-plan-2026-09-20.json',
  [string]$MarkdownOutput = 'docs/LOCAL_REPOSITORY_CLEANUP_PLAN_2026-09-20.md'
)

$ErrorActionPreference = 'Stop'

function Invoke-GitText {
  param([string]$RepositoryPath, [string[]]$Arguments)
  $result = & git -C $RepositoryPath @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  return (($result | Out-String).Trim())
}

function Get-NormalizedRemote {
  param([string]$Remote)
  if (-not $Remote) { return $null }
  return ($Remote -replace '\.git$', '').ToLowerInvariant()
}

function Write-Utf8Lf {
  param([string]$Path, [string]$Content)
  $normalized = $Content -replace "`r`n", "`n"
  [IO.File]::WriteAllText($Path, $normalized, [Text.UTF8Encoding]::new($false))
}

$resolvedRoot = (Resolve-Path -LiteralPath $DevRoot).Path
if ($resolvedRoot -ne 'C:\dev') {
  throw "Refusing to inspect unexpected root: $resolvedRoot"
}

$lifecycle = Get-Content -LiteralPath 'examples/repository-lifecycle-2026-09-20.json' -Raw | ConvertFrom-Json
$retirement = Get-Content -LiteralPath 'examples/retirement-wave-1-2026-09-20.json' -Raw | ConvertFrom-Json
$registry = Get-Content -LiteralPath 'registry/projects.json' -Raw | ConvertFrom-Json

$lifecycleByRemote = @{}
foreach ($entry in $lifecycle.repositories) {
  $lifecycleByRemote[('https://github.com/' + $entry.repository).ToLowerInvariant()] = $entry.status
}
$retirementByRemote = @{}
foreach ($entry in $retirement.repositories) {
  $retirementByRemote[('https://github.com/' + $entry.repository).ToLowerInvariant()] = $entry
}
$registryByPath = @{}
foreach ($project in $registry.projects) {
  if ($project.local_path) { $registryByPath[$project.local_path.ToLowerInvariant()] = $project }
}

$processes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine }
$protectedNames = @('ai-core','aiops','casemap','docshub','freepasserp4','sales','freepass-sales','freepass-admin','estimate','welrixtable','sonogong','workcontrol')
$knownRecentCodexCwds = @(
  'C:\dev\ai-core',
  'C:\Users\admin\.codex\worktrees\293f\ai-core',
  'C:\Users\admin\.codex\worktrees\852a\ai-core',
  'C:\Users\admin\.codex\worktrees\d111\ai-core'
)

$rows = @()
foreach ($directory in Get-ChildItem -LiteralPath $resolvedRoot -Directory -Force) {
  $path = $directory.FullName
  $resolvedPath = (Resolve-Path -LiteralPath $path).Path
  if (-not $resolvedPath.StartsWith('C:\dev\', [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved path escaped C:\dev: $resolvedPath"
  }

  $gitMarker = Join-Path $path '.git'
  $isReparsePoint = [bool]($directory.Attributes -band [IO.FileAttributes]::ReparsePoint)
  $isGit = Test-Path -LiteralPath $gitMarker
  $remote = if ($isGit) { Invoke-GitText $path @('remote','get-url','origin') } else { $null }
  $normalizedRemote = Get-NormalizedRemote $remote
  $branch = if ($isGit) { Invoke-GitText $path @('branch','--show-current') } else { $null }
  $head = if ($isGit) { Invoke-GitText $path @('rev-parse','--verify','HEAD') } else { $null }
  $statusLines = if ($isGit) { @(Invoke-GitText $path @('status','--porcelain=v1') -split "`r?`n" | Where-Object { $_ }) } else { @() }
  $untracked = @($statusLines | Where-Object { $_.StartsWith('??') })
  $dirtyTracked = @($statusLines | Where-Object { -not $_.StartsWith('??') })
  $ahead = $null
  $behind = $null
  if ($isGit -and $head) {
    $counts = Invoke-GitText $path @('rev-list','--left-right','--count','@{upstream}...HEAD')
    if ($counts -match '^(\d+)\s+(\d+)$') { $behind = [int]$Matches[1]; $ahead = [int]$Matches[2] }
  }
  $worktreeList = @()
  if ($isGit -and $head) {
    $worktreeText = Invoke-GitText $path @('worktree','list','--porcelain')
    if ($worktreeText) {
      $worktreeList = @($worktreeText -split "`r?`n" | Where-Object { $_ -like 'worktree *' } | ForEach-Object { $_.Substring(9) })
    }
  }
  $processRefs = @($processes | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine.IndexOf($path, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { $_.ProcessId })
  $recentSessionRef = @($knownRecentCodexCwds | Where-Object { $_.Equals($path, [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
  $registryProject = $registryByPath[$path.ToLowerInvariant()]
  $lifeStatus = if ($normalizedRemote) { $lifecycleByRemote[$normalizedRemote] } else { $null }
  $retireEntry = if ($normalizedRemote) { $retirementByRemote[$normalizedRemote] } else { $null }

  $classification = 'UNKNOWN'
  if ($registryProject -and $registryProject.status -eq 'ACTIVE') { $classification = 'ACTIVE' }
  elseif ($lifeStatus -eq 'ACTIVE') { $classification = 'ACTIVE' }
  elseif ($lifeStatus -eq 'REFERENCE') { $classification = 'REFERENCE' }
  elseif ($lifeStatus -eq 'HOLD') { $classification = 'HOLD' }
  elseif ($lifeStatus -eq 'RETIRE') { $classification = 'RETIRED_CANDIDATE' }

  $protected = $false
  foreach ($name in $protectedNames) {
    if ($directory.Name.IndexOf($name, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) { $protected = $true; break }
  }
  $blockers = @()
  if (-not $isGit) { $blockers += 'not a Git checkout' }
  if ($isReparsePoint) { $blockers += 'directory is a reparse point' }
  if (-not $normalizedRemote) { $blockers += 'origin remote missing or unreadable' }
  if ($dirtyTracked.Count -gt 0) { $blockers += 'tracked changes present' }
  if ($untracked.Count -gt 0) { $blockers += 'untracked files present' }
  if ($ahead -gt 0) { $blockers += 'unpushed commits present' }
  if ($worktreeList.Count -gt 1) { $blockers += 'repository owns multiple Git worktrees' }
  if ($processRefs.Count -gt 0) { $blockers += 'running process references path' }
  if ($recentSessionRef) { $blockers += 'recent Codex task cwd references path' }
  if ($protected) { $blockers += 'protected operational family pending explicit activity proof' }
  if ($retireEntry -and $retireEntry.gate -ne 'READY_FOR_ARCHIVE') { $blockers += ('retirement gate: ' + $retireEntry.gate) }

  $eligible = $classification -eq 'RETIRED_CANDIDATE' -and $retireEntry -and $retireEntry.gate -eq 'READY_FOR_ARCHIVE' -and $blockers.Count -eq 0
  $rows += [ordered]@{
    path = $path
    classification = $classification
    repository_remote = $remote
    branch = $branch
    head = $head
    dirty_tracked_count = $dirtyTracked.Count
    untracked_count = $untracked.Count
    ahead = $ahead
    behind = $behind
    worktree_paths = $worktreeList
    process_ids = $processRefs
    recent_codex_cwd = $recentSessionRef
    reparse_point = $isReparsePoint
    retirement_gate = if ($retireEntry) { $retireEntry.gate } else { $null }
    move_eligible = $eligible
    blockers = $blockers
  }
}

$remoteGroups = $rows | Where-Object { $_.repository_remote } | Group-Object { Get-NormalizedRemote $_.repository_remote }
foreach ($group in $remoteGroups | Where-Object { $_.Count -gt 1 }) {
  foreach ($row in $group.Group) {
    if ($row.classification -notin @('ACTIVE','HOLD','REFERENCE','RETIRED_CANDIDATE')) { $row.classification = 'DUPLICATE_CHECKOUT' }
    if ('duplicate remote checkout requires canonical-path proof' -notin $row.blockers) {
      $row.blockers += 'duplicate remote checkout requires canonical-path proof'
      $row.move_eligible = $false
    }
  }
}

$plan = [ordered]@{
  schema_version = '1.0'
  observed_at = $ObservedAt
  root = $resolvedRoot
  archive_root = 'C:\dev\_archive\2026-09-20'
  source_documents = @(
    'docs/REPO_MULTI_AI_DUPLICATION_AUDIT_2026-09-20.md',
    'docs/REPOSITORY_LIFECYCLE_AUDIT_2026-09-20.md',
    'docs/RETIREMENT_WAVE_1_2026-09-20.md',
    'examples/repository-lifecycle-2026-09-20.json',
    'examples/retirement-wave-1-2026-09-20.json',
    'registry/projects.json'
  )
  policy = [ordered]@{
    delete = $false
    active_hold_unknown_move = $false
    require_backup_manifest = $true
    require_literal_path_move = $true
    reparse_points_auto_move = $false
  }
  repositories = $rows
}

Write-Utf8Lf $JsonOutput ($plan | ConvertTo-Json -Depth 10)

$summaryRows = $rows | Group-Object { $_['classification'] } | Sort-Object Name | ForEach-Object { "| $($_.Name) | $($_.Count) |" }
$candidateRows = $rows | Where-Object { $_.classification -eq 'RETIRED_CANDIDATE' -or $_.move_eligible } | ForEach-Object {
  $reason = if ($_.blockers.Count) { $_.blockers -join '; ' } else { 'none' }
  "| ``$($_.path)`` | $($_.classification) | $($_.retirement_gate) | $($_.dirty_tracked_count)/$($_.untracked_count) | $($_.ahead)/$($_.behind) | $($_.move_eligible) | $reason |"
}
$markdown = @"
# Local Repository Cleanup Plan — 2026-09-20

## Decision

This is the pre-move plan. It does not delete anything. `ACTIVE`, `HOLD`, `REFERENCE`, and `UNKNOWN` paths are immovable. A local move is allowed only for a clean `RETIRED_CANDIDATE` whose retirement gate is `READY_FOR_ARCHIVE`, with no process, recent Codex cwd, multi-worktree, unpushed, dirty, or untracked blocker.

## Inventory summary

| Classification | Count |
|---|---:|
$($summaryRows -join "`n")

## Retirement candidates

| Absolute path | Classification | Gate | Dirty/untracked | Ahead/behind | Move eligible | Blockers |
|---|---|---|---:|---:|---|---|
$($candidateRows -join "`n")

## Restore rule

No deletion is authorized. A moved checkout is restored with `Move-Item -LiteralPath <archived-path> -Destination <original-parent>` only after both paths are resolved and confirmed to remain under `C:\dev`. See `docs/LOCAL_REPOSITORY_CLEANUP_RESULT_2026-09-20.md` for exact commands after execution.

## Machine-readable evidence

See ``examples/local-repository-cleanup-plan-2026-09-20.json``. Re-run this audit immediately before any move because process, session, dirty, and worktree state can change.
"@
Write-Utf8Lf $MarkdownOutput $markdown

Write-Output "Wrote $JsonOutput"
Write-Output "Wrote $MarkdownOutput"
Write-Output ("Eligible moves: " + (@($rows | Where-Object move_eligible).Count))

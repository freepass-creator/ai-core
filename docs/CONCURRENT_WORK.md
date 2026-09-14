# Concurrent Local and GitHub Work

Status: `PROPOSED`

## Rule

Each writer owns one branch and one worktree:

`work/<actor>/<task>`

Local Codex, Cursor, Claude, Gemini or a GitHub-hosted worker must not write to the same branch concurrently. Shared truth moves through commits and pull requests. A writer reads another writer's work by fetching its branch or reviewing its PR.

## Start a lane

From a clean primary checkout:

```powershell
git fetch origin --prune
git worktree add -b work/cursor/example C:\dev\ai-core-cursor-example origin/main
```

Use a unique actor/task pair. If the branch already exists, inspect its owner and state instead of recreating or force-moving it.

## Validated automatic checkpoint

After a coherent change:

```powershell
node scripts/checkpoint-work.mjs --message "describe the verified change" --path README.md --path test/example.test.mjs --push
```

The checkpoint tool:

- requires a `work/<actor>/<task>` branch;
- accepts exact repository-relative paths, never broad implicit staging;
- refuses pre-staged changes, path traversal and files outside the worktree;
- runs the repository tests and state verifier before committing;
- fetches first and refuses a branch whose remote tip is not an ancestor;
- commits only the requested paths;
- pushes without force;
- leaves a local commit intact if a later concurrent push is rejected.

`--push` publishes the checkpoint. Without it, the commit stays local. A push or green CI does not merge, deploy or adopt the change.

## Conflict behavior

`HOLD_REMOTE_DIVERGED` means another writer changed the same branch. Do not auto-rebase, auto-merge or force-push. Fetch both tips, compare scopes and resolve deliberately.

Unrelated dirty files are preserved and excluded from the checkpoint. If another process has already staged anything, the checkpoint stops so it cannot inherit someone else's staging area.

## Current repository branch

The current historical branch `fix/main-truthful-entrypoint` predates this convention. Publish it as-is for review. New concurrent work begins in named work lanes from the reviewed base.

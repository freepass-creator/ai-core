# COLOCATE_ONLY Workspace Projection Adapter v1

## Purpose

This adapter implements `COLOCATE_ONLY` without moving, copying, merging or rewriting the source repository.

Instead, it creates a directory projection inside the explicitly configured group workspace:

`<workspaceRoot>/<headquarters|subsidiaries>/<asset_id>`

The projection points to the existing source checkout.

- Windows: Node directory `junction`
- other platforms: directory symbolic link

The source path remains the real operating checkout.

## Why projection instead of move

The Integration Execution Directive requires preserving Git history, deployment boundaries and rollback safety before any path cutover.

Physical relocation can break:

- deployment scripts;
- scheduled tasks;
- absolute-path configuration;
- local credentials;
- IDE/worktree references.

A workspace projection provides group discoverability while leaving all those boundaries unchanged.

## Explicit area mapping

The adapter does not infer whether a project belongs under `headquarters` or `subsidiaries`.

The caller must inject an explicit mapping:

```js
areaByProject: {
  "freepass-sales": "subsidiaries",
  "ai-core": "headquarters"
}
```

Missing or invalid mapping fails closed.

## Filesystem guarantees

- workspace root must already exist;
- source path must already exist;
- source is resolved with `realpath`;
- target is constrained under the chosen workspace area;
- an existing target is accepted only if it resolves to the exact source;
- conflicting directories/links are never deleted or replaced;
- the adapter does not execute Git commands;
- the adapter does not change project files, SSOT, deployment config, secrets or canonical registries.

## Independent verifier

The verifier checks:

1. `SOURCE_REVISION_UNCHANGED`
2. `DIRTY_STATE_RECHECK`
3. `PLAN_ITEM_STILL_READY` — projection still resolves to the exact source and output digest matches
4. `PATH_DEPENDENCY_CHECK` — injected independent verifier proves original path dependencies remain safe

The path-dependency verifier is intentionally external because generic AI Core code cannot prove project-specific deployment/scheduler/path dependencies by itself.

## Integration

Register this adapter under the `COLOCATE_ONLY` classification in #149's common executor. No other classification is enabled.

The Work Packet currently names the action kind `FILESYSTEM_RELOCATION`, but this adapter deliberately satisfies that plan non-destructively through workspace projection; no source relocation/cutover occurs.


## Verification evidence

Isolated filesystem verification completed with:

- syntax check: PASS
- focused projection/verifier tests: 8/8 PASS
- covered link creation, conflict refusal, idempotency, explicit area mapping, preflight repository binding, source revision/dirty recheck, and independent path-dependency verification

The isolated run used Node's directory-link behavior on the current test platform. Windows junction behavior remains delegated to Node's documented `symlink(..., "junction")` path and must still be observed on the operating Windows workspace before production use.

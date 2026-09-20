# KEEP_SEPARATE Metadata Adapter v1

## Purpose

This is the first concrete Group Integration executor adapter.

It implements only the lowest-risk classification:

`KEEP_SEPARATE / METADATA_ONLY`

The adapter does **not** modify the target project repository. It writes a revision-bound pointer into an explicitly configured group workspace:

`<workspaceRoot>/.ai-core/pointers/<asset_id>.json`

The configured workspace root must already exist.

## Pointer meaning

The pointer records:

- asset/project identity;
- repository and exact source revision;
- source checkout path as metadata only;
- plan and packet IDs;
- preflight digest;
- `source_preserved=true`;
- `project_authority_preserved=true`;
- `merge_git_history=false`;
- `canonical_project_registry_mutated=false`.

It is **not** a new project Registry and it is not an SSOT for project facts.

## Filesystem boundary

- workspace root must be absolute and already exist;
- the real pointer directory is resolved after creation to block symlink/path escape;
- asset IDs are filename-safe;
- existing pointers may update revision only when asset/project/repository identity still matches;
- identity conflicts fail closed;
- the source project repository is never a write target.

## Independent verifier

The paired verifier separately checks:

1. source repository revision is still exact;
2. source worktree is CLEAN;
3. the workspace pointer exists and matches the execution digest;
4. project authority is independently proven unchanged.

Those map directly to the Work Packet verification checks for KEEP_SEPARATE.

## Integration with #149

Example wiring:

```js
const adapter = createKeepSeparateMetadataAdapter({ workspaceRoot });
const verifyKeepSeparate = createKeepSeparateMetadataVerifier({
  workspaceRoot,
  observeRepository,
  verifyProjectAuthority,
});

const executor = createGroupIntegrationExecutor({
  observeRepository,
  verifyAuthority,
  adapters: new Map([['KEEP_SEPARATE', adapter]]),
  verifyExecution: verifyKeepSeparate,
});
```

The common executor still owns preflight, authority ordering, unknown-outcome handling and canonical receipt construction.

No other classification is enabled by this adapter.


## Verification evidence

Isolated verification on Node completed with:

- syntax check: PASS
- focused adapter/verifier tests: 8/8 PASS

The repository GitHub Actions runner-entry issue remains separate from this local isolated verification.

# A Session Concurrency Protocol

Status: **A RESEARCH COORDINATION ONLY / NO B-C-D CANONICAL CHANGE**

## Purpose

Multiple A-session conversations may inspect the same connected repositories at the same time. This protocol prevents duplicated audits, duplicated routing and conflicting A research writes.

## Unit of ownership

Every material A task is identified by:

`<repository>@<subject_revision>::<scope>`

Examples:

- `freepass-creator/freepass-sales@<sha>::repo-rescan`
- `freepass-creator/freepass-admin@<sha>::runtime-evidence`
- `freepass-creator/freepasserp4@<sha>::migration-gap-sync`

The revision is part of the key. A newer repository head is a different work item.

## Required sequence

1. Read `docs/research/a-session-work-claims.v1.json` at its latest GitHub blob SHA.
2. Resolve the exact repository head before inspection.
3. Build the claim key.
4. If another unexpired `ACTIVE` claim exists for that key, stop that work item as `SKIP_DUPLICATE`.
5. If the same key is already `COMPLETED` and the subject revision is still current, stop as `SKIP_ALREADY_COMPLETED`.
6. Otherwise append an `ACTIVE` claim with a bounded lease and update the registry using the blob SHA read in step 1.
7. If GitHub rejects the write because the blob SHA changed, refetch the registry and restart at step 3. Never blind-retry the old write.
8. Before any material A write or routing action, re-check the project head. If it moved, do not finish against the old revision.
9. On completion, mark the claim `COMPLETED` and attach revision-bound evidence refs. On intentional stop, mark it `ABANDONED` or `SUPERSEDED`.
10. B/C/D receiver decisions remain owned by B/C/D. A claims coordinate research work only.

## Lease rule

A claim is live only when:

- `state = ACTIVE`, and
- `lease_until > registry.observed_at`.

Expired claims do not block a new claimant. They remain in history for auditability.

## Concurrency guarantee

The claim registry itself uses GitHub optimistic concurrency. Every update must provide the current file blob SHA. Two sessions that read the same old SHA cannot both successfully claim the same work without one of them encountering a stale-SHA conflict and re-reading the registry.

This is the cross-session lock. The local Work Ledger file lock remains useful for local writers, but it is not a substitute for this GitHub-level A-session claim.

## Notification rule

Duplicate or already-completed work is silent. User notification remains limited to meaningful new discovery, evidence-level change, migration gap, contradiction, stale revision requiring action, or a coordination failure that prevents reliable audit progress.

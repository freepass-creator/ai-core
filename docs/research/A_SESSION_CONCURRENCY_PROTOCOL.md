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


## Executable commands

Check or acquire a claim:

```bash
npm run a:claim -- status \
  --repository freepass-creator/freepass-sales \
  --revision <exact-sha> \
  --scope repo-rescan

npm run a:claim -- claim \
  --repository freepass-creator/freepass-sales \
  --revision <exact-sha> \
  --scope repo-rescan \
  --owner A-session-sales-1 \
  --lease-minutes 60
```

Finish the claimed work with revision-bound evidence:

```bash
npm run a:claim -- complete \
  --claim-id <claim-id> \
  --evidence commit:<sha> \
  --evidence ci:<run-id>
```

Stop without completion:

```bash
npm run a:claim -- abandon --claim-id <claim-id>
npm run a:claim -- supersede --claim-id <claim-id>
```

Validate the coordination registry:

```bash
npm run a:claim:validate
```

The client performs optimistic GitHub SHA writes. If another session wins the write first, the client refetches and re-evaluates once rather than blindly overwriting the registry.


## Automatic next-work allocation

For ordinary A-session rescan work, prefer the allocator instead of manually choosing a repository:

```bash
npm run a:next -- \
  --owner A-session-1 \
  --scope repo-rescan \
  --lease-minutes 60
```

The allocator:

1. reads the current A repository coverage registry from AI Core main;
2. resolves current default-branch heads for every non-self connected repository;
3. keeps only repositories whose current revision differs from the audited revision;
4. prioritizes `DEEP_EVIDENCE` repositories before sampled/overlap repositories;
5. skips work already live or completed for the same `repository@revision::scope`;
6. atomically claims the first available changed repository;
7. rechecks the repository head immediately after claiming;
8. if the head moved during allocation, marks the stale claim `SUPERSEDED` and retries the new revision.

A result of `NO_CHANGED_REPOSITORY` means there is no revision delta to audit. A result of `NO_UNCLAIMED_CHANGED_REPOSITORY` means changed work exists but other A sessions already own it; this should remain silent rather than duplicate their work.

Head-unchanged runtime/deployment evidence checks are a separate scope and may still be claimed explicitly with `a:claim`.


## Heartbeat and recovery

Long-running audits must renew their lease before it expires:

```bash
npm run a:heartbeat -- \
  --claim-id <claim-id> \
  --owner A-session-1 \
  --lease-minutes 60
```

Heartbeat rules:

- only the recorded `owner_session` may renew the claim;
- renewal extends `lease_until` and records `heartbeat_at`;
- an expired claim may be recovered by the same owner only when no other live claimant has already taken the same claim key;
- if another session already owns a live replacement claim, recovery fails closed with `CLAIM_SUPERSEDED_BY_LIVE_OWNER`;
- GitHub blob-SHA optimistic concurrency still applies to the heartbeat write.

This prevents long A audits from silently losing ownership while also preventing an expired owner from stealing work back after another session legitimately took over.


## Expired-claim reaper

Expired ACTIVE claims are not considered live, but leaving them marked ACTIVE makes the coordination ledger hard to read. The reaper normalizes them to terminal history:

```bash
npm run a:claims:health
npm run a:claims:reap
```

Rules:

- `health` classifies live, expired-active, completed, abandoned and superseded claims and reports multiple-live-key anomalies;
- `reap` changes only expired `ACTIVE` claims to `ABANDONED` with `abandon_reason = LEASE_EXPIRED`;
- terminal claims are never rewritten by the reaper;
- the write uses the same GitHub blob-SHA optimistic concurrency and retries only after refetching on a conflict;
- `a:next` runs the reaper before changed-repository allocation, so abandoned stale ownership is normalized before a new claim is selected.

The reaper is cleanup, not ownership theft. A live lease remains untouched.


## Canonical scope policy

New ACTIVE claims must use one of these canonical scope forms:

- `repo-rescan`
- `runtime-evidence:<surface>`
- `migration-gap:<finding-id>`
- `routing:<finding-id>`
- `coordination:<topic>`

This prevents alias-based duplicate work such as one session claiming `repo-rescan` while another calls the same inspection `audit`.

Live overlap rules on the same repository revision:

- identical canonical scopes always conflict;
- `repo-rescan` also conflicts with `runtime-evidence:*` and `migration-gap:*`;
- `routing:*` and `coordination:*` only conflict with the same exact scope.

A completed claim suppresses only the same exact scope. This is intentional: deployment/runtime evidence may change while the repository revision stays the same, so a past repo audit must not permanently prevent a later runtime-evidence check.

Historical terminal claims may retain older noncanonical scope names for audit history. New ACTIVE claims using an unknown alias fail with `CLAIM_SCOPE_INVALID`.

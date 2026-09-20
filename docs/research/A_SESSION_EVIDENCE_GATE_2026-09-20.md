# A Session Evidence Gate — 2026-09-20

Status: **A-SESSION SELF-IMPROVEMENT / RESEARCH LANE / NO B-C-D CANONICAL CHANGE**

## Why

A-session already compares connected repository revisions and classifies material deltas, but its own machine coverage registry previously had no dedicated validator.

That allowed a real failure mode:

- latest A evidence had already inspected FreePassERP4 through `606a7616...`;
- the machine coverage registry still pointed to `44a67ced...`;
- a later scan therefore had to rediscover that A's own stored revision was stale.

## Added gate

`scripts/validate-a-session-coverage.mjs` validates:

- registry schema identity;
- `repository_count` parity;
- repository uniqueness;
- valid audit state;
- exactly one AI Core `CORE_BASELINE`;
- AI Core self-reference must keep `observed_head = null`;
- every non-self observed head is an exact 40-hex Git revision;
- material BACKPORT/Different findings require `DEEP_EVIDENCE`;
- findings cannot silently duplicate.

When an exact head snapshot is supplied it additionally validates:

- snapshot repository/SHA shape;
- every non-self coverage entry exists in the snapshot;
- snapshot does not contain an unknown project;
- stored observed revision equals the exact observed remote head.

A mismatch fails with `STALE_OBSERVED_HEAD`.

## Current head snapshot

`docs/research/a-session-head-snapshot.v1.json` records the exact connected-repository observation used by this scan.

The snapshot is evidence, not the canonical project contract. Future A scans should refresh it only after actually observing current remote heads.

## CI

`npm run a:coverage:validate` is added to Main State Consistency on this research branch.

It checks:

`coverage registry ↔ exact head snapshot`

so an A evidence update cannot change one side and quietly leave the other stale.

## Tests

`test/a-session-coverage.test.mjs` includes deliberate negative cases for:

1. repository count drift;
2. invalid AI Core self-head binding;
3. duplicate repository entry;
4. stale observed revision;
5. missing repository in the head snapshot.

The validator and six tests were also executed locally before repository insertion and passed 6/6.

## Boundary

This gate improves A itself.

It does **not**:

- change B UI/UX canon;
- change C Core Contract canon;
- change D Workflow canon;
- automatically promote a Project > Core finding;
- treat a snapshot update as proof that implementation evidence was inspected.

Remote-head movement only says **re-audit required**. Promotion still requires A to inspect the actual code/schema/test/runtime delta and record revision-bound evidence.

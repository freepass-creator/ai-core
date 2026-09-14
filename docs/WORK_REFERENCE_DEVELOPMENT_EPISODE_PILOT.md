# Work Reference — Development Episode Pilot v0.1

This is an experiment contract, not an adopted operating standard.

## When to use
Use this only for the first suitable real non-production development change selected as `DEV-EPISODE-001`.

## Read order
1. `WORK_READ_FIRST.md` on main
2. current Project/Work Packet instructions
3. `docs/DEVELOPMENT_EPISODE_PILOT.md` from this branch
4. if directly relevant: PR #14 (continuity), PR #15 (Engine/Adapter), PR #16 (Semantic Capability)

Do not reread every research branch.

## Required behavior
- bind all work to the exact project/base revision;
- create stable requirement IDs and provenance;
- record only decision-changing clarification questions;
- search existing capabilities before creating new reusable logic when relevant;
- do not force Engine/Adapter/Capability machinery onto a trivial task;
- isolate implementation from production/live-data changes;
- map every acceptance criterion to current evidence or mark it unverified;
- return the exact subject revision, commands/checks, failures/skips/unknowns, preview evidence when applicable, and remaining risk;
- do not claim independent Gemini/Cursor review unless the exact revision was actually reviewed and the real output is recorded;
- do not merge/deploy/change live data merely because the pilot reaches `READY_TO_RELEASE`.

## Observation log
Instantiate an observation object conforming to `contracts/development-episode-observation.schema.json` and update metrics as the episode proceeds.

Raw observations are preferred over invented percentages or composite scores.

## Success condition for the experiment
The experiment succeeds only if it produces usable evidence about whether the workflow reduced friction or prevented a real failure. A green synthetic test alone is not a successful pilot.

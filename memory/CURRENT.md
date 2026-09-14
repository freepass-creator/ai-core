# Current Memory — 2026-09-14

## Mission

AI Core helps the user reach intended outcomes by finding authoritative context, choosing an execution path, preserving approval boundaries, verifying reality and learning from observed results.

Optimize for the fastest path that preserves required evidence.

## Current priority

Run the first measured real Development Episode. Do not add another framework before evidence from that episode shows a concrete missing mechanism.

- Episode: `DEV-EPISODE-001`
- Trigger: the next suitable real non-production development request
- Observation design: PR #19 / `experiment/development-episode-pilot-v0.1`
- Status: `AWAITING_USER_REVIEW`
- Observation: `docs/episodes/DEV-EPISODE-001.json`
- Prohibited shortcut: do not create a fake task or synthetic observation and call it the first episode

Capture raw facts first:

- clarification questions and repeated information requests;
- stale requirement, plan or proof events;
- user corrections and review rounds;
- reuse versus new implementation decisions;
- rework loops and files touched;
- intent-to-first-preview time;
- acceptance criteria with current evidence;
- false completion and regression events;
- handoff and resume cost.

PR #19 provides an observation contract and arithmetic summarizer. It does not observe these facts itself. The executor must record them from the real task and bind them to its repository revision and evidence.

## Adopted state

`main` is a memory and research entrypoint. It has no executable orchestrator.

PR #1 is the only current implementation line to evaluate: v0.4 planning candidate. It is not merged or adopted. PR #17 and PR #18 are stacked extensions and must not be advanced before the real episode shows that their mechanisms are needed.

Research branches and documents are indexed candidates. They are not a backlog and do not become current behavior merely because they exist or have passing CI.

## Evidence boundary

Keep these states separate:

- artifact created;
- self-authored checks passed;
- independently reviewed;
- merged or adopted;
- execution authorized;
- external execution confirmed;
- real-world outcome observed.

Fast CI for a candidate proves only the checks it actually ran on that revision. It does not prove live source access, Work Packet execution, cross-repository correctness or real outcome improvement.

## Next decision

After `DEV-EPISODE-001`, compare the raw observations with the mechanisms already available in the target project, DevCenter and PR #1. Keep, simplify or reject candidate mechanisms according to observed friction and prevented failures. Do not claim an improvement rate without a real baseline and comparable outcome evidence.

## Stable boundaries

- Project repositories remain the source of truth for project facts and code.
- AIOPS owns operational knowledge and approval controls where applicable.
- DevCenter owns reusable development standards, assets and verification profiles where applicable.
- GitHub is the durable handoff surface.
- Latest explicit user direction and authoritative, reproducible evidence outrank AI consensus.
- AI Core cannot grant operational execution authority.

# Work Reference — Next-Generation AI Core

Status: forward reference only. Current Work Packet and adopted project rules remain authoritative for implementation scope.

## What Work should preserve now

Even before Cognitive Runtime is adopted, current implementation should avoid choices that make these contracts impossible later.

1. Keep task input structured enough to preserve `goal`, `done_when`, `constraints`, project/source revision and risk.
2. Keep source pointers version-bound; do not flatten source contents into a new AI Core SSOT.
3. Keep planning separate from execution authority. A route recommendation is not permission.
4. Return machine-readable execution evidence: commit SHA, executed checks, failures, skips, residual risk.
5. Avoid coupling orchestration to a specific model name. Prefer executor roles/capabilities.
6. Keep handoff payloads small: Work should consume a Plan Slice, not full chat history.
7. Treat a changed authoritative source or changed done condition as plan invalidation, not a silent patch.

## Forward contracts

The next runtime introduces:

- Invariant Kernel
- Goal Graph
- World State
- Task Graph
- Decision Ledger
- Evidence Index
- Outcome Stream
- Learning Queue

Work does **not** need to implement all eight now. It should return enough evidence that Chat/AI Core can populate them later.

## Minimum Work Result

```json
{
  "task_id":"...",
  "start_sha":"...",
  "end_sha":"...",
  "changed_files":[],
  "commands_executed":[],
  "checks":[],
  "failures":[],
  "skips":[],
  "residual_risk":[],
  "source_revision_set":[],
  "done_when_status":[],
  "execution_authority_used":"NONE_OR_EXPLICIT_REFERENCE"
}
```

## Do not infer adoption

This research branch is not production policy. If a future-oriented recommendation conflicts with the current Work Packet, project AGENTS/README, AIOPS control rules, or explicit user direction, stop and report the conflict rather than choosing the research proposal.

## Reference path

- `docs/COGNITIVE_RUNTIME.md`
- `src/cognitive-runtime.mjs`
- `contracts/cognitive-state.schema.json`
- `test/cognitive-runtime.test.mjs`

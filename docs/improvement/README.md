# Independent improvement lane

This task owns `src/improvement/`, `test/improvement-*.test.mjs` and this directory.
Coordinator: task `01a0a25c-d3c3-7fe1-818f-c30b47fc1310`.
Worktree: `C:/Users/admin/.codex/worktrees/852a/ai-core`.
Branch: `codex/self-evolution-evidence`.

Read [CYCLE-001.md](CYCLE-001.md) and [CYCLE-002.md](CYCLE-002.md) before resuming.
Latest follow-up: [CYCLE-003.md](CYCLE-003.md), direct file input.
Verify cwd, branch, dirty state,
remote PR heads and available RAM before the next bounded change. Do not write to
`C:/dev/ai-core`, the intake/adapter owners' files, or global Codex memory.
Common ledger, policy evaluator and registry remain PR20 responsibilities.
Coordinate any common-file changes with the coordinator before editing.

## JSONL evaluation runner

Run `node src/improvement/evaluate-evolution-jsonl.mjs` with UTF-8 JSONL on stdin.
Alternatively, pass a file directly without a shell pipe or encoding conversion:

```powershell
node src/improvement/evaluate-evolution-jsonl.mjs --input "C:/path/평가 입력.jsonl"
```

The file is opened read-only and streamed through the same evaluator. Relative
paths resolve from the working directory. `--stdin` explicitly selects the default
stdin mode; combining it with `--input`, repeating options or omitting a path is
an error. `--input` selects only that file and does not consume piped stdin. A file
read failure never falls back to stdin. For a filename beginning with `--`, use
an explicit relative or absolute path such as `./--input.jsonl`.

Each nonblank line is the existing evaluator's `{candidate, baseline, trial}` input.
One optional UTF-8 BOM at the start of the file is accepted. BOMs within later
nonblank records are not removed; malformed input still produces HOLD.
For example, in PowerShell:

```powershell
'{"candidate":null}', '{"candidate":{}}' | node src/improvement/evaluate-evolution-jsonl.mjs
```

Each output is `{line, result, auto_adopted: false, execution_authorized: false}`;
`line` is the one-based physical input line,
including skipped blank lines. Policy results are returned unchanged from
`scripts/evaluate-self-evolution.mjs`; the runner does not persist or alter inputs,
reimplement policy, grant authority, or issue adoption decisions.

- Invalid JSON: `HOLD_INVALID_JSON` / `JSON_PARSE_FAILED`.
- Evaluator exception: `HOLD_EVALUATION_ERROR` / `EVALUATOR_THROWN`. This is an
  unknown evaluation failure, not a schema diagnosis. Inspect the input locally
  with the original evaluator to diagnose it; payload and exception text are
  deliberately absent from output diagnostics.
- Exit 0: evaluation completed, including ordinary policy HOLD or rejection.
  This is **not** acceptance, adoption or execution approval.
- Exit 2: a row could not be parsed/evaluated, or CLI arguments were invalid.
- Exit 1: stream I/O failure; output may be partial and must not be treated as a
  complete batch. Empty/blank-only input produces no results and exits 0.

The runner closes its output stream on completion. It streams between records;
a single record is still parsed and evaluated in memory without a size limit.
Use bounded local files, not an untrusted public network endpoint.

This is a standalone opt-in transport. Existing evaluator CLI and production
consumers are unchanged. Integration into another caller requires its owner's
review. Removing these new lane files rolls back this change.

## Recurring work

Heartbeat `ai-core` was created ACTIVE and bound to this task
`01a0a2b1-66b3-7c41-9433-9970fb6f6ede` on 2026-09-15.
Saved schedule: daily at 10:00; local timezone Asia/Seoul.
Next schedule-derived occurrence: 2026-09-16 10:00 KST. The create/view tool
did not return a scheduler-computed next-run timestamp, so that timestamp and
actual future execution remain unverified. Creation is not proof of a completed
scheduled run. Do not create a duplicate heartbeat on resume.

Each cycle should attempt one useful, bounded improvement with a counterexample,
tests, reviewable diff and resumable record. Notify on meaningful change,
completion, failure or required user action; remain quiet otherwise. No merge,
deployment, live ledger migration/mutation, account/permission changes, external
messages, global settings or automatic approval changes are authorized.

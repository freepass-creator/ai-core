# Cycle 001 — preserve per-record evaluation failures

Date: 2026-09-15 (Asia/Seoul). Status: local implementation tested; integration HOLD.
Risk: medium (new transport plus tests; no operational data or authority changes).

## Fixed source and boundaries

- Initial clean detached HEAD: `8c61a6c`.
- Implementation base: PR20 OPEN, `b438fca22bd60ac7f6efa1d509c701897e821e76`.
- PR21 OPEN, `faf24a65e65438b4895b946e976429b97d6f3c02`.
- Read PR21 `docs/ORDER_CONTROL_INTEGRATION.md` from that remote revision.
  Do not copy its SQLite records, common registry, policy or work ledger.
- Read current self-evolution source, tests, contract and necessary episode fields.
  Existing DEV-EPISODE-001 remains AWAITING_USER_REVIEW with no comparable baseline;
  its failures/partial review are not evidence of this new change's outcome.
- RAM check: approximately 31.7 GiB total and 6.5 GiB available. No GPU workload;
  no heavy concurrent builds. New files only in the assigned lane.

## Candidate and reproduced failure

Chosen candidate: a standalone JSONL runner that isolates row failures while
delegating every policy decision to the shared evaluator. This is narrower than
changing the shared validator or implementing an external attestation system.

On the fixed base, calling `evaluateSelfEvolution({candidate:null})` throws
`TypeError: Cannot read properties of null (reading 'candidate_id')`.
Calling it with `{candidate:{target_metrics:'oops'}}` throws
`TypeError: candidate.target_metrics?.some is not a function`.
These are directly reproduced synthetic counterexamples, not claimed incidents
in a real operational batch.

Criterion: a malformed row must produce an explicit failure record, preserve its
physical line number, continue with later rows, and leave a nonzero CLI exit code.
Ordinary policy results must be unchanged. Stream failure must remain incomplete.

Implementation: `evaluateEvolutionLine` and `evaluateEvolutionStream` plus stdin
CLI in `src/improvement/evaluate-evolution-jsonl.mjs`. Existing evaluator imported;
no policy, ledger, registry, hashing or adoption logic copied. Exception diagnostics
do not expose payload or exception text. Output uses a backpressure-aware pipeline.

## Verification and independent review

- Original TypeErrors reproduced before implementation.
- `node --test test/evaluate-self-evolution.test.mjs test/improvement-evolution-jsonl.test.mjs`:
  19 passed, 0 failed after I/O checks were added (11 existing + 8 new).
- New tests cover malformed JSON, two malformed candidate shapes, null envelope,
  unchanged policy result, CRLF/blank lines/unterminated final line, continuation,
  exit semantics, unwanted arguments and both input/output I/O failures.
- Final targeted run after review: 21 passed, 0 failed (11 existing + 10 new).
- `git diff --check`: passed. Final scope: one module, one test file and two
  improvement documents; no shared-file changes.
- Full `npm test` started with the first 6 new tests: 139 passed / 140 total.
  One failure: `current repository state is internally consistent` because
  `episode changed files do not match the repository diff`.
- `npm run verify`: same episode-manifest mismatch. It is NOT PASS.
- Shared episode file is outside lane ownership. Coordinator notified to reconcile
  its changed_files and files_touched_count against the integrated diff. No common
  file edited and no fixture manipulated to make this check pass.
- Claude read-only review attempted: unavailable, weekly limit resets 13:00 KST.
  Not counted as review passed.
- Cursor read-only review completed: agreed on policy reuse, HOLD-and-continue,
  physical line provenance and library I/O failures. Requested explicit denial
  on every output: added false authority/adoption flags to the transport envelope,
  leaving the shared result unchanged. Added direct input_error summary and empty
  input checks. CLI exit-1 branch remains covered indirectly by I/O rejection
  tests and code inspection, not a forced OS pipe failure test.
- Important disagreement: Cursor claimed string target_metrics does not throw.
  Rejected that claim based on the actual TypeError reproduction and the passing
  assert.throws regression. candidateProblems records errors but still executes
  target_metrics?.some without returning early. No test was weakened to agree
  with the reviewer. AI agreement is not substituted for runtime evidence.

No build/typecheck scripts exist in this base's package.json. This module has no
browser UI or external service; process-level stdin/stdout and I/O error tests are
its consumer-path checks. No real trial benefit, reduction percentage, trust
attestation, adoption or production execution is claimed.

## Resume / integration

1. Read final review notes and this lane's git log; retain all existing work.
2. Coordinator cherry-picks only the lane commit, updates common episode records
   and runs full tests plus main-state verification on the combined tree.
3. Do not call integration complete before those checks pass. A later real
   comparable episode is still needed to claim behavioral improvement.
4. Heartbeat status/schedule and invocation contract are in README.md here.

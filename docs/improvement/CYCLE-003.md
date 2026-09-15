# Cycle 003 — direct file input without a shell conversion step

Date: 2026-09-15. User directly requested autonomous improvement in this task.
Implementation base: clean `e474eb4ba94310142f6da5ba9536899cea93e457` on
`codex/self-evolution-evidence`. Comparison/integration target:
PR22 `5282f2d008303b5b1bd137fd4cb6460aed46604e`.
The evaluator and improvement module/test matched that target before this change.
PR20 stays `b438fca`; PR21 was `58f360b` at inspection. Available RAM ~6.4 GiB.

## Ownership and reason

Coordinator explicitly approved this follow-up in the existing improvement lane
and is freezing the corresponding files in the integration lane. No shared CLI,
package scripts, episode manifest, ledger, adapter, intake or registry is changed.
The old lane freeze remains meaningful for unrelated changes.

Existing runner required stdin. Supplying `--input file.jsonl` produced Usage and
exit 2. The existing README's PowerShell pipeline also requires a shell-side
data transfer step. Add direct read-only file input using the existing streaming
path so callers can pass the file they already have. No new module or SSOT.
This is a local usability improvement, not a measured reduction in user workload.

## Change and falsification

- Accept no arguments (existing stdin), `--stdin`, or exactly `--input <path>`.
- Reject conflicts, duplicates, missing/blank values and unknown options before
  evaluation. File read failures produce exit 1 and no stdin fallback.
- Open with createReadStream and reuse evaluateEvolutionStream. Destroy the file
  stream in finally, including output failure. No whole-file read or rewrite.
- Preserve row envelopes, BOM handling, physical lines and exit 0/1/2 semantics.
- New process tests ran before implementation: 3 failed / 1 passed, showing that
  named input, file I/O status and explicit stdin were unsupported.
- After implementation: existing evaluator + runner tests 28 passed / 0 failed.
  Unicode/space path, BOM/CRLF, malformed-row continuation, exact stdout parity
  against stdin, original byte equality, missing file/directory, option conflicts
  and explicit stdin covered. A successful named-file test also proves unrelated
  piped data is ignored. Fixtures live in OS temp, outside repository inventory.
- git diff --check passed.
- Cursor read-only review attempted with these two code/test files only. It
  produced no result during the bounded wait; identified its exact node process
  by the unique review prompt and stopped only that process. Independent review
  is UNAVAILABLE, not PASS. No review agreement is claimed for this cycle.
  This small read-only input option is low-risk; deterministic before/after
  process checks and exact diff review are the local validation basis.

## Limits and next step

The full suite was not rerun on this pre-integration lane: its known episode
inventory failure is owned by integration. PR22's status document reports 261
tests and main-state verification passed there; this is recorded remote evidence,
not a fresh test of this follow-up on PR22. Coordinator must reconcile this new
documentation file and rerun integration checks after cherry-picking.

No production activation or measured evolution is claimed. Input is streamed
between records; the existing single-record memory limit remains unchanged.
The CLI reads a named file as supplied and does not certify a stable snapshot if
another writer changes it during reading. No live user/operating data was tested.
Rollback: revert this cycle's commit. Existing stdin usage remains available.

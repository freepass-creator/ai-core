# Cycle 002 — accept a file-start UTF-8 signature

Date: 2026-09-15. Base: `e52756b661fc4b3a209b61994607a3f62ae83dcb`.
Risk: low; three-line transport change, synthetic fixtures, no policy changes.
Status: locally tested; integration remains HOLD as recorded in Cycle 001.

## Reason and fixed research context

The coordinator requested continued small improvements that reduce user management
and rework rather than new modules or version inflation. Read only PR12
`chat/research-notebook` at `abdf681eeda5706f5fbc8ba4594c7b4189bec2db`:
`chat/CURRENT.md` and `chat/notes/2026-09-13-ai-essence-and-human-agency.md`.
The note's sections 5 and 9 favor removing needless rework and one falsifiable
behavior change in an existing mechanism. These are research context, not operating
approval or evidence of improved human outcomes. Available RAM: about 6.9 GiB.

## Failure before change

Sending UTF-8 bytes EF BB BF followed by `{"candidate":{}}` to the runner returned
`HOLD_INVALID_JSON`, exit 2. The same content without that file signature is
evaluated normally. A new process-level acceptance test failed with `2 !== 0`
before the implementation; the later-record BOM rejection test already passed.

## Small change and evidence

Strip exactly one U+FEFF at the start of the first physical line in the stream
transport. Do not alter direct line evaluation or later nonblank records. Policy
validation and evidence stay in the shared evaluator. No new module or SSOT.

- UTF-8 byte fixture now evaluates identically to the unsigned content, line 1.
- A BOM on a later nonblank record remains `HOLD_INVALID_JSON`, exit 2.
- Combined original evaluator and runner tests: 23 passed, 0 failed.
- `git diff --check`: passed.
- No additional AI call: this bounded low-risk follow-up used before/after process
  tests and direct diff review. Cycle 001's independent review is not claimed to
  cover this subsequent change.
- An initial multi-file patch failed its context check and changed no files;
  verified the source, then applied the corrected patch. No residual partial edit.

Expected benefit: avoid a manual file re-save for this encoding marker. This is a
reproduced transport improvement, not a measured reduction in user questions or
rework. A real consumer trial is still needed to measure that benefit.

## Next boundary

Coordinator owns episode inventory reconciliation and any existing CLI linkage.
No further runtime adoption or trial-benefit work can be completed in this lane
until that integration supplies a real caller and comparable observations. Do not
invent episodes, duplicate a workflow, or repeatedly add tests for their own sake.
Next heartbeat: verify integration status, inspect actual failures if supplied,
and select the next independent improvement only if there is new supporting evidence.
Rollback: revert this cycle's commit; no data migration is involved.

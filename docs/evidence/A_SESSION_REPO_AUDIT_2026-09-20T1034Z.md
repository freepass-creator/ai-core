# A Session Repo Audit Delta Evidence — 2026-09-20T10:34Z

Scope: cross-repository evidence audit only. This record does **not** modify B/C/D canonical standards.

Baseline AI Core revision inspected: `f6ab4fd572eb003945beafa5e8722321a4b2fb81`.

## A1 — AI Core evidence timestamp contradiction

Classification: `Different` / A-evidence integrity.

Evidence:

- `examples/repository-lifecycle-2026-09-20.json` at the baseline revision declares `observed_at = 2026-09-20T10:45:00Z`.
- The containing baseline commit `f6ab4fd572eb003945beafa5e8722321a4b2fb81` was created at `2026-09-20T10:23:42Z`.
- This audit observed the file before its declared observation time.

Action:

- Re-issue the lifecycle snapshot with the real observation time before using it as freshness/completion evidence.
- Do not infer lifecycle freshness from the current `observed_at` value.

## A2 — AIOps read-only RTDB backup extraction

Project revisions:

- `freepass-creator/aiops@a8c2745a7981cbee6e6432775e21cf561625db80` — read-only RTDB backup engine migrated from legacy ERP.
- `freepass-creator/aiops@7db96ff2a76fd704c6408fc0834cb04f0084a33d` — ownership/cutover SOP.
- `freepass-creator/aiops@f5dbd28a18c86996666dad92aa91b485a78d9235` — package command.
- inspected AIOps head: `cc440e53e90c642c42a88a70d415355056594129`.

Classification: `Project > Core` for two reusable patterns.

### Route candidate → C (Core Contract), not canonicalized here

Generalized pattern: **content-addressed read-only snapshot evidence manifest**.

Reusable fields/guarantees evidenced by the project implementation:

- immutable source identity/path
- artifact file reference
- byte size
- SHA-256 content digest
- coarse cardinality (`top_level_entries`)
- explicit `READ_ONLY` mode
- explicit no-write attestation (`firebase_write_performed=false`)
- explicit no-repository-commit intent
- sensitive payload suppression in console output

Why this is ahead of the inspected Core result contract: `core-adapter-result/v1` has revision/evidence/time/status fields, but no canonical content-integrity artifact digest/size/no-write attestation structure.

Evidence grade: `SOURCE + SOP`; **not runtime/CI verified** at this revision.

### Route candidate → D (Workflow), not canonicalized here

Generalized pattern: **single-owner scheduled-runtime cutover gate**.

Sequence:

1. inventory the legacy scheduler and exact source/path
2. identify current live owner before creating a replacement
3. run successor manually against the same source/path
4. compare evidence/shape/count/size
5. select one scheduler owner
6. prohibit overlapping schedules during cutover
7. verify replacement execution first
8. only then disable predecessor schedule
9. archive predecessor only after runtime blockers are cleared

This is a migration/cutover pattern candidate, not a D standard change.

No B/UI candidate was found in this delta.

Verification gap:

- AIOps exact head had no GitHub Actions run observed for these new capabilities.
- The default `npm test` entry does not exercise `scripts/backup-rtdb.mjs` or `scripts/staff.mjs`.
- Before promoting the pattern above SOURCE/SOP evidence, require deterministic unit/fixture tests plus a same-source manual/runtime receipt.

## A3 — jpkerp5 retirement/runtime gap

Project revision: `freepass-creator/jpkerp5@e6ddb41f879d571bfd5bbe86a356d9aac3431341`.

Classification: `Core > Project` at the **runtime cutover** layer.

Core/lifecycle intent says the repository is non-authoritative/RETIRE, while the project still contains two runtime blockers:

- Vercel scheduled RIMS license verification that can update `v5/contracts`.
- GitHub Actions daily RTDB backup.

Observed runtime evidence:

- `.github/workflows/daily-backup.yml` still declares daily 03:00 KST execution.
- The latest listed scheduled backup run observed was `34716787331` on 2026-09-12 and concluded `failure`.
- Job inspection showed the `Backup RTDB` step failed because Firebase environment variables were empty; artifact upload was skipped.
- No successor AIOps backup schedule has been created, intentionally avoiding dual ownership.

Breaking impact:

- Archiving/disabling the legacy repo now can remove the remaining scheduled RIMS write path.
- Assuming the legacy backup is healthy is unsafe; the latest observed run failed and there is no replacement scheduler evidence.
- Creating a second schedule before owner verification can create duplicate execution.

Required verification before retirement completion:

1. identify the live Vercel deployment/cron owner for `/api/cron/license-verify`
2. determine whether that runtime is still intended
3. run AIOps backup manually against the same Firebase source/path
4. verify manifest digest/size/count and retention destination
5. prove restore/readback capability separately from backup success
6. establish exactly one scheduled backup owner
7. verify a successful successor scheduled run
8. only then disable legacy schedules and re-evaluate archive

## A4 — AI Core exact-head verification gate remains red

At baseline `f6ab4fd572eb003945beafa5e8722321a4b2fb81`, GitHub Actions run `35504947729` (`Main State Consistency`) completed with `failure`.

Do not treat this A-session baseline as CI-verified until a successor exact head has a green consistency run. Failure root cause was not recoverable from the available job log endpoint in this audit, so no cause is asserted here.

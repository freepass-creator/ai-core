# Retirement Wave 1 — 2026-09-20

## Goal

Reduce legacy GitHub repositories without losing live automation, migration evidence, or unique branch history.

**Default action is ARCHIVE, not DELETE.**
Deletion is a later action after branch/history preservation and external dependency retirement are proven.

## Wave status

| Repository | Gate | Current blocker | Successor / current owner |
|---|---|---|---|
| `freepass-creator/-` | READY_FOR_ARCHIVE | Closed wrong-repo Webtoon draft PR; stale PR branch remains only as history | none |
| `freepass-creator/rentsafe` | READY_AFTER_EXTERNAL_BINDING_CHECK | Confirm no old deployment/domain/secrets remain | `chakhandeal` |
| `freepass-creator/jpkerp` | READY_AFTER_EXTERNAL_BINDING_CHECK | Multiple historical branches; preserve by archive | later ERP generations |
| `freepass-creator/jpkerp2` | BLOCKED | Old Firebase/Storage/runtime bindings and divergent `redesign-v3` branch must be accounted for | `renman` + `vehicle-master` + later ERP lines |
| `freepass-creator/jpkerp-v4` | BLOCKED | Daily Vercel SMS cron must be proven disabled/migrated | later ERP line |
| `freepass-creator/freeepasserp2` | BLOCKED | Firebase rules + Vercel deployment config; old binding check required | later FreePass ERP |
| `freepass-creator/freepasserp` | BLOCKED | Firebase rules + Vercel deployment config; old binding check required | current FreePass ERP line |
| `freepass-creator/jpkerp5` | BLOCKED | Daily RIMS license-verify cron + Firebase rules; runtime owner migration required | current owner unresolved; `billincar` contains same cron lineage |

## Completed in this audit

- Added `REPOSITORY_STATUS.md` to every Wave-1 repository.
- Marked all Wave-1 repositories NON-AUTHORITATIVE / RETIRE.
- Closed the wrongly-created Webtoon Studio PR in `freepass-creator/-` without merging it.
- Verified there are no other open PRs in Wave-1 repositories.
- Inventoried non-default branches.
- Compared the large divergent branch in `jpkerp2`.
- Confirmed that `renman` supersedes the old jpkerp2 OCR endpoint with stronger authentication, rate limits, file validation, broader document support, and extraction fallback behavior.
- Confirmed `vehicle-master` is the current vehicle taxonomy SSOT.

## Branch preservation register

### freepass-creator/-

- `main` — retirement marker.
- `cursor/setup-webtoon-studio-env-a5e7` — wrong-repo Webtoon starter; PR #1 closed, never merge. Preserve only as historical branch until archive.

### freepass-creator/jpkerp

- default `master` — latest legacy line.
- `main` — 68 commits behind `master`; contains earlier insurance OCR / bulk-import work.
- `archive-v1` — independent history; AG Grid/UI legacy line.

No branch merge is required for retirement. Repository archive preserves them.

### freepass-creator/jpkerp2

- `main` — current repository default, now marked RETIRE.
- `redesign-v3` — diverged branch, 69 commits ahead / 46 behind relative to main.
  Notable historical features include expense auto-classification, auto-debit matching, large ERP page redesigns, OCR/parsers, upload tooling, and vehicle-master scripts.

This branch is not authoritative, but it is preservation evidence. Archive the whole repository; do not delete until its history is intentionally preserved elsewhere.

### freepass-creator/jpkerp5

- `main` — legacy v5 line; contains Vercel daily RIMS license-verification cron and Firebase RTDB rules.
- `freepass-erp-flask` — independent initial FreePass ERP history with no common ancestor.

## Critical runtime findings

### jpkerp-v4

`vercel.json` schedules `/api/sms/cron/daily` every day. The route can send overdue, contract-expiry, inspection, and insurance SMS and writes SMS logs. It must not be archived/deleted until the historical deployment/cron is confirmed disabled or migrated.

### jpkerp5

`vercel.json` schedules `/api/cron/license-verify` daily. The route:

- calls RIMS for registered driver-license numbers;
- reads and can update `v5/contracts` in RTDB;
- marks license states such as suspended/cancelled/expired/disqualified;
- explicitly contains comments saying the production cron was running daily at the time of implementation.

`billincar` contains the same cron lineage but with a weaker/older authentication form. Therefore the cleanup task is:

1. identify the actual current runtime owner;
2. if `billincar` is the intended owner, port the stronger jpkerp5 cron authentication before cutover;
3. prove only one scheduled runtime remains;
4. disable the jpkerp5 deployment/cron;
5. then archive jpkerp5.

### jpkerp2

Historical documentation references:

- Firebase Storage bucket `jpkerp.firebasestorage.app`;
- `jpkerp.com`;
- RTDB events/mobile_uploads;
- mobile photo upload and unresolved-work workflow.

The OCR and vehicle-master roles have successors, but old runtime bindings must still be checked before archive.

## Archive readiness rule

A Wave-1 repository becomes `READY_FOR_ARCHIVE` only when all are true:

- no current production deployment/domain;
- no scheduled job/cron;
- no active Firebase/DB writer;
- no open PR;
- unique branch history is intentionally preserved by repository archive;
- successor is known where required;
- no current AI/project treats it as authoritative.

## Delete readiness rule

Delete is intentionally stricter than archive. Do not delete until:

- archive has existed through an agreed recovery period;
- no historical branch is still needed for regression/migration evidence;
- no legal/audit/incident record requires repository retention;
- the user explicitly approves permanent deletion.

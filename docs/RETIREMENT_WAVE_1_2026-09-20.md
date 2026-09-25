# Retirement Wave 1 — 2026-09-20

## Goal

Reduce legacy GitHub repositories without losing live automation, migration evidence, or unique branch history.

**Default action is ARCHIVE, not DELETE.**
Deletion is a later action after branch/history preservation and external dependency retirement are proven.

## Wave status

| Repository | Gate | Current blocker | Successor / current owner |
|---|---|---|---|
| `freepass-creator/-` | READY_FOR_ARCHIVE | Wrong-repo Webtoon draft PR closed; stale branch remains only as archive history | none |
| `freepass-creator/rentsafe` | READY_AFTER_EXTERNAL_BINDING_CHECK | Confirm no old deployment/domain/secrets remain | `chakhandeal` |
| `freepass-creator/jpkerp` | READY_AFTER_EXTERNAL_BINDING_CHECK | Confirm no old deployment/domain still uses the shared `jpkerp` Firebase client | later ERP generations |
| `freepass-creator/jpkerp2` | READY_AFTER_EXTERNAL_BINDING_CHECK | Confirm old `jpkerp` Firebase/Storage/domain runtime is no longer served from this client | `renman` + `vehicle-master` + later ERP lines |
| `freepass-creator/jpkerp-v4` | BLOCKED | Daily Vercel SMS cron must be proven disabled/migrated | later ERP line |
| `freepass-creator/freeepasserp2` | READY_AFTER_DEPLOYMENT_CHECK | Old Vercel deployment binding only; it uses the same `freepasserp3` Firebase backend as its successor generation | later FreePass ERP |
| `freepass-creator/freepasserp` | READY_AFTER_DEPLOYMENT_CHECK | Old Vercel deployment binding only; same `freepasserp3` Firebase backend lineage | current FreePass ERP line |
| `freepass-creator/jpkerp5` | BLOCKED | Daily RIMS Vercel cron + daily GitHub Actions RTDB backup + runtime owner cutover | backup engine → `aiops`; RIMS runtime owner unresolved, `billincar` has same lineage |

## Completed in this audit

- Added `REPOSITORY_STATUS.md` to every Wave-1 repository.
- Marked all Wave-1 repositories NON-AUTHORITATIVE / RETIRE.
- Closed the wrongly-created Webtoon Studio PR in `freepass-creator/-` without merging it.
- Verified there are no other open PRs in Wave-1 repositories.
- Inventoried non-default branches and preserved them by choosing repository archive as the default retirement action.
- Compared the large divergent branch in `jpkerp2`.
- Confirmed that `renman` supersedes the old jpkerp2 OCR endpoint with stronger authentication, rate limits, file validation, broader document support, and extraction fallback behavior.
- Confirmed `vehicle-master` is the current vehicle taxonomy SSOT.
- Confirmed `jpkerp` and `jpkerp2` use the same historical `jpkerp` Firebase project.
- Confirmed `freepasserp` and `freeepasserp2` use the same `freepasserp3` Firebase project and nearly identical Vercel configuration.
- File-tree comparison shows `freeepasserp2` is the smaller/older FreePass client: 118 files versus 219 in `freepasserp`, with 63 identical blobs and 113 files existing only in the later `freepasserp` line.
- Scanned GitHub Actions in all eight Wave-1 repositories: only `jpkerp5` has a scheduled workflow. `rentsafe` has push/PR CI only.
- Migrated the generic read-only RTDB backup engine from `jpkerp5` into AIOPS without creating a replacement schedule.

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

- `main` — repository default, now marked RETIRE.
- `redesign-v3` — diverged branch, 69 commits ahead / 46 behind relative to main.
  Historical features include expense auto-classification, auto-debit matching, large ERP page redesigns, OCR/parsers, upload tooling, and vehicle-master scripts.

This branch is non-authoritative preservation evidence. Archiving the repository preserves it; it does not need to be merged back into main.

### freepass-creator/jpkerp5

- `main` — legacy v5 line; contains scheduled automation and Firebase RTDB logic.
- `freepass-erp-flask` — independent initial FreePass ERP history with no common ancestor.

## Backend lineage findings

### JPK ERP lineage

`jpkerp` and `jpkerp2` both point to the same historical Firebase project and RTDB/Storage. `jpkerp2` also contains historical scripts capable of reading/writing that backend and, in some utilities, the old `freepasserp3` backend.

Therefore they are legacy clients, not separate current SSOTs. Their remaining archive gate is external serving/runtime verification, not feature migration.

### FreePass ERP lineage

`freepasserp` and `freeepasserp2` have the same Firebase client configuration pointing to `freepasserp3`, and their Vercel SPA configuration is identical.

`freeepasserp2` is materially smaller and older than `freepasserp`. There is no reason to keep it as an authoritative implementation. It can move to archive as soon as an old/private Vercel deployment binding is ruled out.

## Critical runtime findings

### jpkerp-v4

`vercel.json` schedules `/api/sms/cron/daily` every day. The route can send overdue, contract-expiry, inspection, and insurance SMS and writes SMS logs. It must not be archived until the historical deployment/cron is confirmed disabled or migrated.

### jpkerp5 — RIMS cron

`vercel.json` schedules `/api/cron/license-verify` daily. The route:

- calls RIMS for registered driver-license numbers;
- reads and can update `v5/contracts` in RTDB;
- marks license states such as suspended/cancelled/expired/disqualified;
- contains implementation comments stating that the production cron was running daily at the time.

`billincar` contains the same cron lineage, but its general UI data root is `billincar_demo` while the cron still directly targets `v5/contracts`. Its cron authentication is also an older/weaker variant than the jpkerp5 implementation.

Required cutover:

1. identify the actual current RIMS runtime owner;
2. if `billincar` is intended to own it, adopt the stronger authentication behavior before cutover;
3. prove exactly one scheduled runtime remains;
4. disable the legacy jpkerp5 Vercel cron;
5. then clear this blocker.

### jpkerp5 — RTDB backup

`.github/workflows/daily-backup.yml` schedules a full RTDB backup every day at **03:00 KST** and uploads a 30-day GitHub artifact. Current connector permissions do not expose enough scheduled-run history to prove whether recent runs are still executing, so the workflow is treated as live until verified.

The generic backup engine has now been moved to:

- `freepass-creator/aiops/scripts/backup-rtdb.mjs`
- `freepass-creator/aiops/docs/sop/AI운영/RTDB-백업.md`

AIOPS now owns the reusable code. **No new scheduled backup was created**, so there is no duplicate schedule from this migration.

Remaining cutover gate:

1. verify source DB and freshness of the legacy backup;
2. manually validate the AIOPS backup against the same source;
3. decide the final scheduler/secret owner;
4. create/verify one replacement schedule only if still required;
5. disable the legacy jpkerp5 workflow;
6. re-evaluate archive readiness.

## Archive readiness rule

A Wave-1 repository becomes `READY_FOR_ARCHIVE` only when all are true:

- no current production deployment/domain;
- no scheduled job/cron;
- no active Firebase/DB writer served from that repository;
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

## 2026-09-25 삭제 전 검증 (대표 지시: 「한 번만 검증하고 다 삭제」)

대상 7개: `freepasserp` · `freeepasserp2` · `freepasserp3` · `rentsafe` · `jpkerp2` · `jpkerp-v4` · `jpkerp5`.

| 저장소 | 현행 저장소가 참조? | GitHub 자동화 | Vercel 설정(저장소 안) | 판정 |
|---|---|---|---|---|
| freepasserp | 없음(감사 문서만) | 없음 | 없음 | 삭제 가능 |
| freeepasserp2 | 없음 | 없음 | 없음 | 삭제 가능 |
| freepasserp3 | 없음 | push 때 `freepasserp3` Firebase 규칙 배포 | 없음 | 삭제 가능 — 규칙 정본은 이미 freepasserp4(`.firebaserc`·`database.rules.json`·`storage.rules`, 더 새것). 남겨 두면 push 한 번에 옛 규칙이 새 규칙을 덮을 위험 |
| rentsafe | 없음 | CI 만 | 없음 | 삭제 가능(후속 = chakhandeal) |
| jpkerp2 | 없음 | 없음 | 없음 | 삭제 가능 |
| jpkerp-v4 | 없음 | 없음 | ⚠ 매일 문자 cron `/api/sms/cron/daily` | GitHub 삭제로는 Vercel cron 이 **안 멈춘다** — Vercel 프로젝트를 먼저 지운다 |
| jpkerp5 | 없음(ERP5_ACCESS_ENTRYPOINT 는 「사용 금지」) | 일일 RTDB 백업 — **9/12 이후 실행 없음, 최근 실행 전부 실패** | ⚠ 매일 `/api/cron/license-verify` | 백업은 이미 멈춰 있어 잃을 것 없음(엔진은 aiops 로 이관됨). Vercel 프로젝트를 먼저 지운다 |

- 현행 12개 저장소(ai-core·freepasserp4·admin·sales·estimate·data·welrixtable·kakao-ops·renman·aiops·devcenter·docshub)에서 위 7개를 코드·설정으로 참조하는 곳은 없다(감사 기록 문서 제외).
- GitHub 저장소를 지워도 **Vercel 에 이미 배포된 것과 그 cron 은 계속 돈다**. 삭제 순서: Vercel 프로젝트 → GitHub 저장소.
- GitHub 는 지운 저장소를 90일 안에 되살릴 수 있다(설정 → Repositories → Deleted repositories).

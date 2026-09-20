# Repository Lifecycle Audit — 2026-09-20

## Purpose

This register separates repositories that are currently authoritative from legacy, reference-only, uncertain, and retirement candidates.

The governing status vocabulary follows `docs/GROUP_OPERATING_MODEL.md`:

- `ACTIVE` — current product / headquarters source of truth.
- `REFERENCE` — not a current runtime SSOT, but temporarily retained because an active project still needs its implementation, history, data mapping, or visual/calculation baseline.
- `HOLD` — actual current use, deployment, or ownership has not yet been proven. Do not delete until checked.
- `RETIRE` — not a current SSOT. No new work may start here. Preserve history until the stated retirement gate is satisfied, then archive/delete under normal approval.

## Non-negotiable retirement rule

A repository is not retired merely because it is old. Before archival/deletion:

1. identify its successor or prove there is no successor;
2. check deploy/domain/Firebase/API/Sheet/credential dependencies;
3. extract unique behavior, migration code, parsers, engines, adapters, documents, and rollback evidence still needed by an ACTIVE project;
4. prove the successor owns the required SSOT/runtime behavior;
5. stop new work in the legacy repository;
6. archive first when practical; delete only after the recovery need has expired.

AI Core reverse-import/audit must treat `RETIRE` repositories as non-authoritative and must not promote them to canonical sources. `REFERENCE` repositories may be read only for a declared migration/reference purpose.

## Current register

| Repository | Status | Successor / authority | Retirement note |
|---|---|---|---|
| freepass-creator/ai-core | ACTIVE | self | Group headquarters / standards / routing |
| freepass-creator/devcenter | ACTIVE | self | Development center |
| freepass-creator/aiops | ACTIVE | self | Operating automation and shared adapters under current refinement |
| freepass-creator/docshub | ACTIVE | self | Document hub |
| freepass-creator/teamjpkwork | ACTIVE | self | Current WORK body |
| freepass-creator/freepass-admin | ACTIVE | self | Current FreePass Admin |
| freepass-creator/freepass-sales | ACTIVE | self | Current FreePass Sales |
| freepass-creator/freepass-estimate | ACTIVE | self | Current estimate product |
| freepass-creator/freepasserp4 | ACTIVE | self | Current FreePass ERP4 / freepasserp.com line |
| freepass-creator/fp-settlement | ACTIVE | self | Independent settlement workstation |
| freepass-creator/freepasshomepage | ACTIVE | self | Current homepage |
| freepass-creator/vehicle-master | ACTIVE | self | Vehicle taxonomy SSOT |
| freepass-creator/ci_center | ACTIVE | self | CI/BI asset center |
| freepass-creator/mewcar | ACTIVE | self | Current Mewcar work |
| freepass-creator/mewcar-jbwoori-proposal | ACTIVE | self | Current proposal work |
| freepass-creator/casemap-private | ACTIVE | self | Current case map |
| freepass-creator/welrixtable | REFERENCE | freepass-estimate | New-car quote UI/calculation reference; FreePass Estimate explicitly retains it until stabilization |
| freepass-creator/sonogong-estimator | REFERENCE | freepass-estimate | Used-car quote UI/calculation reference; retain until estimate parity is proven |
| freepass-creator/freepasserp3 | REFERENCE | freepasserp4 / freepass-estimate | Prior live implementation; retain only for migration/regression evidence |
| freepass-creator/renman | REFERENCE | current project-specific owners | jpkerp6 OCR/multi-tenant prototype; keep only while unported implementation remains useful |
| freepass-creator/jpkerp5 | RETIRE | successor projects / extracted contracts | Group model already records user decision to retire; do not use as a new integration source |
| freepass-creator/jpkerp-v4 | RETIRE | jpkerp5 / later extracted projects | Legacy generation |
| freepass-creator/jpkerp2 | RETIRE | renman + vehicle-master + later ERP lines | Legacy OCR/vehicle-master logic has identifiable successor ownership; verify any remaining unique scripts before archive |
| freepass-creator/jpkerp | RETIRE | later JPK ERP generations | Legacy generation |
| freepass-creator/freeepasserp2 | RETIRE | later FreePass ERP generations | Legacy generation |
| freepass-creator/freepasserp | RETIRE | later FreePass ERP generations | Legacy generation |
| freepass-creator/rentsafe | RETIRE | chakhandeal | chakhandeal states that RentSafe history was migrated into it |
| freepass-creator/workcontrol | RETIRE | teamjpkwork + aiops | Earlier work-control line; extract any still-live scripts/decision records first |
| freepass-creator/- | RETIRE | none | Empty/accidental repository; highest-priority cleanup candidate |
| freepass-creator/freepasspartner | HOLD | unknown | Preserve until current operational use and script ownership are checked |
| freepass-creator/welrix-proposal | HOLD | docshub candidate | Likely document/reference material; verify DocsHub migration/completion before retirement |
| freepass-creator/teamjpk | HOLD | unknown | Verify whether any live site/domain still points here |
| freepass-creator/gukminchagimpo | HOLD | unknown | Independent rental-management product; current operational ownership must be confirmed |
| freepass-creator/billincar | HOLD | unknown | Independent ERP implementation; current user/deployment must be confirmed |
| freepass-creator/chakhandeal | HOLD | self | Successor to RentSafe, but current business/runtime use still needs confirmation before ACTIVE/RETIRE decision |
| freepass-creator/webtoon-studio | HOLD | self | Independent content project; keep outside core operational cleanup until current use is confirmed |

## First retirement wave

The following repositories are the first cleanup wave because a successor is known or the repository has no current authoritative role:

1. `freepass-creator/-`
2. `freepass-creator/rentsafe`
3. `freepass-creator/freeepasserp2`
4. `freepass-creator/freepasserp`
5. `freepass-creator/jpkerp`
6. `freepass-creator/jpkerp2`
7. `freepass-creator/jpkerp-v4`
8. `freepass-creator/workcontrol`
9. `freepass-creator/jpkerp5` after unported behavior is accounted for

## Evidence already observed in this audit

- `rentsafe` describes itself as the original MVP, while `chakhandeal` states it was migrated from `rentsafe` with history.
- `teamjpkwork` describes itself as the current body for WORK, while `workcontrol` describes the earlier work-control evolution path.
- `freepass-estimate` explicitly names `welrixtable`, `sonogong-estimator`, and `freepasserp4` as reference repositories and says they must not be retired before the new estimate product stabilizes.
- `vehicle-master` declares itself the vehicle classification SSOT.
- `renman` identifies itself as jpkerp6 and documents OCR ingestion plus later reuse of selected v5 logic.
- `jpkerp2` still contains historical OCR and vehicle-master tooling, but those capability areas now have explicit successor repositories.
- `docs/GROUP_OPERATING_MODEL.md` already records `jpkerp5` as a RETIRE/폐기 target and says it must not be used as a new integration source.

## Next audit

For every `HOLD` repository, resolve four facts only:

1. live deployment/domain;
2. live data source or scheduled job;
3. unique capability not present elsewhere;
4. named current owner/project.

If all four are absent, move HOLD → RETIRE.

For every `REFERENCE` repository, bind the exact feature/parity gate that allows REFERENCE → RETIRE.

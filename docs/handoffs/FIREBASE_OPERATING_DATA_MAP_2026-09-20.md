# FreePass / JPK Firebase Operating Data Map

상태: **READ-ONLY INVENTORY / REGISTRY CANDIDATE / NO MIGRATION AUTHORITY**

관측 시각: `2026-09-20T11:46:13Z`

기준 AI Core revision: `f6ab4fd572eb003945beafa5e8722321a4b2fb81`

## 결론

사용자가 말한 “두 Firebase”는 현재 코드와 클라우드에서 정확히 두 개의 Firebase project로 수렴하지 않는다. 확인된 구조는 두 **업무 축** 아래 여러 project가 붙은 형태다.

- **A. FreePass 축:** `freepasserp3`, `freepasserp5`, `welrixtable`; 폐기 대상 견적 경로로 `teamjpk-b70b7`가 걸려 있다.
- **B. JPK/렌터카 축:** `teamjpkwork`, `renman-dd0a2`, `chakhandeal`; 역사적 RTDB 계보로 `jpkerp`와 `teamjpk-b70b7`가 남아 있다.
- `mewcar`에서는 현재 revision 기준 Firebase writer/consumer를 찾지 못했다.

따라서 project 이름만 보고 정본을 합치지 않는다. `products`/`policy`, 차량/계약 원자, 과거 `renman` 자료처럼 양쪽에 겹치는 데이터의 canonical owner는 원천 대조와 writer 차단 증거가 나오기 전까지 **HOLD**다.

## 조사 경계와 방법

- 실제 문서 값, 개인정보, 고객 문서, 계약·금액 원문, 서비스계정 키 내용은 읽지 않았다.
- 저장소의 Firebase 설정, collection 상수와 query 경로, rules/index 파일, 배포·스케줄·백업 설정, Git revision만 읽었다.
- Firebase CLI의 project 목록과 `gcloud firestore databases/indexes/backups` 메타데이터만 조회했다.
- `jpkerp`와 `teamjpk-b70b7` Firestore API 활성화 제안에는 `N`으로 응답했다. API, RTDB, listener, trigger를 활성화하거나 배포하지 않았다.
- 아래 source revision은 dirty worktree를 포함하므로 재현 시 SHA와 dirty 상태를 함께 고정해야 한다.

## 클라우드 데이터베이스 현황

| Firebase project | Firestore database | 보호/복구 메타데이터 | 판정 |
|---|---|---|---|
| `freepasserp3` | `(default)`, Native, `asia-northeast3` | delete protection ON, PITR OFF | 운영 Firestore 확인. RTDB resource 표시는 폐기된 인스턴스의 존재 흔적이지 사용 허가가 아니다. |
| `freepasserp5` | `(default)`, Native, `asia-northeast3` | delete protection OFF, PITR OFF | Admin/상품 SSOT 후보. 보호·복구 보강 필요. |
| `welrixtable` | `(default)`, Native, `asia-northeast3` | delete protection OFF, PITR OFF | Sales CRM 운영 Firestore 확인. |
| `teamjpkwork` | `(default)`, Native, `asia-northeast3` | delete protection OFF, PITR OFF; backup schedule 0 | 현행 렌터카 운영 중심. 복구 준비 HOLD. |
| `renman-dd0a2` | `(default)`, Native, `asia-northeast3` | delete protection ON, PITR ON; weekly backup, 98-day retention | 보존/백업 주장과 부합하지만 canonical 또는 실제 복구 가능성은 별도 증명 필요. |
| `chakhandeal` | `(default)`, Native, `asia-northeast3` | delete protection OFF, PITR OFF; backup schedule 0 | 거래신뢰/전자계약의 별도 경계. 복구 준비 HOLD. |
| `jpkerp` | 없음/미확인 | Firestore API disabled; 활성화하지 않음 | RTDB-only 역사 계보. 신규 기준 금지. |
| `teamjpk-b70b7` | 없음/미확인 | Firestore API disabled; 활성화하지 않음 | 손오공 RTDB 견적 경로는 전환 미완료 HOLD. |

Firebase project 자체는 모두 `ACTIVE`로 조회됐다. 이는 각 서비스와 database의 사용 가능 또는 최신성을 뜻하지 않는다.

## A. FreePass 데이터 지도

| project / database | owning repo / deploy owner | collections / schema | writers | consumers | sync / source SSOT | rules / indexes / backup / freshness | HOLD |
|---|---|---|---|---|---|---|---|
| `freepasserp3/(default)` Firestore | `freepasserp4`; `.firebaserc` default. 배포 담당 개인은 미확인 | `products`, `policy`, `partner`, `user`, `contract`, `settlement`, `customer`, `audit_logs`, `new_car_trim`, `settlement_rows`, `settlement_clawbacks`, `vehicle_master` | ERP4 runtime stores와 ingest/mirror/sync scripts | ERP4 UI/API; FreePass Admin의 Auth/user 판정 | 공급사/정제 시트 → 원자/상품 발행. GitHub Actions에 ingest/mirror/contract/settlement writer schedule이 있으나 live enablement 미확인 | `freepasserp4/firestore.rules`, `firestore.indexes.json`; rules에 명시되지 않은 claimed collection은 Admin SDK 전용인지 보안 공백인지 확인 필요. local product backup 흔적만 있고 Firestore restore 증거는 부족 | `freepasserp5`와 `products`/`policy` 중복. `sync-settlement-to-firestore.mts`를 포함한 RTDB URL/adapter/rules/fallback은 활성 가능성이 남은 migration debt. |
| `freepasserp5/(default)` Firestore | `freepasserp.com` 데이터 adapter; `freepasserp4` ERP5 bridge. rules/index deploy owner 미확인 | `products`, `policy`, `contract`, `vehicle_master`, `settlement_rows`, `settlement_events`, `settlement_clawbacks`, `settlement_invoices`, `settlement_fee_rules`, `partner` | Admin runtime settlement writer는 `ERP5_WRITE=on` gate; migration/fill scripts | FreePass Admin 상품·정산 UI; ERP4 white-label catalog bridge | 상품/정책의 SSOT 후보이나 원천 대조와 cutover receipt가 완료 조건 | DB 확인. live READY composite index 4개(`settlement`/`contract`의 `_key+agent_code`, `_key+provider_company_code`). repo에 배포할 rules/index SSOT는 찾지 못함. delete protection/PITR OFF | 데이터는 ERP5, 인증은 ERP3인 이원화. canonical owner와 security deploy owner HOLD. |
| `welrixtable/(default)` Firestore | `sales`와 `freepass-sales`는 같은 GitHub remote지만 서로 다른 SHA. Hosting sites `welrixtable`, `freepass-sales`, `welrix-rent` | `users`, `leads/{leadId}/calls/{callId}`, `config`, `forms` | Web CRM, mail-intake automation | Web/call app의 leads/config/calls realtime consumer | GitHub Actions에 평일 시간당 2회 mail intake writer와 일일 광고 점검이 구성됐으나 live enablement 미확인 | repo rules와 collection-group `calls` index override. live composite index는 0. emulator rule tests 존재. Firestore backup/restore 증거 없음 | 실제 배포 SHA와 live freshness HOLD; 두 checkout drift 해소 필요. |
| `teamjpk-b70b7` legacy RTDB | `sonogong-estimator` | `/sonogong/vehicles`, `/quotes`, `/config`, `/stock` | 브라우저 direct `set` | 견적기 watchers/loaders | static new-car catalog가 `welrixtable` 복사본이라고 주장 | Firestore 없음. RTDB rules만 존재 | 전체 경로가 폐기 정책 위반 migration debt. Firestore parity 전까지 견적 데이터 흐름 HOLD. |

### FreePass 내부 흐름

```text
사람 관리 시트 / 공급사 원본
  -> ERP4 parser, atom, publication
  -> freepasserp3 Firestore (기존 운영 영역)
  -> ERP4/계약/정산 consumer

별도 Admin 경로
  -> freepasserp5 Firestore (상품/정책/계약/정산 후보)
  -> FreePass Admin + ERP4 white-label bridge
  + 인증/관리자 판정은 freepasserp3

영업 경로
  -> welrixtable Firestore (lead/call/form/user)
  -> Sales web/call UI
```

## B. JPK / 렌터카 데이터 지도

| project / database | owning repo / deploy owner | collections / schema | writers | consumers | sync / source SSOT | rules / indexes / backup / freshness | HOLD |
|---|---|---|---|---|---|---|---|
| `teamjpkwork/(default)` Firestore | `teamjpkwork`; Vercel project 동명. 배포 담당 개인 미확인 | `vehicles`, `contracts`, `documents`, `contract_history`, `contract_history_sheet`, `payment_record`, `수납스케줄v3`, `arrears`, `holding`, `채권`, `event_queue`, `event_log`, `car_cards`, `today_tasks`, `work_todo`, `fine_todo`, `fine_unpaid`, `sheet_mirror`, `money_tx`, `bank_deposit`, `debt_sale`, `insurance_status`, `insurance_check`, `fleet_count`, `customers`, `insurance`, `bank_tx`, `유지미수판`, `요약`, `계좌이력`, `ai_errors` | `aiops` atom/sheet mirror writers; TeamJPK Work 사건 큐·과태료 API/manual writers | TeamJPK Work UI, AIOps queue engine, 차량 360 projection | Google Sheets는 사람 입력 source; `sheet_mirror`는 provenance/projection. AIOps가 주기 판정 | runtime environment/credential project ID에 의존. composite indexes 0, backup schedule 0, delete protection/PITR OFF | `contract_history`와 `contract_history_sheet`는 별도 collection이며 의미/소유권 정렬 미완료. multi-writer, Command 단일화, 차량번호 fallback/조회 limit, actual scheduler/deploy freshness HOLD. |
| `renman-dd0a2/(default)` Firestore | `renman`; `.firebaserc` default. TeamJPK 문서상 old backup | 코드상 옛 차량/계약/운영 자료 계보; 현재 collection ownership은 확정하지 않음 | 현행 writer 증거 불충분 | TeamJPK의 legacy/reference 주장 | old-renman 보존 경계 | weekly backup + PITR + delete protection 확인 | backup 존재만으로 canonical 아님. teamjpkwork와 중복 범위·복원 rehearsal·writer 차단 HOLD. |
| `chakhandeal/(default)` Firestore | `chakhandeal`; Vercel project 동명 | `members`, `consents`, `risks`, `appeals`, `audits`, `certificates`, `pii_vault`, `company_keys`, `contracts`, `lab_contracts` | Admin SDK/server boundary | 거래신뢰·동의·전자계약 UI/API | 렌터카 master와 분리된 trust/contract domain | restrictive `firestore.rules`; composite indexes 0; backup schedule 0 | restore readiness와 실제 production use HOLD. 렌터카 master owner로 승격 금지. |
| `jpkerp` legacy RTDB | `jpkerp`, `jpkerp2`, `jpkerp-v4`, `jpkerp5` 계보 | asset/vehicle/contract/import stores와 listeners | 다수 direct RTDB import/write scripts | legacy pages/hooks/views | 과거 차량 master/import | Firestore API disabled. `jpkerp5` daily RTDB JSON backup은 폐기 부채 | 모든 RTDB writer/listener/backup을 migration debt로 분류. consumer parity 전까지 archive도 HOLD. |
| `teamjpk-b70b7` legacy RTDB | `sonogong-estimator` | 손오공 견적 데이터 | browser direct writes | 견적기 | 복사된 static catalog | Firestore API disabled | 재활성화 금지. 견적 consumer를 Firestore projection으로 교체하기 전 HOLD. |

### JPK/렌터카 내부 흐름

```text
Google Sheets / 운영 원문
  -> AIOps ingest + provenance
  -> teamjpkwork Firestore atoms/current projections
  -> TeamJPK Work UI / queue engine / vehicle-360

renman-dd0a2
  -> 보존/backup 후보 (canonical 아님)

chakhandeal
  -> 동의/위험/감사/전자계약 경계 (vehicle master와 분리)

jpkerp*, teamjpk-b70b7 RTDB
  -> migration debt only; fallback 금지
```

## 중복·충돌 목록

| 충돌 | 현재 증거 | 판정 |
|---|---|---|
| `freepasserp3` vs `freepasserp5`의 `products`/`policy` | 두 프로젝트 모두 writer/consumer 코드가 존재 | **HOLD** — source revision, record identity, writer lease, consumer cutover를 대조하기 전 canonical 결정 금지 |
| candidate vs 기존 AI Core registry | `registry/adoption/freepasserp4-products.source-registry.json`은 이미 `canonical_owner: freepasserp5`로 기록 | **HOLD** — 기존 선언의 근거와 현재 중복 writer 증거를 조정하기 전 어느 문서도 운영 승격 금지 |
| FreePass Admin auth vs data | auth/admin user 판정은 ERP3, 업무 데이터는 ERP5 | **HOLD** — 의도된 cross-project trust인지 운영 우회인지 보안 검토 필요 |
| `sales` vs `freepass-sales` | 같은 remote, 다른 SHA | **HOLD** — 실제 Hosting 배포 revision 고정 필요 |
| `teamjpkwork` vs `renman-dd0a2` | 현행 코드/README는 전자, 보존/backup 주장은 후자 | **HOLD** — collection별 current writer와 restore rehearsal 필요 |
| AIOps vs TeamJPK Work writers | ingest/mirror와 queue/manual writer가 공존 | **HOLD** — collection별 command owner와 idempotency contract 필요 |
| 차량번호 기반 join | 코드가 영구 ID가 아님을 스스로 명시하고 fallback/limit 사용 | **HOLD** — `assetId`, `contractId`, payment/event refs 연결 필요 |
| 견적 master copies | 손오공 static catalog와 Welrix/ERP 계보가 섞임 | **HOLD** — 한 master publisher와 revision manifest 필요 |

## 추천 책임 경계 (설계 후보)

1. **프리패스 데이터**
   - `welrixtable`: lead/call/form/user 등 영업 workflow만 소유한다.
   - `freepasserp5`: 상품·정책·계약·정산의 목표 canonical 후보로 둔다.
   - `freepasserp3`: parity가 확인될 때까지 기존 운영/인증 dependency와 migration source로 보존한다. 조용한 fallback은 금지한다.
   - CRM과 ERP 사이에는 stable customer/application/contract reference와 versioned snapshot만 교환한다.

2. **렌터카 마스터**
   - `teamjpkwork` Firestore를 차량·계약·수납·운영 원자의 목표 owner 후보로 둔다.
   - AIOps는 검증된 단일 ingest/command writer로 좁히고, Sheets는 human source, `sheet_mirror`는 provenance로 남긴다.
   - `chakhandeal`은 동의·위험·감사·전자계약 도메인으로 분리하고 차량 master를 중복 소유하지 않는다.
   - `renman-dd0a2`는 복구가 실제 rehearsal될 때까지 보존 store이지 canonical이 아니다.
   - `jpkerp*`와 `teamjpk-b70b7` RTDB는 소비자 전환 후 제거할 migration debt이며 절대 fallback이 아니다.

이 추천은 migration, write, deploy, rules 변경 승인이 아니다.

## Source revisions

| repository/worktree | revision | state |
|---|---|---|
| `freepass-admin` / `C:\dev\freepasserp.com` | `878646bb0459acf0007e0f7f36dfe0c2900c6e6a` | `work/claude/esign-center-v1`, dirty/untracked |
| `freepasserp4` | `595abaefa72ab0d5ee14414fec8998fd632ec488` | `feat/spring-atom-monitor`, dirty |
| `freepass-sales` / `C:\dev\sales` | `94b81c4266963340fc79be9a5a9c4d59056a3cd1` | `main`, clean |
| `freepass-sales` / `C:\dev\freepass-sales` | `dd4b5f2c59e834429e360a868464f89d4bb47edf` | `main`, clean |
| `teamjpkwork` | `75bb285a241b68c13acbe532c30d6d91110f8082` | `main`, dirty |
| `chakhandeal` | `ce56c92f84dd3813a2a04ec4ee4ba215fc78f333` | `cursor/freepass-esign-issue-20260808`, clean |
| `jpkerp` | `e6de03adbac98a33da7d844fb8fb197ff885e7cb` | `master`, dirty |
| `jpkerp-v4` | `8e72823454732a0d6bceddf8be646ad3c9cc83ff` | `main`, clean |
| `jpkerp2` | `6e1e9aee68fd2c3e6d2fd640e670860b60ee1d15` | `main`, dirty |
| `jpkerp5` | `13aebe8f9eaad65d9d40c0925b4081b916438b35` | `main`, dirty |
| `mewcar` | `95c13ab0473f6ca59ed40ffba359e707ad17dd95` | `main`, clean; Firebase role not found |
| `sonogong-estimator` | `fd65e6d8f9d2ffb865896b4b65442e3d2210570a` | `main`, clean |
| `aiops` | `d12f6d4afba48450391981c37fe3bda5da14b02f` | `chore/untrack-wonja-data`, dirty |
| `renman` | `adcb74311928feae368aa5aadab084f27792eec9` | `reborn/2026-08-21`, dirty |

## Evidence pointers

- FreePass: `C:\dev\freepasserp4\.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `lib/server/erp5-firestore-app.ts`, `lib/firebase/firestore-products-client.ts`, `lib/firebase/firestore-policy-client.ts`, `scripts/hourly-sync.mts`.
- Admin: `C:\dev\freepasserp.com\src\adapters\erp5\firestore.ts`, `src/server/auth.ts`, repository adapters for product/contract/settlement/vehicle master.
- Sales: `C:\dev\sales\.firebaserc`, `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `웹/firebase-config.js`, `웹/app.js`, scheduled workflows.
- Rental: `C:\dev\teamjpkwork\lib\firebase\client.ts`, `lib/firebase/admin.ts`, `lib/erp/atoms.ts`, `README.md`; `C:\dev\aiops\fb\put.mjs`, `fb/mirror.mjs`, queue engine and vehicle-360 code.
- Trust/contract: `C:\dev\chakhandeal\lib\firebase.js`, `firebase.json`, `firestore.rules`.
- RTDB debt: `C:\dev\jpkerp*` Firebase configs/import scripts/listeners; `C:\dev\sonogong-estimator\src\firebase\config.js` and Firebase modules.
- Cloud readback: `firebase projects:list --json`; `gcloud firestore databases list`; composite index and backup schedule list commands, observed at the time above.
- 재현 가능한 비민감 cloud receipt: `docs/handoffs/firebase-cloud-metadata-receipt-2026-09-20.json`.

## next_start_here

1. `freepasserp3`/`freepasserp5`의 `products`와 `policy`에 대해 document 값을 내보내지 않는 count/schema/revision manifest 비교 계획을 승인받는다.
2. `teamjpkwork`/`renman-dd0a2`의 collection별 writer identity, latest write timestamp aggregate, backup restore rehearsal 계획을 승인받는다.
3. 실제 Firebase/Vercel/GitHub scheduler와 deploy revision을 project별로 고정한다.
4. RTDB debt의 consumer parity 목록을 만들고 Firestore-only 경로가 검증되기 전에는 제거 완료를 선언하지 않는다.
5. 위 증거가 준비되면 이 candidate registry의 `canonical_role`, `freshness`, `deploy_owner`, `restore_status`를 갱신하고 별도 승인으로 migration plan을 작성한다.
6. `ai-core/firebase-operating-data-map-candidate/v1` validator/schema를 추가한 뒤에만 registry 승격을 검토한다.

## 독립 검토 상태

- FreePass와 JPK 축을 서로 분리해 독립 조사했고, 클라우드 metadata를 별도로 재조회했다.
- Cursor Agent 독립 검토에서 collection 목록, rules coverage, index 이름, cloud receipt, full SHA 문제가 발견돼 반영했다. `contract_history`/`contract_history_sheet` 분리와 ERP3 rules 미포함 경로는 HOLD로 강화했다.
- Claude Code는 주간 사용 한도, Gemini CLI는 계정 403으로 검토하지 못했다. 미검토를 PASS로 간주하지 않는다.
- 공통 합의: project는 두 개가 아니며, RTDB는 전부 migration debt, canonical owner는 중복 증거가 해소될 때까지 HOLD다.
- 남은 이견이 아니라 미증명 영역: 실제 deploy owner, live writer freshness, cross-project Auth의 의도, restore rehearsal.

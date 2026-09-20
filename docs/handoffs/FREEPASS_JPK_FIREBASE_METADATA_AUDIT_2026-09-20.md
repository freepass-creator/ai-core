# FreePass · JPK/렌터카 GitHub–Firebase 메타데이터 감사

- 기준시각: 2026-09-20 UTC
- 감사 방식: GitHub 읽기 전용
- 대상 owner: `freepass-creator`
- ai-core 기준 revision: `9b520f3e1f79b54813159b4deb0f020d8ca64bde`
- 제외: 실제 고객 문서, Firebase 콘솔 데이터, secrets, 환경변수 값, 서비스계정, 로컬 `.env`, 배포 변경
- 허용 근거: repository metadata, README, `firebase.json` / `.firebaserc`, Rules/Indexes/Schema, workflow/deploy config, handoff/status 문서

## 1. 판정 규칙

- `confirmed`: 지정된 허용 근거에서 이름·역할·Firebase project ID 또는 수명주기를 직접 확인했다.
- `unknown`: GitHub 허용 근거만으로 확정할 수 없다. 빈칸을 추정 이름으로 채우지 않는다.
- `conflict`: 같은 대상을 서로 다르게 설명하는 근거가 있다. 런타임·로컬 확인 전 어느 한쪽으로 덮지 않는다.
- GitHub `archived=false`는 저장소가 기술적으로 열려 있다는 뜻일 뿐 제품이 ACTIVE라는 뜻이 아니다. 아래 status는 문서화된 수명주기/권한을 우선한다.
- 같은 repository의 branch, 과거 버전, worktree는 별도 프로젝트로 세지 않았다. 별도 repository로 쪼개진 세대는 `legacy family` 또는 alias/successor 관계로 묶었다.

## 2. 확인된 Firebase project ID

| Firebase project ID | 판정 | 연결 repo / 근거 | 역할 |
|---|---|---|---|
| `welrixtable` | confirmed | `freepass-sales` `.firebaserc`, README/HANDOFF | Sales CRM Firestore 정본; `freepass-sales`, `welrixtable`, `welrix-rent` Hosting site를 같은 repo에서 배포 |
| `freepasserp5` | confirmed | `freepasserp4` 데이터 허브 handoff + 명시적 production writer 설명 | 프리패스 데이터 허브 상품 canonical Firestore 대상. repo명은 `freepasserp4`; 별도 `freepasserp5` repo는 미확인 |
| `freepasserp3` | confirmed | `freepasserp4` `.firebaserc` | `freepasserp4` root Firebase CLI의 default project. `freepasserp5`와 동일하다고 간주하면 안 됨 |
| `teamjpkwork` | confirmed_documentary | `teamjpkwork` README | WORK의 `contracts`·`vehicles` 정본으로 명시. `.firebaserc`/`firebase.json`은 repo에서 미발견 |
| `renman-dd0a2` | conflict | `renman` `.firebaserc`; `teamjpkwork` README | Renman default project인 동시에 WORK 문서는 “옛 ... 백업”으로 표현. 실제 배포/소유 경계 로컬 확인 필요 |

위 다섯 ID 외에는 이번 감사 범위에서 정확한 project ID를 확인하지 못했다. 특히 Admin, Estimate, Settlement, Chakhandeal, Vehicle Master, Mewcar에 ID를 추정 기입하지 않는다.

## 3. 프로젝트·저장소·writer/consumer 지도

| 영역 / 프로젝트 | repository @ exact revision | status | aliases / successor | Firebase reference | writer / consumer 역할 | 판정 |
|---|---|---|---|---|---|---|
| FreePass Admin | `freepass-creator/freepass-admin@2747ef32e96c550d7dea05c58ee012880cb42dd3` | ACTIVE; production persistence/auth/release NOT VERIFIED | 프리패스 어드민, ADMIN | unknown | Canonical Product 모델의 planned consumer; 접수 snapshot/domain writer는 개발용 file adapter까지 확인. 운영 DB writer 없음 | confirmed + unknown |
| FreePass Sales | `freepass-creator/freepass-sales@e98e3e9854012b9043f7fbe7b4168ce772047e39` | ACTIVE | FreePass Sales; hosting aliases `freepass-sales.web.app`, `welrixtable.web.app`; promotion `welrix-rent.web.app` | `welrixtable` | `leads`, `calls`, `users`, `statusEvents`, 광고검수 config의 Firestore writer/consumer; append-only 이력 규칙 | confirmed |
| FreePass Estimate | `freepass-creator/freepass-estimate@57a75aaeaa8b91f14c6bc22faa01e745daaa3112` | ACTIVE / CANONICAL | 프리패스 견적기, 신차·중고 견적기 | unknown | 견적 UI/UX·QuoteRequest·provider contract upstream. Sales/Welrix/partner가 downstream. ERP5 직접 consumer 증거는 없음 | confirmed + unknown |
| Sonogong Estimator | `freepass-creator/sonogong-estimator@c79b8cdc453ef52793081c1d9a51b605b77755dd` | REFERENCE | 손오공 견적기, 중고 UI/UX reference | unknown; `firebase.json`은 RTDB rules만 지칭 | 과거 중고 견적 구현/reference. 현재 견적 정본은 FreePass Estimate | confirmed |
| FreePass ERP4 / public catalog | `freepass-creator/freepasserp4@6188a9ea6b22a7513e51c325384c8558201708e2` | ACTIVE; RTDB debt present | freepasserp4, `freepasserp.com`, ERP4, white-label catalog | default `freepasserp3`; explicit Data Hub read target `freepasserp5` | ERP4 업무 화면/상품 API consumer. 같은 repo가 Data Hub writer workflow도 소유해 제품 경계와 repo 경계가 겹침 | confirmed + conflict |
| FreePass Data Hub · ERP5 | implementation in `freepass-creator/freepasserp4@6188a9ea6b22a7513e51c325384c8558201708e2` | ACTIVE for product SSOT; rules/index/backup HOLD | 프리패스 데이터 허브, ERP5, Product SSOT | `freepasserp5` | `.github/workflows/erp5-ssot-refresh.yml` canonical writer; ERP4 API/F01/F86/public catalog consumers. Admin/Sales/Estimate direct connection unknown | confirmed + unknown |
| FreePass Settlement | `freepass-creator/fp-settlement@b406da67a9cb2b85b5572a7f5d28d350ca84cb58` | ACTIVE standalone | 정산 워크스테이션, fp-settlement | unknown | 서버가 `settlement_rows`, `settlement_clawbacks`, `products`를 read/write한다고 문서화. 어느 project ID인지는 미확인 | confirmed + unknown |
| Welrix Table repo | `freepass-creator/welrixtable@56affca1fc4e419000afe3e42f8821e5458d2071` | REFERENCE / downstream 확인 필요 | Welrix, 과거 신차 견적·Sales hosting alias와 이름 중복 | repo 자체 ID unknown; Sales는 `welrixtable` project 사용 | Estimate README에서 기존 신차 UI/UX 및 계산 연결 reference/downstream. 이 repo의 현재 writer 권한은 미확인 | unknown |
| Vehicle Master | `freepass-creator/vehicle-master@233115fb1daf9f17ba58a4fae2c30eaaf99b2e8c` | ACTIVE / CANONICAL file SSOT | 차종마스터, 렌터카·차량 마스터 | none confirmed | `dist/` JSON/CSV/manifest producer; 여러 ERP/견적 consumer가 참조하는 5단계 taxonomy. Firebase writer 아님 | confirmed |
| JPK WORK | `freepass-creator/teamjpkwork@75bb285a241b68c13acbe532c30d6d91110f8082` | ACTIVE | 워크, WORK, teamjpkwork; 금지 alias `work-navi` 계열 | `teamjpkwork` (README 근거) | Firebase `contracts`·`vehicles` consumer; 처리 시 Sheet 완료 체크와 운영 원장 writer. AI Ops가 hourly task producer | confirmed_documentary |
| Chakhandeal | `freepass-creator/chakhandeal@f6b348051eb468f8944cb70dbab146919838caf3` | ACTIVE successor; production hardening blockers | 착한거래, 착한딜, 구 RentSafe Pro | unknown | server/Admin SDK가 risk/consent/member/audit writer; client write는 Rules로 제한. exact project 미확인 | confirmed + unknown |
| RentSafe legacy | `freepass-creator/rentsafe@8292143799f3954e32f5b893451b2cdc6e07392b` | RETIRE / NON-AUTHORITATIVE | RentSafe Pro, successor `chakhandeal` | unknown | migration evidence only; current service writer/consumer로 사용 금지 | confirmed |
| Renman / JPK ERP6 | `freepass-creator/renman@262e06de09db94a116fa377ea2f5dbe024bb086b` | ACTIVE implementation; deployment gates open | renman, `jpkerp6` | default `renman-dd0a2` | Firestore/Auth/Storage ERP writer-consumer; no-backend production hard block 문서화. WORK의 “old backup” 표현과 충돌 | conflict |
| Legacy JPK ERP family | `jpkerp@78b9ec736aebb413635a3cffa3fa4d3685b69258`; `jpkerp2@315e7f28f86a02f96c78949527a5831973de0e13`; `jpkerp-v4@1a310b5fcee6eb4cfbbc93a55284030f53353cff`; `jpkerp5@e6ddb41f879d571bfd5bbe86a356d9aac3431341` | RETIRE / NON-AUTHORITATIVE; `jpkerp5` archive BLOCKED | JPK ERP generations, jpkerp5 master/template | exact live ID unknown; `jpkerp5` config is RTDB-only | 역사/이관 근거. `jpkerp5`에는 daily RTDB backup과 RIMS cron 잔존 가능성이 있어 새 owner로 사용 금지 | confirmed |
| Legacy FreePass ERP family | `freepasserp@d746b52026b012ceb3113e8a197c9e1ac59c2f3e`; `freeepasserp2@d7d383f09398b31d25f1ffa516cbea31cb1c6d54`; `freepasserp3@8d8b7a559272a37823f879b77099b3bc17bf5a16` | `freepasserp`, `freeepasserp2`: RETIRE; `freepasserp3`: lifecycle UNKNOWN | FreePass ERP generations; successor ERP4 line | `freepasserp3` has `.firebaserc` default `freepasserp3`; older IDs unknown | 신규 기능/SSOT source 금지 for marked-retired repos. 실제 배포 binding 해제 전 삭제/보관 금지 | confirmed + unknown |
| Mewcar subscription | `freepass-creator/mewcar@232f0fee0f0004a1e525444b9ddeb61d04e286f5` | ACTIVE business-doc SSOT | 뮤카, 뮤카 구독사업 | none confirmed | 사업원칙·매뉴얼·체크리스트·운영 허브 문서 producer; Firebase data writer/consumer 근거 없음 | confirmed |
| Mewcar–JB Woori proposal | `freepass-creator/mewcar-jbwoori-proposal@d3a69e8aa3ee19132112e1440a551c3d25bd5a4f` | ACTIVE draft / internal review | JB우리캐피탈 제안, 뮤카 잔가보장 제안 | none confirmed | 문서/PPT/PDF artifact source; 데이터 시스템 아님 | confirmed |

## 4. 핵심 관계와 충돌

1. **Data Hub repo명 충돌**: Firebase project는 `freepasserp5`로 확인되지만 구현 owner repo는 `freepasserp4`다. 별도 `freepasserp5` repo는 설치된 GitHub 목록에서 미발견이다.
2. **ERP4 dual-project 경계**: `freepasserp4/.firebaserc` default는 `freepasserp3`; Data Hub writer/consumer 계약은 명시적으로 `freepasserp5`를 가리킨다. root CLI default를 Data Hub ID로 오인하면 안 된다.
3. **Sales alias 중첩**: `freepass-sales` repo는 Firebase project `welrixtable`을 사용하고 두 hosting alias를 같은 `웹/` 소스에서 배포한다. `welrixtable` repo와 `welrixtable` Firebase project는 같은 객체가 아니다.
4. **Renman ownership 충돌**: `renman/.firebaserc`는 `renman-dd0a2`; WORK README는 이를 옛 백업으로 표현한다. 실제 live deployment, write owner, collection parity를 확인하기 전 ACTIVE/backup 중 하나로 단정하지 않는다.
5. **Admin 연결 미완**: Admin은 운영 persistence/auth/release가 NOT VERIFIED이며 Data Hub direct consumer도 확인되지 않았다. 모델 계약과 실제 Firebase binding을 구분한다.
6. **Settlement project ID 공백**: Firestore collection 이름과 역할은 확인됐지만 exact project ID는 없다. `freepasserp3` 또는 `freepasserp5`라고 추정하지 않는다.
7. **견적 정본 변경**: `freepass-estimate`가 견적 upstream이며 `sonogong-estimator`, `welrixtable`, Sales는 reference/downstream이다. Firebase 저장소 소유권과 견적 계약 소유권은 별개다.

## 5. RTDB 영구 폐기 — migration debt register

RTDB는 신규·현행 SSOT 경로로 재활성화하지 않는다. 아래는 기능 후보가 아니라 제거·격리·런타임 종료 확인이 필요한 migration debt다.

| repo / family | 발견 근거 | debt 판정 | 금지 |
|---|---|---|---|
| `freepasserp4` | root `firebase.json` database rules, RTDB scripts/import residue; Data Hub handoff가 zero-state conflict 기록 | ACTIVE repo의 P0 debt | Data Hub fallback/adapter/listener/API/mirror 재활성화 금지 |
| `jpkerp5` | `firebase.json` RTDB-only, daily RTDB backup workflow, RTDB deployment guide | retirement blocker | 새 통합/SSOT owner로 사용 금지; live schedule 확인 전 끄거나 삭제 금지 |
| `sonogong-estimator` | `firebase.json` RTDB rules | reference debt | 현재 견적 정본에 복원 금지 |
| legacy FreePass ERP repos | database rules and older RTDB paths | retirement debt | 실제 binding 확인 전 삭제 금지; 신규 기능 금지 |
| legacy JPK ERP repos | RTDB status/tooling and historical deployment paths | retirement debt | current ERP source로 승격 금지 |

## 6. local-only checks needed

GitHub만으로 확인할 수 없으며 실제 고객 데이터는 열지 않고 metadata/config/runtime binding만 확인해야 한다.

1. 각 로컬 canonical checkout의 `git remote -v`, `git rev-parse HEAD`, `git worktree list`로 동일 repo 중복 폴더를 접고 revision drift를 기록한다.
2. secret 값을 출력하지 말고 Firebase CLI/Vercel project metadata에서 repo↔deployment↔project binding만 확인한다.
3. `renman-dd0a2`가 Renman live인지 WORK backup인지 deployment metadata, Hosting/Vercel env key **name presence**, recent deploy revision으로 판정한다.
4. `fp-settlement`의 `NEXT_PUBLIC_FIREBASE_PROJECT_ID` 값은 출력하지 않고 expected project와 일치 여부만 receipt로 남긴다.
5. Chakhandeal의 Firebase Admin binding과 Rules deployment target을 값 노출 없이 확인한다.
6. Data Hub `freepasserp5`의 Rules/index deployment owner, backup/restore policy, IAM 최소권한, recent writer receipt를 확인한다.
7. `jpkerp5` daily RTDB backup과 RIMS cron의 실제 활성 runtime을 확인하고, 정확히 하나의 후속 owner가 준비되기 전 중지하지 않는다.
8. legacy FreePass/JPK repos의 Firebase/Vercel binding이 끊겼는지 확인한 뒤에만 archive 후보로 전환한다.
9. Admin/Sales/Estimate가 ERP5를 직접 소비하는지 local config와 adapter wiring으로 확인하되 document data는 읽지 않는다.

## 7. next_start_here

다음 로컬 Codex는 아래 순서로 시작한다.

1. 이 문서의 exact revisions와 로컬 checkout HEAD를 비교한다. drift가 있으면 최신 허용 파일만 재감사한다.
2. 우선 충돌 3개만 닫는다: `renman-dd0a2`, `fp-settlement` project ID, `freepasserp5` Rules/index/backup owner.
3. 출력 형식은 project별 `confirmed / unknown / conflict`와 evidence revision을 유지한다. secret 값이나 document data는 receipt에 포함하지 않는다.
4. RTDB는 모든 새 경로에서 fail-closed 한다. 발견한 코드는 `delete / archive-reference / ERP4-only temporary dependency` 중 하나로 분류할 뿐 실행하지 않는다.
5. 확인 결과를 AI Core project registry에 반영할 때 제품(FreePass Data Hub)과 구현 repo(`freepasserp4`)를 별도 필드로 유지한다.

## 8. 감사 한계

- 이번 감사는 연결된 GitHub owner의 default branch와 명시된 exact revision만 다뤘다.
- GitHub 문서가 실제 배포 상태를 보장하지 않는다. runtime 확인이 필요한 항목은 `unknown` 또는 `conflict`로 남겼다.
- 실제 Firestore/RTDB document, 고객 데이터, secret, service-account payload는 읽지 않았다.
- repo rename, archive, data migration, Firebase deploy, Rules deploy, workflow 실행/중지는 수행하지 않았다.

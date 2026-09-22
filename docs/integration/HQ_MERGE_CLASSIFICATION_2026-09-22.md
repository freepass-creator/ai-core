# 본사를 ai-core 하나로 — 합치는 설계 (2026-09-22)

- 상태: `EXECUTING v0.7` — DevCenter 물리 복사, 중앙 등록부·Design Hub binding 전환, 라우팅 단일화를 실행했다. R1·R2와 포털 독립화는 계속 `HOLD`다.
- 따르는 계획: [통합 실행 지침](../AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md) 2절(분류 5종)·3절(물리 통합 원칙)·5절 STEP 0/4.
  기존 분류 [저장소 생애 감사 2026-09-20](../REPOSITORY_LIFECYCLE_AUDIT_2026-09-20.md) 은 생애(ACTIVE/RETIRE)만 정했고 합병 분류는 비어 있다.
- 대표(2026-09-22): 「결국 하나로 합쳐야 한다니까」 · 「디자인부터 aiops」 · 「개발센터 문서허브 다 하나로 합쳐야돼」 · 「work컨트롤 등등 다 합쳐야돼」 · 「그냥 다 갖고와서 ai코어 비대하게 늘리고」 · 본체 = **ai-core** · 「우리 이거 통합하는계획있는데 그거대로 해야지 혼자 결정할건 아니고」

## 실행 현황

- `2026-09-22` 1단계 복사 실험 실행: `freepass-creator/devcenter@7d750606026589fcec4299609e53dc94e907e47a`의 추적 파일 4,535개를 고정했다.
- 계획대로 `.ai-core/**` 14개와 재생성 가능한 `portal/static/**` 4,296개를 제외하고 225개를 `devcenter/`에 복사했다. 원본 Markdown 79개 중 키트에 든 9개만 제외되어 70개가 들어왔고, 누락 여부는 `devcenter/PROVENANCE.json`과 자동 검사로 확인한다.
- 원 저장소와 로컬 `C:\dev\devcenter`는 수정하지 않았다. 루트 테스트에 DevCenter 69개 테스트와 provenance 검사를 연결했다.
- `2026-09-22` 2단계 전환: DevCenter의 프로젝트·데이터셋·허브 등록부를 루트 `registry/`로 옮기고, `projects.json`·`capabilities.json`·`work-map.json`의 권한을 AI Core 내부 `devcenter/` 모듈로 전환했다(R3 완료). Design Hub는 오래된 AI Core 커밋 대신 현재 루트 원본 9개의 정규화 SHA-256 묶음을 검증한다(R5 완료).
- `2026-09-22` 3단계 전환: Hub Router의 Primary/Secondary 규칙 8개를 `registry/work-map.json#hub_routes`에 흡수하고 별도 `hub-routing-rules.json`을 제거했다(R4 완료). Hub 실행기는 이제 Work Map만 읽고 미등록·무매칭·동점 충돌을 계속 HOLD한다.
- **계속 HOLD:** 중복 규칙·영수증을 정리하는 R1/R2, 원 저장소 read-only 표식, 포털의 `../../freepasserp4` 형제 경로 의존 제거.
- Claude 독립 검토는 호출됐으나 비대화형 응답이 없어 중단했다. 이를 PASS로 세지 않으며, 이번 단계는 파일 해시·문서 수·69개 원본 테스트·AI Core 전체 테스트의 결정론적 증거로만 판정한다.

## ★합치는 설계 — 무엇을 어디로, 겹치면 어떻게

대표(2026-09-22): 「야 내용이 전혀 없어?? 어떻게 합칠지??」

설계도는 새로 만들지 않는다 — 개발센터 [Hub Architecture v1](https://github.com/freepass-creator/devcenter/blob/main/docs/HUB-ARCHITECTURE.md)(2026-09-21 **사용자 확정**)이 이미 정했다:
**AI Core = 헌법·공통 계약·불변 규칙**, **개발센터 = 그 규칙을 실행하는 조직(관제층 + 허브 7개)**. 그 문서 5절은 「물리 이동은 별도 migration 작업이다」라고 적어 두었다 — **이번 일이 그 migration 이다.**

### 1. ai-core 안의 모양

```text
ai-core/
├─ (루트 — 그대로)  헌법 · 공통 계약 · 불변 규칙
│   docs/AI_WORKING_STANDARD.md · contracts/ · design-system/ · registry/ · docs/UI_UX_CONSTITUTION.md …
│
├─ devcenter/                     개발센터 = 실행 조직 (Hub Architecture v1 그대로)
│  ├─ control-plane/
│  │  ├─ standards/    ← devcenter standards/ · docs/CURRENT-STANDARDS · DEV-STANDARD · BASELINE · BOOTSTRAP · STARTER-TEMPLATES
│  │  ├─ operations/   ← devcenter operations/ (progress-handoff 기록 포함) · inspection/
│  │  ├─ ssot/  engine/  runs/
│  │  └─ (registry 는 루트 registry/ 로 합친다 — 규칙 R3)
│  ├─ design-hub/      ← design/ · hubs/design · contracts/design-* · scripts/design-* · docs/DESIGN-* · portal 디자인 도구
│  ├─ data-hub/        ← hubs/data · docs/DATA-HUB-EVIDENCE · contracts/data-receipt · evidence/data
│  ├─ document-hub/    ← hubs/document · docs/DOCUMENT-HUB-RUNTIME · contracts/document-* · scripts/document-hub
│  │                     + ★문서허브(docshub) 양식/ · data/(등록부·생성기) · 정적 앱   (Hub Architecture: docshub = Document Hub 정본)
│  ├─ engineering-hub/ ← capabilities/shared · capabilities/packages · docs/ENGINEERING-HUB-RUNTIME
│  ├─ integration-hub/ ← capabilities/integrations · docs/INTEGRATION-HUB-RUNTIME
│  │                     + ★aiops 공통 연결(Google·Drive·Sheet·인증·Firebase adapter) · aiops docs/aiknowhow(메일·OCR·전사 노하우)
│  ├─ quality-hub/     ← quality/conformance · quality/testing · docs/QUALITY-* · BROWSER-VERIFICATION · contracts/quality-receipt
│  ├─ delivery-hub/    ← quality/release-recovery · docs/DELIVERY-HUB-RUNTIME · contracts/delivery-*
│  └─ portal/          ← portal/app 소스 (portal/static 4,296 은 빌드로 다시 만든다)
│
└─ aiops/                         운영 본부 — 업무 도구·SOP·판단 규칙 (허브가 아니다: Hub Architecture 「제품 고유 비즈니스 로직은 각 프로젝트에 남긴다」)
   ├─ docs/  ← aiops docs/ 294 md 전부 (sop · 제안 · 오더 · 지난것 · 미수로직 · 업무지도 …)
   └─ (업무 도구 코드 — 대표 결정 4번: 가져오되 실행은 원본이 계속, 업무별로 전환)
```

### 2. 겹치면 이렇게 합친다 (규칙 7개)

| # | 겹침 | 합치는 법 | 누가 |
|---|---|---|---|
| R1 | **규칙이 두 번 적힘** — devcenter `design/README`(토큰·버튼 상태 설명) · `CURRENT-STANDARDS` · `standards/` 가 ai-core `design-system/`·표준 문서와 같은 것을 말함 | 규칙은 **루트 한 벌**. devcenter 쪽에만 있는 내용은 루트 규칙 문서에 흡수하고, 그 자리는 링크 한 줄로 바꾼다. 서로 다르면(예: CURRENT-STANDARDS C02 — 컨트롤 폰트 13/12.5 ↔ 12.5/12) 루트 토큰에서 하나로 정하고 대표 확인 | Claude 대조안 → Codex 반영 |
| R2 | **영수증 두 가족** — 허브별 receipt 5종(quality·design·document·data·delivery) ↔ ai-core `core-receipt`·`ui-ux-conformance-receipt`·`qa-result` | `core-receipt` 를 바탕으로, 허브 영수증은 그 **유형**으로 만든다 — 공통 칸(대상·revision·검증·증거)은 한 번, 허브별 칸만 따로 | Claude 설계 → Codex 구현 |
| R3 | **등록부 두 벌** — devcenter `registry.json` · `hubs/registry.json` ↔ ai-core `registry/projects.json` · `capabilities` | 루트 `registry/` 로 합친다. 허브 7개는 `registry/hubs.json` 한 파일, 프로젝트는 `projects.json` 한 곳 | Codex |
| R4 | **라우팅 두 곳** — Hub Router(Primary+Secondary Hub) ↔ ai-core work-map | work-map 하나. 허브 라우팅 규칙(Hub Architecture 6절 예시)은 work-map 의 대상 목록으로 들어간다 | Codex |
| R5 | **고정 revision 묶음** — Design Hub `core-binding` 이 ai-core 옛 커밋(`ac8c502`)에 묶여 있음 | 같은 저장소라 revision 고정 대신 **design-system 원본 묶음의 digest** 를 검사(X-0002) — 옛 토큰을 쓰면 빨강 | Codex |
| R6 | **시작 키트 사본** — devcenter·aiops·docshub 의 `.ai-core/` | 버린다(원본이 루트에 있다) | 복사 때 제외 |
| R7 | **기록** — handoff · review · 제안 · 지난것 | 합치지 않는다 — **원래 경로 그대로** 해당 폴더에 둔다. md 하나도 빼지 않는다 | 복사 때 |

### 3. 합친 뒤 «정본 하나» 를 무엇으로 증명하나

- 루트 규칙 파일(토큰·상호작용 계약)의 값이 `devcenter/**` 어디에도 **다시 정의되지 않는다** — 검사기로 막는다(R1).
- 모든 허브 영수증이 `core-receipt` 바탕 스키마를 통과한다(R2).
- `registry/` 밖에 등록부 JSON 이 없다(R3).
- Design Hub 가 옛 토큰 digest 로 돌면 빨강(R5) — Codex 반례를 그대로 시험으로.

## 왜 지금 (실측한 어긋남)

- 디자인 규격이 두 곳이다. ai-core `design-system/`+UI/UX 헌법이 실제로 쓰인다(freepass-admin 3 · freepass-sales 4 파일 참조, 개발센터 `sk-` 스킨킷 사용 0곳).
  그런데 개발센터 Design Hub `core-binding` 은 ai-core `ac8c502` 에 묶여 있어 최신 `cca1423` 과 규격 파일 6개가 다르다(2026-09-22 freepass-admin 세션 보고). 칩·토글·눌림 상태는 등록부 항목이 없다.
- 로컬 `C:\dev\devcenter` 는 `.git` 이 깨져 갱신이 안 되고, 원격에서 사라진 스킨킷이 남아 다른 세션이 규격으로 읽었다.
- 개발센터 `registry.json` 과 ai-core `registry/projects.json` 이 이중이다([MERGE-P0 결과](../handoffs/AI-CORE-MERGE-P0-RESULT.md)).

## 실측 근거 (명령·revision)

| 저장소 | 기준 커밋 | 추적 파일 | 명령 · 시각(UTC) |
|---|---|---|---|
| devcenter | `7d750606026589fcec4299609e53dc94e907e47a` | 4,535 | `gh api repos/freepass-creator/devcenter/git/trees/<sha>?recursive=1` · 2026-09-22T08:05:47Z |
| docshub | `4059d82779b7e1796afa2bbdf644e1d3bbdba3e7` | 19 (이 중 14 = `.ai-core/` 시작 키트) | 같은 꼴 · 08:05:48Z |
| aiops | `3d6ec8c6a0e826ae0472e3fb3e8bbaa8399b68c9` | 1,407 | 같은 꼴 · 08:05:49Z |

- 배포·워크플로 · 자료 의심은 위 트리에서 경로 패턴(`vercel.json|firebase.json|.github/workflows/` · `lib/wonja/|.env|계좌|입금|미수|credential|secret|.xlsx|.csv`)으로 본 것이다 — 이름으로 본 것이지 내용 검사가 아니다.
- aiops 를 부르는 이 PC 예약작업: `Get-ScheduledTask` 에서 Actions 에 `aiops` 가 든 것 6개(Ready 1). 전역 `~/.claude/CLAUDE.md` 가 `C:\dev\aiops` 스크립트를 직접 부른다.
- ai-core 안에서 `freepass-creator/devcenter` 를 실제 대상으로 지목하는 파일(`git grep origin/main`): `registry/projects.json` · `registry/work-map.json` · `registry/ui-ux-entrypoint.json` · `examples/repository-lifecycle-2026-09-20.json` · `docs/inventory/C-DEV-2026-09-15.json` · `docs/research/a-session-*.v1.json` 4개.
- ★로컬 `C:\dev\docshub` 는 **git 저장소가 아니다**(파일 581개, `.git` 없음). 실제 문서허브(`양식/` 생성기·`data/` 등록부·PDF 도구)는 **로컬에만** 있고 원격 `docshub` 저장소는 작은 정적 앱(`app.js`·`index.html`·`styles.css`)+키트뿐이다. 로컬 폴더에는 **소송 사건 서류**(`사건/`, `_레거시/고소장`)가 섞여 있다.

## 큰 틀 — 그룹 운영 모델의 본사 / 자회사 (이것이 기준이다)

대표(2026-09-22): 「아냐 그 분류말고 크게 나눠놓은거 있어」 → [그룹 운영 모델](../GROUP_OPERATING_MODEL.md) 2절 토폴로지·5절 본사 공통 조직·9절 적용 메모.
통합 실행 지침의 5종 분류(MERGE_PHYSICAL 등)는 이 큰 틀 **안에서** 쓰는 세부 도구다 — 먼저 본사/자회사로 가른다.

**본사 = ai-core 하나로 모은다(복사해서 가져온다).** 자회사는 모델대로 독립 저장소를 유지한다.

| 모델의 자리 | 지금 있는 곳 | ai-core 안 자리 | 처리 |
|---|---|---|---|
| 본사 · AI Core | `ai-core` | (본체) | — |
| 본사 · 기획실 | 따로 저장소 없음 | `planning-office/` (필요할 때) | 새로 만들지 않는다 — 생길 때 둔다 |
| 본사 · **개발센터** | `devcenter` | `devcenter/` | **① 첫 번째** 복사 합병 (디자인부터) |
| 본사 · **경영지원** (권한·문서·감사·인수인계) | `docshub` 의 공통 문서 규격·양식·등록부 (로컬 `C:\dev\docshub` 의 `양식/`·`data/`) | `management-support/docs/` | **②** 복사 합병 — ★사건 서류(`사건/`·`_레거시/고소장`)는 자회사 `casemap` 몫이라 빼고 옮기지 않는다 |
| 본사 · **공통 서비스** (공통 연결·계약·검증) | `aiops` 의 범용 기능 — Google·Drive·Sheet·인증·작업대장 | `shared-services/` | **③** — 모델 9절 그대로. 계약·adapter 로 추출하고 aiops 기존 호출과 같은 결과인지 검증(X-0002) |
| 운영 도메인 | `aiops` 의 과태료·자금·보험·미수 절차 · 예약작업 · 운영 자료 | (옮기지 않음) | 모델 9절 「업무 의미와 절차는 운영 도메인에 유지」 |
| 자회사 · ERP · 영업 · 정산 · 홈페이지 · 사건 · 웹툰 | `freepasserp4` · `freepass-sales` · `fp-settlement` · `freepasshomepage` · `casemap-private` · `webtoon-studio` (+ `freepass-admin` · `freepass-data` · 견적기) | (옮기지 않음) | 독립 유지 — 배포·도메인·OIDC 가 저장소에 묶여 있다 |
| 자회사 · work-control | 몸체 `teamjpkwork` · 옛 `workcontrol` 은 09-20 RETIRE(직원 관제 코드는 aiops 로 옮겨짐) | (옮기지 않음) | ★대표 확인 필요 — 「work컨트롤 등등 다 합쳐야돼」 는 모델의 자회사 자리와 다르다 |

## 옮길 때의 구분 — 대상 셋(개발센터 · aiops · 문서허브)

대표(2026-09-22): 「일단 개발센터, aiops, 문서허브 이정도를 생각하고 있음 · 근데 이거를 옮길때 구분을 좀 더 정해서 가자는거지」

저장소째가 아니라 **안의 내용을 종류별로** 가른다. 종류마다 ai-core 로 오는지, 어디로, 어떻게가 정해진다.

### 구분 11가지

| # | 구분 | 뜻 | ai-core 로 | 어떻게 |
|---|---|---|---|---|
| 1 | 규격·지침·노하우 | 표준 · SOP · aiknowhow · 판단 규칙 (md) | **가져온다** | 그 조직 폴더의 `docs/` — md 하나도 빼지 않는다 |
| 2 | 기록 | 인수인계 · 검토 · 감사 · 제안 · 지난것 · 결정 기록 (md·html) | **가져온다** | 그 조직 폴더에 원래 경로 그대로 — md 하나도 빼지 않는다 |
| 3 | 공통 도구 코드 | Google · Drive · Sheet · 인증 · 작업대장 · lease | **가져온다** | `shared-services/` — 계약·adapter 로, 원래 호출자와 같은 결과인지 검증(X-0002) |
| 4 | 업무 도구 코드 | 과태료 · 자금 · 보험 · 미수 · 자산 엔진 · 시트 작업 스크립트 | **대표 결정** | (가) 가져오되 **실행은 원본이 계속** — 예약작업·경로는 업무별로 따로 전환 / (나) 모델대로 운영 도메인에 둔다 |
| 5 | 양식·템플릿·생성기 | 문서 양식 html · 생성기 js/py · 등록부 | **가져온다** | `management-support/templates/` |
| 6 | 운영 자료 | 실행 결과 · 대장 · 로그 · 배치 (json·ndjson) | **안 옮긴다** | 원본 자리. 업무 데이터를 git 에 새로 들이지 않는다 |
| 7 | 회사 원본 문서 | 지분인수 · 인사 · 개인정보위 조사 · 손익 · 총회 (pdf·docx) | **안 옮긴다** | 원본 자리(또는 드라이브 보관). 개인정보·기밀 — git 이력에 한 번 들어가면 못 뺀다 |
| 8 | 사건 서류·사건 도구 | 사건 · 고소장 · 사건 가져오기 | **안 옮긴다** | 자회사 `casemap` 몫 |
| 9 | 생성물 | 빌드된 정적 페이지 · 빌드 캐시 | **안 옮긴다** | 소스만 가져와 다시 만든다 |
| 10 | 키트 사본 | 각 저장소의 `.ai-core/` 시작 키트 | **안 옮긴다** | ai-core 에 원본이 있다 — 옮기면 규격이 또 두 벌이 된다 |
| 11 | 열쇠 | `.env` · 계정 json · 토큰 | **안 옮긴다** | — |

### 폴더별 배정 (기준 커밋: devcenter `7d75060` · aiops `3d6ec8c` · docshub 로컬 폴더 2026-09-22)

**개발센터 → `devcenter/`** (추적 4,535)

| 폴더 | 파일 | 구분 |
|---|---|---|
| `portal/static/` | 4,296 | 9 생성물 (확인 필요 — 빌드 산출물이면 소스로 다시 만든다) |
| `portal/app/` 등 portal 나머지 | 37 | 코드 → `devcenter/portal/` |
| `docs/` 27 · `standards/` 5 · `design/` 8 · `ssot/` 1 · `engine/` 2 | 43 | 1 규격·지침 |
| `hubs/` 26 · `quality/` 23 · `operations/` 9 · `runs/` 1 · `evidence/` 3 | 62 | 2 기록 + 허브 설정 |
| `scripts/` 40 · `contracts/` 17 · `test/` 13 · `capabilities/` 6 | 76 | 코드 → `devcenter/` 그대로 |
| `.ai-core/` | 14 | 10 키트 사본 |
| 루트 파일 | 7 | README·AGENTS 등 → `devcenter/` |

**aiops** (추적 1,407)

| 폴더 | 파일 | 구분 |
|---|---|---|
| `docs/` (제안 52 · aiknowhow 37 · sop 28 · 오더 13 · 지난것 8 …) | 294 md | 1·2 → `operations/docs/` (md 전부) |
| `erp-uiux/` | 26 | 2 기록 |
| `lib/` 의 goog·drive·sheet·lease·task-board·ai-core adapter 류 | (lib 102 중 일부) | 3 공통 도구 → `shared-services/` |
| `lib/` 나머지 · `scripts/` 105 · `sheets/` 70 · `wonja/` 454 · `unyoung/` 63 · `asset-engine/` 73 · `drive/` 19 · `jageum/` 18 · `boheom/` 17 · `fb/` 14 · `misu/` 5 · `wonjang/` 1 · `test(s)/` 63 | 약 900 | 4 업무 도구 코드 — **대표 결정** |
| `outputs/` 17 · `logs/` 6 · `batches/` 6 · `넣을것/` 7 | 36 json | 6 운영 자료 (이름부터 「미처리과태료 처리대장」·은행 원자) |
| `사건/` | 6 | 8 사건 도구 |
| `.ai-core/` | 14 | 10 키트 사본 |
| `.github/` 3 · `.cursor/` · `.githooks/` · `codex/` · `config/` | 7 | 설정 — 4 의 결정에 따라 |

**문서허브 → `management-support/`** (로컬 `C:\dev\docshub`, git 아님, 581)

| 폴더 | 파일 | 구분 |
|---|---|---|
| `양식/` (html 58 · 생성기 js/py) | 150 | 5 양식·생성기 |
| `data/` (등록부 · catalog · 검사 · SPECS.md) | 10 | 5 · 1 |
| 원격 `docshub` 저장소의 정적 앱(`app.js`·`index.html`·`styles.css`) | 5 | 5 |
| `업무/` (지분인수 · 인사 · 개인정보위조사 · 손익 … pdf 71 · docx 11) | 187 | 7 회사 원본 문서 |
| `사건/` 112 · `_레거시/고소장`·`사건관리` | 약 200 | 8 사건 서류 |
| `_레거시/컴공주총` | (일부) | 7 회사 원본 문서 |


<details><summary>이전 세부 분류표(v0.2 — 큰 틀로 대체됨, 근거 보존)</summary>

### 세부 분류 (Codex X-0002 반영)

| 저장소 | 제안 | 까닭 | 반례 · 조건 |
|---|---|---|---|
| **devcenter** | **MERGE_PHYSICAL** → `ai-core/devcenter/` | 「원래 같은 정본」이어서가 아니다 — ai-core 가 규격 정본이고, devcenter 는 등록·감사·Design/Quality Hub 실행 기능을 가진 **별도 소비자**인데 대표 최신 직접 지시로 본체에 흡수한다(X-0002 정정). 두 곳에 두는 동안 이미 어긋났다(binding `ac8c502` ↔ 최신 `cca1423`, 규격 파일 6개 차이) | **먼저 실험**: 복사본을 갈래에 들여 참조 전환(위 9개 파일)과 기능 대조(원 저장소 검사를 새 위치에서 같은 결과)를 한 뒤에 전환 |
| **docshub** | **HOLD** — 범위 확정 뒤 MERGE_PHYSICAL | 옮길 실제 내용이 git 밖 로컬 폴더에 있고 사건 서류가 섞여 있다. Gmail 템플릿·`docshub.com` 운영 경계도 확인 전(X-0002) | 옮긴다면 `양식/`·`data/`(생성기·등록부)만. **사건 서류는 옮기지 않는다** — 민감 자료이고 사건은 `casemap` 계열 몫이다 |
| **workcontrol** | **RETIRE 유지** (합치지 않음) | 09-20 이미 RETIRE — 직원 관제 코드는 aiops·teamjpkwork 로 옮겨짐 | 옛 배포·도메인 확인 전 archive·삭제 금지(감사 58·82줄) |
| **aiops** | **2단계** — ① `EXTRACT_SHARED` ② 조건 충족 뒤 물리 합병 | 경로·예약·운영 자료에 기대는 것이 많아 한 번에 옮기면 미수·과태료·지킴이 같은 운영이 멈춘다 | ① 은 `lib/*` 파일 이동이 **아니다**(X-0002): ai-core 가 **공통 계약·adapter 를 revision 에 묶어 제공**하고 aiops 가 운영 실행을 소유한다. aiops 기존 호출자와 **같은 결과**를 내는지 검증한다. Codex 가 이미 이 방향(starter kit · request identity · 보험·재무 read adapter · 보안 승인 경계)으로 고쳐 왔다 |
| teamjpkwork · freepass-admin · freepass-sales · freepasserp4 · freepass-data · 견적기 · 홈페이지 | **KEEP_SEPARATE** (이번 범위 밖) | 각자 배포·도메인·Firebase·OIDC 가 저장소 이름에 묶여 있다(예: fp4 `erp5-ssot-refresh.yml` OIDC provider `freepasserp4`). 지침 3절 | 본사 통합과 Git 합병을 구분한다 — 합치려면 배포 전환 계획이 따로 필요 |


</details>

aiops ② 물리 합병의 조건(전부 충족 시):
- 이력 전체의 개인정보·계좌 자료 검사 통과(없으면 이력 없이 현재 트리만)
- `C:\dev\aiops` 를 부르는 곳 목록(전역 지침·예약작업·스크립트) 전환 완료
- 켜진 예약작업의 새 경로 1회 관측

## 옮기는 법 — «복사해서 가져온다» (MERGE_PHYSICAL 공통)

대표(2026-09-22): 「옮기는 계획은 복사하는 방식으로 갖고오는 방식으로 하자 그게 맞을거 같다」

지침 3절 순서 `원형 보존 → 새 위치 구성 → 동일 revision/기능 검증 → 경로 의존성 확인 → 전환 → 일정 기간 관측 → 기존 위치 read-only/retire 판단` 을 복사로 채운다.

1. **원형 보존** — 원 저장소·로컬 폴더는 **건드리지 않는다.** 문제가 생기면 원본으로 바로 돌아간다.
2. **복사** — 원 저장소 기본 갈래의 **한 커밋**을 골라, 추적된 파일(`git archive <sha>`)만 `ai-core/<이름>/` 에 복사한다.
   - **이력은 들이지 않는다** — 과거에 커밋됐던 개인정보·계좌 자료(aiops 원자 이력 등)가 따라오지 않는다. 이력은 원 저장소에 그대로 있다.
   - ★**md 등 문서는 하나도 빼지 않는다.** 대표(2026-09-22): 「md랑 이런거 다 남겨야혀」 — 문서·기록·인수인계·감사 파일을 전부 가져오고, 원본에도 그대로 남긴다.
   - 빼는 것은 셋뿐이다: 열쇠(`.env` 등) · 다시 만들 수 있는 것(`node_modules`·`.local`·빌드 산출물) · 자회사 몫 사건 서류(원래 자리에 그대로 둔다 — 지우지 않는다).
   - 복사 뒤 PROVENANCE 의 파일 목록과 원본 목록을 대조해 **빠진 md 가 0** 인지 확인한다.
   - 복사 전에 열쇠·개인정보 검사를 돌린다.
3. **출처 기록** — `ai-core/<이름>/PROVENANCE.json` 에 원 저장소 · 커밋 SHA · 복사 시각 · 제외 규칙 · 파일 수·해시 목록을 남긴다. 「어디서 언제 가져왔나」에 늘 답이 있다.
4. **검증** — 원 저장소의 검사를 새 위치에서 그대로 돌려 같은 결과. ai-core 루트 검사는 그대로 초록.
5. **경로 전환** — 원본을 부르는 곳(문서·스크립트·예약작업·세션 지침)을 새 경로로. 그 전까지 원본이 계속 운영을 맡는다.
6. **이중 쓰기 금지** — 복사한 뒤로는 **새 위치만 고친다.** 원 저장소 README 첫 줄에 「<날짜> 에 ai-core/<이름> 으로 복사됨 · 여기는 더 고치지 않는다」 를 적는다.
   원본 쪽에서 복사 뒤에 생긴 커밋이 있으면 전환 전에 한 번 더 복사해 맞춘다(PROVENANCE 의 SHA 로 차이를 본다).
7. **관측 뒤 정리** — 일정 기간 새 위치로 문제없이 돌면 원 저장소 archive 여부를 대표가 정한다. 로컬 폴더는 지우지 않고 `<이름>.moved-YYYYMMDD` 로 이름만 바꾼다.

## 같이 바꿔야 하는 ai-core 쪽 — Codex 가 맡는다 (X-0002)

- `verify-main-state` — 들인 경로를 통째로 **빼지 않는다**(증거를 숨긴다 — 초안의 내 안은 REJECT). 에피소드별 scope/manifest 로 검사기를 일반화한다.
- 루트 CI — 들인 저장소의 검사를 붙인다. 먼저 각 저장소의 install/test 명령·Node 버전·비밀 없이 도는 실행을 고정한다.
- Design Hub `core-binding` — 「같은 커밋」은 늘 참이라 검증이 아니다(초안의 내 안은 MODIFY). design-system 원본 묶음의 digest · schema version · 소비자가 채택한 revision 을 검사한다.

**반례(Codex)** — 복사해 들인 뒤 검사기에서 그 경로를 빼고 binding 을 「같은 커밋」 으로만 보면, Design Hub 가 옛 토큰을 계속 써도 전체가 PASS 한다. 물리 합병은 됐지만 「정본 하나」 문제는 그대로다. → 위 세 가지가 끝나기 전에는 devcenter 전환을 끝났다고 하지 않는다.

## 순서와 나눔

① **개발센터** → `devcenter/` — 복사 실험·참조 전환·기능 대조: **Claude** / 검사기·CI·binding: **Codex** / 병합: **Codex**
② **경영지원** ← docshub 공통 문서(양식·data, 사건 서류 제외) → `management-support/docs/`
③ **공통 서비스** ← aiops 범용 기능 → `shared-services/` — 계약·adapter 추출은 Codex 가 하던 방향 그대로, Claude 는 반례 검토
운영 도메인(aiops 업무 절차)과 자회사는 옮기지 않는다.

한 번에 하나. 각 단계는 초안 PR 로 잡는다(책상 규칙 4절).

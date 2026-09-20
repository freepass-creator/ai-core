# TeamJPK / FreePass 프로젝트 명칭 표준 후보

> 상태: **CANDIDATE / DOCUMENTATION ONLY**  
> 기준일: 2026-09-20  
> 이 문서는 이름 제안·GitHub 근거 조사·영향 분석 전용이다. GitHub repo rename, 로컬 폴더 이동, domain·배포·Firebase 변경을 승인하거나 실행하지 않는다.

## 1. 먼저 결정할 이름

사용자 선택이 필요한 항목만 두 안으로 제한했다. 추천안을 앞에 둔다.

| 항목 | 추천안 | 대안 | 현재 판정 |
|---|---|---|---|
| `freepasserp.com` 정체성 | **A. 독립 v1 코드 정본인 `프리패스 ERP`로 유지** | B. ERP4의 공개 상품 찾기 화면으로 정의 | **HOLD** — 로컬 repo는 독립 v1을 명시하지만 기존 포트폴리오에는 ERP4 공개면 해석도 남아 있다. 두 계보를 합치지 않는다. |
| `freepasserp4` 표시명 | **A. `프리패스 ERP`** | B. `프리패스 레거시 ERP` | **A 추천** — 현재 ACTIVE이므로 v4만 제거한다. 후속 제품 전환이 확정되면 B로 내린다. |
| `freepass-estimate` 표시명 | **A. `프리패스 견적기`** | B. `프리패스 견적` | **A 추천** — 사용자가 실제로 부르는 명칭과 기능이 가장 직접적이다. |
| 홈페이지 표시명 | **A. `프리패스모빌리티 홈페이지`** | B. `프리패스 홈페이지` | **A 추천** — 회사소개·B2B 운영기술 플랫폼 성격을 제품 검색면과 분리한다. |

`freepasserp.com`과 `freepasserp4`가 추천안 A를 동시에 쓰는 것은 최종 상태가 아니다. 현재 충돌을 숨기지 않기 위해 두 항목을 각각 등록하고 `freepasserp.com`을 HOLD로 잠갔다. 최종 선택 때 하나는 제품 패밀리, 다른 하나는 구현/레거시 역할로 내려야 한다.

## 2. 명명 원칙

1. `project_id`는 사람이 보는 이름과 분리된 불변 ID다. 표시명·repo가 바뀌어도 재사용하거나 변경하지 않는다.
2. 사용자가 보는 공식명은 자연스러운 한국어를 우선한다. 기술 식별자는 `short_name`과 alias에 남긴다.
3. GitHub repo slug와 표준 로컬 폴더는 영문 kebab-case로 맞추고 `C:\dev\<repo-name>`으로 1:1 대응한다.
4. 현재 repo가 이 규칙을 위반하면 사실을 숨기지 않고 현재 값을 기록한 뒤 `RENAME_REPO`로 표시한다. 이 문서 병합만으로 repo나 폴더를 바꾸지 않는다.
5. 같은 repo의 branch·worktree는 별도 프로젝트로 세지 않는다. 신차/중고 견적, ERP5 상품 SSOT, 과태료, 전자계약처럼 독립 업무 경계가 명시된 하위 기능만 같은 소유 repo를 가진 논리 프로젝트로 등록한다.
6. 회사명·제품명·기술 버전을 한 이름에 섞지 않는다. `v2/v3/v4/v5`는 독립 제품 근거가 없으면 공식명에서 제거하고 alias/history에만 둔다.
7. `RTDB`는 기술 부채·migration history다. 활성 프로젝트명이나 공식 제품명으로 쓰지 않는다.
8. repo가 비슷해 보여도 동일성 근거가 부족하면 합치지 않고 HOLD한다.
9. `status`는 naming/project lifecycle authority다. 실행 가능 여부와 배포 검증 여부는 evidence에서 별도로 읽는다. 예를 들어 repo lifecycle이 ACTIVE여도 production execution은 HOLD일 수 있다.

## 3. 직원이 먼저 접하는 공식 체계

전체 기계 registry는 [`registry/project-names.json`](../registry/project-names.json)에 있다. 여기서는 직원 체감 순서로 핵심 명칭을 제시한다.

| project_id | 공식명 | 일상 호칭 | repo | category | status | 권고 |
|---|---|---|---|---|---|---|
| `teamjpk-work` | 워크 | WORK | `freepass-creator/teamjpkwork` | operations | ACTIVE | KEEP |
| `freepass-sales` | 프리패스 영업 | 세일즈 | `freepass-creator/freepass-sales` | product | ACTIVE | RENAME_DISPLAY |
| `freepass-admin` | 프리패스 관리자 | 어드민 | `freepass-creator/freepass-admin` | product | ACTIVE | RENAME_DISPLAY |
| `freepasserp-com` | 프리패스 ERP | FreePassERP.com | `freepass-creator/freepasserp.com` | product | HOLD | KEEP |
| `freepass-erp` | 프리패스 ERP | ERP | `freepass-creator/freepasserp4` | product | ACTIVE | RENAME_DISPLAY |
| `freepass-product-ssot` | 프리패스 상품 정본 | 상품 SSOT | `freepass-creator/freepasserp4` | shared | HOLD | RENAME_DISPLAY |
| `freepass-estimate` | 프리패스 견적기 | 견적기 | `freepass-creator/freepass-estimate` | product | ACTIVE | RENAME_DISPLAY |
| `freepass-new-car-estimate` | 프리패스 신차 견적기 | 신차 견적 | `freepass-creator/freepass-estimate` | product | HOLD | KEEP |
| `freepass-used-car-estimate` | 프리패스 중고차 견적기 | 중고차 견적 | `freepass-creator/freepass-estimate` | product | HOLD | KEEP |
| `freepass-settlement` | 프리패스 정산 | 정산 | `freepass-creator/fp-settlement` | operations | ACTIVE | RENAME_DISPLAY |
| `freepass-econtract` | 프리패스 전자계약 | 전자계약 | `freepass-creator/freepasserp4` | product | HOLD | KEEP |
| `freepass-homepage` | 프리패스모빌리티 홈페이지 | 홈페이지 | `freepass-creator/freepasshomepage` | product | ACTIVE | RENAME_DISPLAY |
| `aiops` | 업무 운영 자동화 | AIOps | `freepass-creator/aiops` | operations | ACTIVE | RENAME_DISPLAY |
| `aiops-penalty` | 과태료 처리 | 과태료 | `freepass-creator/aiops` | operations | HOLD | KEEP |
| `kakao-automation` | 카카오톡 업무 자동화 | 카카오 자동화 | `freepass-creator/ai-core` | operations | HOLD | KEEP |
| `mewcar-subscription` | 뮤카 자동차 구독사업 | 뮤카 구독 | `freepass-creator/mewcar` | product | ACTIVE | RENAME_DISPLAY |
| `jbwoori-proposal` | JB우리캐피탈 잔가보장 협업 제안 | JB우리 제안 | `freepass-creator/mewcar-jbwoori-proposal` | product | ACTIVE | RENAME_DISPLAY |
| `casemap` | 사건지도 | CaseMap | `freepass-creator/casemap-private` | legal | ACTIVE | RENAME_DISPLAY |
| `webtoon-studio` | 웹툰 스튜디오 | Webtoon Studio | `freepass-creator/webtoon-studio` | product | ACTIVE | RENAME_DISPLAY |

본사·공유 체계는 다음과 같다.

| project_id | 공식명 | 역할 | status |
|---|---|---|---|
| `ai-core` | AI 코어 | 그룹 본사 규격·오더·라우팅·증거·학습 | ACTIVE |
| `devcenter` | 개발센터 | 개발 표준·공통 자산·지도점검 | ACTIVE |
| `ssot-hub` | 정본 허브 | 별도 repo가 아닌 AI Core registry view 후보 | HOLD |
| `docshub` | 문서 허브 | A4/PDF 문서·제안서·계약서 템플릿 | ACTIVE |
| `vehicle-master` | 차종 마스터 | 5단계 차종 분류 SSOT | ACTIVE |
| `ci-center` | CI 센터 | CI·명함 자산; 세부 경계 확인필요 | ACTIVE |

## 4. 버전·기능 이름 정리

### ERP4

`freepasserp4`는 현재 repo slug다. 사용자 표시명에서는 `v4`를 제거하고 `프리패스 ERP`로 쓴다. repo rename은 `freepasserp.com` 관계를 확정한 뒤에만 검토한다.

### ERP5

활성 의미는 독립 제품 `ERP5`가 아니라 `프리패스 상품 정본`이다. 현재 근거는 `freepasserp4` 내부의 Firestore SSOT 문서, refresh/publish workflow, AI Core binding이다. 과거 `jpkerp5` repo는 RETIRED이며 이 항목과 동일 프로젝트가 아니다.

`RTDB`, `freepasserp5`, `FreePass ERP 5`, `Firebase ERP5`는 alias/history 또는 migration debt로만 남긴다.

### 전자계약

현재 실행 코드 근거는 `freepasserp4`의 `/erp5/esign`, `/api/freepass-esign`에 있다. `freepass-admin`에는 main에 확정되지 않은 feature lineage가 있고, `docshub`에는 문서 템플릿이 있다. 따라서 공식명은 하나로 두되 구현 소유권은 HOLD다. repo를 합치라는 의미가 아니다.

### 정산

`fp-settlement`은 README에서 ERP4와 독립이라고 명시한다. ERP4 내부 settlement API와 같은 이름을 쓰지만 별도 UI/app 경계다. 공통 원자 공유가 프로젝트 동일성을 뜻하지 않는다.

### 견적기

`freepass-estimate`가 장기 정본이다. 신차와 중고는 같은 repo에 있지만 화면·원가설정·계산엔진을 각각 분리한다. `welrixtable`은 현재 실행 가능한 신차 runtime/reference, `sonogong-estimator`는 참고·보관 계보다.

## 5. 변경 영향표

| 변경 후보 | 영향 | 위험도 | 사전 확인 | 이번 작업 |
|---|---|---:|---|---|
| 사용자 표시명 한글화 | 화면 제목, 문서 표제, 메뉴 라벨 | 낮음 | 문자열 검색, 외부 제안서 표제 | 제안만 기록 |
| AI Core 로컬 경로 `ai-core-control-tower` → `ai-core` | 스크립트, 다중 checkout, task, IDE workspace | 높음 | 3개 checkout·절대경로·scheduler inventory | 미실행 |
| Sales 로컬 경로 `sales` → `freepass-sales` | 배포 스크립트, 바로가기, server automation | 높음 | 절대경로·Cloud Run/Scheduler·Firebase tooling | 미실행 |
| `ci_center` → `ci-center` | clone URL, 로컬 폴더, 문서 링크 | 중간 | 전체 참조 검색·배포 binding | 미실행 |
| `freepasspartner` → `freepass-partner` | clone URL, 공급사 스크립트, 작업이력 | 높음 | runtime·외부 자동화·credential path | 미실행 |
| `gukminchagimpo` → `gukmincha-gimpo` | clone URL, 회계/운영 도구 | 높음 | 실제 소유자·domain·배포 | 미실행 |
| `fp-settlement` 표시 정리 | 문서와 UI 라벨 | 낮음 | ERP4 settlement와 경계 표기 | 제안만 기록 |
| `freepasshomepage` repo rename | clone URL, hosting/domain | 높음 | 실제 domain/deployment owner | 보류 |
| ERP4/ERP5 숫자 제거 | workflow·contract·API 식별자까지 바꿀 가능성 | 높음 | 표시명과 기술 ID 분리표 | 표시명만 제안 |
| Welrix runtime의 Estimate 편입 | 배포·계산엔진·Firebase·URL | 매우 높음 | parity test, data ownership, rollback | `MERGE` 후보만 기록 |
| legacy archive | 외부 cron/Firebase/Vercel과 역사 branch | 매우 높음 | dependency·domain·secret·scheduler 조사 | 미실행 |

## 6. 단계별 rename plan

### 0단계 — 이름 승인

- 위 4개 선택 항목을 확정한다.
- `project_id`는 고정하고 표시명만 승인한다.
- HOLD 항목을 ACTIVE로 자동 승격하지 않는다.

### 1단계 — 문서 정본화

- 이 PR의 `registry/project-names.json`과 본 문서를 merge한다.
- AI Core의 기존 `registry/projects.json`은 실행 registry로 유지한다.
- naming registry와 execution registry를 자동 덮어쓰지 않는다.

### 2단계 — 표시명 적용

- 제품 UI, README, DocsHub 표제에서 공식 표시명을 적용한다.
- URL, Firebase project ID, API route, collection, workflow 이름은 바꾸지 않는다.
- alias를 최소 한 release 동안 검색 가능하게 유지한다.

### 3단계 — repo/local rename 사전감사

- 대상 repo별 clone, worktree, submodule, workflow, deployment, scheduler, secret path, absolute local path, IDE workspace를 목록화한다.
- 현재 repo와 새 repo slug를 1:1로 확정한다.
- dirty checkout과 unpublished branch가 있으면 HOLD한다.

### 4단계 — 기술 rename

- 한 번에 repo 하나만 변경한다.
- GitHub repo rename → canonical clone 재구성 → local path 변경 → 문서/automation 참조 변경 → build/test 순서로 수행한다.
- redirect에 기대지 않고 새 clone URL을 명시적으로 반영한다.

### 5단계 — 배포·domain 변경

- repo rename과 별도 change set으로 수행한다.
- production revision, Firebase/Vercel binding, scheduler, rollback을 검증한다.
- 실행 영수증 없이는 완료로 표시하지 않는다.

### 6단계 — archive

- RETIRED repo도 외부 binding과 독립 branch 계보를 확인하기 전 삭제하지 않는다.
- archive 후 신규 작업 금지와 successor pointer를 남긴다.

## 7. 근거와 한계

### 확인한 정본

- AI Core `main@9b520f3e1f79b54813159b4deb0f020d8ca64bde`
- `registry/projects.json` schema 1.1, observed 2026-09-20T11:25:00Z
- `examples/repository-lifecycle-2026-09-20.json`, 36개 연결 repo
- `docs/REPO_MULTI_AI_DUPLICATION_AUDIT_2026-09-20.md`
- 각 repo의 default-branch head와 확인 가능한 README/REPOSITORY_STATUS
- 로컬 `freepasserp.com` checkout의 origin/HEAD/README/AGENTS; 연결 GitHub 설치에서는 repo가 노출되지 않았다.

### HOLD

- `freepasserp.com`: 독립 v1과 ERP4 공개면 해석 충돌
- `프리패스 상품 정본`: ERP5 authority/source reconciliation 미완
- `정본 허브`: 독립 repo 없음
- `프리패스 전자계약`: runtime·Admin feature·template 소유권 분산
- `카카오톡 업무 자동화`: 독립 runtime/repo 검증 없음
- `billincar`, `gukminchagimpo`, `chakhandeal`, `freepasspartner`: 정확한 운영 소유권/배포 경계 미확정

## 8. CHAT_GITHUB_HANDOFF_POLICY

- **source_thread:** ChatGPT Work / ai-core v1 개발 / 2026-09-20 / TeamJPK-FreePass official naming registry request
- **checked_revisions:** 전체 목록은 `registry/project-names.json > handoff.checked_revisions`가 정본이다.
- **HOLD:** 위 7절과 registry `handoff.hold`를 따른다. 근거 부족 항목은 합치거나 ACTIVE로 올리지 않는다.
- **next_start_here:** 1절의 네 가지 표시명 선택을 승인한 뒤 이 documentation-only PR을 merge한다. 다음 작업에서 repo별 기술 rename inventory를 별도 작성하며, 이 PR을 repo rename·폴더 이동·배포 변경 승인으로 해석하지 않는다.

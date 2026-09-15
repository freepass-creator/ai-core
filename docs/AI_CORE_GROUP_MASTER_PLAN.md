# AI Core 그룹 통합 마스터 기획안

- 문서 버전: 1.0
- 작성일: 2026-09-15 (Asia/Seoul)
- 상태: `USER-DIRECTED IMPLEMENTATION BLUEPRINT`
- 구조 정본: [GROUP_OPERATING_MODEL.md](GROUP_OPERATING_MODEL.md)
- 실행 인계: [CLAUDE_GROUP_INTEGRATION_HANDOFF.md](CLAUDE_GROUP_INTEGRATION_HANDOFF.md)
- 비상 절차: [EMERGENCY_RUNBOOK.md](EMERGENCY_RUNBOOK.md)

## 0. 이 문서의 목적

이 문서는 클로드에게 “통합 방향을 보고 다시 설계하라”는 참고자료가 아니다. **이미 확정된 AI Core 본사·자회사 모델을 실제 로컬 개발환경과 GitHub 운영체계로 구현하기 위한 마스터 기획안**이다.

클로드는 이 문서를 기준으로 조사 → 구조화 → 파일럿 → 검증 → 단계적 편입을 수행한다. 단, 이 문서가 실데이터 수정·운영 배포·권한 변경·삭제를 자동 승인하지는 않는다. 각 프로젝트의 기존 승인 경계와 비상 절차는 유지한다.

핵심 한 줄:

> **AI Core를 본사로 만들고, 기존 프로젝트는 독립 자회사로 보존한 채 공통 기능만 본사 조직으로 승격하여, 사용자가 AI Core에 자연어로 지시하면 올바른 프로젝트와 공통 기능으로 라우팅되고 증거까지 돌아오는 그룹 운영체계를 만든다.**

---

## 1. 최종 목표

### 1.1 사용자가 보는 목표

사용자는 앞으로 원칙적으로 AI Core에서 다음처럼 말하면 된다.

- “ERP 상품 상세 화면 고쳐.”
- “과태료 처리해.”
- “이번 사업 기획안 이어서 정리해.”
- “홈페이지 디자인 규격 맞춰.”
- “이 기능 다른 프로젝트에서도 쓸 수 있게 공통화해.”

사용자가 저장소 이름, 브랜치, 실행 AI, 빌드 명령, 배포 구조를 매번 설명하지 않아도 AI Core가 현재 정본을 찾아 다음을 수행해야 한다.

`사용자 의도 → 프로젝트 식별 → 정본/revision 확인 → 기존 기능 재사용 판정 → 실행자 선택 → 격리 작업 → 검증 → 필요 승인 → 실제 반영 → 결과/후속 기록`

### 1.2 기술적 목표

1. 모든 현역 프로젝트를 그룹 registry에서 찾을 수 있다.
2. 각 프로젝트의 코드·데이터·배포 SSOT가 명확하다.
3. 각 프로젝트는 독립 Git·독립 빌드·독립 배포·독립 롤백을 유지한다.
4. 공통 기능은 중복 복사가 아니라 버전 고정된 계약/패키지/도구로 재사용한다.
5. AI Core가 프로젝트별 현재 상태와 진행 중 작업을 찾아낼 수 있다.
6. 여러 AI가 같은 프로젝트를 작업해도 브랜치·작업대장·증거를 통해 충돌을 줄인다.
7. 완료는 “코드 작성”이 아니라 revision-bound 검증 결과로 판단한다.
8. 새 프로젝트는 처음부터 그룹 표준 구조로 생성된다.

### 1.3 1차 완료의 정의

아래가 실제로 검증되면 “그룹 통합 1차 완료”다.

- 새 AI 세션이 `WORK_READ_FIRST.md`만 따라가도 그룹 구조와 현재 프로젝트를 찾는다.
- 실제 현역 프로젝트가 registry에 등록돼 있다.
- 프로젝트 하나 이상이 새 그룹 작업공간에서 기존과 동일 revision으로 빌드/테스트된다.
- 실제 사용자 비운영 요청 하나가 AI Core → 자회사 → 작업 → 검증 → 결과 반환까지 연결된다.
- 기존 프로젝트 SSOT와 새 registry가 서로 중복 정본이 되지 않는다.
- 공통화된 기능이 있다면 출처·version/revision·사용 프로젝트가 추적된다.
- 기존 운영 프로젝트의 데이터·브랜드·배포가 통합 과정에서 임의 변경되지 않는다.

---

## 2. 전체 구조 — 본사와 독립 자회사

```text
AI-CORE-GROUP/
├─ headquarters/
│  ├─ ai-core/                    # 대표 오더·기억·라우팅·작업대장·증거
│  ├─ devcenter/                  # 개발 규격·재사용 자산·검증
│  ├─ planning-office/            # 기획/요구사항/결정 형식
│  ├─ management-support/         # 문서·권한·감사·인수인계
│  └─ shared-services/            # 공통 adapter/connector/검증 도구
│
└─ subsidiaries/
   ├─ <erp-project>/
   ├─ <sales-project>/
   ├─ <settlement-project>/
   ├─ <homepage-project>/
   ├─ <legal-project>/
   ├─ <content-project>/
   └─ <future-project>/
```

중요:

- 위 구조는 **로컬 그룹 작업공간**이다.
- 전체를 하나의 Git monorepo로 만드는 것이 아니다.
- 실제 저장소 이름은 inventory에서 확인하며 임의로 생성하지 않는다.
- 기획실·경영지원·shared-services는 처음부터 별도 Git 저장소를 만들 필요가 없다. 독립 lifecycle이 필요해질 때 분리한다.

---

## 3. 본사 조직별 역할을 이렇게 만든다

### 3.1 AI Core — 그룹 관제 본사

AI Core가 소유할 기능:

- 사용자 오더 접수
- intent 해석
- 프로젝트/도메인 식별
- authoritative source 포인터
- 프로젝트 registry
- 진행 중 작업 registry / ledger
- 실행자 routing
- approval/verification/execution/outcome 상태 분리
- 세션 간 handoff
- 공통 Failure Memory
- 비상 진입점

AI Core가 소유하면 안 되는 것:

- 프로젝트 실제 제품 코드
- 고객/직원 원문 데이터
- 프로젝트 DB 자체
- 프로젝트별 비밀키
- 특정 서비스의 브랜드/UI 정본
- 프로젝트를 대신하는 두 번째 업무 SSOT

### 3.2 Planning Office — 기획실

처음에는 AI Core 내부 논리 기능으로 두고, 별도 repository를 자동 생성하지 않는다.

책임:

- 자연어 요구 → 목적/범위/완료조건 변환
- 사용자 확정 / source-derived / AI-inferred 구분
- requirement ID 부여
- 결정 로그
- 프로젝트 신설 여부 판정
- 본사 공통 vs 자회사 고유 영역 분리
- Work Packet/Plan Slice 생성 규격

표준 산출물:

```text
REQ-<project>-<number>
DEC-<project>-<number>
WORK-<project>-<number>
```

최소 Work Packet:

- user_intent
- desired_outcome
- acceptance_criteria
- non_goals
- target_project
- authoritative_sources + revision
- likely_scope
- reuse_candidates
- required_checks
- approval_boundary
- unresolved_decisions

### 3.3 DevCenter — 개발센터

DevCenter는 **공통 개발 자산의 정본**이다.

소유 대상:

- 프로젝트 생성 표준
- Project Capsule schema
- 공통 개발 검사기
- UI 최소 품질 규격
- API/data/state 계약 형식
- reusable capability catalog
- adapter/connector 패턴
- build/test/preview/checkpoint 표준
- Proof Bundle 규격
- 회귀 검사 규격

하지 않을 것:

- 각 자회사 업무 로직 강제 통합
- 모든 디자인을 같은 UI로 만들기
- 이름이 비슷한 코드를 자동 공통화
- 프로젝트 SSOT 복사

### 3.4 Management Support — 경영지원

초기에는 문서/정책/감사 규격의 논리 영역이다.

책임:

- 문서 템플릿과 보관 규칙
- 권한/승인 모델의 공통 표현
- 인수인계 규격
- 감사 가능한 실행 evidence 규격
- 비상/복구 기록 규격
- 외부 시스템 권한 경계 설명

실제 계정·비밀키를 저장하지 않는다.

### 3.5 Shared Services — 공통 서비스

공통화 가능 후보:

- GitHub repository discovery
- Google Drive/Docs/Sheets 접근 adapter
- Firebase 연결 adapter
- Vercel deploy/status adapter
- 공통 HTTP/API connector
- 문서/PDF 생성 기반
- 공통 logging/proof formatter
- 공통 schema validation
- 공통 notification adapter

단, **connector와 업무 의미를 분리한다.**

예:

```text
Google Sheets API 호출      → 공통 connector/adapter 후보
과태료 변경부과 판정 규칙   → 운영 도메인 로직
ERP5 상품 데이터 필드 의미  → ERP 프로젝트 SSOT
```

---

## 4. 자회사 프로젝트는 이 규격으로 관리한다

기존 프로젝트를 억지로 전면 리팩터링하지 않는다. 필요한 파일이 이미 있으면 재사용한다. 없을 때만 최소한으로 보완한다.

### 4.1 목표 프로젝트 구조

```text
project/
├─ PROJECT.md
├─ AGENTS.md
├─ project.json
├─ src/
├─ tests/
├─ docs/
│  ├─ SSOT.md
│  ├─ DECISIONS.md
│  ├─ HANDOFF.md
│  └─ RELEASE.md
├─ contracts/
├─ brand/
├─ .env.example
└─ build/package config
```

**기존 저장소가 다른 구조를 쓰면 기능상 동등한 파일을 매핑해도 된다.** 폴더명을 맞추기 위한 대규모 이동은 금지한다.

### 4.2 `PROJECT.md`

사람이 읽는 프로젝트 헌장.

필수 내용:

- 프로젝트 목적
- 실제 사용자
- 담당 업무
- 하지 않는 일
- 주요 시스템
- 데이터 SSOT
- 배포 대상
- 가장 중요한 위험

### 4.3 `project.json` — Project Capsule

기계 판독 진입점. 코드의 새 SSOT가 아니라 정본 포인터와 실행 정보다.

권장 구조:

```json
{
  "project_id": "...",
  "mission": "...",
  "status": "ACTIVE",
  "repository": "owner/repo",
  "default_branch": "main",
  "stack": [],
  "runtime": "...",
  "commands": {
    "install": [],
    "dev": [],
    "build": [],
    "test": [],
    "lint": []
  },
  "source_roots": [],
  "authoritative_sources": [],
  "data_ssot": [],
  "deploy_targets": [],
  "required_approvals": [],
  "shared_capabilities": [],
  "known_blockers": [],
  "last_verified_revision": "..."
}
```

규칙:

- 비밀값 금지
- 추측값 금지
- 모르면 `UNKNOWN` 또는 빈 값 + blocker
- `last_verified_revision` 없는 실행정보는 검증되지 않은 정보로 취급

### 4.4 `docs/HANDOFF.md`

항상 짧게 유지한다.

- 현재 revision
- 현재 작업
- 완료된 것
- 미완료
- blocker
- 다음 한 작업
- 마지막 실제 검증

긴 역사를 쌓는 곳이 아니다. 역사는 decisions/issue/commit으로 보낸다.

---

## 5. 그룹 Registry를 이렇게 만든다

### 5.1 원칙

Registry는 프로젝트 사실을 복제하는 데이터베이스가 아니다. **찾기 위한 포인터와 현재 검증 상태**만 가진다.

AI Core 내 권장 위치:

```text
registry/
├─ projects.json
├─ shared-capabilities.json
└─ schemas/
   ├─ project.schema.json
   └─ capability.schema.json
```

기존 Control Tower branch에 재사용 가능한 registry/schema가 있으면 검토 후 가져오며, 새로 중복 생성하지 않는다.

### 5.2 `projects.json` 최소 필드

```json
{
  "projects": [
    {
      "project_id": "...",
      "status": "ACTIVE",
      "repository": "owner/repo",
      "local_path": "...",
      "capsule_path": "project.json",
      "observed_revision": "...",
      "last_observed_at": "...",
      "ssot_status": "CONFIRMED",
      "active_work": [],
      "shared_capabilities": []
    }
  ]
}
```

상태:

- `ACTIVE`: 현재 개발/운영 대상
- `REFERENCE`: 참고/원천으로 유지
- `HOLD`: 정본/권한/상태 불명으로 작업 보류
- `RETIRE`: 사용자 확정 폐기 대상; 실제 삭제 여부와 구분

### 5.3 Registry 검증

반드시 검사할 것:

- project_id 중복
- 동일 repo의 중복 등록
- 없는 capsule path
- stale observed revision
- RETIRE 프로젝트가 새 dependency로 사용되는지
- 두 프로젝트가 같은 데이터 SSOT를 서로 자기 것으로 선언하는지

---

## 6. 공통 Capability Catalog를 이렇게 만든다

### 6.1 목적

“코드가 비슷하니 복붙”이 아니라, **의미가 검증된 기능을 재사용**한다.

권장 capability 필드:

```json
{
  "capability_id": "...",
  "purpose": "...",
  "source_repository": "...",
  "source_revision": "...",
  "implementation": "...",
  "inputs": [],
  "outputs": [],
  "invariants": [],
  "side_effects": [],
  "permissions": [],
  "tests": [],
  "adapters": [],
  "consumers": [],
  "evidence_state": "VERIFIED"
}
```

### 6.2 공통화 판정

결과는 다섯 가지 중 하나로 반환한다.

- `REUSE_EXACT`
- `REUSE_WITH_ADAPTER`
- `COMPOSE_OR_EXTEND`
- `KEEP_LOCAL`
- `HOLD_UNKNOWN`

두 프로젝트에서 이름이 같은 것만으로 `REUSE_EXACT` 금지.

### 6.3 AIOps 정리 원칙

AIOps를 한 번에 해체하지 않는다.

1. transport/connector 후보 식별
2. 인증·권한 경계 확인
3. 업무 도메인 의존성 확인
4. 실제 두 프로젝트 이상 재사용 가능성 확인
5. 공통 contract 작성
6. adapter 분리
7. 기존 AIOps 동작과 회귀 비교
8. 검증된 기능만 shared capability로 승격

과태료·자금·보험 등 업무 판정은 AIOps/해당 운영 도메인에 남긴다.

---

## 7. AI Core 작업 Routing을 이렇게 만든다

### 7.1 입력

사용자 자연어 요청.

### 7.2 처리 순서

```text
1. INTENT
2. PROJECT RESOLVE
3. SOURCE/REVISION RESOLVE
4. REQUIREMENT COMPILE
5. CAPABILITY REUSE CHECK
6. IMPACT / RISK
7. EXECUTOR ROUTE
8. ISOLATED WORK
9. VERIFY
10. APPROVAL GATE (필요할 때만)
11. APPLY / MERGE / DEPLOY
12. OBSERVE
13. HANDOFF / LEARN
```

### 7.3 질문 규칙

AI가 이미 확인 가능한 것은 사용자에게 다시 묻지 않는다.

질문은 답에 따라 결과가 달라지는 경우에만 한다.

예:

- 디자인 선호 → 사용자 결정 필요 가능
- repository 이름 → registry에서 찾을 수 있으면 질문 금지
- 배포 승인 → 실제 변경 직전 필요
- 이미 존재하는 SSOT 위치 → 검색 후 찾을 것

### 7.4 실행자 선택

모델 이름을 규칙에 박지 않는다. capability 기준으로 정한다.

- 단순 문서/작은 수정 → direct 가능
- repo-wide 탐색/구조변경 → Codex/Claude/Work류
- 독립 검토 → 작업자와 다른 reviewer
- UI 검증 → browser/preview verifier

동일한 AI가 작성하고 검토했으면 `SELF_REVIEW`다. 독립 검토로 기록하지 않는다.

---

## 8. 작업 상태 모델을 통일한다

다음 상태를 하나의 `DONE`으로 합치지 않는다.

```text
REQUESTED
PLANNED
IMPLEMENTED
TESTED
REVIEWED
APPROVED
MERGED
DEPLOYED
OBSERVED
CLOSED
```

필요 없는 단계는 `NOT_APPLICABLE`로 표시한다.

중요:

- IMPLEMENTED ≠ TESTED
- TESTED ≠ APPROVED
- MERGED ≠ DEPLOYED
- DEPLOYED ≠ 정상 동작 확인
- 문서 작성 ≠ 실제 시스템 적용

---

## 9. Proof Bundle을 표준화한다

각 작업 완료 시 최소 반환:

```text
work_id
project_id
subject_revision
requirement_ids
changed_files
commands_run
checks_passed
checks_failed
checks_skipped
preview/evidence refs
review_state
approval_state
merge_state
deployment_state
observed_outcome
known_unknowns
rollback/recovery note
next_action
```

“잘 됐습니다”라는 자연어만으로 종료하지 않는다.

---

## 10. 로컬 작업공간 편입 절차

각 저장소를 아래 순서로 **하나씩** 편입한다.

### STEP 1 — Inventory

확인:

- 현재 로컬 경로
- Git remote
- branch/HEAD
- dirty/untracked 존재 여부
- worktree
- deploy 대상
- data SSOT
- 주요 환경/secret 의존성의 존재 여부(값은 기록 금지)
- build/test 명령
- 현재 실제 운영 여부

출력: `GROUP-INVENTORY.md` 또는 registry evidence.

### STEP 2 — Classification

`ACTIVE / REFERENCE / HOLD / RETIRE`

분류 근거를 기록한다.

### STEP 3 — Preserve Original

- 기존 위치 삭제 금지
- 기존 Git history 보존
- 미커밋 변경 보존
- 운영 경로 변경 금지

### STEP 4 — Group Workspace Placement

새 그룹 작업공간에서는 독립 clone/worktree 등 안전한 방법을 사용한다.

기존 실행 위치는 전환 전까지 정본으로 유지한다.

### STEP 5 — Baseline Verification

가능한 범위에서:

- install
- lint
- test
- build
- runtime smoke
- 주요 화면/기능

실데이터가 필요하면 검사 생략 또는 fixture 사용. SKIP을 PASS로 쓰지 않는다.

### STEP 6 — Capsule & SSOT Map

Project Capsule 작성/보완.

정본 포인터:

- source
- data
- deployment
- documentation
- business rules

### STEP 7 — Common Candidate Scan

기존 공통 기능과 비교.

당장 공통화하지 않고 후보만 등록 가능.

### STEP 8 — Real Work Pilot

실제 사용자 비운영 요청 한 건을 새 구조에서 수행.

### STEP 9 — Compare

이전 위치 vs 그룹 위치:

- revision
- build/test 결과
- runtime behavior
- 데이터/설정 차이

### STEP 10 — Transition Decision

운영 전환 필요 시 별도 승인.

기존 위치 삭제는 마지막 단계이며 자동으로 하지 않는다.

---

## 11. 구현 단계 — Claude는 이 순서로 진행한다

### PHASE G0 — 현황 고정

목적: 현재 상태를 모른 채 구조를 만들지 않는다.

해야 할 일:

1. 최신 AI Core main 확인
2. 로컬 AI Core 위치 확인
3. 기존 group workspace 존재 여부 확인
4. 기존 registry/control tower assets 확인
5. 접근 가능한 프로젝트 inventory 작성
6. 현재 활성 작업/dirty repo 식별

산출물:

- `docs/handoffs/GROUP-G0-RESULT.md`
- registry 초안 또는 기존 registry 분석

완료 조건:

- “있는 것”과 “만들어야 할 것” 구분
- 아직 어떤 저장소도 대규모 이동하지 않음

### PHASE G1 — 본사 최소 골격

목적: 프로젝트를 찾고 작업을 배정할 최소 본사 기능.

구현:

- project registry
- capsule validation
- work ledger 재사용/정리
- common handoff/proof format
- headquarters/subsidiaries workspace skeleton

하지 않는 것:

- full UI control room
- 자동 배포
- 대규모 capability extraction

완료 조건:

- registry에 실제 프로젝트 최소 1개 등록
- validation 실행
- stale/unknown 상태를 구분

### PHASE G2 — 첫 자회사 파일럿

선정 기준:

- 현역
- 운영 배포를 바꾸지 않아도 됨
- build/test 가능
- 비밀정보 의존이 상대적으로 낮음
- 최근 사용자 요청이 있어 실제 작업 흐름을 검증 가능

실행:

- 원형 보존 편입
- capsule
- baseline test
- 실제 비운영 작업 한 건
- proof bundle

완료 조건:

- 같은 source revision에서 전후 결과 확인
- 기존 운영 위치 무손상

### PHASE G3 — DevCenter 정리

첫 파일럿에서 실제 필요했던 것만 공통화한다.

우선순위:

1. Project Capsule schema
2. checkpoint/test runner
3. Proof Bundle
4. reuse catalog
5. UI/문서/데이터 contract minimum standards

새 거대한 프레임워크를 먼저 만들지 않는다.

### PHASE G4 — AIOps 분류

목적: 범용 인프라와 운영 업무를 분리.

산출물:

```text
AIOPS_CAPABILITY_MAP.md
- KEEP_DOMAIN
- SHARED_CANDIDATE
- REUSE_WITH_ADAPTER
- RETIRE_CANDIDATE
- UNKNOWN
```

공통 후보는 실제 검증 후에만 이동/추출한다.

### PHASE G5 — 자회사 순차 편입

한 프로젝트씩 G2 패턴 반복.

병렬로 하더라도 각 repo는 독립 branch/worktree/owner 사용.

### PHASE G6 — Natural Language Routing

AI Core에서 자연어 요청을 실제 프로젝트로 라우팅.

최소 기능:

- 프로젝트 탐색
- capsule load
- current work lookup
- work packet 생성
- executor handoff
- proof return

처음에는 CLI/문서 기반이어도 된다. UI를 먼저 만들지 않는다.

### PHASE G7 — New Project Factory

검증된 최소 표준으로 새 프로젝트 bootstrap.

생성:

- PROJECT.md
- AGENTS.md
- project.json
- docs 기본 구조
- contracts/brand/tests 골격
- 검증 workflow

프로젝트 유형별 선택 가능해야 한다.

### PHASE G8 — 운영 고도화

실제 병목이 확인된 것만 추가:

- Control Room UI
- Capability Graph
- on-demand Codebase Twin
- preview automation
- multi-agent portfolio
- release observation
- Failure Memory automation

측정 없이 “좋아 보이는 기능”을 추가하지 않는다.

---

## 12. 현재 알려진 프로젝트별 방향

### AI Core

- 본사 역할 유지
- registry/routing/handoff/evidence 중심
- 프로젝트 코드를 흡수하지 않음

### DevCenter

- 본사 개발센터로 정리
- 기존 자산 먼저 inventory
- 공통 자산의 실제 사용처를 확인

### AIOps

분해 대상이 아니라 **분류 대상**.

- 범용 connector/adapter → shared candidate
- 과태료/자금/보험/회사 운영 로직 → domain 유지
- 기존 승인/lease/control plane → 보호 구조로 존중

### ERP

- ERP4 = 플랫폼 이름
- Firebase ERP5 = 데이터 SSOT 후보, 반드시 원천 대조
- ERP3 = 신규 기준으로 쓰지 않음
- 통합 프로젝트가 데이터 마이그레이션을 자동 수행하지 않음

### jpkerp5

- 사용자 결정: RETIRE 대상
- 신규 통합 원천으로 사용 금지
- 실제 archive/delete 완료 여부는 별도 확인

### 기타 영업/정산/홈페이지/법무/콘텐츠

- 각각 독립 자회사
- 실제 repo 이름·배포·데이터를 inventory에서 확인
- 공통 디자인으로 획일화 금지

---

## 13. 작업 충돌 방지 규칙

- 한 branch = 한 writer
- 동일 파일/리소스 동시작업 감지 시 HOLD
- 다른 writer의 dirty/staged 변경 제거 금지
- force push 금지
- 자동 rebase/merge 금지
- 작업자가 바뀌면 source revision 재확인
- 오래된 Work Packet은 revision/requirements가 바뀌면 stale

비상 징후가 있으면 `EMERGENCY_RUNBOOK.md` 우선.

---

## 14. 보안·권한 경계

그룹 통합이라고 해서 다음 권한이 새로 생기지 않는다.

- 운영 DB 쓰기
- Google Sheet/Drive 라이브 변경
- 배포
- 도메인 변경
- GitHub repo 삭제/archive
- 비밀키 변경
- 사용자/직원 권한 변경
- 고객 발송
- 결제/금융 처리

공통 repository에는 다음을 저장하지 않는다.

- 토큰/키
- 고객/직원 개인정보 원문
- 금융 원본
- 계약서 민감 원본
- DB export
- production `.env`

---

## 15. Claude 작업 방식 — 반드시 지킬 실행 규칙

1. **먼저 읽고 찾는다.** 새로 만들기 전에 기존 구현을 검색한다.
2. **기획안을 재설계하지 않는다.** 실제 충돌이나 기술 제약이 있을 때만 변경안을 제시한다.
3. **전체를 한 번에 뜯지 않는다.** 단계별 commit/PR로 남긴다.
4. **작은 검증 가능한 단위로 작업한다.** 각 단계가 독립 rollback 가능해야 한다.
5. **문서만 만든 것을 구현이라고 하지 않는다.** 실제 실행 검증을 분리한다.
6. **검사하지 않은 것은 UNKNOWN/SKIP으로 쓴다.** 추측 PASS 금지.
7. **main에 바로 작업하지 않는다.** 작업 branch/worktree 사용.
8. **기존 프로젝트의 dirty state를 보존한다.** 임의 cleanup 금지.
9. **실데이터·운영 변경은 별도 승인 경계를 따른다.**
10. **결과는 GitHub에 남긴다.** 대화에만 남기지 않는다.

---

## 16. 각 Phase 결과 문서 형식

권장 위치:

```text
docs/handoffs/
├─ GROUP-G0-RESULT.md
├─ GROUP-G1-RESULT.md
├─ GROUP-G2-RESULT.md
└─ ...
```

각 결과 문서:

```text
# Phase

## 기준
- base revision
- branch
- target repos

## 실제 수행
- changed files
- commands
- migrations/none

## 검증
- PASS
- FAIL
- SKIP

## 보존 확인
- dirty state
- SSOT
- deployment
- data

## 미확인/위험

## 다음 한 작업
```

---

## 17. 클로드의 첫 실행 작업 — 지금 바로 할 것

작업 ID: `GROUP-G0`

### 목적

코드를 이동하기 전에 실제 로컬/GitHub 상태를 고정하고, 이미 있는 자산과 없는 자산을 구분한다.

### 실행 지시

1. 최신 `main`을 읽는다.
2. `GROUP_OPERATING_MODEL.md`, 본 문서, `CLAUDE_GROUP_INTEGRATION_HANDOFF.md`를 순서대로 읽는다.
3. AI Core/DevCenter/AIOps 및 접근 가능한 현역 프로젝트의 실제 repo와 로컬 위치를 inventory한다.
4. 각 repo의 HEAD, remote, dirty/untracked 여부, worktree, 주요 실행 명령을 확인한다.
5. 기존 registry/control-tower/work-ledger/capsule 구현을 찾고 재사용 가능성을 표로 만든다.
6. `AI-CORE-GROUP` 기존 폴더가 있는지 확인한다. 있으면 덮어쓰지 않는다.
7. 아직 프로젝트를 이동하지 않는다.
8. `docs/handoffs/GROUP-G0-RESULT.md`에 사실/미확인/추천 파일럿 1개를 남긴다.
9. G0 결과를 commit하고 검증 결과를 반환한다.

### G0 완료 기준

- 실제로 발견한 repo 목록이 있다.
- 각 repo 상태가 revision과 함께 기록되어 있다.
- 기존 공통 자산 재사용 후보가 확인됐다.
- 첫 파일럿 후보와 선정 이유가 있다.
- 어떤 운영 변경도 수행하지 않았다.

G0가 PASS하면 다음은 `GROUP-G1` 본사 최소 골격이다. 자동으로 G1까지 밀어붙이지 말고 G0 결과를 기준으로 계속 진행할 수 있는 상태를 만든다.

---

## 18. 클로드에 전달할 최종 명령

> **이 문서는 구현 명세다. 방향을 다시 설계하지 말고 `GROUP-G0`부터 실행해. 기존 코드를 먼저 조사하고, 본사 공통은 공통화하되 각 자회사 Git·데이터 SSOT·브랜드·배포는 독립 유지해. 한꺼번에 이동하거나 통합하지 말고 단계별로 원형 보존·검증하면서 진행해. 각 Phase의 실제 수행 내용, commit SHA, 검사 PASS/FAIL/SKIP, 미확인, 다음 한 작업을 GitHub `docs/handoffs/`에 남겨. 실데이터·운영 배포·권한·삭제는 별도 승인 없이 하지 마. 문서 작성과 실제 구현/검증/배포를 서로 다른 상태로 보고해.**

---

## 19. 변경 관리

이 마스터 기획안의 구조 원칙을 바꾸는 변경은 다음을 요구한다.

- 변경하려는 기존 결정
- 변경 이유
- 실제 제약/새 증거
- 영향을 받는 프로젝트
- migration/rollback 영향
- 사용자 확인이 필요한 가치 판단 여부

단순 구현 편의를 이유로 본사/자회사 경계를 무너뜨리거나 monorepo로 합치는 변경은 허용하지 않는다.

실행 중 발견한 세부 기술사항은 이 문서를 매번 거대하게 수정하지 말고 각 Phase result, Project Capsule, 해당 프로젝트 SSOT에 남긴다. 마스터 기획안에는 그룹 공통 방향과 구현 단계만 유지한다.

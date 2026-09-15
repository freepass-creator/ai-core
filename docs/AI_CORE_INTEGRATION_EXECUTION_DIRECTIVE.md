# AI Core Integration Execution Directive — 통합 실행 최우선 지침

- 문서 버전: 1.0
- 작성일: 2026-09-16 (Asia/Seoul)
- 상태: `USER_CONFIRMED EXECUTION PRIORITY`

## 0. 최우선 목표

현재 AI Core의 최우선 목표는 연구·문서 추가가 아니라 **흩어져 있는 AI/개발/업무 자산을 실제로 합병·통합해서 최대한 빨리 실무에 적극 활용할 수 있는 상태로 만드는 것**이다.

최종 목표:

> **사용자는 AI Core 한 곳에서 자연어로 업무를 지시하고, AI Core는 여러 AI/CLI의 검토를 거쳐 조정된 실행안을 만든 뒤, 올바른 프로젝트·정본·도구·실행자에게 일을 배정하고, 결과와 다음 작업을 다시 AI Core로 돌려준다.**

## 1. AI Core의 의사결정 방식

AI Core는 단일 AI의 답을 최종값으로 사용하지 않는다.

중요 작업은 [Multi-AI Council](AI_CORE_MULTI_AI_COUNCIL.md)과 [AI Collaboration Protocol](AI_COLLABORATION_PROTOCOL.md)을 따른다.

기본 흐름:

`문제 구조화 → 정본 고정 → 가능한 여러 AI/CLI 검토 → 의견 일치/불일치 확인 → 근거 기반 조정 → CONSENSUS / ADJUSTED_CONSENSUS / HOLD → 실행`

고정 모델 구성은 두지 않는다. 현재 사용 가능한 GPT, Codex, Claude CLI, Gemini CLI 또는 기타 agent 중 실제 capability와 도구 접근이 맞는 실행자를 사용한다.

한도·속도·가용성은 동적 변수다. “항상 N개의 AI” 같은 절대값을 만들지 않는다. 중요한 작업일수록 독립 관점을 늘리고, 작은 작업은 Fast Path를 쓴다.

## 2. 통합 대상의 물리적 처리 기준

모든 폴더/저장소/프로젝트는 inventory 후 다음 중 하나로 분류한다.

- `MERGE_PHYSICAL` — 실제로 하나로 합쳐야 하는 파편/중복.
- `COLOCATE_ONLY` — 로컬 그룹 폴더 아래 같이 배치하되 Git/SSOT/배포는 독립.
- `EXTRACT_SHARED` — 프로젝트는 분리하고 공통 기능만 본사/DevCenter/shared-services로 추출.
- `KEEP_SEPARATE` — 별도 프로젝트로 계속 관리.
- `RETIRE` — 사용자 결정과 실제 상태를 확인한 뒤 신규 작업 원천에서 제외.

분류는 이름이나 폴더 모양으로 하지 않는다. 아래를 실제로 확인한다.

- 현재 Git repository / remote / branch / HEAD
- 로컬 미커밋·미추적 파일
- 실행/빌드/테스트 방식
- 배포 대상과 alias/domain
- 데이터 SSOT와 DB
- 환경변수/인증/스케줄러 의존성
- 프로젝트 브랜드/업무 의미
- 다른 폴더와의 실제 코드 중복
- 롤백 가능성

## 3. 물리 통합 원칙

### 합칠 것은 실제로 합친다

같은 생명주기, 같은 목적, 같은 정본을 여러 폴더에서 중복 유지하고 있다면 장기적으로 하나의 관리 위치로 정리한다.

단, 바로 삭제하지 않는다.

`원형 보존 → 새 위치 구성 → 동일 revision/기능 검증 → 경로 의존성 확인 → 전환 → 일정 기간 관측 → 기존 위치 read-only/retire 판단`

### 별도 프로젝트가 맞으면 억지로 합치지 않는다

ERP, 영업 앱, 홈페이지, 법무, 콘텐츠 등 고유 도메인·데이터·브랜드·배포를 가진 프로젝트는 독립 저장소를 유지한다.

로컬에서는 `AI-CORE-GROUP/subsidiaries/` 아래 함께 관리할 수 있지만 Git history와 project authority를 합치지 않는다.

### 공통 기능은 복사하지 말고 추출한다

여러 프로젝트에서 실제 반복되는 기능은 DevCenter/shared-services 후보로 만들고, version/revision을 고정해 채택한다.

업무 의미는 프로젝트/도메인에 남기고 connector/adapter/검증 등 재사용 가능한 기반만 공통화한다.

## 4. 목표 작업공간

```text
AI-CORE-GROUP/
├─ headquarters/
│  ├─ ai-core/
│  ├─ devcenter/
│  └─ <검증 후 필요한 공통 조직/서비스>
└─ subsidiaries/
   ├─ <independent-project-1>/
   ├─ <independent-project-2>/
   └─ ...
```

이 폴더는 실제 로컬 실행 작업공간이다. 전체를 하나의 monorepo로 만들라는 뜻이 아니다.

## 5. 구현 순서 — 속도를 우선하되 증거를 버리지 않는다

### STEP 0 — Council Inventory

- GitHub + 로컬 관련 자산 inventory
- 실제 역할/SSOT/배포/데이터 경계 확인
- 각 자산을 `MERGE_PHYSICAL / COLOCATE_ONLY / EXTRACT_SHARED / KEEP_SEPARATE / RETIRE`로 초안 분류
- 2개 이상 AI/CLI 관점 검토가 가능한 경우 Council 수행
- 충돌/UNKNOWN 명시

### STEP 1 — 그룹 작업공간 구성

- `AI-CORE-GROUP/headquarters`
- `AI-CORE-GROUP/subsidiaries`
- 기존 정상 프로젝트를 안전하게 co-locate
- Git history와 운영 위치 보존

### STEP 2 — AI Core 본사 기능 연결

- Project Registry
- Work Router
- Current Work Ledger
- Handoff
- Proof Bundle
- Multi-AI Council 기록
- Evolution Bridge

기존 구현/브랜치/DevCenter 자산을 먼저 재사용한다.

### STEP 3 — 실제 업무 하나 end-to-end

가짜 demo 대신 실제 비운영 또는 낮은 위험 업무 하나를 선정한다.

`대표 오더 → Council/검토 → 정본 resolve → 실행 → 검증 → 결과 복귀 → 다음 작업`

이 흐름이 성공해야 AI Core가 실제 업무에 쓰인다고 본다.

### STEP 4 — 물리 합병 확대

STEP 0에서 `MERGE_PHYSICAL`로 합의된 대상부터 하나씩 실제 통합한다.

동시에 `EXTRACT_SHARED` 후보는 공통 서비스로 추출하고, 독립 프로젝트는 위치/규격만 정리한다.

### STEP 5 — 반복 운영 확대

- Today View
- 반복 업무
- 이상 감지
- 후속 추적
- 업무별 자동화

실제 검증된 업무부터 확장한다.

## 6. 지금 당장 Claude/Codex가 해야 할 작업

작업 ID: `AI-CORE-MERGE-P0`

1. 최신 `main`의 다음 문서를 읽는다.
   - `WORK_READ_FIRST.md`
   - `docs/AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md`
   - `docs/AI_CORE_MULTI_AI_COUNCIL.md`
   - `docs/AI_COLLABORATION_PROTOCOL.md`
   - `docs/GROUP_OPERATING_MODEL.md`
   - `docs/AI_CORE_GROUP_MASTER_PLAN.md`
   - `docs/AI_CORE_OPERATING_PLAYBOOK.md`
2. GitHub와 사용자 로컬 환경의 관련 프로젝트/폴더를 inventory한다.
3. 기존 Control Tower / registry / work ledger / DevCenter / AIOps 자산을 재사용 가능한지 확인한다.
4. 폴더·저장소별 실제 상태표를 만든다.
5. 각 항목에 물리 통합 분류를 제안한다.
6. 가능한 다른 AI/CLI에게 동일 표와 핵심 질문을 주고 독립 검토를 받는다.
7. `CONSENSUS / ADJUSTED_CONSENSUS / HOLD`로 조정한다.
8. 우선 통합할 1~3개 대상을 제시한다.
9. 기존 데이터/배포를 건드리지 않는 첫 물리 통합 실행안을 만든다.
10. 결과를 `docs/handoffs/AI-CORE-MERGE-P0-RESULT.md`에 남긴다.

## 7. P0 결과표 필수 형식

| asset | current_path | repo | role | data_ssot | deploy | dirty_state | classification | reviewer_consensus | first_action | risk |
|---|---|---|---|---|---|---|---|---|---|---|

추가로 남길 것:

- 확인하지 못한 로컬 폴더
- 원격에는 없지만 로컬에만 있는 작업
- 중복 코드/중복 문서 후보
- 공통 기능 후보
- 실제 삭제/retire가 아직 안 된 대상
- 운영 경로 변경 시 필요한 승인

## 8. 완료 기준

AI Core 통합을 “됐다”고 말하려면 최소 다음이 실제로 확인돼야 한다.

- 관련 자산이 inventory돼 있다.
- 물리 합병/공존/공통추출/독립유지 기준이 정리돼 있다.
- 여러 AI/CLI의 검토가 합의 또는 조정안으로 남아 있다.
- 로컬 그룹 작업공간에서 프로젝트를 찾고 실행할 수 있다.
- 대표 자연어 오더 하나가 end-to-end로 실제 처리된다.
- 결과가 AI Core Work Ledger/Handoff로 돌아온다.
- 다음 AI 세션이 이전 대화를 다시 듣지 않고 이어서 작업한다.
- 통합 과정에서 운영 데이터/브랜드/배포 정본을 잃지 않는다.

이 목표에 직접 기여하지 않는 추가 프레임워크·문서·버전 증가는 우선순위를 낮춘다.

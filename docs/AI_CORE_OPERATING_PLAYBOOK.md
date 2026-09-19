# AI Core Operating Playbook — 실제 업무 활용 설계

- 문서 버전: 1.0
- 작성일: 2026-09-16 (Asia/Seoul)
- 상태: `USER-DIRECTED OPERATING BLUEPRINT`
- 구조 정본: [GROUP_OPERATING_MODEL.md](GROUP_OPERATING_MODEL.md)
- 구현 정본: [AI_CORE_GROUP_MASTER_PLAN.md](AI_CORE_GROUP_MASTER_PLAN.md)
- 고도화 연결: [AI_CORE_EVOLUTION_BRIDGE.md](AI_CORE_EVOLUTION_BRIDGE.md)

## 0. 목적

AI Core 통합의 목표는 저장소와 폴더를 정리하는 것이 아니다.

최종 목표는 사용자가 한 곳에서 자연어로 실제 업무를 지시하면 AI Core가 필요한 회사·프로젝트·정본·실행자·도구를 찾아 실행을 조정하고, 검증된 결과와 다음 일을 다시 한 곳으로 돌려주는 것이다.

핵심 루프:

`대표 오더 → 의도/업무 분류 → 정본 확인 → 실행 계획 → 적합한 실행자/도구 → 승인 필요한 경계 → 실행 → 검증 → 결과 복귀 → 후속/학습`

사용자는 저장소명, 시트명, 실행 AI, 빌드 명령, 자료 위치를 매번 기억하지 않아도 되는 것이 목표다.

## 1. 사용자가 보는 AI Core

AI Core의 사용자 경험은 복잡한 조직도를 그대로 노출하지 않는다. 대표가 보는 기본 단위는 다음 다섯 가지다.

1. **오늘 해야 할 일** — 기한·의존성·우선순위가 있는 실제 업무.
2. **진행 중** — 어느 시스템/프로젝트에서 누가 무엇을 하는지.
3. **대표 결정 필요** — AI가 대신 확정하면 안 되는 선택.
4. **이상/위험** — 미수, 오류, 충돌, stale evidence, 승인 만료 등.
5. **완료/후속** — 실제 결과가 확인된 것과 다음 한 작업.

기본 질문 예시:

- “오늘 내가 볼 거 뭐 있어?”
- “돈 관련해서 이상한 거 봐줘.”
- “과태료 처리해.”
- “ERP 상품 상세 고쳐.”
- “그 사업 기획 이어서 해.”
- “어제 시킨 거 어디까지 됐지?”

이 질문을 받았을 때 AI Core는 사용자가 다시 배경을 설명하게 만들기 전에 현재 memory, project registry, task ledger와 대상 정본을 조회한다.

## 2. 회사 전체 업무지도

업무지도는 저장소 목록이 아니라 **업무 의미 → 정본 → 실행 경로**의 색인이다. 실제 저장소/자료 이름은 registry에서 확인한다.

### 2.1 사업/상품

- 사업 기획
- 상품 기획/가격/보증금/조건
- 제휴·공급사
- 신규 프로젝트 설립
- 사업 성과/리뷰

기본 경로: `AI Core Planning → 관련 사업 Project/문서 SSOT → 필요 분석/결정 → 결과/후속`

### 2.2 영업

- 유입 DB
- 콜/접촉 이력
- 관심/비관심
- 견적/상품 공유
- 접수
- 계약 전환

기본 경로: `Sales Project → 고객/영업 데이터 정본 → 상태머신 → 후속 업무`

### 2.3 렌터카/차량 운영

- 상품/차량
- 계약
- 출고/인도
- 보험
- 차량 관리
- 과태료
- 반납/매각 등 운영 상태

기본 경로: `운영 도메인/AIOps + 해당 ERP SSOT`. 업무 의미는 운영 도메인에 두고, API/Drive/Sheet/Firebase 같은 연결 기능은 공통 서비스 후보로 분리한다.

### 2.4 자금/정산

- 자금일보
- 입금/출금
- 수납
- 미수
- 정산
- 세금계산서/청구 상태

기본 경로: `AIOps/자금·정산 정본 → 대조 → 이상/할 일 → 필요한 승인 → 실제 반영 → 재조회`.

“숫자를 새로 만들어 보고”하지 않고 실제 정본 필드와 원천을 우선한다.

### 2.5 개발/제품

- ERP
- 영업 앱
- 홈페이지
- 내부 도구
- 데이터/SSOT
- 공통 개발 자산

기본 경로: `AI Core → Project Resolve → DevCenter capability reuse → branch/worktree → build/test/preview → Proof Bundle → 필요 시 release`.

배포/릴리스 공통 판정은 `docs/shared-services/SHARED_RELEASE_GATE.md`를 따른다. `merge`·`deployment READY`·`production observation`을 같은 완료 상태로 합치지 않는다.

### 2.6 문서/커뮤니케이션

- 보고서/제안서
- 계약/양식
- 메일/메시지
- 회의 내용 정리
- 인수인계

기본 경로: `관련 원천 → 문서/커뮤니케이션 규격 → 초안 → 검토 → 필요한 경우 외부 전송 승인 → 전송/보관 결과`.

## 3. 업무 라우터

모든 자연어 요청은 내부적으로 최소 다음 구조로 변환한다.

```yaml
work_id: WORK-<domain>-<number>
user_intent: <사용자가 실제로 원하는 결과>
domain: <business/sales/operations/finance/development/document/...>
target_project: <registry project_id 또는 UNKNOWN>
authoritative_sources:
  - pointer: <repo/file/system>
    revision: <revision 또는 current observation>
required_capabilities: []
executor_route: <capability-based route>
approval_boundary: <NONE/REQUIRED + 대상>
acceptance_criteria: []
next_check: <실행 후 확인할 실제 결과>
```

AI가 추론한 의도는 `AI_INFERRED`로 두며 사용자의 명시 지시를 덮지 않는다. 답에 따라 구현/업무 결과가 달라지는 결정만 사용자에게 묻는다.

## 4. 실행자 선택

사용자가 Claude/Codex/ChatGPT/Gemini 등을 매번 선택하지 않게 한다. AI Core는 **이름이 아니라 capability**로 라우팅한다.

- 구조/대형 코드베이스 분석·구현 → repository-wide executor.
- 작은 문서/판단/기획·검토 → direct/chat executor.
- 독립 검토 → subject revision에 결속 가능한 별도 reviewer.
- 외부 시스템 읽기/쓰기 → 해당 connector/adapter와 권한 경계.
- 반복 운영 절차 → 해당 AIOps SOP/업무 엔진.

연결 가능 상태와 실제 이번 작업을 수행했다는 증거를 구분한다.

## 5. 실제 업무 상태 모델

사용자의 “됐어?”에 정확히 답하려면 상태를 한 단어 `DONE`으로 합치지 않는다.

권장 상태:

- `REQUESTED` — 사용자가 요청함.
- `RESOLVED` — 대상 프로젝트/정본/업무가 식별됨.
- `PLANNED` — 완료조건과 실행경로가 준비됨.
- `BLOCKED` — 결정/권한/원천/의존성 때문에 보류.
- `IN_PROGRESS` — 실제 작업 진행.
- `ARTIFACT_READY` — 코드/문서/변경안이 만들어짐.
- `VERIFIED` — 선언 범위의 검증 통과.
- `APPROVAL_PENDING` — 실제 외부 변경 전 승인 필요.
- `EXECUTED` — 외부/운영 실행 확인.
- `OUTCOME_OBSERVED` — 현실의 결과 확인.
- `CLOSED` — 완료조건 충족과 후속 처리 완료.

문서 생성이나 코드 commit만으로 `CLOSED`로 올리지 않는다.

## 6. AI Core Today — 대표용 관제

최종적으로 AI Core는 다음 정보를 한 번에 구성할 수 있어야 한다.

```text
[대표 결정 필요]
- 사업/가격/정책 등 사람의 판단이 필요한 항목

[오늘]
- 기한이 오늘이거나 지연된 업무
- 운영상 반드시 확인해야 할 반복 업무

[이상]
- 미수/입금 불일치/데이터 이상
- 배포 실패/회귀
- 승인 만료/정본 drift
- 여러 AI 작업 충돌

[진행 중]
- work_id / 프로젝트 / 현재 단계 / blocker / 다음 검사

[완료]
- 실제 결과까지 확인된 항목
- 후속 업무가 있으면 함께 표시
```

이 화면/응답의 숫자와 상태는 AI가 새로 계산한 추정치가 아니라 각 정본과 revision-bound observation에서 구성한다.

## 7. 대표 오더 예시와 내부 흐름

### “오늘 처리할 돈 관련 일 봐줘”

`finance domain → 관련 법인/자금 정본 resolve → 자금일보/입금/수납/미수 source 조회 → 불일치/기한/예외 추출 → 대표 결정 필요와 자동 처리 가능 항목 분리 → 후속`

### “과태료 처리해”

`operations domain → 과태료 SOP 확인 → 고지서/차량/계약 대조 → 같은 관청 묶음 등 현재 승인된 규칙 적용 → dry-run/검증 → 외부 변경 경계 확인 → 실행 → 결과 재조회`

### “ERP 상품 상세 고쳐”

`development → ERP project resolve → 현재 SSOT/요구사항 확인 → 기존 UI/component/capability 검색 → Change Packet → 구현 → web/mobile 검증 → preview/evidence → release 여부`

### “김 이사님한테 보낼 자료 준비해”

`document/business → 관련 회의/메일/사업 원천 resolve → 확정 사실/사용자 이해/미확인 분리 → 문서 생성 → 사용자 검토 → 발송 요청이면 수신자/최종본 확인 → 전송 결과`

## 8. 업무 결과가 다시 AI Core로 돌아오는 규칙

모든 중요한 작업은 최소 다음을 반환한다.

```yaml
work_id: ...
project_id: ...
subject_revision: ...
status: ...
artifact_refs: []
checks:
  passed: []
  failed: []
  skipped: []
execution:
  performed: true|false
  reference: ...
outcome:
  observed: true|false
  summary: ...
blockers: []
next_action: ...
learning_feedback: ...
```

이 반환이 있어야 다른 세션에서 “어디까지 됐지?”에 이어갈 수 있다.

## 9. 정본과 기억의 경계

- AI Core memory: 압축 기억, 진행 포인터, 공통 교훈.
- Project repository: 프로젝트 코드/의사결정/SSOT.
- AIOps: 운영 업무 의미와 절차.
- DevCenter: 개발 표준과 검증된 재사용 자산.
- 외부 시스템: 실제 최신 데이터/실행 결과.

AI Core가 편리하다는 이유로 프로젝트 데이터나 고객/직원 원문을 복제해 새 정본을 만들지 않는다.

## 10. 실제 활용을 위한 구현 우선순위

### OPS-P0 — 업무지도 + Work Router

1. 실제 주요 업무 20~30개를 inventory한다.
2. 각 업무에 `domain / source / project / capability / approval / completion`을 연결한다.
3. 대표의 자연어 20개를 routing fixture로 만든다.
4. 올바른 정본과 실행 경로를 찾는지 검증한다.

### OPS-P1 — Current Work Ledger

- 현재 요청/진행/보류/결정/완료를 한 곳에서 찾게 한다.
- 기존 task board/work ledger를 먼저 재사용한다.
- `어제 그거` 같은 참조를 work_id와 최근 맥락으로 해결한다.

### OPS-P2 — Today View

- 대표 결정 필요
- 오늘/지연 업무
- 이상
- 진행 중
- 실제 완료

읽기 전용으로 먼저 만든다. 자동 실행 버튼보다 정확한 관제가 우선이다.

### OPS-P3 — 실제 도메인 하나 end-to-end

운영 영향이 낮고 정본·검증이 명확한 업무 하나를 선택해 `오더 → 정본 → 실행 → 검증 → 결과 복귀`를 끝까지 연결한다.

가짜 demo가 아니라 실제 업무를 사용하되, 외부 변경이 필요한 단계는 기존 승인 체계를 유지한다.

### OPS-P4 — 반복 업무/후속 자동화

P3에서 검증된 업무부터 시간/이벤트 기반 follow-up, 이상 감지, 반복 보고를 붙인다. 자동화가 운영 규칙을 우회해서는 안 된다.

## 11. Evolution Bridge와 연결

실제 업무는 단순히 처리되고 끝나지 않는다.

각 Work Result에서 반복 질문, 재작업, false completion, stale evidence, 잘못된 routing, 불필요한 승인/질문을 관측해 [AI Core Evolution Bridge](AI_CORE_EVOLUTION_BRIDGE.md)로 Feedback Packet을 보낸다.

반대로 CIVILIZATION/DEVKIT/Chat 연구의 새 원칙은 Evolution Bridge를 통과해서만 이 Playbook이나 프로젝트 규칙에 채택한다.

즉 최종 순환은:

`실제 업무 → 마찰/실패 관측 → 고도화 연구 → 후보 → 작은 검증 → 제한 채택 → 실제 업무 개선 → 다시 관측`

## 12. 완료 기준

AI Core가 실제 업무에 쓰인다고 말하려면 최소 다음이 확인돼야 한다.

- 대표가 저장소/자료 위치를 말하지 않은 자연어 오더를 올바른 도메인으로 라우팅한다.
- 정본/revision을 찾아 근거와 함께 일을 시작한다.
- AI가 불필요하게 이미 제공된 정보를 다시 묻지 않는다.
- 적합한 실행자와 도구를 AI Core가 선택한다.
- 승인 필요한 실제 변경은 별도로 멈춘다.
- 작업 결과가 Work Ledger에 돌아와 다음 세션에서 이어진다.
- 완료/검증/실행/현실 결과를 구분한다.
- 실제 업무 실패와 개선 결과가 Evolution Bridge로 환류된다.

이 조건이 없으면 저장소가 한 폴더 아래 있어도 “통합 완료”가 아니다.

## 13. 첫 실행 — OPS-P0

클로드/Work는 그룹 통합 `GROUP-G0` inventory와 병렬 또는 직후에 다음을 수행한다.

1. 실제 회사 업무의 현재 SOP/프로젝트/자료 정본을 읽기 전용으로 inventory한다.
2. 우선 20~30개 대표 업무를 `work-map`으로 정리한다.
3. 자연어 오더 fixture 20개를 만든다.
4. 각 fixture가 project/source/capability/approval/completion으로 올바르게 route 되는지 검사한다.
5. 틀린 routing과 UNKNOWN을 숨기지 않는다.
6. 실제 쓰기/발송/배포 없이 결과를 보고한다.

첫 산출물 권장 위치:

- `registry/work-map.json` 또는 기존 registry 내 동등 구조.
- `docs/handoffs/OPS-P0-RESULT.md`.

이미 동등 기능이 있으면 새 파일/엔진을 만들지 말고 그것을 확장한다.

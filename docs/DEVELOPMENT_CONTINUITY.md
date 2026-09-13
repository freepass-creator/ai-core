# Development Continuity Engine v0.1

상태: RESEARCH_CANDIDATE / DESIGN

## 문제

Development Runtime과 Development Autonomy가 프로젝트 문맥, 자연어 요구, 검증 증거를 구조화해도 세션과 실행자가 바뀔 때 다음 문제가 남는다.

1. 사용자의 요구가 대화 중 수정되면 이전 plan/acceptance/proof가 조용히 오래된다.
2. Chat은 최신 의도를 알고 Work는 이전 Work Packet을 보고 있을 수 있다.
3. 같은 요구를 여러 표현으로 다시 설명하면서 requirement가 중복되거나 서로 충돌한다.
4. AI가 추정한 의도와 사용자가 직접 확정한 요구가 섞일 수 있다.
5. 여러 AI가 같은 파일/기능을 동시에 건드리면 충돌을 뒤늦게 발견한다.
6. 작업을 다시 시작할 때 이전 단계, 남은 blocker, 이미 확인한 증거를 재구성한다.

따라서 다음 단계의 병목은 coding throughput보다 **development continuity**다.

## 목표

사용자가 개발 요구를 계속 바꾸고, Chat/Work/Codex가 교대하고, repository revision이 움직여도 하나의 개발 에피소드가 의미를 잃지 않게 한다.

핵심 원칙:

> requirement, source revision, plan, proof, executor ownership을 같은 episode revision에 묶고, 하나가 바뀌면 영향을 받는 결과만 stale로 만든다.

## 1. Living Requirement Graph

요구사항을 prose 문서 한 장이 아니라 stable ID를 가진 그래프로 관리한다.

각 requirement는 최소한 다음을 가진다.

- id
- statement
- provenance: USER_CONFIRMED / AI_INFERRED / SOURCE_DERIVED
- status: ACTIVE / SUPERSEDED / REJECTED / UNKNOWN
- version
- depends_on
- acceptance criteria
- non-goals
- last_changed_at

AI 추정은 USER_CONFIRMED로 승격하지 않는다. 사용자가 새 지시로 기존 요구를 바꾸면 과거 항목을 삭제하지 않고 SUPERSEDED로 남긴다.

## 2. Requirement Set Digest

현재 ACTIVE requirement와 acceptance criteria를 정규화해 digest를 만든다.

Work Packet / Change Packet / Proof Bundle은 이 digest를 참조한다.

- requirement digest 변경 → 기존 plan/proof 영향범위 재평가
- source revision 변경 → code-dependent plan/proof stale
- 단순 표현 변경이 의미를 바꾸지 않으면 불필요한 invalidation을 피한다

## 3. Development Episode

하나의 변경을 긴 대화가 아니라 상태를 가진 episode로 본다.

권장 상태:

DISCOVERING → FRAMED → READY → IMPLEMENTING → VERIFYING → PREVIEW_READY → USER_REVIEW → RELEASE_READY → RELEASED → OBSERVING → CLOSED

보조 상태:

BLOCKED / STALE / ABORTED

상태 전이는 evidence/authority 조건을 갖고 있으며 임의 점프를 허용하지 않는다.

## 4. Minimal Plan Slice

Work에게 전체 conversation이나 전체 requirement graph를 보내지 않는다.

현재 변경에 필요한 것만 보낸다.

- episode id/revision
- active requirement IDs
- 필요한 dependency requirements
- current project/source revision
- affected capability/code nodes
- allowed/forbidden scope
- done_when
- required proof
- blockers/unknowns

Requirement Graph는 전체 기억이고 Plan Slice는 현재 실행용 최소 뷰다.

## 5. Drift Detector

다음 변화가 생기면 기존 결과의 유효성을 검사한다.

- requirement statement/acceptance/non-goal 변경
- authoritative source revision 변경
- design/data/state-machine SSOT 변경
- blocker 해소/신규 발생
- branch head 이동
- verifier policy 변경

모든 것을 무조건 폐기하지 않고 영향을 받는 requirement/check만 stale 처리하는 것이 목표다.

## 6. Multi-Agent Ownership

각 episode/step에 owner와 write scope를 둔다.

- branch
- files/directories
- logical components/capabilities
- lease/expiry when applicable

동일 branch/path의 중첩 write ownership은 실행 전에 충돌로 표시한다.

이것은 독립 검토를 막지 않는다. read/review scope와 write scope를 구분한다.

## 7. Continuity Handoff

Chat → Work:
- latest confirmed intent
- requirement digest
- minimal plan slice
- source revision
- unresolved questions

Work → Chat:
- implementation revision
- requirement coverage
- actual checks
- failures/skips
- proof refs
- newly discovered constraints

새 constraint가 requirement 의미를 바꾸면 Chat이 graph를 갱신하고 새 episode revision을 발행한다.

## 8. Development Memory의 두 층

### Project-local continuity
현재 제품의 requirement/episode/branch/proof 상태. 해당 project가 SSOT다.

### General development learning
여러 프로젝트에서 반복되는 failure condition, verification profile, routing improvement. DevCenter/AI Core 후보로 승격한다.

Project-local 요구를 공용 지식으로 복사하지 않는다.

## 9. 사용자 경험

사용자는 다음처럼 말할 수 있어야 한다.

> "아까 접수 버튼은 그대로 두고, 취소만 오른쪽에 넣자. 그리고 모바일에서는 아래 고정하지 말자."

AI는 내부적으로:

1. 기존 requirement 중 관련 항목 탐색
2. 변경된 requirement만 새 version 생성
3. 이전 plan/proof 영향범위 stale
4. 새 minimal plan slice 생성
5. Work에 현재 slice만 전달
6. 새 proof를 현재 digest에 결속

사용자는 과거 요구사항 전체를 다시 설명하지 않는다.

## 10. 성공 측정

Shadow pilot에서 기존 방식과 비교한다.

- repeated requirement explanations
- stale implementation incidents
- conflicting agent edits
- context items transferred
- rework count
- time to resume after agent/session switch
- false completion caused by old acceptance criteria
- user corrections after preview

## 11. 다음 단계

Development Autonomy P0(Project Capsule / Change Compiler / Proof Bundle)와 함께 실제 프로젝트 한 건에서 shadow pilot한다.

효과가 확인되기 전에는 거대한 Codebase Twin/전사 Control Room을 필수 인프라로 만들지 않는다.

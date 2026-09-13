# Human Stewardship — 사람의 부족한 부분을 채우는 최소 보좌 계약

상태: `candidate implementation`  
계약 revision: `2026-09-13.4`

## 목적

AI Core는 사람 대신 삶의 목적이나 우선순위를 확정하지 않는다. 사람이 놓치기 쉬운 충돌, 미래 위험, 완료 뒤의 현실 결과를 구조적으로 보여주되 사용자 선택권과 기존 권한을 보존한다.

Human Stewardship 연구의 아홉 관점을 하나의 점수나 거대한 새 OS로 만들지 않는다. 현재 Work Packet에는 실제 결정에 필요한 세 조각만 넣는다.

## 1. Portfolio Contract

AIOPS가 commitment의 정본 소유자다. Core는 Task가 `related_commitment_ids`로 지정한 현재 결정 관련 항목만 읽는다.

- snapshot은 revision과 observed time을 가져야 한다.
- commitment는 비식별 summary, 상태, 기한, dependency, 명시적 resource claim, 사용자 확정 priority, versioned source pointer만 허용한다. `dependencies`, `resource_claims`, `priority` 누락을 빈 값이나 UNKNOWN으로 보정하지 않고 snapshot 전체를 거부한다.
- 관련 없는 일정·인생 기록·대화는 Work Packet에 포함하지 않는다.
- 단순한 활성 작업 개수로 capacity를 추정하지 않는다.
- 관련 ID의 상태만으로 실제 경쟁을 확정하지 않는다. `BLOCKED`는 인증 전 advisory 후보이며, resource 이름의 단순 중복은 충돌이 아니다.
- 결과는 순서 조정 또는 사용자와의 재우선순위 검토 제안일 뿐이다.
- Core는 commitment 취소·priority 변경을 승인하지 않는다.

현재 caller가 제공한 snapshot의 신원을 인증하지 못하므로 분석 결과는 `STRUCTURALLY_ANALYZED_UNAUTHENTICATED`다. 24시간보다 오래된 snapshot은 `STALE_UNAUTHENTICATED`로 재조회만 제안한다. 관련 ID가 있지만 snapshot이 없으면 `NOT_EVALUATED`다. 이 두 상태는 결과적 순서·자원 결정 전에 trusted AIOPS 재확인을 요구하지만, 독립적인 로컬 준비까지 막지는 않는다.

Task의 `portfolio_effect`는 `none | create_commitment | change_commitment | change_deadline | change_priority | change_allocation | unknown` 중 하나다.

- `none`이고 관련 ID가 없으면 `NOT_REQUIRED`다.
- `unknown`인 결과적 업무는 `NOT_ASSESSED_ADVISORY`로 관계 확인을 권하지만 자동 충돌이나 실행 차단을 만들지 않는다.
- 명시적 portfolio effect가 있는데 관련 ID가 없으면 `NOT_DECLARED`이며 scoped AIOPS discovery가 필요하다.
- 파일명이나 자유문장 keyword로 commitment 영향을 추정하지 않는다.

현재 버전은 사용자가 미리 선언하지 않은 commitment 충돌을 발견했다고 주장하지 않으며 trusted portfolio adapter도 아직 없다.

## 2. Foresight Contract

로컬·가역 작업은 `LIGHT`, 외부효과·C/D 위험·비가역 행동은 `DEEP` 검토를 적용한다.

최대 세 개의 중요 위험만 남기되 법률 권한·기한과 비가역 손실을 일반 위험보다 먼저 보존한다. 각각 다음을 포함한다.

- if → then 조건부 시나리오
- 근거와 `UNKNOWN_UNTIL_OBSERVED` 불확실성
- 조기 경보
- 예방 조치
- rollback 또는 containment
- 중단 조건

예측은 `CONDITIONAL_SCENARIO_NOT_FACT`이며 사실·기억·자동 행동으로 승격하지 않는다. `DEEP`도 `CONDITIONAL_ONLY_NOT_EXECUTION_CLEARANCE`이지 검토 완료가 아니다. 결과적 행동에는 최소 한 개의 명시적 조건부 검토 의무를 남긴다. caller가 쓴 recovery 문장은 증거가 아니므로 비가역 행동은 trusted action-bound recovery 영수증이 구현되기 전까지 `FORESIGHT_RECOVERY_PATH_REQUIRED`로 실행만 HOLD한다. 복구 증거를 만드는 독립 가역 준비는 계속할 수 있다.

## 3. Follow-through Contract

산출물 작성과 현실 성과를 분리한다.

- 로컬 초안·정보 설명은 기본적으로 후속 추적을 만들지 않는다.
- 외부효과·결과적 행동 또는 명시적 `outcome_observation`이 있으면 관찰 계획 하나만 만든다. `desired_outcome` 문장만으로 monitoring을 만들지 않는다.
- `outcome_observation`은 관찰할 event/metric과 필요한 evidence를 명시한다.
- 관찰 항목은 goal, desired outcome, 완료조건, 제약, scope, domain/risk, 외부효과, portfolio effect, action digest를 포함한 task-context digest와 적용 가능한 base subject revision에 묶인다.
- 외부효과만 있고 실제 결과적 action이 아직 없으면 로컬 초안에 잘못 결속하지 않고 `DEFERRED_UNTIL_CONSEQUENTIAL_ACTION_BOUND`로 관찰을 비워 둔다.
- automation이 실제 연결되지 않았으므로 `tracking_active=false`, `automation_binding=NOT_IMPLEMENTED`다.
- 실행 전에는 `PLANNED_UNBOUND / NOT_STARTED`다. 증거는 task context에 묶이고 프로젝트가 있을 때 subject revision에도 묶여야 한다. trusted 실행 영수증 뒤 `OUTCOME_PENDING`으로 전환하는 adapter는 아직 구현되지 않았으며, 성공이나 완료로 바꾸지 않는다.

## Support Quality Vector

Direction, Reality, Foresight, Choice, Commitment, Resource, Agency, Resilience, Growth를 하나의 점수로 합치지 않는다. 관찰 증거가 없는 v0.6에서는 각 축을 `UNKNOWN`으로 유지하고 `composite_support_score=null`로 둔다.

## 질문 부담

기존 Human Orchestration은 한 호출에서 가치가 가장 높은 질문 하나만 보여준다. 결정 에피소드 전체에서 같은 질문을 반복하지 않는 기능은 영속 state가 필요한 다음 과제다. v0.6은 이 기능을 구현했다고 주장하지 않는다.

사람에게 질문해야 할 기준은 다음 세 조건을 함께 만족하는 경우다.

1. 인간의 가치판단이다.
2. 답이 결과적 행동을 바꾼다.
3. 정본 조사로 해결할 수 없다.

나머지는 Core가 조사하거나, 가역적 가정을 표시한 준비로 제한하거나, 뒤로 미룬다.

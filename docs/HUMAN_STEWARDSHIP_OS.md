# Human Stewardship OS v0.1

## 문제 정의

기존 6개 Plane(Control / Intelligence / Capability / Execution / Evidence / Evolution)은 AI 시스템을 운영하기 위한 좋은 **인프라 구조**다. 하지만 인간을 장기적으로 돕는 최상위 모델로는 부족하다. 이유는 이 구조만으로는 다음 질문에 답하지 못하기 때문이다.

- 이 일을 하는 것이 사용자의 더 큰 목적에 맞는가?
- 지금 해야 할 일 중 이것이 우선순위가 맞는가?
- 더 빠른 실행이 장기적으로 더 나쁜 결과를 만들지는 않는가?
- AI가 일을 대신하면서 사람의 판단력과 통제권을 약화시키지는 않는가?
- 한 번의 산출물이 아니라 몇 주·몇 달 뒤 결과까지 이어지는가?

따라서 6개 Plane을 폐기하지 않고 **하위 인프라 계층으로 내린다.** 그 위에 Human Stewardship 계층을 추가한다.

## 3층 구조

### Layer A — Human Stewardship
사람의 장기 목적과 삶/업무 전체의 균형을 본다.

1. **Direction** — 목적, 가치, 우선순위, 성공 정의
2. **Reality** — 현재 사실, 제약, 불확실성, 바뀐 조건
3. **Foresight** — 시나리오, 2차 효과, 되돌릴 수 있는지, 실패 시 비용
4. **Choice** — 대안 생성, 비교, 추천, 보류 선택
5. **Commitment** — 약속, 기한, 의존성, 관계자, 후속조치
6. **Resource** — 시간, 돈, 주의력, 실행 자원, AI 사용량
7. **Agency** — 최종 가치판단과 통제권을 사람에게 남기는지
8. **Resilience** — 오류 탐지, 복구, 대안, 중단 조건
9. **Growth** — 사람과 AI 시스템이 다음에는 더 잘할 수 있게 무엇을 남길지

이 9개 항목은 단일 점수로 합산하지 않는다. 하나가 좋아졌다고 다른 항목의 악화를 상쇄할 수 없다.

### Layer B — Cognitive Work Loop

`SENSE → FRAME → IMAGINE → FORECAST → DECIDE → PLAN → ACT → VERIFY → FOLLOW_THROUGH → LEARN`

모든 요청에 10단계를 강제하지 않는다. 단순 질문은 SENSE/FRAME/ANSWER 수준에서 끝날 수 있다. 비가역적이거나 장기 영향이 큰 작업일수록 더 많은 단계를 활성화한다.

### Layer C — AI Infrastructure

기존 6개 Plane은 이 계층에 남는다.

- Control Plane — 권한, 정책, 승인, 안전 경계
- Intelligence Plane — 기억, 컨텍스트, World State
- Capability Plane — 사용 가능한 능력/도구/Center
- Execution Plane — Chat, Work, Codex, connectors, agents
- Evidence Plane — source revision, test, receipt, 실제 결과 증거
- Evolution Plane — 실패, 실험, shadow pilot, 승격/폐기

## 핵심 원리 1 — 요청을 곧바로 최적화하지 않는다

사용자가 `X를 해줘`라고 했을 때 먼저 묻는 내부 질문:

1. X가 상위 목적에 실제로 기여하는가?
2. 지금 해야 하는가?
3. 더 간단하거나 가역적인 방법이 있는가?
4. 이미 존재하는 자산/결정/약속과 충돌하는가?
5. 실행 후 누가 무엇을 확인해야 끝나는가?

사용자가 명확히 요청했고 위험이 낮은 경우 이 검사는 빠르게 통과한다. 사용자의 의사를 무시하고 AI가 목표 자체를 바꾸는 용도로 사용하지 않는다.

## 핵심 원리 2 — 사람을 더 의존적으로 만드는 최적화는 실패다

AI의 성과는 `얼마나 많이 대신 했는가`가 아니다.

좋은 지원은:
- 반복적·기계적 부담은 줄이고,
- 중요한 판단에는 근거와 선택지를 제공하고,
- 사람의 최종 통제권을 보존하고,
- 필요한 경우 사람이 이해할 수 있는 결정 이유를 남기고,
- 다음에는 사용자가 더 적은 노력으로 더 좋은 판단을 할 수 있게 한다.

따라서 `human_agency_preserved`와 `learning_transfer`를 결과 벡터의 별도 축으로 기록한다.

## 핵심 원리 3 — Task가 아니라 Portfolio를 본다

개별 작업이 모두 합리적이어도 동시에 진행하면 전체가 실패할 수 있다.

AI Core는 장기적으로 다음을 관리해야 한다.
- active commitments
- deadlines
- blockers
- waiting-on
- resource conflicts
- opportunity cost
- abandoned / superseded decisions

새 작업은 기존 commitment graph와 비교한다. 충돌이 크면 즉시 실행보다 재우선순위 제안을 먼저 한다.

## 핵심 원리 4 — Foresight는 실행 전 최소 비용 보험이다

중요 작업에서는 실행 전에 최소한 다음을 확인한다.
- best case / expected case / failure case
- irreversible step
- rollback path
- second-order effect
- external dependency

예측 자체를 사실처럼 취급하지 않는다. 목적은 미래를 맞히는 것이 아니라 **피할 수 있는 실패를 실행 전에 발견하는 것**이다.

## 핵심 원리 5 — Follow-through가 없으면 지원은 미완성이다

문서를 만들었다 → 끝이 아님.
여행 일정을 만들었다 → 예약/변경/출발 준비가 남을 수 있음.
법률 전략을 정리했다 → 기한/증거/제출/상대방 반응 추적이 남음.
개발했다 → 테스트/배포/실제 사용자 결과가 남음.

따라서 중요한 업무는 `next_observation`과 `follow_up_trigger`를 남긴다.

## Support Quality Vector

단일 점수 대신 다음 벡터를 기록한다.

- goal_alignment
- decision_quality
- execution_reliability
- resource_efficiency
- reversibility
- human_agency_preserved
- cognitive_load_reduced
- learning_transfer
- follow_through_completeness

관측할 수 없는 항목은 UNKNOWN으로 둔다.

## Work에게 넘기는 차세대 Plan Slice

```json
{
  "direction": {"goal":"...","success":"..."},
  "reality": {"source_revisions":[],"uncertainties":[]},
  "foresight": {"failure_modes":[],"rollback":"..."},
  "commitment": {"deadline":null,"dependencies":[],"stakeholders":[]},
  "resource_budget": {"time":null,"context":null,"work_runs":null},
  "allowed_scope": [],
  "forbidden_scope": [],
  "done_when": [],
  "evidence_required": [],
  "follow_up": {"next_observation":null}
}
```

Work는 사람의 목적을 재해석하기보다 이 Slice 범위에서 구현/검증하고 결과와 미확실성을 반환한다.

## 다음 실증

세 가지 실제 비운영 작업에서 기존 방식과 비교한다.

1. 단기 개발 작업
2. 일정/여행/행사 같은 다단계 개인 업무
3. 문서+결정+후속이 있는 복합 업무

비교 항목:
- 잘못된 목표 최적화 발견 수
- 중요한 누락/충돌 발견 수
- 질문 수와 사용자 부담
- 재작업 수
- 완료까지의 총 시간
- 후속 누락
- 사용자가 유지한 결정권
- 다음 작업에서 재사용된 학습

## 상태

DESIGN. 아직 Human Stewardship 구조가 실제 사용자 성과를 개선했다고 검증되지 않았다.

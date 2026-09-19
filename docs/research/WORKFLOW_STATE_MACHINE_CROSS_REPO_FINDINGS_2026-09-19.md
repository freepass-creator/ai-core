# Workflow / State Machine Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_WORKFLOW_STANDARD / NOT_CANONICAL**

## 목적

D 세션(Workflow Standard)에 실제 프로젝트의 상태/전이/이벤트/승인/복구 패턴과 외부 표준 근거를 공급한다.

외부 참고:
- W3C SCXML 1.0 — event-based state machine
- OMG BPMN 2.0.2 — business process notation
- CloudEvents — event envelope 참고

이 문서는 workflow canonical schema를 선언하지 않는다.

## 1. 가장 중요한 발견 — “상태”와 “사실”을 분리

FreePass Admin이 가장 좋은 사례다.

```text
progress facts:
- contractCompleted
- documentsCompleted
- balanceCompleted
- deliveryCompleted

derived status:
RECEIVED / CONTRACTED / DELIVERED / CANCELLED
```

즉 사용자가 체크한 사실과 화면에서 보여주는 요약 상태를 분리한다.

Core 후보:
- fact
- state
- derived state
- display state

를 구분.

### 금지
- 모든 업무 사실을 enum 하나에 우겨 넣기
- UI label을 저장 상태값으로 쓰기
- 상태값 변경으로 사실 이력을 덮어쓰기

## 2. 상태를 여러 축으로 나눈다

JPK ERP5 차량 상태에서 확인:

차량 준비축:
- 미확보
- 준비중
- 영업가능
- 운행
- 반납유휴
- 매각

계약축:
- 미계약
- 계약됨
- 운행중
- 종료

화면 headline은 두 축을 조합해 파생.

Core 후보:

```text
state axes -> derived display state
```

예:
- vehicle.lifecycle
- vehicle.availability
- vehicle.contract_state
- vehicle.condition

D 세션은 “상태 enum 하나”보다 **orthogonal state axes**를 우선 검토해야 한다.

## 3. Transition은 to-state만 있으면 부족

JPK vehicle transition은 다음을 함께 갖는다.

- from
- to
- action label
- checklist/guard
- automatic evidence
- manual evidence

즉 transition contract 후보:

```json
{
  "transition_id": "vehicle.deliver",
  "from": ["DELIVERY_READY"],
  "to": "IN_USE",
  "event": "vehicle.delivery.completed",
  "guards": [],
  "required_facts": [],
  "required_permissions": [],
  "idempotency": {},
  "effects": [],
  "audit": {}
}
```

## 4. Guard와 Evidence를 분리

전이가 가능한 조건:
- Guard

전이가 실제 완료됐다는 근거:
- Evidence

예:
- “계약이 있음” = guard
- “인도 완료 확인” = fact/evidence

AIOps가 강하게 보여주는 교훈:
**직원이 완료를 눌렀다 = claim**
**시스템 근거가 확인됐다 = fact**

Core workflow는 claimed completion과 verified completion을 구분해야 한다.

## 5. Completion semantics

Sales:
- 전화 앱 launch != 통화 완료
- 문자 앱 launch != 발송 완료

AIOps:
- 직원 완료 체크 != 업무 완료
- 입금/파일/회수 등 근거 확인 필요

Core 후보 상태:

```text
REQUESTED
STARTED / LAUNCHED
HUMAN_REPORTED
SYSTEM_VERIFIED
COMPLETED
FAILED
CANCELLED
HOLD
```

모든 workflow가 이 상태를 그대로 써야 한다는 뜻은 아니고,
completion semantics를 명시하는 meta-contract 후보.

## 6. Cancel / Correction / Restore

Admin:
- cancel은 delete가 아님
- cancellation reason
- 첫 취소 이유 보존
- cancelled aggregate는 progress 변경 금지

AIOps:
- event 수정 대신 correction event
- 보류는 종료가 아니라 revisit date를 가진 열린 상태

Core 후보:
- CANCELLED
- CORRECTED
- RESTORED
- ON_HOLD

그리고:
- cancellation_reason
- correction_of
- resume_at
- restored_from

를 명시.

## 7. Append-only History

Admin history, AIOps event ledger, ERP4 e-sign history가 같은 방향.

규칙:
- 기존 event 수정/삭제 금지
- 새 event append
- event order / sequence
- actor
- occurred_at
- recorded_at
- source
- correction target

현재 projection은 event 결과로 계산 가능해야 한다.

## 8. Event History vs Current Projection

ERP4 e-sign 설계가 강한 사례:

- provider event history = 원본 이력
- current status/openedAt/signedAt = 빠른 조회 projection
- 외부 업체별 상태는 Adapter가 표준 이벤트로 변환

Core 후보:
```text
event stream -> projector -> current state
```

외부 provider 상태를 consumer가 직접 해석하지 않는다.

## 9. Idempotent Transition

필수:
- 동일 transition request 재시도 안전
- 동일 event/provider-event 중복 차단
- 이미 완료된 transition의 재호출 정책 명시

후보:
- transition_request_id
- idempotency_key
- source_event_id
- current_revision

같은 key + 같은 intent → 기존 결과
같은 key + 다른 intent → conflict/HOLD

## 10. Optimistic Concurrency

상태전이는 current revision에 바인딩해야 한다.

JPK ERP5:
- updatedAt comparison
- conflict → 409

Core 후보:
- expected_revision
- current_revision
- compare-and-set / transaction
- stale transition → VERSION_MISMATCH

## 11. 권한은 transition 단위

Role에 “편집 가능” 하나만 두기보다:

- 어떤 transition을 실행 가능한가
- 어떤 조건에서 승인 필요한가
- 누가 승인/실행/확인했는가

를 구분.

후보 actor roles:
- requester
- approver
- executor
- verifier

같은 사람이 여러 역할을 맡을 수 있어도 evidence 필드는 분리한다.

## 12. Workflow Event Naming

후보:
`<domain>.<entity>.<past-tense-action>`

예:
- sales.application.received
- sales.application.cancelled
- contract.signed
- vehicle.delivery.completed
- vehicle.return.received
- finance.receipt.matched

UI 버튼명과 event key를 분리.

## 13. Time semantics

반드시 분리:
- requested_at
- occurred_at
- recorded_at
- effective_at
- completed_at
- resume_at / due_at

AIOps에서 “발생시각”과 “기록시각”을 분리한 것이 좋은 근거다.

## 14. Due / SLA / Open-Close Pair

AIOps OPEN_CLOSE는 매우 유용한 상위 모델을 제시한다.

```text
opening event
  + due rule
  + closing event(s)
  = open obligation
```

예:
- invoice.issued → receipt.matched
- vehicle.delivered → returned/recovered
- document.requested → document.received

기한 전에는 open이 정상.
기한 후 미종결이면 task/order 생성.

Core 후보:
- obligation/pair contract
- due_at
- closing_events
- escalation_action

이 구조는 단순 state machine보다 업무자동화에 강하다.

## 15. Hold / Snooze

AIOps:
- 보류는 완료가 아님
- 다시 볼 날짜 필수
- 그 전에는 같은 오더를 다시 만들지 않음

Core 후보:
```json
{
  "state": "ON_HOLD",
  "reason": "...",
  "resume_at": "...",
  "held_by": "..."
}
```

## 16. Parallel facts

Admin progress 4개처럼,
모든 단계가 선형 sequence가 아닐 수 있다.

- 서류
- 잔금
- 계약서
- 인도

는 일부 독립.

Core workflow는:
- sequential state only
- parallel facts
- fork/join
- optional branch

를 표현할 수 있어야 한다.

이 점에서 BPMN/SCXML 개념을 참고할 가치가 있다.

## 17. External Provider Workflow

ERP4 e-sign:
- external provider is source of signature truth
- provider webhook/poll → Adapter → standard event
- provider-specific states do not leak into core domain

Core 후보:
- provider_event_id
- provider_workflow_id
- adapter_version
- last_sequence
- sync_at

## 18. Partial Failure / Saga

중요 반례:
계약 상태 변경은 성공했는데 차량 sync가 실패하는 식의 partial success.

Core workflow는 multi-aggregate effect에 대해:
- transaction
- outbox
- saga/compensation
- reconciliation

중 하나를 명시해야 한다.

“한쪽 성공, 다른쪽 실패인데 200 OK”를 표준으로 방치하면 안 된다.

## 19. Workflow machine-readable contract 후보

```json
{
  "workflow_id": "vehicle.lifecycle",
  "version": "1.0",
  "initial_state": "READY",
  "states": {},
  "facts": {},
  "transitions": {},
  "events": {},
  "permissions": {},
  "timeouts": {},
  "obligations": {},
  "recovery": {}
}
```

SCXML 형식을 그대로 채택할지,
JSON Schema 기반 내부 DSL을 만들지는 D 세션 결정.

## 20. 프로젝트별 우위

### Admin
- facts → derived status
- cancellation semantics
- immutable append-only history

### Sales
- launch vs completion
- customer/work-key scoped continuity

### ERP4 e-sign
- external workflow authority
- event sequence
- projection vs event history
- provider adapter

### JPK ERP5
- state axes
- explicit guarded transitions
- optimistic concurrency

### AIOps
- claim vs verified completion
- open/close obligations
- due/escalation
- hold/resume
- evidence-driven closure

## 21. D 세션 P0

1. State vs Fact vs Derived State
2. Multi-axis state
3. Transition schema
4. Guard vs Evidence
5. Actor/Permission/Approval
6. Idempotent transition
7. Event/history
8. Cancel/Correct/Restore/Hold
9. Revision/concurrency
10. Due/timeout/escalation
11. Open-close obligation
12. Parallel facts/fork-join
13. Partial failure/recovery

## 외부 표준 참고

- W3C SCXML 1.0
- OMG BPMN 2.0.2
- CloudEvents 1.0.x

## 한 줄 결론

> **Workflow 표준의 핵심은 상태 이름 통일보다 “어떤 사실이 어떤 근거와 권한으로 어떤 전이를 일으키고, 실패·취소·보류·복구를 어떻게 이력으로 남기는가”를 기계적으로 통일하는 것이다.**

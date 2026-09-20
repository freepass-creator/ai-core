# Core Logical Execution Identity v1

상태: **C SESSION CANONICAL CONTRACT**

## 목적

하나의 업무 실행이 native, retry, fallback, downstream, manual recovery 등 여러 실행 경로를 거칠 때도 **동일한 logical execution**임을 기계적으로 식별한다.

이 계약은 Workflow 상태나 recovery eligibility를 정의하지 않는다. 그 의미는 D가 소유한다. C는 동일 실행을 연결하는 identity/binding 형식만 소유한다.

## 서로 다른 식별자

- `request_id`: 한 번의 API/command 요청
- `idempotency.key`: 같은 semantic command의 중복 처리 방지
- `correlation_id`: 관측/추적 묶음
- `logical_execution_id`: 여러 attempt/path를 관통하는 하나의 논리 실행
- `attempt_id`: 실제 한 번의 실행 시도

이 값들을 같은 값으로 강제하지 않는다.

## Identity dimensions

`logical_execution_id`에는 다음 dimension이 고정되어야 한다.

- `operation_kind`
- `logical_slot`
- `subject_scope`
- `semantic_input_digest`

`identity_digest`는 위 dimensions의 canonical JSON SHA-256이다. 같은 logical_execution_id가 다른 dimensions와 결합되면 동일 실행으로 취급하면 안 된다.

## Attempt binding

기존 C envelope는 optional `execution` binding을 가질 수 있다.

- `core-request-context/v1`
- `core-adapter-result/v1`
- `core-receipt/v1`
- `core-event/v1`

binding은 logical execution과 실제 attempt를 동시에 기록한다.

```
logical_execution_id
  ├─ attempt_id: native
  ├─ attempt_id: fallback
  └─ attempt_id: downstream
```

실행 경로 이름의 업무 의미, fallback 허용 조건, success suppresses replay 같은 규칙은 D 소유다.

## No-replay 경계

C contract가 보장하는 것은 "같은 logical execution인가"를 판별할 수 있는 identity다.

다음은 D/consumer가 결정한다.

- native success 후 fallback 금지
- ambiguous outcome HOLD
- retry exhaustion
- recovery slot due 여부
- compensation/rollback

즉 **identity는 replay 방지의 전제조건이지 workflow policy 자체가 아니다.**

## Runtime helper

`src/contracts/execution-identity.mjs`

- `executionIdentityDigest(dimensions)`
- `createExecutionIdentity(...)`
- `bindExecutionAttempt(...)`
- `sameLogicalExecution(...)`

모두 provider/workflow 독립적이다.

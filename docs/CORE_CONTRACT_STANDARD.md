# AI Core Core Contract Standard v1

상태: **CANONICAL C-SESSION FOUNDATION / additive adoption**

소유: **C — Core Contract Standard**

## 1. 책임 경계

C는 UI 뒤의 시스템 계약을 소유한다.

- Data / SSOT / Master / identity / type / nullability / time / money / version
- Engine / Port / Adapter / Repository / Connector 경계
- Import / Export / Parser / Normalizer / Mapper 계약
- API / pagination / idempotency / revision 계약
- Event envelope / correlation / causation / replay 식별자
- Error / retryability / provider normalization
- Result / Receipt / Evidence / reproducibility

C는 **업무 상태 전이 자체를 소유하지 않는다**. Workflow state, transition, guard, approval, hold/resume/cancel/fail의 업무 의미는 D가 소유한다. C는 그 명령/이벤트/오류/receipt를 운반하는 형식만 제공한다.

## 2. 데이터 정본

### 2.1 Canonical owner / writer

모든 canonical fact는 owner와 writer가 명시되어야 한다. 같은 사실을 둘 이상의 DB가 동시에 소유하면 안 된다.

```
Raw source
  -> Parser / Adapter
  -> Normalizer
  -> Canonical Core Model
  -> Product / Business Model
  -> Projection / Output
```

장애 시 legacy store를 조용히 정본으로 승격하는 fallback은 금지한다.

### 2.2 Identity

- ID는 stable + opaque다.
- mutable label, 행번호, 정렬순서, 공급사 key를 canonical PK로 쓰지 않는다.
- 필드명은 `*_id`, 사람이 보는 code/label은 별도다.
- legacy/provider key -> canonical ID 매핑은 Adapter 책임이다.

### 2.3 Null / unknown

`null`, absent, zero, empty string은 서로 다른 의미다. unknown을 0이나 `""`로 저장하지 않는다. required/nullable은 schema로 선언한다.

### 2.4 Time

- date: `YYYY-MM-DD`
- datetime: RFC 3339 timezone 포함
- canonical persisted timestamp는 UTC로 normalize
- source timezone/offset이 업무 증거이면 provenance에 보존
- `created_at`과 business effective date를 혼합하지 않는다.

### 2.5 Money / percentage

- money = `{ amount_minor, currency }`
- currency = ISO-4217 alpha-3
- floating currency amount는 canonical 저장 금지
- percentage는 **percentage points**. `10 = 10%`.
- provider가 `0.1`을 요구하면 Adapter에서 변환한다.

## 3. Provenance / snapshot / revision

`contracts/core-provenance.schema.json`이 source fact와 normalized fact의 연결을 정의한다.

source는 최소 하나를 가져야 한다.

- `source_revision`
- immutable `source_checksum`

field-level provenance에는 source path, digest, transformation, verification state를 남길 수 있다. raw PII를 evidence에 복제하지 않고 참조/해시를 우선한다.

세 종류의 version을 구분한다.

1. API contract version
2. schema/resource version
3. entity revision / optimistic-concurrency token

이 셋을 URL `/v1` 하나로 대체하지 않는다.

## 4. Engine / Adapter

```
Consumer / UI
  -> Application Service
  -> Domain Engine
  -> Port
  -> Adapter / Repository
  -> Connector / External System
```

- Engine: 업무 의미, 계산, invariant. provider SDK/field를 모른다.
- Application Service: use-case orchestration, idempotency, auth/actor requirement, transaction request.
- Port: 기술중립 의미 계약.
- Adapter: provider field/unit/error를 canonical contract로 변환.
- Repository: persistence, uniqueness, atomicity, concurrency, storage idempotency.
- Connector: HTTP/DB/API transport, credential transport, timeout/retry primitive.

Provider 특이사항은 Core Model에 넣지 않는다.

Adapter terminal result는 `core-adapter-result/v1`을 사용한다. `status`, `retryable`, `adapter_version`, `source_revision`, `issues[]`, `evidence_refs[]`를 숨기지 않는다.

## 5. API

HTTP method/status semantics를 임의 재정의하지 않는다.

- 400 malformed/validation
- 401 authentication
- 403 authorization
- 404 not found
- 409 state/version/idempotency conflict
- 422 domain validation을 사용할 경우 의미 고정
- 429 rate limit
- 502 invalid upstream
- 503 temporary unavailable
- 500 unexpected internal/persistence

mutable large list는 cursor pagination을 기본 검토한다. cursor는 opaque다. `core-api-page/v1`은 `next_cursor`, `has_more`, request id, generated time, optional resource revision을 표준화한다.

업무 idempotency는 HTTP method idempotency와 별도다.

- same key + same semantic payload -> prior result replay 가능
- same key + changed payload -> `IDEMPOTENCY_CONFLICT`
- side effect 결과는 receipt와 함께 보존

## 6. Error

`core-error/v1`은 RFC 9457 Problem Details의 핵심 필드에 회사 extension을 더한다.

필수 machine fields:

- `code`
- `category = USER | SYSTEM | PROVIDER`
- `correlation_id`
- `retryable`

프로젝트별 `{error:"already done"}` 형태는 신규 canonical API에서 금지한다. 공통 error family는 `registry/core-error-codes.json`에서 관리하고, domain-specific code는 family semantics를 깨지 않는 범위에서 확장한다.

## 7. Event

`core-event/v1`은 CloudEvents 1.0.x 의미를 참고한 내부 canonical envelope다.

필수:

- immutable `event_id`
- namespaced `event_type`
- independent `event_version`
- producer
- occurred_at / recorded_at 분리
- correlation_id / causation_id
- subject id + revision
- payload
- evidence refs

Event envelope는 business workflow state를 정의하지 않는다. D가 소유한 상태전이 결과가 event payload로 표현될 수 있을 뿐이다.

## 8. Receipt / Evidence

중요 실행은 `core-receipt/v1`을 남긴다.

receipt는 최소 다음 질문에 답해야 한다.

- 무엇을 실행했나
- 누가 요청했나
- 누가/무엇이 처리했나
- 어떤 입력 digest/ref를 사용했나
- 어떤 source revision을 봤나
- 어떤 출력 digest/ref를 만들었나
- 언제 시작/종료했나
- 결과가 SUCCEEDED/HOLD/FAILED/PARTIAL 중 무엇인가
- 어떤 evidence가 있는가
- 어떤 executor/environment revision으로 재현 가능한가

“버튼 클릭됨”, “명령 전송됨”은 업무 성공 증거가 아니다.

## 9. Version / compatibility / migration

v1 내부:

- optional field 추가: 허용
- enum 값 추가: consumer가 unknown-safe임이 증명된 경우에만
- required field 추가: breaking
- 기존 필드 의미 변경: breaking
- unit 변경: breaking
- nullability 축소: breaking

breaking change는 새 `/vN` contract를 만든다.

프로젝트 migration은 **SHADOW -> VALIDATE -> DUAL READ(필요 시) -> CUTOVER -> LEGACY RETIRE** 순서를 기본으로 하며, silent fallback은 금지한다.

## 10. Machine-readable authority

- `registry/core-contracts.json`
- `registry/core-error-codes.json`
- `contracts/core-*.schema.json`
- `scripts/validate-core-contracts.mjs`
- `test/core-contract-standard.test.mjs`

A 세션의 cross-repo 문서는 evidence input이며 canonical authority가 아니다. C가 근거 revision을 확인하고 일반화한 뒤 위 artifact로 승격해야 정본이 된다.

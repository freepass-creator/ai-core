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

### 3.1 Observed / inferred / derived fact evidence

`core-fact-evidence/v1`은 사실 증거의 종류를 `OBSERVED | INFERRED | DERIVED`로 구분한다.

- `OBSERVED`: 직접 source evidence가 존재
- `INFERRED`: 명시된 rule과 basis fact로 추론
- `DERIVED`: source evidence를 변환해 계산된 사실

`INFERRED`는 반드시 `rule_ref`와 `basis_fact_refs`를 남긴다. 논리적으로 타당한 추론이라도 `OBSERVED`로 승격하지 않는다.

D가 workflow에서 추론 필요 조건과 금지되는 stronger completion fact를 정하고, C는 그 결과를 표현하는 typed evidence envelope를 제공한다. 상세는 `docs/CORE_FACT_EVIDENCE.md`를 따른다.

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

### 8.1 Proof input freshness

검증 결과가 source revision 하나만 보았다는 이유로 계속 유효하다고 가정하지 않는다.

`core-proof-input-binding/v1`은 proof에 사용된 원본, checker 구현, fixture, config, schema, dependency를 각각 digest/revision에 결속하고 canonical input-set digest를 만든다.

- 동일 input set → `CURRENT`
- 구성 입력 추가/삭제 또는 digest/revision 변경 → `STALE`
- binding 자체의 digest 불일치 → `INVALID`

`STALE`은 업무 실패가 아니라 **과거 PASS가 현재 입력을 더 이상 증명하지 못한다**는 뜻이다. 다시 검증하기 전에는 current evidence로 집계하지 않는다.

`core-receipt/v1`은 optional `proof_input_binding`으로 이 계약을 연결할 수 있다. 세부 규격은 `docs/CORE_PROOF_INPUT_BINDING.md`를 따른다.

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


## 11. SSOT Source Priority

SSOT를 선언하는 프로젝트는 `core-source-registry/v1`을 사용한다.

필수 의미:
- subject type별 canonical owner / writer
- source role
- 명시적 priority
- authoritative 여부
- freshness policy
- stale 시 HOLD / REJECT / warning 정책
- fallback policy

**silent fallback은 금지**한다. 복구 소스를 쓰려면 명시적 activation과 evidence가 필요하다.

## 12. Snapshot / Request / Query

- `core-snapshot/v1`: 당시 subject revision, source revision, payload digest를 고정한다.
- `core-request-context/v1`: request/correlation/actor/expected revision/idempotency를 묶는다.
- `core-query/v1`: search/filter/sort/cursor/limit을 구조화한다.

필터 문자열이나 provider query 문법을 canonical API에 그대로 노출하지 않는다. Provider query translation은 Adapter가 책임진다.

## 13. Parser / Normalizer / Mapper

`core-transformer-contract/v1`은 Parser, Normalizer, Mapper를 각각 versioned capability로 선언한다.

각 transformer는 다음을 고정한다.
- input/output contract
- implementation source + revision
- deterministic 여부
- issue code
- verification profile

Raw를 바로 Business Model에 쓰거나 Parser와 업무판정을 한 함수에 섞는 것을 금지한다.

## 14. Import / Export

`core-data-pipeline-contract/v1`을 사용한다.

Import 기본 경로:
```
RAW_SNAPSHOT -> PARSE -> NORMALIZE -> VALIDATE -> [IDENTITY_RESOLVE] -> [REVIEW] -> COMMIT
```

Export 기본 경로:
```
PROJECT -> [PRIVACY_FILTER] -> SERIALIZE -> [DELIVER]
```

Import는 validate 이전 commit을 허용하지 않고, Export는 canonical store를 수정하는 COMMIT 단계를 허용하지 않는다. 모든 pipeline은 receipt를 요구한다.

## 15. Event Type Registry

Event instance와 Event type contract를 분리한다.

- instance: `core-event/v1`
- type definition: `core-event-type-contract/v1`
- registry: `registry/core-event-types.json`

Event type은 producer, payload schema, consumers, duplicate policy, replay policy, retention을 선언해야 한다. 프로젝트가 새 event name을 즉흥 생성하기 전에 registry contract를 거친다.

## 16. Enum / Code

공통 code lifecycle 형식은 `core-code-set/v1`이다.

- code는 stable machine value
- display label은 계약 identity가 아니다
- deprecate/retire/replacement를 명시
- `open_enum=true`이면 consumer는 미래 unknown code를 안전하게 처리해야 한다.

업무 Workflow state의 실제 code 내용과 transition 의미는 D가 소유한다. C는 code의 wire/schema lifecycle만 소유한다.

## 17. Generic Result

기존 `ai-core-work-result/v1`은 현재 Work runtime의 도메인 결과로 유지한다. 신규 공통 integration에서는 `core-result/v1`을 사용하고, 중요한 side effect는 별도 `core-receipt/v1`을 연결한다.

즉 Result는 **무슨 결과가 나왔는가**, Receipt는 **그 결과를 만들기 위해 실제 무엇을 실행했는가**를 증명한다.


## 18. Automated Schema Evolution Gate

`scripts/check-contract-compatibility.mjs`가 PR의 canonical v1 schema를 base branch와 비교한다.

같은 major contract에서 다음은 breaking으로 판정한다.
- canonical contract 삭제/경로 교체
- 기존 property 삭제
- required field 추가
- enum value 삭제
- nullability/type 축소
- minimum/minLength/minItems 강화
- maximum/maxLength/maxItems 축소
- pattern/format/ref 변경
- additionalProperties 허용 → 금지

Breaking 변화가 필요하면 기존 v1을 수정하지 않고 새 major contract를 추가한다. CI는 `npm run contracts:compat`로 이 규칙을 검사한다.

Core Contract Registry가 아직 없는 최초 도입 base에서는 `BASE_NOT_INITIALIZED`로 통과하며, #94가 main에 들어간 다음 변경부터 실제 compatibility gate가 활성화된다.

## 19. Logical Execution Identity

여러 request/attempt/path가 하나의 업무 실행을 구성할 때 `core-execution-identity/v1`을 사용한다.

다음 식별자를 서로 구분한다.

- `request_id`: 한 번의 요청
- `idempotency.key`: semantic command 중복 방지
- `correlation_id`: tracing 묶음
- `logical_execution_id`: native/retry/fallback/downstream/recovery를 관통하는 동일 논리 실행
- `attempt_id`: 실제 한 번의 실행 시도

logical execution identity는 `operation_kind + logical_slot + subject_scope + semantic_input_digest` dimensions에 묶이며, canonical JSON SHA-256 `identity_digest`로 차이를 검출한다.

`core-request-context/v1`, `core-adapter-result/v1`, `core-receipt/v1`, `core-event/v1`은 optional `execution` binding을 통해 같은 logical execution과 개별 attempt를 연결할 수 있다.

C는 identity/binding 형식만 소유한다. fallback 허용 조건, retry exhaustion, ambiguous outcome HOLD, replay suppression 같은 workflow 의미는 D가 소유한다.

상세 규격과 runtime helper는 `docs/CORE_EXECUTION_IDENTITY.md`, `src/contracts/execution-identity.mjs`를 따른다.

### 19.1 Scheduled execution observation

`core-schedule-observation/v1`은 예정 logical slot, 실제 dispatch/run identity, execution attempt, downstream completion을 서로 다른 사실로 기록한다.

C는 이 관측 형식과 identity binding만 소유한다. `ON_TIME / LATE / MISSED / UNKNOWN` 같은 timing assessment는 반드시 D가 소유한 `policy_ref`에 결속되어야 하며, C가 임의의 late/miss threshold를 정하지 않는다.

세부 규격은 `docs/CORE_SCHEDULE_OBSERVATION.md`를 따른다.


# API / Event / Error Standard Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_CORE_CONTRACT / NOT_CANONICAL**

## 1. 외부 표준 기준축

### HTTP
- RFC 9110 HTTP Semantics
- method semantics / status code / idempotency 의미를 임의 재정의하지 않는다.

### Error
- RFC 9457 Problem Details for HTTP APIs
- RFC 7807 대신 9457을 현재 기준으로 사용한다.

### Schema
- JSON Schema Draft 2020-12
- machine-readable request/response/event validation의 공통 기반 후보.

### API Description
- OpenAPI Specification.
- 현재 OAS 계열을 HTTP API contract 문서화/검증 기준으로 사용.

### Event Envelope
- CloudEvents stable 1.0.x 계열을 참고.
- event producer마다 제각각 envelope를 만들지 않는다.

## 2. 현재 우리 리포의 문제

현재 프로젝트들은 다음이 섞여 있다.

```json
{ "ok": false, "error": "lock_conflict", "message": "..." }
```

```json
{ "error": "매물 코드가 없습니다." }
```

```ts
{ ok: false, reason: 'PRODUCT_CHANGED' }
```

각 프로젝트 내부에서는 동작하지만 전사 Core API가 되면 소비자가 매번 새 규칙을 배워야 한다.

## 3. Error contract 후보

HTTP 상태는 generic semantics를 표현하고,
업무 세부 오류는 stable machine code를 별도로 둔다.

후보:

```json
{
  "type": "https://errors.example/core/version-mismatch",
  "title": "Version conflict",
  "status": 409,
  "code": "VERSION_MISMATCH",
  "detail": "The resource changed after it was read.",
  "instance": "/applications/AP-...",
  "correlation_id": "...",
  "retryable": false,
  "meta": {
    "expected_revision": "...",
    "current_revision": "..."
  }
}
```

RFC 9457 필드와 회사 extension을 분리한다.

Core stable error family 후보:
- VALIDATION
- NOT_FOUND
- CONFLICT
- VERSION_MISMATCH
- IDEMPOTENCY_CONFLICT
- UNAUTHORIZED
- FORBIDDEN
- CANCELLED
- RATE_LIMITED
- UPSTREAM_UNAVAILABLE
- UPSTREAM_INVALID_RESPONSE
- PERSISTENCE
- INTERNAL

## 4. HTTP status mapping 후보

- 400: malformed / request validation
- 401: authentication required/invalid
- 403: authenticated but forbidden
- 404: resource not found
- 409: state/version/idempotency conflict
- 422: syntactically valid but domain validation failure — 사용할 경우 전사적으로 의미 고정
- 429: rate limit
- 502: upstream invalid/bad gateway semantics
- 503: temporary unavailable
- 500: unexpected internal error

업무코드와 HTTP 코드를 1:1로 강제하지 않는다.

## 5. Idempotency

RFC 9110의 HTTP method idempotency와
우리 업무의 **request idempotency key**를 구분해야 한다.

예:
- PUT 자체 semantics는 idempotent
- POST 접수 생성도 business idempotency key로 중복 방지 가능

Core 후보:
- `Idempotency-Key` 또는 명시적 contract field
- 같은 key + 같은 semantic payload → 기존 결과 반환
- 같은 key + 다른 payload → 409 IDEMPOTENCY_CONFLICT
- side effect 결과 receipt 보존

## 6. Request / Response envelope

모든 성공 응답을 억지로 `{ok:true,data}`로 감쌀 필요는 없다.
HTTP resource API는 resource 자체를 반환할 수 있다.

다만 공통 metadata가 필요한 batch/async operation에는 명시적 envelope 사용.

후보:
```json
{
  "data": {},
  "meta": {
    "request_id": "...",
    "revision": "...",
    "generated_at": "..."
  }
}
```

중요:
- envelope 유무를 endpoint마다 즉흥 결정 금지
- API family별 contract에서 선언

## 7. Pagination

공통 후보:
- list endpoint는 pagination strategy를 명시
- offset/page와 cursor를 섞지 않음
- mutable large dataset은 cursor 우선 검토
- stable sort key 필요
- next cursor는 opaque
- total count가 비싸거나 일관성 보장이 어려우면 optional

후보 meta:
```json
{
  "items": [],
  "page": {
    "next_cursor": "...",
    "has_more": true
  }
}
```

## 8. Versioning

세 종류를 분리한다.

1. API contract version
2. resource/schema version
3. entity revision / optimistic-lock revision

URL `/v1` 하나로 셋을 대신하지 않는다.

Core 후보:
- breaking API = explicit version policy
- schema_version
- resource revision/ETag 후보
- deprecated_since
- sunset/removal policy

## 9. Event contract

AIOps Event Ledger와 CloudEvents를 비교하면 공통 envelope를 정하기 좋다.

AIOps 현재 주요 의미:
- event id
- occurred_at
- recorded_at
- corporation/domain
- event type
- target type/id
- before/after
- attributes
- evidence
- actor
- result
- correction target

CloudEvents의 공통 context와 결합 후보:

```json
{
  "specversion": "1.0",
  "id": "...",
  "source": "...",
  "type": "vehicle.delivery.completed",
  "time": "...",
  "subject": "vehicle/...",
  "datacontenttype": "application/json",
  "data": {
    "entity_id": "...",
    "actor": {},
    "correlation_id": "...",
    "causation_id": "...",
    "before": {},
    "after": {},
    "evidence": []
  }
}
```

CloudEvents 자체를 내부 domain model로 강제할지,
외부/transport envelope로만 사용할지는 C 세션 결정사항.

## 10. Event naming 후보

```text
<domain>.<entity>.<past-tense-action>
```

예:
- sales.application.created
- contract.delivery.completed
- vehicle.return.received
- finance.receipt.matched

금지:
- UPDATED 같은 너무 넓은 이벤트만 남발
- 화면 버튼명을 event type으로 사용
- 한국어/영어 event key 혼용

display label은 locale layer에서 번역.

## 11. Event immutability / correction

AIOps의 좋은 원칙:
- 과거 event row를 수정하지 않음
- 취소/정정도 새 event
- correction target id를 가짐

Core 후보:
- append-only event
- correction_of
- causation_id
- correlation_id
- actor
- source revision

## 12. Audit와 Domain Event 구분

같지 않다.

Domain Event:
- 업무상 일어난 사실
- downstream automation의 입력 가능

Audit Event:
- 누가 시스템에서 무엇을 변경했는지
- 보안/추적 목적
- 민감정보 최소화

한 로그에 둘을 억지로 합치지 않는다.

ERP4의 PII scrub 방식은 Audit Standard에 가져갈 가치가 크다.

## 13. Audit criticality

JPK ERP5의 fire-and-forget audit는 모든 업무에 적합하지 않다.

Core 후보:
- OPTIONAL_TELEMETRY: 실패해도 본 작업 진행
- REQUIRED_AUDIT: audit 기록이 transaction/outbox로 보장돼야 함
- LEGAL_EVIDENCE: 별도 retention/immutability/proof 필요

즉 audit 실패정책도 contract다.

## 14. Async / Job API

오래 걸리는 import/export/OCR/sync는 HTTP request 하나를 오래 잡지 않는다.

후보:
```text
POST /jobs
→ 202 Accepted + job_id

GET /jobs/{id}
→ QUEUED / RUNNING / SUCCEEDED / FAILED / CANCELLED
```

completion은 request accepted와 구분한다.

## 15. Webhook

후보:
- event id
- timestamp
- signature
- replay protection
- retry policy
- delivery id
- receiver idempotency
- dead-letter / terminal failure
- delivery receipt

Webhook delivery success != business processing success.

## 16. Machine schema

C 세션에는 최소 다음 artifact가 필요하다.

- OpenAPI description
- JSON Schema components
- Error code registry
- Event type registry
- Webhook contract
- Pagination contract
- Version/deprecation policy
- idempotency contract

## 17. 우리 프로젝트에서 가져갈 것

### Admin
- typed result/reason
- version conflict
- repository idempotency

### ERP4
- public/private projection 분리
- PII-scrubbed audit
- stable source/revision evidence

### AIOps
- append-only event/correction
- evidence pointer
- occurred vs recorded time

### JPK ERP5
- optimistic lock / 409 pattern
- closed-period conflict
- 공용 action helper
- 반례: 문자열 error / partial consistency / fire-and-forget critical audit

### Welrix
- upstream invalid response fail-closed
- provider error normalization

## 18. C 세션 P0

1. HTTP method/status semantics
2. RFC 9457-compatible Error Object
3. stable error-code registry
4. JSON Schema baseline
5. OpenAPI baseline
6. idempotency key contract
7. revision/version contract
8. pagination
9. Event envelope/type registry
10. Audit vs Domain Event
11. async job contract
12. webhook delivery/idempotency

## 참고 표준

- RFC 9110 — HTTP Semantics
- RFC 9457 — Problem Details for HTTP APIs
- JSON Schema Draft 2020-12
- OpenAPI Specification
- CloudEvents stable 1.0.x

## 한 줄 결론

> **전사 API 표준의 핵심은 URL 모양이 아니라 HTTP 의미, stable error code, schema/version/idempotency, event envelope와 감사 경계를 모든 프로젝트가 같은 방식으로 이해하게 만드는 것이다.**

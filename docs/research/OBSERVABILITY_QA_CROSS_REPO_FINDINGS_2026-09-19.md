# Observability / QA Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_OBSERVABILITY_QA_STANDARD / NOT_CANONICAL**

## 외부 기준

- OpenTelemetry Specification
- OpenTelemetry Semantic Conventions
- OWASP Web Security Testing Guide
- OpenMetrics 참고
- RFC 9457 error semantics와 연동

## 1. “로그가 있다”와 “관측 가능하다”는 다르다

관측 계약은 최소 세 신호를 구분한다.

### Logs
무슨 일이 있었나

### Metrics
얼마나 자주/많이/오래

### Traces
한 요청/업무가 여러 시스템을 어떻게 지나갔나

Core Standard는 console.log 존재 여부가 아니라 이 세 신호의 **공통 identity/correlation**을 정의해야 한다.

## 2. 공통 Correlation Context

모든 request/job/event에 후보:

```text
request_id
correlation_id
causation_id
trace_id
span_id
job_id
actor_id
entity_type
entity_id
source_revision
app_version
environment
```

모든 필드를 모든 로그에 강제하지 않고 signal별 required set을 둔다.

## 3. OpenTelemetry를 semantic naming baseline으로

OpenTelemetry는 traces/metrics/logs/resource에 공통 semantic convention을 제공한다.

Core 후보:
- service.name
- service.version
- deployment.environment
- trace/span context
- HTTP semantic attributes
- DB/messaging attributes
- exception type/message/stack

제품별 임의 키를 만들기 전에 OTel semantic key가 있는지 확인.

## 4. Structured Log

금지:
```text
"에러남"
"저장실패"
"API error"
```

후보:
```json
{
  "timestamp": "...",
  "severity": "ERROR",
  "service": "freepass-sales",
  "environment": "prod",
  "event": "application.save.failed",
  "error_code": "PERSISTENCE",
  "correlation_id": "...",
  "entity_type": "application",
  "entity_id": "...",
  "actor_id": "...",
  "revision": "..."
}
```

PII/secret은 제외.

## 5. Error Report와 User Message 분리

ERP4/JPK에서 확인된 문제:
- 사용자 친화 메시지는 필요
- 그러나 내부 진단 code/context를 잃으면 안 됨

Core:
- stable error code
- sanitized user message
- internal diagnostic
- correlation id

분리.

## 6. Health Check

health는 한 종류가 아니다.

### Liveness
process 자체가 살아 있나

### Readiness
현재 요청을 정상 처리 가능한가

### Dependency health
DB/provider/sheet/external API

### Freshness
데이터가 최근까지 갱신됐나

ERP4/AIOps에서 실제로 “프로세스는 사는데 schedule/data가 죽은” 사고가 반복됨.

Core health envelope 후보:
```json
{
  "status": "OK|DEGRADED|FAIL",
  "checked_at": "...",
  "version": "...",
  "checks": [
    {"name":"database","status":"OK"},
    {"name":"catalog_freshness","status":"DEGRADED","age_seconds":4200}
  ]
}
```

## 7. Freshness는 1급 지표

ERP4/AIOps 핵심 교훈:
- “데이터 있음” != “최신”
- last successful run
- source observed_at
- snapshot revision
- consumer updated_at

Core 후보:
- max_age
- observed_at
- refreshed_at
- source_revision
- stale_after
- stale behavior: HOLD / warning / cached-read

## 8. Pipeline Observability

ERP4 ops pipeline처럼 각 단계 요약을 별도 작은 status document로 두는 패턴이 좋다.

```text
source collection
→ adapter
→ canonical write
→ snapshot
→ projection
→ consumer
```

각 stage:
- state
- started_at
- completed_at
- input_count
- output_count
- rejected_count
- warning_count
- revision/run_id
- blocker

전량 데이터를 계속 폴링하지 않고 summary status를 본다.

## 9. Trace-to-Source / Precision Drilldown

ERP4 `/api/ops/trace`의 강점:
- source type
- tab
- row
- run id
- updated_at
- direct source link

즉 장애 지표에서 **고칠 원천까지 바로 추적** 가능.

Core 후보:
- telemetry → entity → provenance/source pointer

“에러 14건”에서 끝나지 않는다.

## 10. Metrics

기본 Golden Signals 후보:
- request rate
- error rate
- latency
- saturation/resource when relevant

업무 시스템 추가:
- queue depth
- job age
- stale source count
- retry count
- dead-letter count
- unmatched/review-required count
- verification pending age

단, 업무 KPI와 시스템 SLI를 섞지 않는다.

## 11. Metric Naming / Unit

OpenTelemetry semantic convention 우선.

- unit을 이름에 중복 삽입하지 않기
- duration은 seconds 기반 metadata 권장
- count와 gauge 의미 분리
- label cardinality 폭발 금지
- customer id/vehicle id를 metric dimension으로 무분별하게 사용 금지

고카디널리티 identity는 trace/log로.

## 12. Client Error

ERP4의 좋은 패턴:
- window.error
- unhandledrejection
- user/session correlation
- stale chunk 감지
- reload loop 방지
- 입력 중이면 강제 reload 유예

Core 후보:
- global error boundary
- unhandled rejection
- chunk/version mismatch
- client app version
- route/page
- sanitized user identity

## 13. Version / Production Proof

ERP4의 강한 원칙:

```text
git commit exists
!= deployment READY
!= production domain serves revision
```

운영 완료는 실제 서비스 `/api/version` readback이 expected revision과 일치해야 한다.

이건 QA/Deploy 공통 invariant로 승격할 가치가 높다.

## 14. QA Layer

Core test profile 후보:

### Static
- schema
- typecheck
- lint
- contract files
- forbidden imports/patterns

### Unit
- domain engine
- parser/adapter
- state transition

### Contract
- API request/response
- adapter
- storage/repository
- auth/rules

### Integration
- multiple modules/dependencies

### Browser/E2E
- actual flow/state/focus/navigation

### Security negative
- forbidden cross-org
- overwrite/delete
- unauthenticated
- stale token

### Production proof
- version/readback
- health
- smoke
- no unexpected errors

## 15. Negative Control

Sales의 좋은 패턴:
의도적으로 구형/잘못된 동작을 주입했을 때 검사가 **반드시 실패**하는지 확인.

Core 후보:
- test that test can fail
- security deny cases
- stale/revision mismatch
- duplicate/idempotency conflict
- corrupted source

“테스트가 존재” != “결함을 잡는다”.

## 16. Fixture / Synthetic vs Real Proof

구분:
- unit fixture
- synthetic integration
- emulator
- preview
- production observation

synthetic PASS를 production PASS로 승격 금지.

Proof에 environment와 target revision 필수.

## 17. Retry / Recovery QA

반드시 검사:
- response loss after successful write
- duplicate retry
- timeout
- upstream partial failure
- stale revision
- restart/resume
- cursor/checkpoint resume
- outbox redelivery
- same event twice

Happy path만으로 완료 금지.

## 18. Background Jobs

AIOps 교훈:
코드가 고쳐져도 scheduler가 꺼져 있으면 안 돈다.

Core job observability:
- last_started
- last_completed
- last_success
- next_due
- last_result
- heartbeat
- lease owner
- run revision
- processed count
- checkpoint

schedule configuration 자체도 관측 대상.

## 19. Detection / Verification

AIOps의 중요한 구조:
- Human claim
- System evidence
- Verified completion

Observability는 단순 장애뿐 아니라 **업무 완료 검증**에도 쓰인다.

예:
- 파일 업로드됐나
- 돈 들어왔나
- 차량 입고됐나
- 시트에 값이 생겼나

Core QA/evidence framework와 연결해야 한다.

## 20. Alerting

알림은 모든 error에 보내지 않는다.

후보:
- severity
- impact
- duration
- retry exhaustion
- freshness threshold
- SLO burn
- protected workflow failure

dedupe / suppression / ownership 필요.

## 21. QA Result Envelope

후보:
```json
{
  "subject_revision": "...",
  "environment": "preview",
  "suite": "security-rules",
  "started_at": "...",
  "ended_at": "...",
  "checks": [],
  "passed": 42,
  "failed": 0,
  "skipped": 1,
  "evidence": [],
  "limitations": []
}
```

skip/unknown을 PASS에 포함하지 않는다.

## 22. Release Gate 입력

최소:
- required suites
- exact revision
- test results
- security results
- migration status
- rollback availability
- production target
- post-deploy proof

## 23. P0 후보

1. telemetry context/correlation
2. structured log schema
3. OTel semantic naming
4. error diagnostic separation
5. liveness/readiness/dependency/freshness
6. pipeline run status
7. source drilldown
8. metric naming/unit/cardinality
9. test layer taxonomy
10. negative controls
11. fixture/emulator/preview/prod proof levels
12. background job heartbeat/checkpoint
13. production revision readback
14. QA result envelope
15. alert severity/ownership

## 한 줄 결론

> **본사 Observability/QA 규격은 “로그 남겨라·테스트 해라”가 아니라 같은 correlation·revision·environment로 시스템 상태와 검증 증거를 연결하고, 실제 운영이 그 판을 서빙하는지까지 증명하게 해야 한다.**

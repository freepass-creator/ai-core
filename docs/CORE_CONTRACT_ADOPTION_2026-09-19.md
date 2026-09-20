# Core Contract Adoption — ERP4 / Admin / Sales / Estimate — 2026-09-19

상태: **C-P1 CROSS-PROJECT ADOPTION / MACHINE REGISTRY ACTIVE**

기준:
- AI Core Core Contract P0: PR #94
- adoption registry: `registry/core-contract-adoption.json`
- project count: 4
- canonical C contracts accounted per project: 26
- total assessment cells: 100

## 1. 판정 의미

두 축을 분리한다.

### classification
- `CORE_MATCH`: 현재 프로젝트 의미가 Core와 이미 맞음
- `ADAPTER_ONLY`: provider/project 특이 의미라 Adapter에 남겨야 함
- `MIGRATE`: Core contract로 명시적 변환/도입 필요
- `D_OWNED_WORKFLOW`: Workflow 내용은 D 소유
- `B_OWNED_PRESENTATION`: UI 표현은 B 소유
- `LEGACY_RETIRED`: 신규 사용 금지/퇴역 대상
- `NOT_APPLICABLE`: 현재 프로젝트 경로에 적용하지 않음

### binding_state
- `NONE`: 의미 판정만 완료
- `SHADOW`: 기존 운영 의미는 그대로 두고 Core contract를 병행 생성/검증
- `VALIDATED`: 동등성/회귀 검증 완료
- `CUTOVER_READ`
- `CUTOVER_WRITE`
- `RETIRED`

classification과 binding_state를 섞지 않는다.
예를 들어 ERP4 SSOT는 `CORE_MATCH + SHADOW`가 될 수 있다. 의미는 이미 맞고, Core machine contract를 병행 적용하는 단계라는 뜻이다.

## 2. FreePass ERP4

Revision:
`2d9fd07075aae7d6d64687fabbf61126e166c34c`

핵심 판정:
- CORE_MATCH: 7
- MIGRATE: 12
- D-owned: 1
- N/A: 4

### 이미 Core보다 충분히 강한 부분
- ERP5 single canonical owner/writer
- downstream 역방향 canonical write 금지
- fixed snapshot
- raw → Parser/Adapter/Normalizer → canonical atoms
- silent legacy fallback 금지
- source freshness/consumer refresh 분리

### P0 migration
- common ID/time/money/null conventions
- stable Core error envelope
- request idempotency + expected revision
- execution receipt
- generic API/result envelope

### 현재 SHADOW
`core.source-registry.v1`

Artifact:
- `registry/adoption/freepasserp4-products.source-registry.json`
- `test/core-contract-cross-project-adoption.test.mjs`

즉 ERP4의 ERP5 product SSOT 원칙을 바꾸지 않고 Core machine contract로 병행 표현한다.

## 3. FreePass Admin

Revision:
`fb85037969a6c2f4596350b9c66303025be6f19d`

핵심 판정:
- CORE_MATCH: 11
- MIGRATE: 8
- D-owned: 1
- N/A: 4

4개 프로젝트 중 **backend architecture가 Core와 가장 가까운 프로젝트**다.

이미 일치:
- Domain Engine
- Application Service
- Port
- Adapter
- Repository
- Connector
- repository-level idempotency
- snapshot immutability
- version conflict
- raw → adapter → canonical → application snapshot

주요 migration:
- AppError → Core Error family mapping
- production persistence/auth binding profile
- critical mutation execution receipt
- event type/replay/duplicate contract

실제 cross-project backfill에서 Admin의 `CANCELLED` stable error 의미가 Core error registry에 빠져 있음을 발견했다.
C-P1에서 `CANCELLED`를 공통 error family로 추가했다.

## 4. FreePass Sales

Revision:
`fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`

핵심 판정:
- CORE_MATCH: 2
- MIGRATE: 13
- D-owned: 1
- N/A: 8

Sales는 Core보다 구조적으로 뒤처진 부분이 많지만, 두 가지 실제 운영 패턴은 강하다.

### 이미 채택할 패턴
- Firestore server truth vs local recovery cache
- work-key scoped idempotent save

### Core가 Sales에서 다시 배운 것
외부 action의:
- REQUESTED
- LAUNCHED
- SERVER_COMMITTED
- BUSINESS_CONFIRMED

는 같은 뜻이 아니다.

이 차이는 업무 Workflow state를 새로 정의하자는 뜻이 아니라 **실행 증거의 관측 단계**를 남겨야 한다는 뜻이다.

그래서 C-P1에서 `core-receipt/v1`에 optional `milestones[]`를 추가했다.

Sales의 녹음 storage처럼 evidence artifact가 append-only여야 하는 패턴도 기존 Core receipt/evidence 원칙과 정합한다.

## 5. FreePass Estimate

검증 branch:
`work/ui-baseline`

Revision:
`8df0fdfe5ce72ffbc17b3adffcc881c37164ed3a`

핵심 판정:
- CORE_MATCH: 10
- MIGRATE: 5
- ADAPTER_ONLY: 1
- N/A: 8

4개 중 **Engine/Adapter/Provider/Snapshot이 가장 앞선 프로젝트**다.

이미 Core와 일치:
- semantic contract IDs
- Engine owns meaning
- Adapter owns provider field/unit/error translation
- fail-closed authoritative provider
- execution revision/evidence
- fixed share snapshot
- no silent fallback
- stable provider error taxonomy

### 현재 SHADOW
`core.adapter-result.v1`

Artifact:
- `registry/adoption/freepass-estimate-quote-execution.fixture.json`
- `test/core-contract-cross-project-adoption.test.mjs`

실제 `freepass-quote-execution/v1` shape를 Core adapter result로 shadow projection해 HOLD/provider/evidence 의미를 보존하는지 검증한다.

### Estimate가 Core에 준 보강
authoritative provider가 channel/profile에 따라 달라질 수 있다.

그래서 `core-source-registry/v1`에 optional `authority_scope[]`를 추가했다.

Core는 여전히 한 registry instance 안에서 canonical authority 하나만 허용하지만,
그 권한이 적용되는 project/environment/channel/profile 범위를 명시할 수 있다.

## 6. C-P1에서 Core가 실제로 배운 것

이번 cross-project adoption은 프로젝트에 규격을 일방 적용한 작업이 아니다.

실제 backfill로 Core 자체도 다음을 보강했다.

1. **Scoped source authority**
   - Estimate 근거
   - `core-source-registry/v1.authority_scope[]`

2. **Execution evidence milestones**
   - Sales 근거
   - `core-receipt/v1.milestones[]`

3. **Stable CANCELLED error**
   - Admin 근거
   - `registry/core-error-codes.json`

이 세 변경은 모두 additive이며 provider/business-specific 값을 Core에 직접 넣지 않는다.

## 7. 다음 적용 순서

### 1순위 — Estimate
- quote execution → Core adapter result shadow를 프로젝트 verify command에도 붙임
- source/provider authority scope instance
- Core receipt input/output digest 연결
- SHADOW → VALIDATED

### 2순위 — ERP4
- current ERP5 product source registry shadow 유지
- fixed snapshot → Core snapshot
- supplier ingest pipeline → Core data-pipeline (`BEST_EFFORT_BATCH`)
- partial-success 가능한 supplier write에 durable PARTIAL/FAILED receipt
- publish/write receipt
- API error/request context
- SHADOW → VALIDATED

### 3순위 — Admin
- Engine/Port/Adapter contract instance 생성
- AppError mapping table
- production adapter binding profile
- persistence/auth가 붙을 때 Core receipt/idempotency를 선행 조건으로 적용

### 4순위 — Sales
대규모 리라이트 금지.

먼저 딱 한 경계:
`통화/문자/저장 중 하나의 write boundary`

에서:
- request context
- stable error
- event
- receipt milestones

를 shadow 적용한 뒤 모듈화를 진행한다.

## 8. 금지

- CORE_MATCH를 곧 CUTOVER로 해석하지 않는다.
- 프로젝트의 좋은 패턴을 없애고 Core 모양만 맞추지 않는다.
- provider-specific error/mapping을 Core code set에 박지 않는다.
- Workflow state 의미를 C가 가져오지 않는다.
- UI label/interaction을 C data contract로 만들지 않는다.
- production proof 없이 VALIDATED/CUTOVER를 선언하지 않는다.

## 9. 현재 결론

P0는 “본사 계약”을 만들었다.

P1부터는 다음 순환으로 간다.

```
Project evidence
  → C classification
  → Core gap 발견
  → generalize
  → additive Core improvement
  → SHADOW artifact
  → contract test
  → project adoption
```

이 루프가 AI Core가 프로젝트를 일방적으로 덮는 방식이 아니라,
**각 프로젝트의 실제 우위를 다시 AI Core 정본으로 흡수하면서 전체 시스템을 수렴시키는 방식**이다.


## 10. ERP4 실제 writer 재감사

2026-09-19 current main `44a67cedc5f0d3e38efc68f1e8f84e6c28ab97b3` 재확인 결과:

- current main의 `scripts/ingest-all-suppliers.mts`는 **SSOT HARD GUARD**이며 production writer가 아니다.
- 실제 production workflow `.github/workflows/erp5-ssot-refresh.yml`는 검증 엔진 `cf940df642edf315adbc6da2b4134fbad53da160`을 pin한다.
- pinned engine의 `ingest-all-suppliers.mts`는 전체 source preflight 후 supplier별 sequential apply를 수행한다.
- apply 단계에서는 한 supplier write가 실패해도 이미 성공한 앞 supplier write가 남을 수 있다.
- 따라서 전역 ATOMIC으로 선언하면 거짓이다.

이 실제 동작 때문에 Core `core-data-pipeline/v1`에 다음을 추가했다.

- `commit_policy = BEST_EFFORT_BATCH`
- `partial_failure_policy = ALLOW_PARTIAL_WITH_RECEIPT`

그리고 ERP4 `core.data-pipeline.v1` 평가는 `CORE_MATCH`에서 `MIGRATE/P0`로 정정했다.

이건 ERP4를 나쁘다고 평가한 것이 아니라, **실제 운영 의미를 Core가 충분히 표현하지 못했던 공백을 발견한 것**이다.


## 11. Application Service contract backfill

FreePass Admin 실제 구조를 대입하면서 Core의 누락을 확인했다.

기존 Core는:
```
Domain Engine
  -> Port
  -> Adapter
```
를 기계 계약으로 갖고 있었지만, 실제 프로젝트가 반복해서 사용하는:
```
Domain Engine
  -> Application Service
  -> Port
  -> Adapter
```
중 **Application Service**가 문서에만 있고 machine contract가 없었다.

그래서 `core.application-service.v1`을 추가했다.

소유 의미:
- use-case orchestration
- required ports
- actor requirement
- idempotency requirement
- transaction boundary request
- service-level stable errors
- verification profile

금지:
- Domain 규칙을 Service로 끌어올리기
- provider 기술명을 Service 의미로 만들기
- UI rendering 소유

첫 adoption 판정:
- FreePass Admin: CORE_MATCH / P0
- FreePass Estimate: CORE_MATCH / P1
- ERP4: MIGRATE / P1
- Sales: MIGRATE / P1

Binding Profile에는 optional `service_bindings`를 additive하게 추가했다.

## 12. Logical Execution Identity backfill — 2026-09-20

D의 recovery no-replay pilot가 요구하는 공통 전제조건을 C가 별도 계약으로 일반화했다.

추가:
- `core.execution-identity.v1`
- `contracts/core-execution-identity.schema.json`
- `src/contracts/execution-identity.mjs`
- 기존 Request / Adapter Result / Receipt / Event의 optional `execution` binding

경계:
- C는 동일 logical execution과 attempt identity만 정의한다.
- D는 fallback/retry/recovery eligibility와 replay 금지 의미를 계속 소유한다.
- 현재 4개 프로젝트는 모두 `MIGRATE / NONE`으로 시작하며 실제 프로젝트 revision 검증 전에는 SHADOW/VALIDATED로 올리지 않는다.
- ERP4는 recovery pilot의 직접 선행조건이므로 P0, Admin/Sales/Estimate는 P1로 기록한다.

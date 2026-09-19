# AI Core Core Contract Migration Guide

상태: **CANONICAL MIGRATION POLICY — C session**

## 목적

기존 프로젝트를 한 번에 재작성하지 않고 AI Core Core Contract로 안전하게 수렴시킨다.

## 기본 원칙

1. 현재 운영 의미를 먼저 관측한다.
2. provider/local convention을 바로 삭제하지 않는다.
3. 새 Core contract를 SHADOW로 생성해 기존 결과와 비교한다.
4. 의미가 같은지 contract test로 증명한다.
5. write path는 idempotency + receipt가 준비된 뒤 전환한다.
6. cutover 뒤 legacy fallback은 자동으로 남기지 않는다.
7. rollback은 old path 재활성화가 아니라 revision-bound migration plan으로 수행한다.

## 표준 migration 단계

### 1. INVENTORY

현재 프로젝트의 local ID/provider key, status/enum/code, date/time, 금액·퍼센트 단위, raw field, parser/normalizer/mapper, API error, idempotency, event/audit, receipt/evidence, source priority/fallback을 찾는다.

### 2. CLASSIFY

- **CORE_MATCH**: 이미 Core 의미와 같음
- **ADAPTER_ONLY**: provider 특이사항이므로 Adapter에 남김
- **MIGRATE**: Core contract로 변경 필요
- **D_OWNED_WORKFLOW**: 상태전이 의미이므로 D 규격으로 이동
- **B_OWNED_PRESENTATION**: UI label/format이므로 B 규격으로 이동
- **LEGACY_RETIRED**: 더 이상 호출되면 안 됨

### 3. SHADOW

기존 결과를 유지하면서 Core envelope/schema를 병행 생성한다.

- 기존 adapter result → `bridgeLegacyAdapterResult()` → `core-adapter-result/v1`
- 기존 amount → canonical minor unit + currency
- provider ratio 0.1 → canonical percentage 10
- 기존 string error → 명시적 mapping table을 거쳐 stable Core code
- 기존 event → `core-event/v1` shadow envelope

### 4. VALIDATE

최소 검증:
- schema validation
- semantic validator
- old vs Core result equivalence
- duplicate/idempotency negative test
- stale revision conflict test
- provider failure mapping
- evidence/receipt presence
- no silent fallback

### 5. CUTOVER READ

canonical read owner를 Core contract 쪽으로 전환한다. 이 시점에도 write owner는 별도일 수 있다.

### 6. CUTOVER WRITE

다음 조건이 모두 충족될 때만 write를 전환한다.

- canonical writer가 하나
- request idempotency 적용
- expected revision/concurrency 적용
- structured error mapping
- execution receipt
- rollback/compensation ownership 명확
- D workflow transition과 충돌 없음

### 7. RETIRE

- legacy write 차단
- fallback 자동 진입 차단
- old type/status/API 신규 사용 금지
- migration telemetry 확인 후 코드 제거

## 패턴별 판정

| 기존 패턴 | C 표준 |
|---|---|
| row number / display label을 PK로 사용 | stable opaque `*_id` |
| `amount: 500000.5` | `{amount_minor, currency}` |
| provider percent `0.1`이 Core까지 노출 | Adapter에서 `10` percentage points로 변환 |
| timezone 없는 timestamp | RFC3339 timezone 포함 |
| `{error:"lock_conflict"}` | `core-error/v1` + stable error code |
| POST retry 시 중복 생성 가능 | `core-request-context/v1` idempotency |
| source fallback 자동 전환 | `core-source-registry/v1` explicit-only fallback |
| raw row를 바로 business model로 사용 | Raw → Parser → Normalizer → Core |
| event마다 envelope가 다름 | `core-event/v1` |
| producer만 있고 consumer/replay 정책 없음 | `core-event-type-contract/v1` |
| 실행 성공이라고 로그 한 줄만 남김 | `core-receipt/v1` |
| provider field/unit이 Engine에 존재 | Adapter로 이동 |
| UI가 저장 무결성 책임 | Repository/Application boundary로 이동 |
| 프로젝트 status enum이 workflow를 소유 | D 세션으로 이동 |

## AI Core 자체 legacy

현재 `src/engine/adapter-contract.mjs`와 `ai-core-work-result/v1`은 즉시 삭제하지 않는다.

- adapter result는 bridge를 통해 shadow 검증한다.
- `ai-core-work-result/v1`은 Work runtime domain result로 유지한다.
- 신규 범용 integration은 `core-result/v1` + `core-receipt/v1`을 우선한다.
- 기존 Work lifecycle state는 D가 별도 parity 검증할 때까지 C가 재정의하지 않는다.

## 완료 기준

- canonical owner/writer/source priority가 명시됨
- ID/time/money/null/version contract 준수
- provider 특이사항이 Adapter 밖으로 새지 않음
- API error/idempotency/revision contract 준수
- event type과 replay/duplicate policy 등록
- 중요한 write에 receipt/evidence 존재
- migration 이후 legacy fallback이 default path가 아님
- contract tests가 CI에서 통과

## 현재 Shadow Pilot

AI Core 자체의 실제 builtin 두 경로를 첫 pilot으로 사용한다.

- `core.brief`: 실제 SUCCEEDED 결과를 canonical adapter result로 shadow projection
- `work.projection`: provider가 없을 때 실제 HOLD/blocker 의미를 canonical issues로 shadow projection

두 경로 모두 기존 runtime authority와 `ai-core-work-result/v1`을 변경하지 않고 비교 검증한다. 이 pilot이 통과해야 다음 프로젝트 adapter를 동일 방식으로 migration한다.

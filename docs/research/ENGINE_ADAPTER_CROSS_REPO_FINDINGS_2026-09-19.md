# Engine / Adapter Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_CORE_CONTRACT / NOT_CANONICAL**

## 목적

C 세션의 Engine / Adapter Standard에 실제 프로젝트에서 검증된 패턴과 반례를 공급한다.
이 문서는 canonical contract를 선언하지 않는다.

## 비교 대상

- FreePass Admin
- FreePass ERP4
- Welrix Table
- AIOps
- JPK ERP5

## 1. 가장 명확한 공통 층

실제 프로젝트를 대조하면 다음 분리가 가장 재사용성이 높다.

```text
UI / Consumer
  ↓
Application Service
  ↓
Domain Engine
  ↓
Port
  ↓
Adapter / Repository
  ↓
Connector / External System
```

### Domain Engine
소유:
- 업무 의미
- 계산
- validation/invariant
- 상태 전이
- canonical unit
- snapshot 의미

금지:
- Firebase SDK
- raw HTTP
- React state
- supplier raw field 이름
- provider credential

### Application Service
소유:
- use-case 실행 순서
- 여러 engine 조합
- idempotency orchestration
- auth/actor requirement
- transaction boundary 요청
- 결과/error mapping

### Port
소유:
- Domain/Service가 요구하는 **기술중립 의미 계약**

좋은 이름:
- `ApplicationRepository`
- `QuoteProvider`
- `AuditSink`

나쁜 이름:
- `FirestoreApplicationRepositoryPort`
- `GoogleSheetQuotePort`

### Adapter
소유:
- 외부 필드 매핑
- 단위 변환
- provider-specific rule translation
- Port 구현
- source provenance
- 외부 오류를 stable internal error로 변환

Adapter가 새 업무 의미를 만들면 안 된다.

### Repository
소유:
- persistence
- uniqueness
- atomicity
- optimistic/pessimistic concurrency
- storage-level idempotency
- transaction

### Connector
소유:
- HTTP/DB/API transport
- auth transport
- timeout/retry primitive
- serialization

Connector는 업무판정을 하지 않는다.

## 2. FreePass Admin에서 배울 것

Admin의 `BACKEND-BOUNDARIES.md`는 가장 깨끗한 층 경계를 갖는다.

실전적으로 앞선 부분:
- Domain → Service → Port → Adapter/Repository
- write idempotency를 UI가 아닌 저장소 경계에서 보장
- sequence + duplicate check + create를 하나의 atomic operation으로 묶음
- aggregate mutate를 read→write로 분리하지 않음
- typed AppError
- snapshot/version conflict를 명시적으로 처리
- actor/audit 경계

Core 후보:
- repository mutation contract
- idempotency key contract
- typed/domain error contract
- immutable fields invariant
- version mismatch contract

## 3. ERP4에서 배울 것

ERP4 Supplier Adapter는 **source provenance**가 가장 강하다.

좋은 패턴:
- `AtomSource`
- `adapterVersion`
- field별 `sourceHeader / sourceValue / transformation`
- 공급사별 raw 의미를 canonical atom으로 변환
- 기간 + 주행거리처럼 축이 더 있는 가격을 억지로 단일값으로 축소하지 않음
- 계산된 보증금도 숫자만 저장하지 않고 policy 자체를 원자로 보존

특히 중요:

```text
raw row
  ↓
adapter
  ↓
canonical atom + provenance + issues
```

Adapter 결과는 성공/실패 2값이 아니라:
- canonical candidate
- issues[]
- review_required

형태가 유리하다.

## 4. Welrix에서 배울 것

가장 좋은 사례는 **canonical unit과 provider unit 분리**다.

예:
- Core 보증금 비율 = `10` (%)
- Provider body = `0.1`

변환 위치는 Adapter.

또한 authoritative provider 장애 시 임의 fallback 금지.

공통 후보:
- provider identity
- adapter version
- request contract version
- authoritative/fallback policy
- timeout/retry policy
- result cardinality validation
- provider health state

## 5. AIOps에서 배울 것

공용 mechanism 후보:
- lease/mutex
- atomic stream write
- canonical reconcile
- connector/cache
- source registry
- work coordination ledger

그러나 과태료/미수/자금 같은 업무 의미는 AIOps local domain에 남긴다.

**공통화 단위는 파일이 아니라 capability contract다.**

## 6. JPK ERP5에서 배울 것과 반례

좋은 점:
- contract action helper로 auth/closed-period/optimistic lock/audit을 한 문으로 모음
- optimistic lock conflict를 409로 표현
- transition/domain helper 분리
- safeUpdate로 UI error handling 진입점 통일

반례:
- API error가 `error: "already done"`, `error: "lock_conflict"` 등 문자열 중심
- 일부 사용자 메시지와 machine code 경계가 불완전
- contract mutation 성공 후 vehicle sync 실패가 별도 audit만 남고 aggregate consistency는 깨질 수 있음
- client audit가 fire-and-forget이라 audit 실패가 write 성공과 분리됨

Core Standard는 이를 그대로 복제하지 말고:
- stable error code
- atomic/outbox/saga consistency policy
- audit criticality level
- partial-success contract

를 명시해야 한다.

## 7. Adapter 공통 인터페이스 후보

```ts
type AdapterContext = {
  sourceId: string
  sourceRevision?: string
  observedAt: string
  adapterVersion: string
  correlationId: string
}

type AdapterIssue = {
  code: string
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKING'
  field?: string
  sourcePath?: string
  message?: string
}

type AdapterResult<T> = {
  status: 'READY' | 'REVIEW_REQUIRED' | 'REJECTED'
  value?: T
  issues: AdapterIssue[]
  provenance: Record<string, unknown>
}
```

주의:
- 이것은 후보 shape.
- C 세션이 canonical schema를 최종 결정한다.

## 8. Import / Export 표준 후보

Import:
1. raw immutable snapshot
2. parse
3. normalize
4. validate
5. identity resolve
6. issue classification
7. preview/review
8. atomic commit
9. audit/result receipt

Export:
1. canonical read
2. revision pin
3. projection mapping
4. privacy filtering
5. render/serialize
6. output checksum/revision
7. delivery proof는 별도

## 9. 핵심 불변조건 후보

- Domain은 provider raw field를 모른다.
- Adapter는 canonical 의미를 바꾸지 않는다.
- Connector는 업무판정을 하지 않는다.
- UI는 persistence 무결성을 책임지지 않는다.
- authoritative provider 실패를 임의 계산으로 숨기지 않는다.
- unknown/ambiguous source를 조용히 추측하지 않는다.
- Adapter version과 source revision을 결과 evidence에 남긴다.
- write retry는 idempotency contract를 가져야 한다.

## 10. C 세션에 넘길 P0

1. Engine contract
2. Port contract
3. Adapter contract
4. Repository transaction/idempotency contract
5. Connector contract
6. AdapterResult + issue taxonomy
7. Source provenance
8. Provider authority/fallback
9. Import pipeline
10. Partial success / consistency policy

## 한 줄 결론

> **공통화해야 하는 것은 공급사별 코드가 아니라 “업무 의미는 Engine이, 연결 차이는 Adapter가, 전송은 Connector가, 무결성은 Repository가 책임진다”는 경계와 증거계약이다.**

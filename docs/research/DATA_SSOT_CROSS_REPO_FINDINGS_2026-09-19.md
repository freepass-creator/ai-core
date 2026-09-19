# Data / SSOT Cross-Repo Findings — A 세션 — 2026-09-19

상태: **INPUT_TO_CORE_CONTRACT / NOT_CANONICAL**

목적:
- C 세션(Core Contract Standard)에 기존 프로젝트의 실제 우위와 실패사례를 공급한다.
- 이 문서는 canonical schema를 선언하지 않는다.
- 공통화할 원칙과 프로젝트 고유 의미를 분리한다.

## 1. 이번 비교 대상

- FreePass ERP4
- FreePass Admin
- FreePass Sales
- AIOps
- JPK ERP5
- Welrix Table
- Vehicle Master

## 2. 가장 강하게 반복된 공통 원칙

### 2.1 Canonical owner는 하나

ERP4에서 가장 강하게 검증된 규칙:

```text
Source
  ↓
Parser / Adapter / Normalizer
  ↓
Canonical SSOT
  ↓
Versioned Snapshot / Projection
  ↓
Consumer Apps
```

금지:
- downstream sheet/json/ui가 canonical을 역으로 덮어쓰기
- 장애 시 legacy store를 조용히 정본처럼 fallback
- 같은 업무 사실을 여러 DB가 동시에 소유

Core Contract 후보:
- `canonical_owner`
- `canonical_writer`
- `source_registry`
- `projection_of`
- `snapshot_revision`
- `freshness_policy`

### 2.2 Source fact와 normalized fact를 분리

AIOps/ERP4 공통 교훈:

- 원문은 보존
- 파싱/정규화 결과는 별도
- 사람이 정정한 값과 원문을 섞지 않음
- “어디서 온 값인지”를 field/record 수준에서 추적

공통 후보:
```text
raw_source
normalized_value
source_ref
source_revision
observed_at
confidence / verification_state
normalizer_version
```

### 2.3 ID는 표시값이 아니라 영구 의미키

ERP4 `trim_row_key`가 강한 사례다.

규칙:
- 행번호/정렬순서로 ID 생성 금지
- 기존 ID 재사용 금지
- 의미가 달라지면 기존 ID 수정 대신 retire/exclude + 새 ID
- display label 변경과 identity 변경을 분리
- stable ID로 downstream 연결

Core 후보:
- opaque/stable ID
- human-readable code는 별도
- mutable display label을 PK로 사용 금지
- legacy key는 Adapter에서 canonical ID로 매핑

### 2.4 삭제보다 lifecycle / retirement

ERP4 vehicle master, Admin cancel, JPK data 모두 같은 방향.

- 사용중인 ID/record를 물리삭제하지 않음
- `EXCLUDED / CANCELLED / RETIRED / DELETED_AT` 같은 lifecycle 표현
- correction/history를 남김

단, 실제 개인정보 보존/삭제는 별도 privacy retention 규칙을 따른다.

### 2.5 Snapshot은 “그때 본 값”을 보존

Admin application snapshot, ERP4 fixed publish snapshot, Quote snapshot이 반복된다.

사용처:
- 견적
- 접수
- 계약
- 배포
- 공개 catalog
- 정산

공통 envelope 후보:
```json
{
  "snapshot_id": "...",
  "subject_id": "...",
  "subject_revision": "...",
  "source_revision": "...",
  "schema_version": "...",
  "created_at": "...",
  "payload": {}
}
```

### 2.6 Current state와 event/history를 분리

AIOps event ledger, Admin audit history, JPK lifecycle에서 반복.

- current record = 현재 조회용
- event/history = 왜 그렇게 됐는지
- state를 history 대신 덮어쓰기만 하지 않음

Core 후보:
- current projection
- append-only event/history
- correction event
- actor/source/revision

## 3. 상태값에 대한 중요한 발견

JPK ERP5는 VehicleStatus 하나에 모든 의미를 몰아넣었을 때 복잡해졌고, 이후:

- 준비축
- 계약/판매축

으로 나눠 파생 상태를 만들었다.

이건 Core Contract에서 매우 중요하다.

### 금지 후보

```text
vehicle.status = AVAILABLE | SOLD | ACTIVE | CONTRACTED | READY | ...
```

하나의 enum에 서로 다른 차원의 의미를 다 넣는 방식.

### 권장 후보

```text
vehicle.lifecycle_stage
vehicle.availability
vehicle.contract_state
vehicle.condition_state
vehicle.disposition_state
```

그리고 화면용 headline은 파생한다.

즉:
**상태는 가능하면 orthogonal axes → derived display state**

C 세션에서 상태 enum을 만들 때 반드시 Workflow 세션과 같이 검토해야 한다.

## 4. 날짜 / 금액 / 통화

기존 리포의 혼란을 줄이기 위한 공통 후보:

### 날짜
- machine contract: ISO 8601
- 날짜만: `YYYY-MM-DD`
- 시각: timezone 포함 timestamp
- display formatting은 locale/profile
- `created_at`과 business effective date를 구분

### 금액
- 통화코드와 금액 의미를 분리
- KRW-only 내부라도 contract에는 단위 명시
- 퍼센트는 `10`인지 `0.1`인지 canonical 의미를 고정
- provider 전용 단위변환은 Adapter 안에서만

### null
- `null` / absent / zero / empty string 의미를 구분
- “모름”을 0이나 ""로 저장하지 않는다

## 5. Master와 Transaction을 분리

반복 관측:

### Master
- 차량/차종
- 고객
- 공급사/회사
- 정책
- 사용자/조직

### Transaction / Aggregate
- 견적
- 접수
- 계약
- 정산
- 통화
- 입금
- 이벤트

Core Contract 후보:
- master ID는 stable
- transaction은 당시 master snapshot/reference를 명시
- master 수정이 과거 transaction 의미를 조용히 바꾸지 않음

## 6. Canonical Model에 넣지 말아야 하는 것

프로젝트별 업무 의미를 중앙에 강제하지 않는다.

예:
- 특정 공급사 원본 필드명
- Welrix API body
- 손오공 전용 상태명
- 특정 시트의 컬럼명
- UI display label
- 임시 migration flag

이건 Adapter / Product Profile 소유.

## 7. C 세션에 넘길 우선 계약

### P0
1. Entity Identity Contract
2. Canonical Owner / Writer Contract
3. Source Provenance Contract
4. Date / Time / Money / Percentage Contract
5. Null / Unknown Semantics
6. Snapshot / Revision Envelope
7. Master vs Transaction boundary
8. Current State vs Event History

### P1
9. Status Axis Contract
10. Soft-delete / Retirement / Cancellation
11. Schema Version / Migration
12. Projection / Cache / Freshness
13. Dedup / Idempotent Import
14. Cross-system canonical-id mapping

## 8. 프로젝트별 우위

### ERP4
- canonical writer one-way boundary
- fixed snapshot
- no legacy fallback
- stable vehicle trim key
- projection freshness contract

### Admin
- typed domain model
- immutable application snapshot
- repository-level idempotency
- actor/audit history
- aggregate invariants

### AIOps
- source evidence / atom / projection separation
- append-only/correction thinking
- canonical registry mechanics
- unknown을 숨기지 않음

### JPK ERP5
- multi-axis state derivation
- explicit transition checklist
- VIN/plate history identity thinking
- customer deterministic dedup

### Sales
- server truth vs local recovery
- stable work key
- completion semantics

### Welrix
- canonical business unit vs provider unit
- snapshot/share continuity

## 9. 핵심 결론

> **Data Standard의 핵심은 필드 이름을 똑같이 만드는 것이 아니다. “누가 이 사실을 소유하는가, 어떤 ID로 같은 대상을 가리키는가, 원문과 정규화값이 어떻게 연결되는가, 과거 시점의 의미가 어떻게 보존되는가”를 통일하는 것이다.**

C 세션은 이 원칙을 schema/JSON contract로 정본화하고, A 세션은 계속 각 repo에서 반례와 더 나은 구현을 찾아 공급한다.

# Engine / Port / Adapter Architecture v0.1

상태: RESEARCH_CANDIDATE

## 목적

개발센터의 기능·엔진·외부연결이 이름만 비슷한 파일 묶음이 되지 않도록 **업무 의미, 실행 로직, 외부 시스템 연결, 프로젝트별 배선**을 분리한다.

현재 DevCenter에는 `engine/`이 “operations 절차를 실행하고 run 상태를 관리하는 공통 실행기 자리”로 정의돼 있고 아직 구현되지 않았으며, `capabilities/integrations`는 외부 API·데이터 연결 계약과 어댑터 자리로 정의돼 있다. 따라서 지금 가장 먼저 필요한 것은 코드를 옮기는 일이 아니라 **용어와 계약을 고정하는 것**이다.

## 핵심 구분

### 1. Engine

업무 의미나 계산·상태전이·검사 규칙을 수행하는 재사용 가능한 핵심 로직.

예:
- 장기렌터카 가격 계산
- 계약 상태 전이
- 접수 유효성 검사
- 문서 요구사항 대조

원칙:
- 프로젝트 경로, DB 제품명, API transport를 직접 알지 않는다.
- 입력/출력/불변조건/error model이 계약으로 고정된다.
- side effect는 기본 금지. 필요한 경우 명시적인 Port를 통해서만 요청한다.
- engine version과 source revision을 분리해서 기록한다.

### 2. Port

Engine이 외부 세계에 요구하거나 외부가 Engine에 제공해야 하는 **추상 계약**.

예:
- `vehicle.read`
- `quote.write`
- `clock.now`
- `document.render`
- `notification.send`

Port는 공급자 이름이 아니다. `firestore.read`가 아니라 `vehicle.read`처럼 **업무 의미**를 먼저 표현한다.

### 3. Adapter

Port를 특정 프로젝트·저장소·DB·API·UI 환경에 연결하는 변환층.

예:
- `vehicle.read` → Firestore 차량 컬렉션
- `vehicle.read` → Google Sheet 차량 마스터
- `quote.write` → 특정 ERP API

Adapter가 책임지는 것:
- field mapping
- unit/format conversion
- provider-specific error mapping
- retry / timeout / idempotency
- auth/permission boundary
- data classification
- health check

Adapter가 하면 안 되는 것:
- Engine의 업무 규칙 재정의
- 가격 계산식이나 상태 전이를 provider 편의에 맞춰 변경
- 검증되지 않은 fallback으로 의미를 바꿈

### 4. Connector

HTTP, DB SDK, GitHub, Gmail, Sheets 등 **transport/provider 접속 자체**를 담당하는 저수준 클라이언트.

Connector는 업무 의미를 모른다. Adapter가 Connector를 사용해 Port 의미를 구현한다.

`Engine → Port → Adapter → Connector → External System`

### 5. Binding Profile

특정 프로젝트/환경에서 어떤 Engine의 어떤 Port에 어떤 Adapter를 꽂는지 선언하는 revision-bound 배선표.

예:
- Project: freepasserp
- Engine: `rental.quote.v2`
- `vehicle.read` → `adapter.firestore.vehicle.v1`
- `quote.write` → `adapter.freepass-api.quote.v1`

Profile은 설정/포인터이고 원본 데이터나 업무 규칙을 복제하지 않는다.

### 6. Runtime / Orchestrator

여러 Engine과 Adapter를 순서대로 조합하고 run 상태·증거·오류·재시도를 관리한다.

중요: DevCenter의 현재 `engine/` 디렉터리가 설명하는 “공통 실행기”는 이 문서의 **Runtime/Orchestrator**에 가깝다. 따라서 향후 실제 구현 전에는 이름 충돌을 해소해야 한다. 지금 파일 이동은 하지 않는다.

---

## 제안 구조

논리 구조:

```text
DevCenter
├─ contracts/
│  ├─ engines/
│  ├─ ports/
│  └─ adapters/
├─ capabilities/
│  ├─ engines/
│  ├─ adapters/
│  ├─ connectors/
│  └─ shared/
├─ bindings/
│  └─ project profiles
├─ runtime/
│  └─ orchestration / run-state
└─ quality/
   └─ engine / adapter / binding verification
```

이것은 목표 토폴로지다. 기존 DevCenter 파일을 즉시 이동시키는 안이 아니다.

## 계약

### Engine Contract

필수 의미:
- stable engine id
- semantic version
- source pointer + revision
- input/output schema refs
- invariants
- required ports
- side-effect declaration
- error model
- verification profile
- applicability / non-applicability

### Adapter Contract

필수 의미:
- stable adapter id
- implemented port id
- provider/project scope
- compatible engine/port versions
- field/unit mapping
- side effects
- idempotency semantics
- retry/timeout policy
- auth boundary
- data classification
- failure mapping
- health-check path
- source pointer + revision
- verification profile

### Binding Profile

필수 의미:
- project/environment
- subject revision
- engine ids/versions
- port → adapter selection
- config/secret refs (값 자체 금지)
- required approvals
- verification state

---

## 해석/선택 규칙

1. 같은 semantic capability에 authoritative Engine이 둘이면 HOLD.
2. 하나의 Port에 Adapter 후보가 여러 개 존재하는 것은 허용. 실제 실행은 Binding Profile이 하나를 선택한다.
3. Adapter가 요구 의미를 바꾸는 mapping을 갖고 있으면 FAIL/HOLD.
4. Engine version이 바뀌어 Port contract가 달라지면 기존 Adapter compatibility는 자동 상속하지 않는다.
5. Adapter source revision이 바뀌면 기존 adapter verification receipt는 stale.
6. Binding Profile revision이 바뀌면 이전 end-to-end proof는 stale 가능성이 있다.
7. Connector 교체는 Adapter contract가 유지되고 동일 검증을 통과할 때만 transparent replacement로 본다.

---

## 검증 계층

### Engine verification
- pure input/output cases
- invariant tests
- state-transition tests
- edge/error cases
- deterministic/repeatability where applicable

### Adapter verification
- contract fixtures
- mapping correctness
- unit/format conversion
- permission failure
- timeout/retry
- idempotency
- provider error → domain error mapping
- no unintended side effects

### Engine + Adapter integration
- selected Port behavior
- schema compatibility
- failure propagation
- transaction/consistency behavior

### Binding verification
- all required Ports resolved
- no duplicate/conflicting authoritative binding
- environment/config refs available
- current source revisions match proof

### Runtime proof
- actual selected engine/adapter revisions
- executed checks
- run logs
- failures/skips
- external side-effect state

---

## 개발 경험과의 연결

Development Runtime의 Project Capsule에는 다음이 들어갈 수 있다.
- available engines
- required ports
- active binding profile
- adapter health
- stale bindings

Change Compiler는 요구사항을 보고 필요한 Engine/Port를 찾는다.
Impact Planner는 Engine 변경인지 Adapter 변경인지 분리한다.
Proof Bundle은 Engine proof / Adapter proof / Binding proof를 구분한다.

이렇게 되면 사용자는 “Firestore로 연결해”, “Sheets로 바꿔” 같은 provider 수준 요구를 하더라도 실제 업무 규칙을 다시 만들 필요가 없다.

---

## 중요한 설계 원칙

> Engine은 **무엇이 맞는가**를 책임지고, Adapter는 **어떻게 연결하는가**를 책임진다.

> Connector는 **어떻게 통신하는가**를 책임지고, Runtime은 **어떤 순서와 상태로 실행하는가**를 책임진다.

이 네 책임이 섞이면 재사용·검증·교체·롤백이 모두 어려워진다.

## 기존 DevCenter에 대한 제안

현재 `engine/`은 공통 실행기 자리이고 `capabilities/integrations`는 adapter 자리다. 당장 디렉터리를 이동하지 말고 먼저:

1. Engine / Runtime 용어를 문서로 구분.
2. Engine Contract / Adapter Contract / Binding Profile 규격을 후보로 등록.
3. 실제 기존 기능 하나를 골라 Engine과 Adapter를 분해하는 Shadow Pilot 수행.
4. 효과 확인 후 `capabilities/engines`, `capabilities/adapters`, `bindings`, `runtime` 물리 구조를 채택할지 결정.

첫 Pilot은 외부 저장소/DB와 결합된 기능이 적합하다. 동일 Engine을 두 Adapter(예: mock/in-memory + 실제 provider)로 실행해 결과 의미가 유지되는지 비교한다.

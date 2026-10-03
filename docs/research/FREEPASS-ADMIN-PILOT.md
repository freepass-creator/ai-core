# Backend Architecture Candidate — FreePass Admin Pilot

- 상태: `CANDIDATE / SECOND-PROJECT-EVIDENCE_REQUIRED`
- 원천: `freepass-creator/freepass-admin`
- 기준일: 2026-09-19
- 목적: 실제 제품에서 검증된 Backend boundary를 DevCenter 공통 규격 후보로 학습한다.
- 주의: 이 문서는 전사 표준 승인이 아니다. 두 번째 실제 프로젝트 적용·검증 전에는 candidate다.

## 1. 검증 중인 구조

```text
UI
 ↓
Application Service
 ↓
Domain Engine
 ↓
Port
 ↓
Adapter / Repository
 ↓
DB / External System
```

### 책임 분리
- Domain: 업무 의미, 불변조건, 상태 전이
- Service: use case 실행 순서
- Port: 의미 단위 추상 계약
- Adapter: 외부/공급사/저장소 차이
- Repository: persistence, atomicity, concurrency, idempotency
- Connector: HTTP/DB/API transport
- Runtime: 실행 상태, retry, proof, orchestration

## 2. FreePass Admin에서 실제로 강화된 항목

### Atomic application create
접수번호 발번, submissionId 중복 확인, 저장을 Repository의 한 원자 작업으로 묶었다.

운영 Adapter 요구사항:
- transaction 또는 동등한 atomic primitive
- duplicate idempotency key 재사용 시 기존 결과 반환
- 사람이 읽는 번호의 유일성 보장

### Atomic aggregate mutation
진행상태/취소는 `get → update`가 아니라 Repository 내부 원자 mutation을 사용한다.

목적:
- 동시에 들어온 서로 다른 상태 변경의 lost update 방지
- 취소/진행 변경 경쟁 시 저장소의 최신 상태 기준 판정

### Actor-backed audit history
Application aggregate에 최소 감사 이력을 저장한다.

현재 이벤트:
- APPLICATION_CREATED
- APPLICATION_PROGRESS_CHANGED
- APPLICATION_CANCELLED

각 이벤트에:
- occurredAt
- actor
- semantic delta/reason
을 남긴다.

### Four-fact progress
접수 진행 사실은:
- 계약서
- 필수서류
- 잔금
- 인도

상태 문자열과 사실 체크를 분리한다.

### Immutable snapshot semantics
Application Snapshot은 Product version과 선택 Offer를 보존하며 MULTI_SELECT 배열까지 깊은 복사해 원 상품 변경이 과거 접수에 전파되지 않게 한다.

### Typed error + aggregate invariants
최신 검증 baseline은 `3f1812c6968f57494c1e8204e7a67d54e1c1f3ea`다.

GitHub Actions run `35437766677`에서:
- npm ci
- typecheck
- test
- build
가 모두 PASS했다.

추가 학습:
- Error message 문자열이 아니라 semantic code로 분기한다.
- Application id / applicationNumber / submissionId / createdAt / Snapshot은 불변이다.
- 기존 audit history는 append-only다.
- 이 불변식은 Repository write 경계에서 검증한다.

## 3. 이 후보에서 배운 공통 원칙

1. UI disabled는 무결성 경계가 아니다.
2. idempotency는 persistence 경계에서 보장한다.
3. 사람이 읽는 sequence 발번도 transaction 경계 안에 둔다.
4. aggregate 상태변경은 read-modify-write 한 덩어리로 처리한다.
5. actor/audit은 UI 메모가 아니라 Domain evidence다.
6. Product/current state와 historical snapshot은 분리한다.
7. 상태 이름과 독립 사실 체크를 한 필드로 뭉개지 않는다.
8. Adapter는 업무 의미를 새로 만들지 않는다.
9. 공통화는 인터페이스와 검증규칙을 대상으로 하고 프로젝트 고유 업무규칙은 로컬에 둔다.

## 4. 아직 공통 표준으로 승격하지 않는 이유

FreePass Admin의 현재 파일 Repository는 단일 Node 프로세스 안에서만 queue 원자성을 보장한다.

다음 증거가 추가로 필요하다.
- 실제 운영 persistence transaction 검증
- 실제 Auth/Permission binding
- 외부 audit persistence/관찰 필요성 판정
- 두 번째 실제 프로젝트 재사용
- migration/rollback 검증

## 5. 두 번째 프로젝트 파일럿 체크리스트

후보: FreePass Sales 또는 다른 실제 업무 프로젝트.

확인:
- Domain/Service/Port/Adapter 분리가 실제로 맞는가
- 원자 create/mutate 계약이 재사용 가능한가
- actor/audit 의미가 동일한가
- idempotency key 의미가 동일한가
- 프로젝트 고유 로직을 Adapter/Domain local에 유지할 수 있는가
- 공통 패키지화보다 contract/template이 더 적합한가

## 6. 승격 조건

다음이 모두 만족되면 DevCenter 공식 Backend Architecture Standard 승격 검토:
1. 실제 프로젝트 2개 이상 사용
2. typecheck/unit/contract/integration evidence
3. persistence concurrency evidence
4. auth/audit boundary evidence
5. versioned contract
6. rollback/migration path
7. 고유 업무 의미 침범 없음

## 7. 원천 포인터

- `freepass-admin/contracts/BACKEND-BOUNDARIES.md`
- `freepass-admin/src/domain/**`
- `freepass-admin/src/services/**`
- `freepass-admin/src/ports/**`
- `freepass-admin/src/adapters/**`
- `freepass-admin/.github/workflows/backend-check.yml`

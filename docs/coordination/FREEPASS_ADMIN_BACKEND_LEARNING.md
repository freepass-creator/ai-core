# FreePass Admin Backend Learning Packet — 2026-09-19

- 상태: `LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- 원천 프로젝트: `freepass-creator/freepass-admin`
- 학습 대상: AI Core / DevCenter
- 범위: UI/UX 제외. Domain / Service / Port / Adapter / Repository / SSOT / persistence / auth / audit / transaction 구조만 다룬다.
- 목적: FreePass Admin에서 이미 더 구체적으로 구현·검증된 백엔드 패턴을 AI Core/DevCenter가 학습 후보로 인지하고, 다른 프로젝트에서 재사용 가능성이 검증되면 공통 규격으로 승격하기 위한 입력 자료로 사용한다.

## 1. 왜 이 문서를 남기는가

현재 AI Core는 그룹 본사로서 프로젝트·SSOT·revision·승인·검증·실행 경계를 관리하고, DevCenter는 공통 개발 규격·재사용 자산·검증을 맡는다.

반면 FreePass Admin은 실제 제품 코드에서 이미 다음 구조를 구체적으로 사용하고 있다.

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

AI Core의 현재 Engine / Port / Adapter 개념은 연구·설계 수준이 강하고, DevCenter의 `engine/`은 아직 공통 도메인 엔진 카탈로그나 런타임 표준으로 성숙하지 않았다. FreePass Admin은 이 부분에서 실제 제품 단위 구현이 더 앞서 있으므로, 공통 규격 후보를 추출할 가치가 있다.

단, 이 문서는 FreePass Admin 구조를 즉시 전사 표준으로 선언하지 않는다. AI Core 그룹 운영 모델의 공통화 판정 규칙을 그대로 적용한다.

## 2. FreePass Admin에서 앞서 있는 구현

### 2.1 Domain / Service / Port / Adapter 경계

현재 구조:

```text
src/
├─ domain/
│  ├─ adapter/
│  ├─ application/
│  ├─ product/
│  └─ search/
├─ services/
│  └─ applications.ts
├─ ports/
│  └─ repositories.ts
└─ adapters/
   └─ store/
```

핵심 장점:

- Domain은 업무 의미와 상태 전이를 소유한다.
- Service는 사용 사례와 실행 순서를 소유한다.
- Port는 도메인이 필요로 하는 저장/외부 기능의 추상 계약을 소유한다.
- Adapter/Repository는 파일, Firestore, 공급사 등 실제 구현 차이를 흡수한다.
- UI가 DB/Firebase/공급사 구조를 직접 알지 않도록 분리할 수 있다.

AI Core의 현재 working model인
`Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state`
와 방향이 일치하며, FreePass Admin은 그 중 제품 내부 Domain/Service/Port/Adapter 경계를 실제 코드로 보여주는 사례다.

### 2.2 Canonical Product + same-Offer Search

FreePass Admin은 공급사 RAW를 바로 화면에서 사용하지 않고 다음 의미 계층을 둔다.

```text
Supplier RAW
 ↓
Supplier Adapter
 ↓
Mapping + Validation
 ↓
Canonical Product SSOT
 ↓
Common Search
```

검색은 기간·월대여료·보증금·약정주행거리·정책을 서로 다른 Offer에서 조합하지 않고, 하나의 동일 Offer가 동시에 만족해야 한다.

이 원칙은 단순 검색 UI가 아니라 도메인 무결성 규칙이다. 공통화 시에는 FreePass 고유 검색 로직 자체가 아니라 다음 패턴만 후보로 본다.

- 원문 보존
- 정규화된 Canonical 모델
- 의미 단위 Offer/Policy
- 동일 엔티티/버전 연속성
- 검색 결과와 후속 저장 간 선택 항목 continuity

### 2.3 Application Snapshot + Version Check

접수 시 상품 현재값을 단순 참조하는 대신:

- `expectedProductVersion`
- 선택 `offerId`
- Application Snapshot
- `submissionId`

를 사용한다.

의미:

- 화면을 본 뒤 상품이 바뀌면 조용히 최신값으로 저장하지 않는다.
- 접수 당시 고객에게 제시된 상품/조건을 보존한다.
- 같은 요청 재전송은 새 접수를 만들지 않는다.

이 패턴은 주문·계약·견적·승인 등 다른 업무에서도 재사용 가능성이 높다.

### 2.4 Repository-level idempotency

FreePass Admin은 중복방지를 버튼 disabled 같은 UI 규칙에 맡기지 않고 Repository 경계에서 `submissionId`로 막는다.

학습 포인트:

- UI는 편의장치일 뿐 무결성 경계가 아니다.
- 중복방지는 영속 저장소 경계에서 보장해야 한다.
- 재시도 시 이미 만들어진 결과를 반환하는 계약이 필요하다.

### 2.5 Cancel = delete가 아니라 상태 + 사유

취소를 레코드 삭제로 취급하지 않고:

- CANCELLED 상태
- cancellation reason
- 최초 취소 사유 보존

으로 처리한다.

이는 감사 추적, 정산, 분쟁 대응, 운영 복구 관점에서 공통적인 엔터프라이즈 패턴 후보가 될 수 있다.

## 3. FreePass Admin이 아직 부족한 부분 — 학습 시 같이 가져가면 안 됨

현재 FreePass Admin의 구조가 앞선다고 해서 현재 구현 전체가 완성된 것은 아니다.

### 3.1 실제 UI가 Domain/Service를 우회하는 구간

실제 Next 화면과 Mockup에 하드코딩/별도 검색 로직이 남아 있다.

공통 규격 후보는
`UI → Service → Domain → Port → Adapter`
단일 경로를 전제로 해야 한다.

### 3.2 Persistence는 운영형이 아님

현재 JSON file store는 개발 검증용이다.

운영에서는 Firestore 등 실제 영속 저장소 Adapter가 필요하며 다음을 확인해야 한다.

- transaction
- unique constraint 또는 유일성 보장
- concurrent write
- idempotency
- retry semantics
- failure handling

### 3.3 접수번호 동시성

현재 count 후 +1 방식은 서로 다른 동시 접수에서 충돌 가능성이 있다.

공통 규격 승격 전:
- transaction counter
또는
- opaque primary key + 별도 human-readable sequence
패턴을 검증해야 한다.

### 3.4 Auth / Permission / Actor Audit

현재 제품 main에는 관리자 인증·권한·actor audit 경계가 완성되지 않았다.

공통 엔진 규격은 상태 변경 시 최소 다음을 구분해야 한다.

- 누가 요청했는가
- 누가 승인했는가
- 누가 실행했는가
- 어떤 revision/조건에서 실행했는가
- 어떤 값이 전후로 바뀌었는가

### 3.5 Event / Audit Trail

현재값 변경만으로 끝내지 않고 의미 있는 이벤트를 append-only 또는 감사 가능한 방식으로 남기는 패턴이 필요하다.

예:
- APPLICATION_CREATED
- CONTRACT_COMPLETED
- DOCUMENTS_COMPLETED
- BALANCE_COMPLETED
- DELIVERY_COMPLETED
- APPLICATION_CANCELLED

## 4. AI Core가 학습해야 할 핵심 정리

### 4.1 AI Core가 직접 가져갈 것

AI Core는 FreePass 업무 로직을 소유하지 않는다.

AI Core가 학습·관리할 것은:

- 어떤 프로젝트가 어떤 Domain Engine을 소유하는지
- 어떤 Port/Adapter 계약을 사용하는지
- 어떤 revision을 채택했는지
- 공통 capability 후보인지
- 검증 상태가 무엇인지
- 어떤 프로젝트에서 재사용되었는지
- rollback / authority / proof 상태가 무엇인지

### 4.2 DevCenter가 후보로 가져갈 것

DevCenter에는 다음 표준이 부족하거나 미성숙하다.

- Domain folder / boundary 규격
- Application Service 규격
- Port contract 규격
- Adapter 규격
- Repository 규격
- Idempotency 규격
- Transaction / concurrency 규격
- Error taxonomy
- Logging / audit event 규격
- Auth / actor boundary
- Persistence verification checklist

FreePass Admin 구조를 하나의 실전 사례로 사용해 이 표준 후보를 만들고, 다른 프로젝트에 강제 적용하기 전에 최소 2개 실제 프로젝트에서 검증한다.

## 5. Domain SSOT 관련 AI Core 보완 후보

현재 그룹 운영 모델에는 각 자회사가 독립 SSOT·데이터·스키마를 갖는다고 되어 있다.

FreePass의 경우 ADMIN / SALES / WHITE LABEL은 서로 다른 제품 앱이지만 상품 업무 사실은 하나다.

따라서 다음 구분이 더 정확하다.

```text
Canonical Product Domain SSOT
   ├─ FreePass Admin
   ├─ FreePass Sales
   └─ White Label
```

앱은 독립 배포·브랜드·권한·표시 필드를 갖되, 동일한 상품 업무 사실을 세 프로젝트가 각각 복제해 별도 정본으로 만들면 안 된다.

학습 후보:
- Project SSOT
- Domain SSOT
- Consumer App

세 개념을 분리한다.

즉 모든 자회사/앱이 반드시 자기 안에 모든 데이터 정본을 가져야 한다는 규칙보다,
**업무 사실의 소유 Domain을 하나로 두고 여러 앱이 계약을 통해 소비할 수 있게 하는 구조**를 검토한다.

이 제안은 AI Core 그룹 운영 모델의 즉시 변경 명령이 아니다. FreePass 사례를 기준으로 정합성을 검토할 후보 사항이다.

## 6. Adapter를 두 종류로 구분

공통화 시 Adapter라는 말이 섞이지 않게 한다.

### 기술 Adapter / Connector
예:
- Firebase
- Google Sheet
- Gmail
- Drive
- GitHub
- Vercel

소유 후보:
AI Core Shared Services / DevCenter.

### 업무 Adapter
예:
- 특정 렌터카 공급사 상품
- 특정 공급사 가격표
- 공급사 사진 규칙
- 공급사 보증금 표현
- 엔카/차량 데이터 매핑

소유:
해당 Domain 프로젝트.

공통화 대상은 업무 규칙 자체가 아니라 Adapter 인터페이스/검증/오류/버전 규격이다.

## 7. 공통 규격 승격 조건

FreePass Admin의 구조를 DevCenter 공식 Backend Architecture Standard로 올리기 전 최소 조건:

1. FreePass Admin에서 실제 UI가 Service/Domain/Port/Adapter 단일 경로를 사용한다.
2. persistence transaction/idempotency/concurrency가 실제 저장소에서 검증된다.
3. auth/permission/audit 경계가 추가된다.
4. FreePass Sales 또는 다른 실제 프로젝트가 같은 패턴을 재사용한다.
5. 프로젝트별 업무 의미는 Adapter/Domain local로 유지되고 공통 표준이 이를 침범하지 않는다.
6. 공통 계약을 pin 가능한 version/revision으로 제공한다.
7. rollback과 migration 경로를 검증한다.
8. 기존 프로젝트에 강제 이식하지 않고 신규/개선 프로젝트에서 pilot한다.

## 8. AI Core / DevCenter 후속 작업 제안

우선순위:

1. FreePass Admin을 backend architecture pilot 프로젝트 후보로 등록한다.
2. 현재 `src/domain`, `src/services`, `src/ports`, `src/adapters`를 Codebase Twin이 아니라 얇은 Project Capsule pointer로 등록한다.
3. Domain / Service / Port / Adapter / Repository 최소 계약 초안을 DevCenter에 만든다.
4. Error / Audit / Idempotency / Transaction을 별도 공통 규격 카드 후보로 분리한다.
5. FreePass Sales에서 동일 패턴 적용 가능성을 대조한다.
6. 두 번째 실제 프로젝트 증거가 생기기 전에는 전사 공통 표준으로 승격하지 않는다.

## 9. 비목표

이 문서는 다음을 지시하지 않는다.

- FreePass Admin 코드를 AI Core 저장소로 이동
- 모든 프로젝트를 FreePass 구조로 강제 변경
- UI/UX 규격 통합
- 기존 운영 DB/Firebase 자동 연결
- 기존 프로젝트 SSOT 복제
- 현재 FreePass Admin 구현 전체를 완성품으로 판정
- 미검증 기능을 공통 capability로 자동 승격

## 10. 참조 원천

FreePass Admin:
- `README.md`
- `AGENTS.md`
- `docs/architecture/v1-core.md`
- `docs/reviews/ADMIN-DESIGN-FUNCTION-AUDIT-2026-09-18.md`
- `src/domain/**`
- `src/services/applications.ts`
- `src/ports/repositories.ts`
- `src/adapters/**`

AI Core:
- `memory/CURRENT.md`
- `docs/GROUP_OPERATING_MODEL.md`
- `docs/DEVELOPMENT_RUNTIME.md`

DevCenter:
- `README.md`
- `engine/README.md`
- `capabilities/IMPROVEMENTS.md`
- `registry.json`

## 11. 2026-09-19 실제 구현·검증 결과

FreePass Admin에서 학습 후보였던 일부 항목을 실제 코드로 고도화하고 CI로 검증했다.

기준 revision:
`f8eb1bfd8337aad4a12948f18e668e3ee19ad3fc`

검증:
- GitHub Actions run `35437615280`
- `npm ci` PASS
- `npm run typecheck` PASS
- `npm test` PASS
- `npm run build` PASS

실제로 반영된 항목:

1. **4개 진행 사실**
   - 계약서
   - 필수서류
   - 잔금
   - 인도

2. **Snapshot deep clone**
   - MULTI_SELECT 배열 참조 공유 제거
   - 원 상품 변경이 기존 Application Snapshot에 전파되지 않는 회귀테스트 추가

3. **Actor boundary**
   - `ActorRef`
   - `ActorProvider`
   - Service에서 상태변경 actor를 요구

4. **최소 audit history**
   - APPLICATION_CREATED
   - APPLICATION_PROGRESS_CHANGED
   - APPLICATION_CANCELLED
   - actor / occurredAt / delta 또는 reason 저장

5. **원자 접수 생성 계약**
   - submissionId 중복검사
   - 사람이 읽는 접수번호 sequence 발번
   - Application 생성/저장
   를 Repository `createSequenced` 경계로 통합

6. **원자 aggregate mutation**
   - 진행변경/취소를 `get → update`로 분리하지 않고 Repository `mutate` 경계 안에서 처리
   - 동시에 서로 다른 진행값 변경 시 lost update 방지 테스트 추가

7. **위험한 우회 API 제거**
   - ApplicationRepository에서 비원자 `create/update/countByDatePrefix` write path 제거
   - Service가 atomic create/mutate만 사용하도록 contract 자체를 좁힘

8. **동시성 회귀검증**
   - 서로 다른 20개 접수 동시 생성
   - applicationNumber 중복 0
   - 같은 submissionId 동시 재시도는 생성 1건
   - 서로 다른 진행 변경 동시 실행 시 둘 다 보존

## 12. DevCenter 반영 상태

DevCenter에 다음 candidate를 등록했다.

- `standards/backend/FREEPASS-ADMIN-PILOT.md`
- registry scope: `dev.backend.boundary.freepass_admin_candidate`

상태는 여전히 `CANDIDATE / SECOND-PROJECT-EVIDENCE_REQUIRED`다.

즉 FreePass Admin 한 프로젝트의 성공을 곧바로 전사 표준으로 선언하지 않는다.
다음 검증 대상은 FreePass Sales 등 두 번째 실제 프로젝트이며, 동일한 Domain/Service/Port/Adapter/Repository 의미가 맞는지 교차 검증한다.

## 13. 현재 남은 경계

이번 고도화로 내부 코드/개발 저장소 수준에서 해결된 것과 운영 연결 문제를 분리한다.

### 해결/검증됨
- Domain/Service/Port/Adapter/Repository 기본 경계
- Application progress 4 facts
- Snapshot deep clone
- repository-level idempotency
- single-process atomic sequence/create
- single-process atomic aggregate mutation
- actor contract
- aggregate audit history
- typecheck/unit/build CI gate

### 운영 연결이 있어야 검증 가능
- 실제 Firestore/운영 persistence Adapter transaction
- 멀티 인스턴스 동시성
- 실제 관리자 Auth/Permission binding
- production audit retention/sink
- production runtime smoke/deployment/rollback

이 남은 항목은 문서 미완성이 아니라 **외부 운영 바인딩 증거가 필요한 경계**로 취급한다.

## 11. 핵심 한 줄

> AI Core는 통제와 학습·버전·증거를 소유하고, DevCenter는 공통 개발 패턴을 소유하며, FreePass는 실제 업무 의미와 Domain Engine을 소유한다. FreePass Admin에서 먼저 검증된 Domain/Service/Port/Adapter/Repository 구조는 DevCenter의 차기 Backend Architecture Standard 후보로 학습한다.

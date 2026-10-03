# Development Center Hub Architecture v1

상태: 사용자 확정 구조 반영 / 조직·라우팅 정본  
확정일: 2026-09-21

## 1. 원칙

Development Center는 AI Core의 개발 실행 조직이다.

- **AI Core**: 회사 전체의 헌법, 공통 Contract, 불변 규칙을 소유한다.
- **Development Center**: 그 규칙을 실제 개발에서 찾고, 조합하고, 구현하고, 검증하고, 재사용하게 한다.
- **Hub**: Development Center 안의 전문 실행 영역이다.
- **Project**: Hub가 아니다. 각 프로젝트는 Hub의 규격·자산·도구를 소비하거나 검증된 구현을 Hub에 후보로 공급한다.

Hub는 저장소 이름이 아니다. 물리 저장소를 억지로 이동하지 않고 정본 포인터와 책임 경계를 관리한다.

## 2. 공식 조직

```text
AI Core
└─ Development Center
   ├─ Control Plane
   │  ├─ Standards
   │  ├─ Registry
   │  ├─ Operations
   │  ├─ Inspection
   │  ├─ SSOT Verification
   │  └─ Execution Engine / Runs
   │
   ├─ Design Hub
   ├─ Data Hub
   ├─ Document Hub
   ├─ Engineering Hub
   ├─ Integration Hub
   ├─ Quality Hub
   └─ Delivery Hub
```

공식 Hub는 정확히 **7개**다. 기능이 새로 생겼다는 이유만으로 Hub를 추가하지 않는다. 먼저 기존 Hub의 파트로 수용 가능한지 판단한다.

## 3. Control Plane

Control Plane은 제8의 Hub가 아니다. 모든 Hub를 관장하는 공통 운영 계층이다.

- `operations/`: 요청·범위·배정·인계
- `standards/`: 요구사항·완료조건·정본·예외
- `registry.json`: 외부/내부 정본 포인터
- `ssot/`: SSOT 검증
- `operations/inspection/`: 지도점검·시정·재검사
- `engine/`: 센터 공통 실행 진입점
- `runs/`: 실행 증거

## 4. 7 Hub 책임

### Design Hub
UI/UX, Design Token, Component, Pattern, Screen/Page Spec, 브랜드 적용, Design QA를 관장한다.

AI Core의 UI/UX Constitution/Contract를 상위 기준으로 읽고, 프로젝트별 디자인 자산과 승인 패턴을 실행 가능한 형태로 연결한다. AI Core와 DevCenter에 같은 토큰 값을 중복 정본으로 만들지 않는다.

### Data Hub
Schema, ID, SSOT, Field Authority, Lineage, Provenance, Data Quality, Projection, Migration, Distribution, Audit/Receipt를 관장한다.

업무 데이터 자체를 복제해 보관하지 않는다. AI Core의 Data/Core Contract와 각 데이터 플랫폼 구현을 연결한다. FreePass Data는 대표 구현 프로젝트이지 Data Hub 자체가 아니다.

### Document Hub
보고서, 제안서, 계약서, 약관, 양식, PDF/PPT/문서 렌더링 규격을 관장한다.

현재 `freepass-creator/docshub`의 문서 양식은 authoritative source로 유지한다. 문서의 시각 언어는 Design Hub와 연계하되 문서 템플릿 정본을 복제하지 않는다.

### Engineering Hub
공통 코드 패턴, SDK, Repository/Adapter/Provider, 재사용 모듈, 프론트/백엔드 구현 패턴을 관장한다.

프론트엔드/백엔드를 별도 Hub로 쪼개지 않는다. 제품 고유 비즈니스 로직은 각 프로젝트에 남긴다.

### Integration Hub
Firebase, Google, GitHub, 외부 API, Webhook, Connector, 인증 경계 등 시스템 간 연동 계약과 Adapter를 관장한다.

외부 시스템의 데이터 정본이나 권한을 Development Center가 소유하지 않는다.

### Quality Hub
Conformance, Testing, Regression, Accessibility, Performance, Security QA와 검증 증거를 관장한다.

배포 실행과 Rollback 자체는 Delivery Hub 책임이며, Quality Hub는 배포 가능 여부를 증명하는 검증을 공급한다.

### Delivery Hub
Build, Package, Deploy, Release, Version, Environment, Rollback, Recovery, Runtime Evidence를 관장한다.

Quality Hub의 PASS 없이 배포 완료를 주장하지 않는다. 프로젝트별 배포 권한과 환경 Secret은 제자리에 유지한다.

## 5. 기존 경로 매핑

| 기존 자산 | 새 관장 구조 |
|---|---|
| `design/` | Design Hub |
| `capabilities/shared/` | Engineering Hub |
| `capabilities/integrations/` | Integration Hub |
| `quality/conformance/` | Quality Hub |
| `quality/testing/` | Quality Hub |
| `quality/release-recovery/` | Delivery Hub의 과도기 backing path |
| `operations/` | Control Plane |
| `standards/` | Control Plane |
| `ssot/` | Control Plane |
| `engine/` | Control Plane 실행계층 |
| `registry.json` | Control Plane Registry |
| `freepass-creator/docshub` | Document Hub authoritative source |
| AI Core UI/UX B assets | Design Hub 상위 Contract/기준 |
| AI Core Data/Core Contract + `freepass-data` | Data Hub 기준 + 대표 구현 |

물리 이동은 별도 migration 작업이다. 조직 개편만으로 파일·Repo를 이동하거나 정본을 복제하지 않는다.

## 6. 라우팅 규칙

사용자 요청을 Development Center가 받으면 먼저 하나의 Primary Hub를 정하고 필요한 Secondary Hub를 붙인다.

예:
- “전체 디자인 통일” → Design Hub + Quality Hub
- “Firebase 구조 정리” → Data Hub + Integration Hub + Quality Hub
- “계약서 양식 통일” → Document Hub + Design Hub + Quality Hub
- “공통 Repository 패턴 만들어” → Engineering Hub + Quality Hub
- “배포 준비해” → Delivery Hub + Quality Hub
- “외부 API 연결” → Integration Hub + Engineering Hub + Quality Hub

상위 AI Core Contract와 충돌하면 Hub가 임의로 재정의하지 않고 AI Core 기준을 우선한다.

## 7. 완료 기준

Hub가 존재한다는 것은 폴더가 있다는 뜻이 아니다. 최소한 다음이 연결돼야 한다.

1. 책임 범위
2. 입력/출력
3. 상위 Contract
4. authoritative/candidate source
5. 실행 진입점
6. 검증 방법
7. 소비 프로젝트
8. 변경·예외·승격 기록

Machine-readable registry는 `hubs/registry.json`이다.

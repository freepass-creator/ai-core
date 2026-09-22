# Development Center

개발 자산을 찾고, 조합하고, 만들고, 검증해 다시 쓰며 모든 개발의 점검·시정·재검사를 기록하는 개발창고와 작업장.

## 공식 구조 — Control Plane + 7 Hubs

Development Center는 AI Core의 개발 실행 조직이다. AI Core가 회사 공통 헌법·Contract를 소유하고, Development Center가 이를 실제 개발 자산·도구·검증으로 연결한다.

공식 전문 실행 영역은 정확히 **7개 Hub**다.

1. [Design Hub](hubs/design/README.md)
2. [Data Hub](hubs/data/README.md)
3. [Document Hub](hubs/document/README.md)
4. [Engineering Hub](hubs/engineering/README.md)
5. [Integration Hub](hubs/integration/README.md)
6. [Quality Hub](hubs/quality/README.md)
7. [Delivery Hub](hubs/delivery/README.md)

`operations / standards / registry / ssot / inspection / engine / runs`는 제8의 Hub가 아니라 모든 Hub를 관장하는 **Control Plane**이다.

조직·라우팅 정본은 [Development Center Hub Architecture](docs/HUB-ARCHITECTURE.md), machine-readable 등록부는 [hubs/registry.json](hubs/registry.json), 실제 요청의 첫 진입점은 [어디를보나.md](어디를보나.md)를 본다. 실행 라우팅은 [Hub Router Runtime](docs/HUB-ROUTER-RUNTIME.md)과 `node scripts/hub-router.mjs "<요청>"`을 사용한다.

## 기존 경로와 Hub 매핑

기존 자산은 정본 충돌을 막기 위해 물리 이동하지 않고 현재 경로를 backing source로 사용한다.

- [design](design/README.md) → **Design Hub**
- `capabilities/shared` → **Engineering Hub**
- `capabilities/integrations` → **Integration Hub**
- `quality/conformance`, `quality/testing` → **Quality Hub**
- `quality/release-recovery` → **Delivery Hub** 과도기 backing path
- `freepass-creator/docshub` → **Document Hub** authoritative source
- AI Core Core/Data Contract + `freepass-creator/freepass-data` → **Data Hub** 기준 + 대표 구현
- [operations](operations/README.md), [standards](standards/README.md), [engine](engine/README.md), `registry.json`, `ssot/`, `runs/` → **Control Plane**

## Hub Readiness

7개 Hub는 [readiness 정본](hubs/readiness.json)과 [계산기](scripts/hub-readiness.mjs)로 실행 준비도를 측정한다. 목표는 각 Hub **90% 이상 + contract/source/runtime/validation 전부 VERIFIED**다. 초기 기준은 [2026-09-21 baseline](docs/HUB-READINESS-BASELINE-2026-09-21.md)을 본다.

Readiness는 제품 품질 점수가 아니다. Hub가 공통 실행 계층으로 재사용·검증 가능한 수준인지 측정하며, 문서 존재만으로 점수를 올리지 않는다.

## 지도점검 관제실

[지도점검 규정](operations/inspection/POLICY.md)에 따라 `대상 등록 → 정본·버전 고정 → 규격 점검 → 시정 배정 → 수정 실행 → 재검사·종결`을 관리한다. `node scripts/inspect-project.mjs --target <프로젝트 경로>`로 값을 읽지 않는 기본 구조 점검을 실행할 수 있다. 결과가 규격 밖이면 근거와 재검사 방법이 포함된 시정 작업 패킷을 발행한다.

## 다른 세션의 첫 방문

[개발센터 견학](docs/SESSION-TOUR.md)부터 시작한다. 이번 작업의 정본 찾기 → Primary Hub 선택 → 필요한 Secondary Hub 연결 → 원자 직접 사용 → 충돌 반례 확인 → 검증 결과 인계 순서다. 브라우저의 **세션 견학**에서도 같은 안내와 다른 세션에 전달할 요청문을 제공한다. 읽었다는 사실을 자동 검수 통과로 취급하지 않는다.

## 현재 상태

그룹·파트 골격, 로컬 규격 등록부, [브라우저 규격·원자 실험실](portal/README.md), 읽기 전용 지도점검 엔진과 7 Hub 조직·라우팅 등록부가 있다.

**Hub 등록은 구현 완료 선언이 아니다.** 기존 backing source의 구현 성숙도는 서로 다르며, 전체 규격 의미 자동 대조·대상별 수정기·전 Hub runtime은 아직 완료되지 않았다. 개발센터 현재 작업본의 네 AI 최종 검수는 **HOLD**이며 폴더 존재를 검증 완료로 취급하지 않는다.

## 기존 자산 사용

루트 `registry.json`은 기존 개발 규격과 Hub 조직 포인터를 가리킨다. 원본 저장소/경로/버전을 확인하고 사용한다. 현역·보관 판정 원본은 로컬 `C:/dev/aiops/docs/저장소지도.md`다. 여기서 임의 승격하지 않는다.

로컬에서는 이 저장소를 다른 프로젝트와 같은 부모 디렉터리에 둔 후 다음 명령으로 경로를 확인한다.

```powershell
node 틀.mjs
node 틀.mjs dev.hub.design
node 틀.mjs dev.design.token
```

`틀.mjs`는 문자열 검색·경로 존재 확인만 수행한다. 후보 표시는 통과 판정이 아니다.

SSOT 조직 정의는 [ssot/PART.md](ssot/PART.md), 검사기 정본은 `C:/dev/devcenter/ssot`다. `standards/ssot`는 조직상 참조 자리이며 두 번째 검사기를 만들지 않는다.

## 자산과 기록

- Git: 코드·규격 참조·사용 예제·검사·버전 이력
- 기존 프로젝트: 기존 자산의 원본 유지
- 로컬 조사/실행 기록: `reviews/`, `runs/` (업로드 제외)
- Firebase: 향후 다중 사용자 실시간 상태가 필요할 때 별도 검토; 현재 Development Center 자체 운영 저장소로 도입하지 않음

[저장소 등록 범위](docs/BOOTSTRAP.md)를 확인한다. 사용자 지정 구조와 구현/검수 완료는 구분한다.

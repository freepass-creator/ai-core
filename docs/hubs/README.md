# Development Center

개발 자산을 찾고, 조합하고, 만들고, 검증해 다시 쓰며 모든 개발의 점검·시정·재검사를 기록하는 개발창고와 작업장.

## 공식 구조 — Control Plane + 7 Hubs

Development Center는 AI Core의 개발 실행 조직이다. AI Core가 회사 공통 헌법·Contract를 소유하고, Development Center가 이를 실제 개발 자산·도구·검증으로 연결한다.

공식 전문 실행 영역은 정확히 **7개 Hub**다.

1. [Design Hub](design.md)
2. [Data Hub](data.md)
3. [Document Hub](document.md)
4. [Engineering Hub](engineering.md)
5. [Integration Hub](integration.md)
6. [Quality Hub](quality.md)
7. [Delivery Hub](delivery.md)

`operations / standards / registry / ssot / inspection / engine / runs`는 제8의 Hub가 아니라 모든 Hub를 관장하는 **Control Plane**이다.

조직·라우팅 정본은 [Development Center Hub Architecture](HUB-ARCHITECTURE.md), machine-readable 등록부는 AI Core 루트 [registry/hubs.json](../../registry/hubs.json), 실제 요청의 첫 진입점은 [업무 라우팅 등록부](../../registry/work-map.json)를 본다. 실행 라우팅은 [Hub Router Runtime](HUB-ROUTER-RUNTIME.md)과 `node src/routing/hub-router.mjs "<요청>"`을 사용한다.

## 기존 경로와 Hub 매핑

흡수된 자산은 아래 본체 경로를 backing source로 사용한다.

- [UI/UX 진입점](../UI_UX_START_HERE.md) → **Design Hub**
- `../../src/hubs/engineering/` → **Engineering Hub**
- `../../src/hubs/integration/` → **Integration Hub**
- `../../scripts/verification/`, `../../test/quality-receipt.test.mjs` → **Quality Hub**
- `../../src/hubs/delivery/` → **Delivery Hub**
- `freepass-creator/docshub` → **Document Hub** authoritative source
- AI Core Core/Data Contract + `freepass-creator/freepass-data` → **Data Hub** 기준 + 대표 구현
- [헌법](../AI_WORKING_STANDARD.md), [Academy](../AI_ACADEMY_CURRICULUM.md), [Hub Router Runtime](HUB-ROUTER-RUNTIME.md), `../../registry/devcenter-datasets.json` → **Control Plane**

## Hub Readiness

7개 Hub는 [readiness 정본](../../src/hubs/readiness.json)과 [계산기](../../src/hubs/hub-readiness.mjs)로 실행 준비도를 측정한다. 목표는 각 Hub **90% 이상 + contract/source/runtime/validation 전부 VERIFIED**다. 초기 기준은 [2026-09-21 baseline](https://github.com/freepass-creator/ai-core/blob/4d28654a99b76c9491afad6c54466574181fcdb1/devcenter/docs/HUB-READINESS-BASELINE-2026-09-21.md)을 본다.

Readiness는 제품 품질 점수가 아니다. Hub가 공통 실행 계층으로 재사용·검증 가능한 수준인지 측정하며, 문서 존재만으로 점수를 올리지 않는다.

## 지도점검 관제실

[지도점검 규정](../verification/POLICY.md)에 따라 `대상 등록 → 정본·버전 고정 → 규격 점검 → 시정 배정 → 수정 실행 → 재검사·종결`을 관리한다. `node scripts/verification/inspect-project.mjs --target <프로젝트 경로>`로 값을 읽지 않는 기본 구조 점검을 실행할 수 있다. 결과가 규격 밖이면 근거와 재검사 방법이 포함된 시정 작업 패킷을 발행한다.

## 다른 세션의 첫 방문

[Academy 작업 시작 안내](../AI_ACADEMY_CURRICULUM.md)부터 시작한다. 이번 작업의 정본 찾기 → Primary Hub 선택 → 필요한 Secondary Hub 연결 → 원자 직접 사용 → 충돌 반례 확인 → 검증 결과 인계 순서다. 브라우저의 **세션 견학**에서도 같은 안내와 다른 세션에 전달할 요청문을 제공한다. 읽었다는 사실을 자동 검수 통과로 취급하지 않는다.

## 현재 상태

그룹·파트 골격, 로컬 규격 등록부, [브라우저 규격·원자 실험실](../../docs/catalog-portal.md), 읽기 전용 지도점검 엔진과 7 Hub 조직·라우팅 등록부가 있다.

**Hub 등록은 구현 완료 선언이 아니다.** 기존 backing source의 구현 성숙도는 서로 다르며, 전체 규격 의미 자동 대조·대상별 수정기·전 Hub runtime은 아직 완료되지 않았다. 필요한 검토를 수행하지 못한 범위는 **HOLD**이며 폴더 존재를 검증 완료로 취급하지 않는다.

## 기존 자산 사용

AI Core 루트 `registry/devcenter-datasets.json`은 기존 개발 규격과 Hub 조직 포인터를 가리킨다. 원본 저장소/경로/버전을 확인하고 사용한다. 여기서 임의 승격하지 않는다.

로컬에서는 이 저장소를 다른 프로젝트와 같은 부모 디렉터리에 둔 후 다음 명령으로 경로를 확인한다.

```powershell
node scripts/standards-find.mjs
node scripts/standards-find.mjs dev.hub.design
node scripts/standards-find.mjs dev.design.token
```

`../../scripts/standards-find.mjs`는 문자열 검색·경로 존재 확인만 수행한다. 후보 표시는 통과 판정이 아니다.

정본 사용 원칙은 [헌법](../AI_WORKING_STANDARD.md)을 따른다. 현재 검증 도구는 `../../scripts/verification/`와 `npm run canon:guard`이며, 규격 검색은 검증 통과를 뜻하지 않는다.

## 자산과 기록

- Git: 코드·규격 참조·사용 예제·검사·버전 이력
- 기존 프로젝트: 기존 자산의 원본 유지
- 로컬 조사/실행 기록: `reviews/`, `runs/` (업로드 제외)
- Firebase: 향후 다중 사용자 실시간 상태가 필요할 때 별도 검토; 현재 Development Center 자체 운영 저장소로 도입하지 않음

[저장소 등록 범위](https://github.com/freepass-creator/ai-core/blob/4d28654a99b76c9491afad6c54466574181fcdb1/devcenter/docs/BOOTSTRAP.md)를 확인한다. 사용자 지정 구조와 구현/검수 완료는 구분한다.

## 허브 문서 탐색

# DevCenter 문서 진입점

## 현재 실행 문서

- [작업 시작 안내](../AI_ACADEMY_CURRICULUM.md)
- [Hub Architecture](HUB-ARCHITECTURE.md)
- [Hub Router Runtime](HUB-ROUTER-RUNTIME.md)
- [Hub Readiness](HUB-READINESS.md)
- 각 Hub runtime 및 evidence 문서

## 호환·역사 문서

- [공통 헌법](../AI_WORKING_STANDARD.md)
- [2026-09-09 원본 조사 기록](https://github.com/freepass-creator/ai-core/blob/4d28654a99b76c9491afad6c54466574181fcdb1/devcenter/docs/CURRENT-STANDARDS.md)
- [현재 AI 협업 정책](../AI_WORKING_STANDARD.md)
- [당시 출처와 버전](https://github.com/freepass-creator/ai-core/blob/4d28654a99b76c9491afad6c54466574181fcdb1/devcenter/docs/baseline-sources.json)
- [당시 문제·개선 기록](https://github.com/freepass-creator/ai-core/blob/4d28654a99b76c9491afad6c54466574181fcdb1/devcenter/docs/IMPROVEMENT-REPORT.md)

공통 규칙의 정본은 AI Core 루트 `docs/`, `design-system/`, `contracts/`, `registry/`다. DevCenter 문서 등록이나 과거 검토 상태는 기능 구현·현재 규격 승인·배포 완료를 뜻하지 않는다.

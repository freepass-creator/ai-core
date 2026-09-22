# Development Center Hubs

Development Center의 공식 전문 실행 영역은 아래 **7개 Hub**다.

1. [Design Hub](design/README.md)
2. [Data Hub](data/README.md)
3. [Document Hub](document/README.md)
4. [Engineering Hub](engineering/README.md)
5. [Integration Hub](integration/README.md)
6. [Quality Hub](quality/README.md)
7. [Delivery Hub](delivery/README.md)

공통 조직·라우팅 원칙은 [Hub Architecture](../docs/HUB-ARCHITECTURE.md), machine-readable 정본은 [registry.json](registry.json)을 본다.

`operations / standards / registry / ssot / inspection / engine / runs`는 별도 Hub가 아니라 **Control Plane**이다.

## 실행 라우팅

- 규칙: [routing-rules.json](routing-rules.json)
- 실행기: [../scripts/hub-router.mjs](../scripts/hub-router.mjs)
- 검증기: [../scripts/validate-hubs.mjs](../scripts/validate-hubs.mjs)
- 회귀 테스트: [../test/hub-router.test.mjs](../test/hub-router.test.mjs)

모르는 요청은 가장 비슷한 Hub로 억지 배정하지 않고 **HOLD**한다.

## Hub Readiness

- readiness 정본: [readiness.json](readiness.json)
- 계산기: [../scripts/hub-readiness.mjs](../scripts/hub-readiness.mjs)
- 기준/해석: [../docs/HUB-READINESS.md](../docs/HUB-READINESS.md)
- 초기 baseline: [../docs/HUB-READINESS-BASELINE-2026-09-21.md](../docs/HUB-READINESS-BASELINE-2026-09-21.md)

목표는 7개 Hub 모두 **90% 이상 + critical axis 전부 VERIFIED**다.

# Engineering Hub

Development Center의 공통 구현·재사용 코드 허브.

## 관장
- 공통 SDK / Library
- Repository / Adapter / Provider 패턴
- Frontend / Backend 구현 패턴
- 공통 API client / utility
- 재사용 가능한 모듈과 샘플
- 프로젝트 Starter 구현 자산

## 현재 backing source
- `../../capabilities/shared/`
- 검증된 프로젝트 공통 구현 후보
- AI Core의 API/Event/Error/Result Contract

## 경계
제품 고유 비즈니스 로직과 업무 정본을 가져오지 않는다. Frontend/Backend는 별도 Hub가 아니라 Engineering Hub 내부 파트다.


## Shared Asset Runtime

- Asset contract: `../../contracts/engineering-asset.schema.json`
- Asset registry: `assets.json`
- Consumer registry: `consumers.json`
- Runtime/gate: `../../scripts/engineering-hub.mjs`
- Regression definitions: `../../test/engineering-hub.test.mjs`
- Guide: `../../docs/ENGINEERING-HUB-RUNTIME.md`

공통 자산은 복사본이 아니라 source revision/blob에 묶인 pointer로 관리한다. 프로젝트 구현은 CANDIDATE로 들어오며 evidence 없이 ACTIVE로 승격하지 않는다.

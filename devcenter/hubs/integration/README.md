# Integration Hub

Development Center의 시스템 연동 허브.

## 관장
- Firebase / Google / GitHub 연결
- 외부 API / SDK / Connector
- Webhook / Event bridge
- 인증·권한 연결 경계
- Adapter contract
- Retry / timeout / external failure handling

## 현재 backing source
- `../../capabilities/integrations/`
- 각 프로젝트의 검증된 connector/adapter
- AI Core의 Event/Error/Result/Workflow Contract

## 경계
외부 서비스의 데이터·권한·Secret을 Hub가 소유하지 않는다. 실제 credential과 production binding은 각 권한 체계에 남긴다.


## Connector Runtime

- Connector contract: `../../contracts/integration-connector.schema.json`
- Connector registry: `connectors.json`
- Consumer registry: `consumers.json`
- Runtime/gate: `../../scripts/integration-hub.mjs`
- Regression definitions: `../../test/integration-hub.test.mjs`
- Guide: `../../docs/INTEGRATION-HUB-RUNTIME.md`

모든 connector는 timeout/retry/idempotency/auth/health/recovery를 선언해야 하며 Secret 값은 Registry에 저장하지 않는다. 프로젝트 구현이 존재해도 production 증거 없이는 CANDIDATE를 유지한다.

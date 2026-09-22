# Integration Hub Runtime v1

## 목적

Firebase, Google, GitHub, 외부 API, Webhook 등 연동을 프로젝트별 임의 구현으로만 두지 않고 **공통 안전계약 + exact source evidence**로 관리한다.

## 정본

- Connector contract: `contracts/integration-connector.schema.json`
- Connector registry: `hubs/integration/connectors.json`
- Consumer registry: `hubs/integration/consumers.json`
- Runtime/gate: `scripts/integration-hub.mjs`
- Regression definitions: `test/integration-hub.test.mjs`

## 필수 계약

모든 connector는 최소 다음을 선언한다.

- provider / protocol / direction
- exact repository + revision + path + blob SHA
- timeout
- retry max attempts / backoff
- idempotency requirement + key
- auth mode / secret location boundary
- health probe / success receipt
- failure mode / fallback / disable path
- verification evidence

Secret 값 자체는 Registry에 저장하지 않는다.

## 상태

- `CANDIDATE`: 구현 근거는 있으나 공통/production 활성 증거 부족
- `ACTIVE`: 승인된 공통 실행 후보
- `DEGRADED`: 연결은 존재하나 정상 서비스 조건 미충족
- `DEPRECATED`
- `RETIRED`

## 첫 evidence

FreePass Data의 Firestore store 두 개를 CANDIDATE로 등록했다.

- catalog Firestore
- source Firestore

코드가 존재한다고 production ACTIVE로 올리지 않는다. 현재 FreePass Data 문서 자체가 production Firebase binding/IAM/writer cutover를 별도 승인·검증 항목으로 남기므로 Hub도 같은 HOLD를 유지한다.

## Receipt

실제 실행 시:
- subject revision
- attempts
- idempotency key ref
- health evidence
- PASS/HOLD/FAIL
- 실패/HOLD 시 recovery evidence

를 receipt로 남겨야 한다.

## Promotion

CANDIDATE → ACTIVE는 실제 revision-bound evidence 없이는 불가하다. 프로젝트 학습을 Hub 공통 connector로 승격하는 결정은 별도 registry revision으로 남긴다.

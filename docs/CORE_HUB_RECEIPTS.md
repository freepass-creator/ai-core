# Core Hub Receipts

모든 Development Center 허브 영수증의 공통 봉투는 루트 `contracts/core-receipt.schema.json`의 `core-receipt/v1`이다. 대상 revision, 실행 상태, 입출력 digest, 증거, 재현 정보와 시간은 이 봉투에 한 번만 기록한다.

허브별 스키마는 공통 필드를 다시 정의하지 않는다. `receipt_kind`로 유형을 식별하고 `payload`에 해당 허브만의 구조를 둔다.

| receipt_kind | payload schema | generator |
|---|---|---|
| `hub.quality` | `contracts/quality-receipt.schema.json` | `devcenter/scripts/quality-receipt.mjs` |
| `hub.design-adoption` | `contracts/design-adoption-receipt.schema.json` | `devcenter/scripts/design-feedback.mjs` |
| `hub.design-visual` | `contracts/design-visual-receipt.schema.json` | `devcenter/scripts/design-visual-qa.mjs` |
| `hub.document` | `contracts/document-receipt.schema.json` | `devcenter/scripts/document-hub.mjs` |
| `hub.data` | `contracts/data-receipt.schema.json` | `devcenter/scripts/data-hub.mjs` |
| `hub.delivery` | `contracts/delivery-receipt.schema.json` | `devcenter/scripts/delivery-gate.mjs` |

기존 `devcenter-*-receipt/v1` 이름은 호환성과 출처 추적을 위해 `payload.legacy_contract`에만 남긴다. 새 소비자는 최상위 `schema_version`, `status`, `source_revision`, `evidence_refs`를 먼저 읽고 필요한 경우에만 `payload`를 읽는다.

`CREATE_NEW_JUSTIFIED`: 기존 `src/engine/execution-receipt.mjs`는 외부 프로젝트가 만든 terminal receipt를 찾고 판정하는 reader라서, 허브 결과를 canonical envelope로 만드는 역할에 재사용할 수 없다. 따라서 공통 생성 로직만 `src/engine/core-hub-receipt.mjs`에 추가하고 새 계약 가족은 만들지 않았다.

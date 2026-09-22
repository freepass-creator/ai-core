# Data Hub

Development Center의 공통 데이터 기술·규격 실행 허브.

## 관장
- Schema / ID / Version / Revision
- SSOT / Field Authority
- RAW / Normalize / Canonical / Projection
- Lineage / Provenance
- Data Quality / Freshness / Completeness
- Migration / Shadow / Parity / Cutover
- Distribution / Consumer Contract
- Audit / Diff / Receipt

## 현재 backing source
- AI Core Core/Data Contract
- `freepass-creator/freepass-data`의 검증된 구현
- `../../ssot/` 검증 체계와 Registry 포인터

## 경계
Data Hub는 운영 데이터 저장소가 아니다. 고객·계약·차량 등 실제 데이터 정본을 복제하지 않는다. FreePass Data는 대표 구현 프로젝트이며 Hub 자체가 아니다.


## Evidence / Promotion Runtime

- Data Receipt contract: `../../contracts/data-receipt.schema.json`
- First real receipt: `../../evidence/data/freepass-data-catalog-v1.json`
- Adopted patterns: `patterns.json`
- Consumer map: `consumers.json`
- Recovery contract/state: `recovery.json`
- Runtime/gate: `../../scripts/data-hub.mjs`
- Regression definitions: `../../test/data-hub.test.mjs`
- Guide: `../../docs/DATA-HUB-EVIDENCE.md`

FreePass Data의 Catalog V1 구현을 exact revision으로 평가하고, 재사용 가능한 패턴만 Data Hub로 승격한다. 제품 고유 collection/도메인 구현은 역수입하지 않는다.

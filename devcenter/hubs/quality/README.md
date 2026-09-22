# Quality Hub

Development Center의 검증·품질 증거 허브.

## 관장
- Conformance
- Unit / Integration / Acceptance Test
- Regression
- Accessibility
- Performance
- Security QA
- Visual QA evidence
- 변경 영향 검증
- PASS / FAIL / HOLD 증거

## 현재 backing source
- `../../quality/conformance/`
- `../../quality/testing/`
- 지도점검 재검사 증거

## 경계
Release/Deploy/Rollback 실행 자체는 Delivery Hub 책임이다. Quality Hub는 실행 가능 여부를 증명하는 검증과 receipt를 제공한다.

## Quality Receipt

모든 Hub의 검증 증거를 공통 형식으로 남기는 정본:

- Contract: `../../contracts/quality-receipt.schema.json`
- Runtime: `../../scripts/quality-receipt.mjs`
- Test: `../../test/quality-receipt.test.mjs`
- Guide: `../../docs/QUALITY-RECEIPT.md`

Quality Receipt는 대상 프로젝트의 exact revision, 실제 실행 명령, check별 evidence, HOLD/FAIL의 remediation/recheck를 강제한다.


## Evidence / Learning

- First real receipt: `../../evidence/quality/freepass-admin-backend-baseline.json`
- Adopted QA patterns: `patterns.json`
- Consumer map: `consumers.json`
- Evidence retention/recovery: `retention.json`
- Guide: `../../docs/QUALITY-HUB-EVIDENCE.md`

과거 PASS는 exact revision에만 유효하다. 최신 revision으로 자동 승계하지 않는다.

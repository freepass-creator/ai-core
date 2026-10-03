# Delivery Hub

Development Center의 빌드·배포·릴리스·복구 허브.

## 관장
- Build / Package
- Deploy
- Release / Version
- Environment promotion
- Rollback / Recovery
- Runtime smoke / receipt
- Release evidence
- Last-known-good

## 현재 backing source
- `../../src/hubs/delivery/delivery-gate.mjs`
- 프로젝트별 CI/CD 및 배포 설정
- AI Core release/recovery 관련 Contract

## 경계
Quality Hub의 검증 없이 배포 완료를 주장하지 않는다. Secret, production 권한, 배포 승인 주체는 기존 권한 체계에 남긴다.

실행·복구 근거는 아래 Release / Receipt Runtime과 revision에 결속된 영수증으로 확인한다.


## Release / Receipt Runtime

- Release contract: `../../contracts/hubs/delivery-release.schema.json`
- Delivery receipt: `../../contracts/hubs/delivery-receipt.schema.json`
- Gate/runtime: `../../src/hubs/delivery/delivery-gate.mjs`
- Regression definitions: `../../test/delivery-gate.test.mjs`
- Consumer registry: `../../src/hubs/delivery/consumers.json`
- Guide: `DELIVERY-HUB-RUNTIME.md`

Delivery Hub는 실제 provider credential이나 production 권한을 소유하지 않는다. exact revision, Quality Receipt, rollback/last-known-good, production approval evidence가 모두 닫혀야 실행 준비 상태가 된다.

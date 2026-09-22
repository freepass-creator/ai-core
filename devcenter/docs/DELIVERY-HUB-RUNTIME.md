# Delivery Hub Runtime v1

## 목적

Build/Deploy/Release/Rollback을 프로젝트별 임의 절차가 아니라 **exact revision + Quality evidence + last-known-good**에 묶는다.

## 구성

- Release contract: `contracts/delivery-release.schema.json`
- Delivery receipt: `contracts/delivery-receipt.schema.json`
- Gate/runtime: `scripts/delivery-gate.mjs`
- Regression definitions: `test/delivery-gate.test.mjs`
- Consumer registry: `hubs/delivery/consumers.json`

## Fail-closed 규칙

Delivery Hub는 다음 경우 배포 실행 준비를 허용하지 않는다.

- branch name/`latest`처럼 움직이는 subject revision
- 필요한 Quality Receipt가 없음
- Quality Receipt가 PASS가 아님
- Quality Receipt subject revision이 release subject와 다름
- rollback command 또는 last-known-good가 없음
- production인데 명시적 승인 ref가 없음

## 상태 구분

```text
CODE EXISTS
  != BUILD PASS
  != DEPLOYED
  != RUNTIME SMOKE PASS
  != PRODUCTION READY
```

Delivery Receipt는 build/deployment/smoke를 각각 보존한다. 하나라도 FAIL이면 전체 FAIL, 완료 증거가 부족하면 HOLD다.

## Production 경계

이 runtime은 배포 명령과 gate를 **계획·검증**하는 공통 계층이다. Secret이나 production 권한을 소유하지 않는다. 실제 provider credential, 승인 권한, production environment는 프로젝트/플랫폼의 기존 권한 체계에 남긴다.

## 현재 consumer

FreePass Admin은 등록돼 있지만 HOLD다.

- 최신 mapped Admin revision의 exact-head build/test 증거가 없음
- 기존 GitHub Actions run은 runner_id=0 / 실행 step 0개로 시작되지 않음
- 연결된 Vercel team에서 Admin preview project가 발견되지 않음
- production persistence/auth/runtime smoke 미검증

따라서 배포를 시도하지 않고 HOLD를 유지한다.

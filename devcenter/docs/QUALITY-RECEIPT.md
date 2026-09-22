# Quality Receipt v1

## 목적

Development Center에서 “검사했다”, “문제없다”, “배포 준비됐다”를 말로 끝내지 않고 **프로젝트 exact revision에 묶인 검증 영수증**으로 남긴다.

Machine contract:
- `contracts/quality-receipt.schema.json`

Runtime:
- `scripts/quality-receipt.mjs`

## 핵심 규칙

Quality Receipt는 반드시 다음을 고정한다.

- 대상 project ID / repository / exact 40-char revision
- Primary Hub / Secondary Hubs
- 이번 검사가 주장하는 범위와 명시적 제외 범위
- 실제 runner와 실행 명령
- started/finished timestamp
- 개별 check의 PASS / NOTICE / HOLD / FAIL
- check별 evidence
- FAIL/HOLD의 remediation + recheck
- 전체 result counts
- deterministic receipt ID

## 판정

전체 결과는 개별 check에서 자동 파생한다.

```text
FAIL > HOLD > NOTICE > PASS
```

- PASS인데 evidence가 없으면 receipt가 유효하지 않다.
- HOLD/FAIL인데 evidence + remediation + recheck가 없으면 유효하지 않다.
- `main`, `latest` 같은 움직이는 ref는 subject revision으로 허용하지 않는다.
- receipt ID는 subject/hub/scope/execution/check/source hash의 semantic digest에 묶인다.

## 사용

Draft JSON을 준비한 뒤:

```powershell
node scripts/quality-receipt.mjs finalize draft.json receipt.json
node scripts/quality-receipt.mjs validate receipt.json
```

## 경계

Quality Receipt가 PASS라고 해서 제품 전체 무결점이나 production 안전을 인증하는 것은 아니다. `scope.claims`에 적힌 범위만 증명하고 `scope.exclusions`는 명시적으로 남긴다.

Delivery Hub는 배포/릴리스 완료를 주장할 때 필요한 Quality Receipt를 입력 증거로 사용해야 한다.

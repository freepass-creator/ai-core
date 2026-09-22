# Quality Hub Evidence v2

## 첫 실제 Quality Receipt

대상:
`freepass-creator/freepass-admin@3f1812c6968f57494c1e8204e7a67d54e1c1f3ea`

Receipt:
`evidence/quality/freepass-admin-backend-baseline.json`

Receipt ID:
`qr_c38a088053e3d9c8ac3d56fa`

실제 GitHub run:
`35437766677`

확인된 PASS:
- npm ci
- typecheck
- test
- build

HOLD:
- production persistence
- production auth/permission
- production runtime smoke
- deployment

따라서 이 receipt는 **실행 증거가 있는 범위만 PASS**하고 production readiness는 주장하지 않는다.

## Project → Quality Hub learning

`hubs/quality/patterns.json`에 실제 파일럿에서 확인된 공통 QA 학습을 승격했다.

- semantic error code branching
- repository write-boundary invariants
- scope/revision-bound PASS

이 패턴은 프로젝트의 업무 규칙을 가져오는 것이 아니라 재사용 가능한 검증 원칙만 가져온다.

## Consumer map

`hubs/quality/consumers.json`은 과거 verified baseline receipt와 최신 observed revision을 분리한다.

최신 Admin revision이 있다고 과거 receipt를 최신 revision PASS로 옮겨 적지 않는다.

## Evidence retention

`hubs/quality/retention.json`은 receipt 불변성과 보존/restore 요구를 명시한다.

현재 persistent cross-project evidence index와 retention/restore rehearsal이 없으므로 recovery는 PARTIAL이다.

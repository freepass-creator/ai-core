# Development Center Hub Router Runtime v1

## 목적

7 Hub 구조를 문서 조직도로만 두지 않고 요청을 **Primary Hub + Secondary Hubs**로 결정하는 최소 실행 계약이다.

## 정본

- Hub 조직: `hubs/registry.json`
- 라우팅 규칙: `hubs/routing-rules.json`
- 실행기: `scripts/hub-router.mjs`
- 설정 검증: `scripts/validate-hubs.mjs`
- 회귀 테스트: `test/hub-router.test.mjs`

## Fail-closed 원칙

Router는 모르는 요청을 임의 추측하지 않는다.

- 등록되지 않은 Hub → HOLD
- Hub 개수가 7개가 아니면 → HOLD
- Control Plane이 Hub로 승격되면 → HOLD
- 매칭 없음 → HOLD
- 동점 충돌 → HOLD
- Routing Registry 손상 → HOLD

## 사용

```powershell
node scripts/validate-hubs.mjs
node --test test/hub-router.test.mjs
node scripts/hub-router.mjs "전체 디자인 통일시켜"
node scripts/hub-router.mjs "Firebase 연동 구조 정리"
```

## 현재 한계

v1은 deterministic keyword routing이다. 자연어 의미 전체를 이해하는 분류기가 아니다.

중요한 점은 AI가 자유롭게 Hub를 발명하거나 책임 경계를 바꾸지 못하게 하는 **최소 기계 Gate**를 갖는 것이다. 향후 AI semantic classifier를 붙이더라도 최종 출력은 이 Registry의 7 Hub와 Control Plane 범위를 벗어나면 안 된다.

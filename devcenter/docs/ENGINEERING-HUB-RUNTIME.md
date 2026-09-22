# Engineering Hub Runtime v1

## 목적

프로젝트 곳곳의 공통 코드·스크립트·패턴을 복사 창고로 만들지 않고 **source revision을 고정한 재사용 자산 Registry**로 관리한다.

## 정본

- Asset contract: `contracts/engineering-asset.schema.json`
- Asset registry: `hubs/engineering/assets.json`
- Consumer registry: `hubs/engineering/consumers.json`
- Runtime/gate: `scripts/engineering-hub.mjs`
- Regression definitions: `test/engineering-hub.test.mjs`

## Asset 상태

- `CANDIDATE`: 프로젝트에서 발견했으나 공통 채택 전
- `ACTIVE`: 공통 사용 가능한 검증 자산
- `DEPRECATED`: successor로 이동해야 함
- `RETIRED`: 신규 소비 금지

## Source 원칙

Asset은 반드시:
- repository
- exact 40-char revision
- path
- Git blob SHA
- input/output/side effect
- verification evidence
- lifecycle/rollback ref

를 가진다.

코드를 Development Center로 복제하는 것이 아니라 원본 포인터를 고정한다.

## Promotion

Project → Hub 역수입은 자동 채택이 아니다.

```text
발견
→ CANDIDATE
→ evidence/review
→ ADOPT/HOLD/REJECT
→ new registry revision
→ consumer migration
```

`planPromotion()`은 결정을 계획할 뿐 Registry를 몰래 수정하지 않는다.

## Recovery

ACTIVE asset은 rollback ref가 필수다. DEPRECATED는 successor를 가져야 한다. 실제 rollback rehearsal과 consumer migration evidence가 쌓이기 전 recovery는 PARTIAL이다.

## 현재 등록 자산

- DevCenter typecheck gate
- DevCenter function catalog collector

FreePass Admin backend boundary는 아직 project evidence candidate이며 공통 ACTIVE asset으로 승격하지 않았다.

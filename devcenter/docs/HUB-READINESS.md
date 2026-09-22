# Development Center Hub Readiness v1

## 목적

7개 Hub를 “있다/없다”가 아니라 **증거가 연결된 실행 준비도**로 측정한다.

이 점수는 제품 품질 점수나 운영 인증이 아니다. Development Center가 해당 Hub를 공통 실행 계층으로 얼마나 재사용 가능하게 만들었는지 보여주는 내부 readiness다.

## 8개 축

각 축은 `ABSENT=0 / PARTIAL=1 / VERIFIED=2`다.

1. `contract` — 책임·입출력·상위 Contract
2. `source` — authoritative/candidate source와 revision
3. `runtime` — 실제 실행 진입점
4. `validation` — machine gate / test / conformance
5. `consumers` — 실제 소비 프로젝트와 adoption
6. `evidence` — revision-bound receipt / proof
7. `recovery` — rollback / backup / last-known-good
8. `feedback` — 프로젝트 학습의 Hub/Core 역수입

## 상태

- **READY**: 90% 이상이면서 critical axis(`contract/source/runtime/validation`)가 모두 VERIFIED
- **PARTIAL**: 40% 이상이지만 READY 조건 미충족
- **HOLD**: 40% 미만
- 설정 자체가 손상되면 점수를 내지 않고 FAIL

90%는 반올림으로 억지 통과시키지 않는다. 8축×2점 구조에서는 사실상 15/16 이상과 critical VERIFIED가 필요하다.

## 실행

```powershell
node scripts/hub-readiness.mjs
node --test test/hub-readiness.test.mjs
```

정본:
- `hubs/readiness.json`
- `hubs/registry.json`

## 초기 baseline 해석

초기 값은 2026-09-21 시점에 GitHub에서 확인한 DevCenter / AI Core / FreePass Data / DocsHub 근거를 기준으로 한다. 외부 Repo 구현이 있다고 해서 Development Center Hub runtime이 VERIFIED라고 자동 승격하지 않는다.

특히:
- Design Hub: 규격과 자산은 강하지만 Hub-owned compile/render/receipt loop가 미완성
- Data Hub: FreePass Data 실행 증거는 강하지만 공통 Hub runtime과 recovery가 미완성
- Document Hub: DocsHub 원본은 있으나 validator/consumer/recovery가 약함
- Engineering / Integration: 자산 수집은 있으나 machine contract + conformance runtime이 약함
- Quality Hub: inspection runtime이 있으나 의미 검증 adapter와 canonical receipt가 미완성
- Delivery Hub: 중앙 build/deploy/release runtime과 receipt가 가장 큰 gap

점수 승격은 `evidence`를 추가하고 해당 축을 PARTIAL→VERIFIED로 바꾼 뒤 validator/test를 통과해야 한다.

# FreePass Self Quote / Estimate Engine-Adapter Learning — 2026-09-19

- 상태: `VERIFIED_PROJECT_PATTERN / LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- 현재 Domain SSOT: `freepass-creator/freepass-estimate`
- 현재 검증 브랜치: `work/ui-baseline`
- 검증 revision: `b4488dae5ab38b9e211806766902c4c359091d02`
- 검증 증거: GitHub Actions `New-car baseline CI` run `35437900025` = SUCCESS
- 역사적 이관 원천: `freepass-creator/welrixtable`
- 중고차 역사적 참고: `freepass-creator/sonogong-estimator`
- 학습 대상: AI Core / DevCenter
- 목적: FreePass Estimate에서 실제 구현·회귀검증된 Quote Engine / Provider / Adapter / Snapshot / Interaction Contract 패턴을 공통 학습 후보로 기록한다.

## 1. 현재 권한과 사실

견적 기능의 제품 정본은 **FreePass Estimate**다.

```
AI Core common standards
        ↓ adoption
FreePass Estimate — estimator/domain SSOT
        ↓ distribution
FreePass Sales / Welrix / Partner Channels
```

현재 사실을 구분한다.

- 제품/Domain 소유권: FreePass Estimate
- 신차 실행 코드: FreePass Estimate `work/ui-baseline`에 존재
- 신차 회귀검증: 현재 branch CI PASS
- Welrix: 역사적 UI/계산 reference + 필요 시 external calculation provider
- Sonogong: 중고 견적 역사적 reference
- default `main`: 아직 초기화 commit
- 따라서 AI Core project registry 상태는 `HOLD`
- HOLD 이유는 “실행 코드 미존재”가 아니라 **canonical work branch가 아직 main으로 승격되지 않았고 production proof가 미관측**이기 때문이다.

과거 문구인 “Estimate에는 아직 실행 코드가 없다”는 현재 사실과 맞지 않으며 폐기한다.

## 2. One UI / Multiple Authoritative Providers

화면은 계산 공급자를 선택하지 않는다.

```
Estimator UI
   ↓
freepass-quote-request/v1
   ↓
Configured Quote Provider
   ├─ STANDARD
   │    └─ freepass-standard
   └─ EXTERNAL
        ├─ excel:welrix
        ├─ excel:<partner>
        └─ erp:<partner>
```

Provider 선택은 회사/채널 설정이 소유한다.

핵심:
- provider마다 UI를 fork하지 않는다.
- provider 교체가 차량선택/조건/결과/공유 UI 변경을 요구하지 않게 한다.
- 외부 계산 공급자가 추가돼도 공통 QuoteRequest/QuoteResult를 유지한다.

## 3. Calculation Truth Owner != Product SSOT

외부 회사가 특정 계산식의 진실값을 소유할 수 있다.

예:
- Welrix가 Welrix 채널 계산 결과를 authoritative하게 계산
- FreePass Estimate가 공통 UI/UX와 Quote contract를 소유

즉:

```
Calculation Truth Owner
        ≠
Shared Estimator Product Owner
```

외부 계산기를 사용한다고 해서 외부 프로젝트가 공통 견적 제품의 정본이 되지 않는다.

이 권한 분리는 partner Excel / ERP / API가 늘어날수록 중요하다.

## 4. Semantic Contract IDs

숫자 `v1`만 흩어두지 않고 계약 이름과 버전을 함께 고정한다.

현재 Estimate canonical contracts:

- `freepass-quote-request/v1`
- `freepass-quote-result/v1`
- `freepass-quote-provider/v1`
- `freepass-quote-execution/v1`
- `freepass-quote-snapshot/v2`
- `freepass-estimate-mobile-navigation/v1`

학습 포인트:
- “v1”만으로는 어떤 계약의 v1인지 증명되지 않는다.
- evidence/proof에는 semantic contract id가 필요하다.
- legacy numeric version은 하위호환용으로만 유지할 수 있다.

## 5. Engine Owns Meaning

공통 견적 계약이 소유하는 의미:

- 금액 단위
- 비율 단위
- 기간 단위
- 차량/조건/시나리오 의미
- 요청/결과 무결성
- scenario ↔ result positional continuity

예:
- 공통 계약: 보증금 `10` = 10%
- Welrix API: `0.1`
- 변환 위치: Welrix Adapter 내부

Provider 특수 규칙을 UI나 공통 Domain 계약으로 끌어올리지 않는다.

이는 AI Core working invariant의 실제 제품 증거다.

> **Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state.**

## 6. Adapter Owns Provider-specific Translation

Adapter 책임:

- provider 전용 field mapping
- 단위 변환
- provider vehicle identifier mapping
- external body
- HTTP/API/Excel/ERP 호출
- response normalization
- provider error taxonomy
- credential/server boundary

UI와 공통 Engine은 provider-specific payload를 직접 소유하지 않는다.

## 7. Fail-closed Authoritative Provider

authoritative provider 장애 시 다른 계산기로 silent fallback하지 않는다.

명시적으로 실패/HOLD 처리하는 예:

- provider unsupported
- upstream unavailable
- invalid response
- 결과 cardinality 불일치
- 필요한 차량 사실 미확정
- 원가정책 미확정

실제 사례:
- FreePass Standard 전수 기준 535건 중 532 PASS
- 현대 NEXO 3건은 수소차 원가정책 미확정으로 의도적 fail-closed

핵심:
**부정확한 금액을 정상처럼 보여주는 것보다 정확하게 멈추는 것이 우선이다.**

## 8. Positional / Cardinality Continuity

요청 scenario 배열과 결과 배열은:

- 같은 길이
- 같은 순서

를 유지한다.

일부 scenario가 계산 불가라고 결과를 당겨 붙이면 기간과 금액의 의미가 바뀔 수 있다.

이 패턴은 batch calculation 전반의 공통 후보다.

## 9. Snapshot Continuity + Versioned Provenance

공유 견적은 수신 시점에 재계산하지 않는다.

```
실시간 계산
  ↓
확정 Snapshot
  ↓
공유
  ↓
수신자는 Snapshot 그대로 조회
  ↓
조건 변경 시 새 계산
```

새 Snapshot 규격:
- `freepass-quote-snapshot/v2`
- quote contract
- result contract
- execution contract
- source revision
- provider mode
- 확정 금액/조건

보안 경계:
- customer share URL에 adapter id 같은 내부 연결 세부는 넣지 않는다.
- provider mode 수준의 provenance만 허용한다.

하위호환:
- 기존 `v1` 공유 링크는 계속 읽는다.
- 알려지지 않은 미래 snapshot contract는 fail-closed로 무시한다.

이 패턴은 신청/주문/승인/계약/가격제안에도 재사용 후보가 된다.

## 10. Interaction State is a Contract

FreePass Estimate 모바일 정본:

`제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림 → 색상 → 옵션 → 조건 → 결과`

규칙:
- 단일선택 단계는 즉시 auto-advance
- Back은 이전 선택을 보존
- 색상/옵션/조건 등 완료 의사가 필요한 단계만 explicit Next
- auto 단계에서도 공통 Footer/Next infrastructure는 mounted/prepared
- auto에서는 Next를 숨기고 manual 단계에서 같은 navigation contract를 사용
- **Top is informational / Bottom is actionable**

학습 포인트:
- UI 동작도 검증 가능한 상태계약으로 관리
- hidden과 nonexistent를 구분
- 정책 변경 시 DOM/컴포넌트 재설계보다 state transition을 바꾼다.

## 11. Runtime Proof — AI Core에서 Estimate가 채택한 것

Estimate는 AI Core의 공통 runtime evidence 개념을 실제 견적에 채택했다.

`freepass-quote-execution/v1`:

- SUCCEEDED / HOLD / FAILED
- provider
- engine
- subject_revision
- started_at / ended_at
- evidence
- checks
- blockers

Vite build에 immutable revision을 inject해 Quote execution proof의 `subject_revision`과 연결한다.

즉 견적 금액만 반환하는 것이 아니라:
**어떤 계약·어떤 provider·어떤 build에서 계산됐는지** 추적 가능하게 한다.

## 12. Stable Error Taxonomy

문자열 message만으로 분기하지 않는다.

예:
- QUOTE_REQUEST_INVALID
- QUOTE_REQUEST_CONTRACT_UNSUPPORTED
- QUOTE_ENGINE_UNKNOWN
- QUOTE_ENGINE_UNSUPPORTED
- QUOTE_RESULT_INVALID
- PROVIDER_UNSUPPORTED
- PROVIDER_ERROR
- PROVIDER_RESPONSE_INVALID

학습 포인트:
- 사용자 문구는 바뀔 수 있다.
- 프로그램 제어와 evidence는 stable code를 사용한다.

## 13. Release Proof — AI Core에서 Estimate가 채택한 것

`/api/version`을 추가했다.

구분:
- Git merge
- CI PASS
- deployment READY
- actual production revision observation

은 서로 다른 상태다.

현재:
- branch CI는 PASS
- production URL/revision은 AI Core에 아직 관측되지 않음
- 따라서 project registry는 HOLD가 맞다.

## 14. Unified Verify Command

Estimate는 검증 로직이 GitHub Actions YAML에만 흩어져 있던 상태에서 AI Core 운영 방식에 맞춰:

`npm --prefix apps/new run verify`

를 추가했다.

포함:
- action placement
- mobile navigation
- visual grammar
- accessibility baseline
- vehicle configuration
- standard engine regression
- provider contract/routing
- runtime proof
- snapshot contract
- release proof
- sync
- production build

학습 포인트:
- 프로젝트는 AI/사람 모두 재현 가능한 한 개의 대표 verification entrypoint를 갖는 편이 좋다.
- CI YAML 자체가 유일한 실행 정본이 되지 않게 한다.

## 15. Verification Contract Drift — 실제 Failure Memory

실제 발견:

구현은 이미:
- header 정보 전용
- 공유/발송 하단 footer

였지만 과거 Playwright E2E는:
- `.m-header .m-act`

를 검사하고 있었다.

즉:

```
Implementation Revision
        >
Verification Contract Revision
```

CI 파일이 존재한다고 최신 요구를 증명하는 것은 아니다.

AI Core 학습 후보:
- source/code revision뿐 아니라 verification contract provenance 추적
- acceptance criteria 변경 시 stale selector/test 탐지
- proof bundle에 어떤 계약을 검증했는지 포함

## 16. Accessibility — AI Core에서 Estimate가 채택한 것

AI Core Screen Design Standard에서 비파괴적으로 우선 채택:

- visible `:focus-visible`
- reduced-motion
- 44px touch-target floor token
- input/CTA minimum checks

주의:
- 승인된 화면 밀도를 깨지 않기 위해 36px visual chip을 무조건 44px로 확대하지 않음
- effective hit target 검증이 먼저 필요

## 17. Verification Layers

현재 신차 branch CI:

### UI / Interaction
- UI parity
- action placement
- mobile navigation contract
- visual grammar
- accessibility baseline

### Domain / Provider
- representative vehicle configuration
- standard engine regression
- provider contract
- provider routing

### Evidence / Provenance
- quote runtime proof contract
- share snapshot provenance contract
- release revision proof contract

### Delivery
- sync checks
- production build
- preview build artifact

최신 verified run:
- `35437900025` — SUCCESS

## 18. AI Core Project Registry / Routing 반영

AI Core는 이제 FreePass Estimate를 정식 프로젝트로 인식한다.

Project registry:
- project_id: `freepass-estimate`
- status: `HOLD`
- work branch: `work/ui-baseline`

Work Map:
- work type `estimator`
- target project: `freepass-estimate`

Capability:
- `sales.vehicle-estimator`
- owner project: `freepass-estimate`

기존 `sonogong-estimator` 타깃은 역사적 중고 reference로 남고,
그룹 견적기 오더의 canonical target은 FreePass Estimate로 바뀌었다.

## 19. FreePass Admin과 합쳐서 보는 공통 후보

FreePass Admin:
```
UI → Application Service → Domain Engine → Port → Adapter/Repository
```

FreePass Estimate:
```
UI → Quote Contract/Engine → Configured Provider Adapter → Calculation Source
```

두 실제 프로젝트에서 반복 검증된 후보:
- Domain meaning / external connection 분리
- versioned semantic contract
- Adapter boundary validation
- fail-closed
- canonical internal semantics
- Snapshot/revision continuity
- project-specific authority 유지
- testable execution evidence

Engine/Adapter 분리는 이제 단일 프로젝트 추상이 아니라 복수 실제 제품 evidence를 가진다.

## 20. 자동 공통 승격 금지선

AI Core/DevCenter가 가져가면 안 되는 것:

- FreePass 견적 산식
- 차량 원가정책
- 특정 provider mapping
- 차량 단계 세부 UI
- NEXO 정책 결정
- 고객 공개 문구

AI Core는 패턴·계약·evidence 방식만 학습한다.

## 21. 남은 Promotion Gate

공통 규격 승격 전 추가 검증:

1. 두 번째 실제 external provider Adapter
2. timeout/retry/circuit-breaker 공통 정책
3. provider health contract
4. customer-visible error vs internal diagnostic 분리
5. verification-contract stale detection 자동화
6. 중고 provider가 같은 canonical Quote contract를 재사용하는지 검증
7. production URL revision proof
8. work branch → main canonical promotion

## 22. 근거

FreePass Estimate:
- `PROJECT.md`
- `AGENTS.md`
- `docs/NEW_CAR_ARCHITECTURE.md`
- `docs/AI_CORE_ALIGNMENT_2026-09-19.md`
- `apps/new/src/lib/quote/contracts.js`
- `apps/new/src/lib/quote/spec.js`
- `apps/new/src/lib/quote/build-request.js`
- `apps/new/src/lib/quote/calculate.js`
- `apps/new/src/lib/quote/execution-result.js`
- `apps/new/src/lib/quote/engines/freepass-standard.js`
- `apps/new/src/lib/quote/engines/external.js`
- `apps/new/src/lib/share-link.js`
- `apps/new/api/external-quote.js`
- `apps/new/api/version.js`
- `apps/new/scripts/check-provider-contract.mjs`
- `apps/new/scripts/check-quote-execution-contract.mjs`
- `apps/new/scripts/check-share-snapshot-contract.mjs`
- `apps/new/scripts/e2e-mobile-ux.mjs`
- verified revision: `b4488dae5ab38b9e211806766902c4c359091d02`

Historical lineage:
- `freepass-creator/welrixtable`
- pinned initial UI baseline: `707a57f8f97aed28eaab7f1fa7e42cd0bff9ee2d`
- `freepass-creator/sonogong-estimator`

AI Core:
- `registry/projects.json`
- `registry/work-map.json`
- `registry/capabilities.json`
- `src/engine/adapter-contract.mjs`
- `src/engine/result-envelope.mjs`
- `docs/SCREEN_DESIGN_STANDARD.md`
- `docs/shared-services/SHARED_RELEASE_GATE.md`
- `docs/coordination/FREEPASS_ADMIN_BACKEND_LEARNING.md`

## 23. 한 줄 결론

> **FreePass Estimate는 이미 신차 견적 Runtime/Provider/UX/Share 계약을 실제 구현하고 CI로 검증한 canonical estimator 프로젝트다. AI Core는 이 업무를 가져가는 것이 아니라 semantic contract, provider authority separation, fail-closed, snapshot provenance, interaction-state contract, verification-drift 교훈을 학습하고 그룹 라우팅을 이 프로젝트로 향하게 한다.**

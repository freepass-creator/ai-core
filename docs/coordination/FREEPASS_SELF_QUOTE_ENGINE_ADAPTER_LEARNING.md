# FreePass Self Quote Engine / Adapter Learning — 2026-09-19

- 상태: `LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- **현재 원천 프로젝트 / Domain SSOT**: `freepass-creator/freepass-estimate`
- 역사적 이관 원천: `freepass-creator/welrixtable`
- 학습 대상: AI Core / DevCenter
- 관련 정본: FreePass Estimate `PROJECT.md`, `docs/NEW_CAR_ARCHITECTURE.md`, `apps/new/src/lib/quote/**`
- 목적: 실제 견적 제품에서 검증된 Engine / Provider / Adapter / Snapshot / interaction-state / fail-closed 패턴을 AI Core가 학습하되, 견적 업무 권한은 FreePass Estimate에 남긴다.

## 1. Authority

현재 견적 기능의 정본은 **FreePass Estimate**다.

```
AI Core common standards
        ↓ adoption
FreePass Estimate — estimator/domain SSOT
        ↓ distribution
FreePass Sales / Welrix / Partner Channels
```

Welrix는 초기 검증 UI/계산 구조의 migration reference이며, 특정 채널의 authoritative calculation provider일 수 있다.
그러나 견적 UI/UX, QuoteRequest/QuoteResult, navigation contract의 장기 소유권은 FreePass Estimate에 있다.

AI Core는 다음을 학습한다.

- 재사용 가능한 패턴
- 계약/증거 형식
- provider 권한 분리
- 검증 방식

AI Core가 소유하지 않는 것:

- 차량 견적 업무 의미
- FreePass Standard 계산식
- 특정 차량/원가 정책
- Welrix provider mapping
- 견적 화면 세부 UX 정본

## 2. One UI / Multiple Authoritative Providers

제품 화면은 계산 공급자를 선택하거나 알 필요가 없다.

```
Estimator UI
   ↓
Normalized QuoteRequest
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
- Provider 교체가 차량선택/조건/결과/공유 UI 변경을 요구하지 않게 한다.
- 외부 provider가 추가돼도 공통 Quote contract를 유지한다.

## 3. Calculation Truth Ownership != Shared Product Ownership

실제 제품에서 중요한 권한 분리다.

예:
- Welrix는 자기 계산식의 금액 진실값을 소유할 수 있다.
- FreePass Estimate는 공통 견적 UI/UX와 Quote contract를 소유한다.

즉:

```
Calculation Truth Owner
        ≠
Shared Estimator Product Owner
```

외부 계산기를 쓴다는 이유로 외부 프로젝트가 공통 제품 정본이 되지 않는다.

이 구분은 partner Excel/ERP/API가 늘어날수록 공통 아키텍처에 중요하다.

## 4. Engine Owns Meaning

공통 견적 계약이 소유하는 의미:

- 금액 단위
- 비율 단위
- 기간 단위
- 차량/조건/시나리오의 업무 의미
- 요청/결과 무결성
- scenario와 result의 positional continuity

예:
- 공통 계약: 보증금 `10` = 10%
- 어떤 provider: `0.1` 요구
- 변환 위치: 해당 Adapter 내부

Provider 특수 단위를 Domain/UI 계약으로 끌어올리지 않는다.

## 5. Adapter Owns Provider-specific Translation

Adapter 내부 책임:

- provider 전용 field mapping
- % ↔ ratio 변환
- provider vehicle identifier mapping
- external request body
- HTTP/API/Excel/ERP 호출
- response schema normalization
- provider error → product error taxonomy
- provider별 credential/server boundary

Engine/UI는 provider-specific payload를 직접 소유하지 않는다.

이는 AI Core working invariant의 실제 제품 증거다.

> **Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state.**

## 6. Fail-closed Authoritative Provider

외부 provider가 해당 채널의 authoritative calculation source라면 장애 시 다른 엔진으로 몰래 fallback하지 않는다.

실패/보류로 취급하는 예:

- upstream HTTP 실패
- provider unsupported
- invalid response
- 결과 길이/순서 불일치
- 숫자 무결성 실패
- 필요한 원가정책/차량 사실 미확정

핵심:
**정확하지 않은 금액을 정상처럼 보여주는 것보다 명시적으로 멈추는 것이 낫다.**

공통화 후보:
- authoritative provider 선언
- fallback policy 명시
- fail-open / fail-closed
- unsupported / unavailable / invalid response 분리

## 7. Positional Result Continuity

요청의 시나리오 배열과 결과 배열은:

- 같은 길이
- 같은 순서

를 유지한다.

특정 scenario를 계산하지 못하면 결과를 당겨 붙이지 않고 해당 위치 의미를 보존한다.

이 패턴은 batch calculation 전반에서 재사용 후보가 된다.

## 8. Snapshot Continuity

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

이 원칙은 견적뿐 아니라:
- 신청
- 주문
- 승인
- 계약
- 가격 제안

처럼 “당시 사용자가 본 결과”를 보존해야 하는 업무에 재사용 가능하다.

Snapshot 후보 메타:
- source/provider
- engine/contract version
- source revision
- selected inputs
- returned results
- created_at
- 수정 후 새 revision

## 9. Interaction State is a Contract

FreePass Estimate 모바일에서는 UI 흐름을 단순 화면 취향이 아니라 검증 가능한 상태계약으로 본다.

정본 규칙:
- 제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림은 단일선택 즉시 전진
- Back은 선택값 보존
- 색상/옵션/조건처럼 완료 의사가 필요한 단계만 explicit Next
- 자동전진 단계에서도 공통 Footer/Next infrastructure는 준비 상태로 유지
- auto 단계에서는 Next를 숨기고 manual 단계에서 같은 navigation contract를 노출
- **Top is informational / Bottom is actionable**

AI Core가 배울 점:
- interaction을 화면별 if 문이 아니라 state + contract로 관리
- hidden과 nonexistent를 구분
- 향후 auto/manual 정책 변경을 같은 navigation contract로 흡수

## 10. Verification: Offline Contract + Live Parity + Domain Regression

실제 Estimate 검증층:

### Offline contract
- provider contract
- provider routing
- request/result boundary
- fallback 금지
- error taxonomy

### Domain regression
- standard engine regression
- vehicle configuration resolver
- source fact audit
- fail-closed unsupported cases

### UI interaction regression
- action placement
- mobile navigation contract
- UI parity
- accessibility baseline
- Playwright flow

### Live / reference parity
- authoritative external calculator와 동일 조건·동일 결과 대조
- 대표 차종 0원 차이 검증

공통 학습 포인트:
**테스트 파일이 있다는 것과 현재 요구사항을 검증한다는 것은 다르다.**

## 11. Verification Contract Drift — 실제 발견된 Failure Memory

2026-09-19 비교 과정에서 실제 drift가 발견됐다.

구현:
- 모바일 header는 이미 정보 전용
- 공유/발송은 하단 action footer로 이동

그런데 오래된 Playwright E2E는 여전히:
- `.m-header .m-act`

를 찾고 있었다.

즉:

```
Implementation Revision
        >
Verification Contract Revision
```

코드는 최신이었지만 검증기가 과거 요구사항을 검사했다.

AI Core 학습 후보:
- source/code revision뿐 아니라 verification contract 적용 revision도 관리
- acceptance criteria 변경 시 관련 E2E selector/contract stale 탐지
- “CI 초록”이 최신 요구사항의 proof인지 별도 확인
- proof bundle에 검증 규격의 provenance 포함 검토

## 12. AI Core가 앞서 있어 Estimate가 채택한 것

이 학습은 양방향이다.

Estimate는 AI Core에서 다음을 배워 실제 코드에 반영했다.

### 12.1 Runtime execution evidence
`freepass-quote-execution/v1`

- SUCCEEDED / HOLD / FAILED
- provider
- engine
- subject_revision
- started_at / ended_at
- evidence
- checks
- blockers

### 12.2 Stable error taxonomy
문자열 message만이 아니라 stable code 병행.

예:
- QUOTE_REQUEST_INVALID
- QUOTE_ENGINE_UNKNOWN
- QUOTE_ENGINE_UNSUPPORTED
- QUOTE_RESULT_INVALID
- PROVIDER_UNSUPPORTED
- PROVIDER_ERROR

### 12.3 Production revision proof
`/api/version`

- merge != deploy
- deploy READY != production proof
- 실제 운영 URL이 expected revision을 서빙해야 완료

### 12.4 Accessibility baseline
AI Core Screen Design Standard에서 우선 비파괴 적용:
- visible focus
- reduced-motion
- 44px touch target floor token
- input/CTA minimum

36px visual chip은 승인된 밀도와 충돌할 수 있어 effective hit target 검증 전 무조건 확대하지 않는다.

## 13. FreePass Admin 사례와 합쳐서 보는 공통 후보

FreePass Admin:
```
UI → Application Service → Domain Engine → Port → Adapter / Repository
```

FreePass Estimate:
```
UI → Quote Contract/Engine → Configured Provider Adapter → Calculation Source
```

두 실제 프로젝트에서 반복 관측된 후보:

- Domain meaning과 external connection 분리
- versioned contract
- Adapter boundary validation
- fail-closed
- canonical internal semantics
- Snapshot/revision continuity
- provider/repository idempotency/evidence boundary
- project-specific authority 유지

이제 Engine / Adapter 분리는 단일 프로젝트 추상이 아니라 두 실제 프로젝트에서 반복된 학습 후보로 볼 근거가 강화됐다.

## 14. 아직 자동 공통 승격하지 않는 이유

다음은 추가 검증 필요:

1. 다른 실제 external provider Adapter에서 재사용
2. timeout / retry / circuit-breaker 정책 표현
3. provider health contract
4. source revision + snapshot revision 공통 envelope
5. customer-visible error와 internal diagnostic 분리
6. verification-contract stale detection 메커니즘
7. 두 개 이상 다른 도메인에서 interaction state contract 재사용성

## 15. Promotion Gate

AI Core/DevCenter 공통 규격으로 승격 전 최소:

1. FreePass Estimate CI/regression 유지
2. 다른 실제 프로젝트에서 provider-neutral contract 재사용
3. fallback/fail-closed 정책의 도메인 적합성 검증
4. request/result continuity가 실제 오류를 방지한 증거
5. verification stale detection 검증
6. project-specific Domain authority를 침범하지 않음
7. pinned version/revision + rollback 경로

## 16. 근거

FreePass Estimate:
- `PROJECT.md`
- `AGENTS.md`
- `docs/NEW_CAR_ARCHITECTURE.md`
- `docs/AI_CORE_ALIGNMENT_2026-09-19.md`
- `apps/new/src/lib/quote/spec.js`
- `apps/new/src/lib/quote/calculate.js`
- `apps/new/src/lib/quote/execution-result.js`
- `apps/new/src/lib/quote/engines/freepass-standard.js`
- `apps/new/src/lib/quote/engines/external.js`
- `apps/new/api/external-quote.js`
- `apps/new/api/version.js`
- `apps/new/scripts/check-provider-contract.mjs`
- `apps/new/scripts/check-quote-execution-contract.mjs`
- `apps/new/scripts/e2e-mobile-ux.mjs`

Historical lineage:
- `freepass-creator/welrixtable`
- initial pinned UI baseline: `707a57f8f97aed28eaab7f1fa7e42cd0bff9ee2d`

AI Core:
- `src/engine/adapter-contract.mjs`
- `src/engine/result-envelope.mjs`
- `src/engine/project-runtime.mjs`
- `docs/SCREEN_DESIGN_STANDARD.md`
- `docs/shared-services/SHARED_RELEASE_GATE.md`
- `docs/coordination/FREEPASS_ADMIN_BACKEND_LEARNING.md`

## 17. 한 줄 결론

> **FreePass Estimate는 “하나의 견적 제품이 여러 authoritative 계산 공급자를 같은 Domain 계약으로 소비하는 구조”를 실제로 구현한 사례다. AI Core는 견적 업무를 가져가지 않고 Provider/Adapter 권한 분리, fail-closed, Snapshot continuity, interaction-state contract, parity evidence, verification-drift 교훈을 학습한다.**

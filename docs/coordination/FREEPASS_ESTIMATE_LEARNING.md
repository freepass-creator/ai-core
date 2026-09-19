# FreePass Estimate Learning Packet — 2026-09-19

- 상태: `LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- 원천 프로젝트: `freepass-creator/freepass-estimate`
- 학습 대상: AI Core / DevCenter
- 범위: 견적 Domain SSOT, Quote Engine / Provider / Adapter, UI interaction state contract, regression evidence
- 목적: FreePass Estimate에서 실제 제품으로 구체화·검증된 패턴 중 AI Core의 일반 추상화보다 앞선 부분을 학습 후보로 기록한다.

## 1. Authority

FreePass Estimate는 견적 기능의 정본이다.

```
FreePass Estimate
   ├─> FreePass Sales
   ├─> Welrix
   └─> Partner / Channel surfaces
```

AI Core가 이 패턴을 학습하더라도 견적 업무 의미나 견적 UI 소유권을 가져가지 않는다.

- AI Core: 공통 통제·증거·revision·release·검증 규격
- FreePass Estimate: 견적 Domain / UI interaction / Quote contract / Provider contract SSOT
- Downstream apps: canonical 견적 기능 소비

## 2. 실제 제품에서 앞서 있는 패턴

### 2.1 One UI, multiple authoritative providers

화면은 계산기를 선택하지 않는다.

```
Estimator UI
   ↓
Normalized QuoteRequest
   ↓
Configured Quote Provider
   ├─ STANDARD → freepass-standard
   └─ EXTERNAL
        ├─ excel:welrix
        ├─ excel:<partner>
        └─ erp:<partner>
```

Provider 선택은 회사/채널 설정이 소유한다.

이 패턴의 핵심은 provider마다 UI를 fork하지 않는 것이다.

### 2.2 Calculation truth ownership != shared UI ownership

Welrix 같은 외부 공급자는 자기 계산식의 진실값을 소유할 수 있다.
그러나 그 사실이 견적 화면·QuoteRequest·QuoteResult·상호작용의 소유권까지 의미하지 않는다.

즉 두 권한을 분리한다.

- Calculation truth owner
- Shared product/contract owner

이 구분은 partner API/ERP/Excel 연동이 늘어날수록 중요하다.

### 2.3 Adapter owns provider-specific translation

공통 요청 안에서는 비율·금액·차량 사실의 의미를 고정한다.
특정 공급자가 다른 단위나 필드명을 요구하면 adapter 내부에서만 변환한다.

예:
- 공통 계약: 보증금 10 = 10%
- Welrix provider: 0.1 필요
- 변환 위치: Welrix adapter 내부

Provider의 특수 규칙을 UI나 공통 Domain 계약으로 끌어올리지 않는다.

이는 AI Core working invariant인
`Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state`
의 실제 제품 사례다.

### 2.4 Fail-closed authoritative provider

외부 provider가 authoritative calculation source일 때 장애가 나면
다른 계산기로 몰래 fallback하지 않는다.

잘못된 금액을 정상처럼 제공하는 것이 명시적 실패보다 더 위험하기 때문이다.

공통화 후보:
- authoritative provider
- fallback policy
- fail-open / fail-closed 명시
- unsupported vs unavailable vs invalid-response 구분

### 2.5 Positional result continuity

견적 요청의 시나리오 배열과 결과 배열은 같은 길이·같은 순서를 유지한다.
한 시나리오를 계산할 수 없어도 결과 항목을 당겨 붙이지 않고 해당 자리에 `null`을 둔다.

이것은 단순 포맷 규칙이 아니라 요청-결과 의미 연속성 규칙이다.

다른 batch calculation/domain에도 재사용 가능성이 있다.

### 2.6 Interaction state is a contract

FreePass Estimate 모바일에서는 다음을 단순 UI 취향이 아니라 검증 가능한 상태계약으로 취급한다.

- 제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림은 단일 선택 즉시 전진
- Back은 이전 선택을 보존
- 색상/옵션/조건 등 완료 의사가 필요한 단계만 명시적 Next
- 자동전진 단계에서도 공통 Footer/Next infrastructure는 준비된 상태로 유지
- auto 단계에서는 Next를 숨기고 manual 단계에서 같은 navigation contract를 노출
- Top is informational / Bottom is actionable

이 패턴은 단계별 UI를 조건문으로 즉흥 구현하지 않고
`state + navigation contract`로 고정했다는 점이 핵심이다.

### 2.7 Domain regression evidence

현재 Estimate는 일반 unit test보다 업무 의미에 가까운 검사를 가진다.

- provider contract
- provider routing
- vehicle configuration resolver
- standard-engine regression
- external Excel parity
- mobile navigation contract
- action-placement contract
- UI parity
- fail-closed unsupported cases

공통 학습 포인트:
**Domain Engine은 단순 함수 테스트뿐 아니라 실제 authoritative reference와의 parity evidence를 가져야 할 수 있다.**

## 3. 이번 비교에서 Estimate가 AI Core로부터 채택한 것

Estimate가 더 앞선 프로젝트는 아니다. AI Core가 훨씬 성숙한 공통 계층도 있다.

이번 비교에서 다음을 Estimate에 반영했다.

### 3.1 Runtime execution evidence

견적 결과와 별도로 `freepass-quote-execution/v1` metadata를 추가했다.

- SUCCEEDED / HOLD / FAILED
- provider / engine
- started_at / ended_at
- subject_revision
- evidence
- checks
- blockers

기존 QuoteResult 의미는 깨지지 않는다.

### 3.2 Stable error taxonomy

문자열 message만 사용하지 않고 안정적인 code를 병행한다.

예:
- QUOTE_REQUEST_INVALID
- QUOTE_ENGINE_UNKNOWN
- QUOTE_ENGINE_UNSUPPORTED
- QUOTE_RESULT_INVALID
- PROVIDER_UNSUPPORTED
- PROVIDER_ERROR

### 3.3 Production revision proof

`/api/version`을 추가해 실제 운영 주소가 어떤 revision을 서빙하는지 확인할 수 있게 했다.

Git merge / CI PASS / deployment READY와 실제 production proof를 구분한다.

### 3.4 Accessibility baseline

AI Core Screen Design Standard에서 비파괴적으로 채택 가능한 부분을 우선 반영했다.

- visible focus
- reduced-motion
- 44px touch-target floor token
- input/CTA 최소 높이 검사

36px visual chip은 승인된 밀도와 충돌 가능성이 있으므로
effective hit target 검증 없이 무작정 44px로 확대하지 않는다.
이 항목은 별도 실제 화면 audit가 필요하다.

## 4. 이번에 발견된 중요한 Failure Memory 후보

실제 구현은 이미 상단 CTA를 제거하고 하단 action footer로 바뀌어 있었지만
Playwright E2E는 과거 `.m-header .m-act`를 계속 찾고 있었다.

즉:

```
Implementation revision > Verification contract revision
```

코드는 최신인데 검증기가 과거 상태를 검사하는 drift였다.

AI Core가 학습할 후보:
- production/code revision만 pin하지 말고 verification contract의 적용 revision도 추적
- 테스트가 존재한다는 사실과 현재 요구사항을 검증한다는 사실을 구분
- UI contract 변경 시 관련 E2E selector/acceptance contract의 stale detection 필요

## 5. AI Core / DevCenter 공통화 후보

즉시 전사 표준으로 승격하지 않는다.
다른 실제 프로젝트에서 재사용 증거가 생기면 다음을 검토한다.

1. Provider-neutral Domain Request/Result contract
2. Authoritative provider + explicit fallback policy
3. Provider adapter 내부 unit/field normalization
4. Positional batch result continuity
5. UI interaction state/navigation contract
6. Verification-contract revision continuity
7. Domain parity evidence profile

## 6. 공통화하면 안 되는 것

다음은 Estimate local이다.

- 차량 견적 필드 자체
- 신차 장기렌터카 계산 정책
- FreePass Standard 원가 계산식
- Welrix 차량/provider mapping
- 차량 단계명과 견적 화면 상세 UI
- 특정 차량 예외 정책

공통화 대상은 업무값이 아니라 패턴·계약·증거 방식이다.

## 7. Promotion gate

AI Core/DevCenter 공식 공통 규격 후보로 승격하려면 최소:

1. Estimate에서 현재 CI/regression 증거 유지
2. 다른 실제 프로젝트에서 같은 provider-neutral pattern 재사용
3. fail-closed/fallback policy가 다른 도메인에서도 유효한지 검증
4. request/result continuity가 실제 오류를 방지했다는 증거
5. verification stale detection 방식 검증
6. project-specific Domain authority를 침범하지 않음

## 8. 핵심 한 줄

> FreePass Estimate는 **하나의 제품 UI가 여러 authoritative 계산 공급자를 소비하면서도 Domain 계약과 상호작용을 하나로 유지하는 실제 사례**다. AI Core는 이 제품 로직을 가져가는 것이 아니라 Provider/Adapter 권한 분리, fail-closed 정책, interaction-state contract, parity evidence 패턴을 학습 후보로 가져간다.

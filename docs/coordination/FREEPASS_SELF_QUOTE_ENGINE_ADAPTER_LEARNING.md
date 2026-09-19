# FreePass Self Quote Engine / Adapter Learning — 2026-09-19

- 상태: `LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- 원천 프로젝트: `freepass-creator/welrixtable`
- 학습 대상: AI Core / DevCenter
- 관련 정본: `docs/SELF-QUOTE-CONTRACT.md`, `src/lib/quote/**`
- 목적: 외부 계산 시스템을 소비하는 실제 제품에서 Engine / Adapter / Snapshot / fail-closed 경계를 검증한 두 번째 실전 사례로 기록한다.

## 1. 제품 경계

FreePass Self Quote는 자체 월 대여료 계산기를 새로 만드는 제품이 아니다.

```text
FreePass UI / 선택 뼈대
  ↓
Quote Engine — 업무 의미와 공통 단위
  ↓
Welrix Adapter — 외부 규격 변환·통신·응답 검증
  ↓
Welrix Estimate API — 실제 대여료 계산
```

핵심은 화면이 Welrix 전송 규격을 직접 알지 않고, 공통 Engine도 외부 시스템의 비율 표현이나 API body를 소유하지 않는다는 점이다.

## 2. 실제로 검증된 규칙

### 2.1 Engine owns meaning

공통 견적 계약은 다음 의미와 단위를 소유한다.

- 금액: 원 단위의 유한한 비음수 숫자
- 비율: 퍼센트 단위. 예: 10% = `10`
- 기간: 개월
- 차량/조건/시나리오의 업무 의미
- 요청/결과 무결성 검사

외부 API가 10%를 `0.1`로 요구하더라도 공통 Engine 계약은 바뀌지 않는다.

### 2.2 Adapter owns external mapping

Welrix Adapter 안에서만 다음을 처리한다.

- `10 → 0.1` 같은 % → ratio 변환
- Welrix request body 생성
- HTTP 통신
- Welrix response schema 검사
- upstream 오류를 제품 오류로 변환

따라서 Welrix API body가 바뀌어도 UI/공통 Engine이 같이 흔들리지 않는 구조다.

### 2.3 Fail-closed

외부 계산이 실패하거나 부분 응답을 주면 로컬 계산기로 조용히 대체하지 않는다.

다음은 모두 실패다.

- HTTP 실패
- `ok !== true`
- 결과 개수 불일치
- 차량가/월 대여료 등 숫자 무결성 실패
- 일부 시나리오만 정상인 부분 응답

가격·금융·계약성 결과에서는 “값을 보여주는 것”보다 “정확한 출처와 동일한 값임을 보장하는 것”이 우선일 수 있다는 실전 사례다.

## 3. Snapshot continuity

공유 견적은 링크를 여는 시점에 다시 계산하지 않는다.

```text
실시간 계산
  ↓
확정 결과 Snapshot 생성
  ↓
공유
  ↓
수신자는 Snapshot 그대로 조회
  ↓
조건을 실제로 변경할 때만 새 계산
```

이 패턴은 견적 외에도 주문·신청·승인·계약처럼 “사용자가 당시 본 결과”를 보존해야 하는 업무에 재사용 후보가 된다.

공통화 후보:

- source revision / engine identifier
- snapshot createdAt
- selected inputs
- returned results
- 수정 시 새 revision 생성
- 과거 snapshot immutable 유지

## 4. Contract version + verification

현재 제품에서 명시한 버전:

- Quote contract: `quote-v1`
- Welrix adapter contract: `welrix-estimate-v1`

검증을 두 종류로 분리한다.

### Offline contract test

외부 서버 없이 CI에서 항상 검증:

- 단위 경계
- 유효 범위
- 외부 body mapping
- 부분 응답 차단
- fallback 금지

### Live parity test

실제 외부 계산기와 대조:

- 동일 조건
- 동일 차량/트림
- 동일 결과 금액
- 현재 FreePass 기준 핵심 차종에서 “0원 차이”를 검증

외부 의존 live test를 일반 PR 필수 게이트와 분리함으로써, CI 안정성과 외부 정합성 검증을 둘 다 유지한다.

## 5. FreePass Admin 사례와의 공통점

기존 `FREEPASS_ADMIN_BACKEND_LEARNING.md`의 실전 구조:

```text
UI → Application Service → Domain Engine → Port → Adapter / Repository
```

Self Quote는 더 작은 범위지만 다음을 실제로 보여준다.

```text
UI → Quote Engine → Adapter → External Calculation API
```

두 프로젝트에서 공통으로 확인된 후보:

- 업무 의미와 외부 연결 책임 분리
- versioned contract
- boundary validation
- fail-closed
- 외부 원문/결과와 내부 canonical 의미 분리
- Snapshot / revision continuity
- 테스트 가능한 Adapter mapping

따라서 FreePass Admin 단일 사례였던 Engine / Adapter 경계가 FreePass Self Quote라는 두 번째 실제 제품에서도 재사용 가능함을 보여주는 증거로 취급할 수 있다.

## 6. 아직 공통 규격으로 자동 승격하지 않는 이유

Self Quote의 현재 구현은 특정 업무와 Welrix에 최적화돼 있다.

AI Core / DevCenter 공통 규격 승격 전에는 최소 다음을 더 검증한다.

1. Adapter error taxonomy 공통 형식
2. retry 허용/금지 정책을 업무별로 표현하는 방식
3. timeout / circuit-breaker / health 상태 규격
4. 외부 source revision과 snapshot revision의 공통 envelope
5. 관측성/로그에서 고객 공개값과 내부값 분리
6. 다른 외부 공급사 Adapter에서 동일 계약 재사용

## 7. AI Core가 학습할 핵심

AI Core가 FreePass 견적 업무를 소유하는 것은 아니다.

학습 대상은 다음과 같다.

- Engine은 의미와 단위를 소유한다.
- Adapter는 외부 시스템 차이를 흡수한다.
- 외부 결과의 정확성이 업무 핵심이면 fail-closed를 명시적으로 선택할 수 있다.
- 공유/계약성 결과는 mutable live data보다 immutable Snapshot이 우선일 수 있다.
- 공통 계약과 Adapter 계약을 각각 versioning한다.
- offline contract test와 live parity test를 분리한다.
- 프로젝트에서 검증된 패턴을 공통화하되 업무 고유 규칙 자체는 원 프로젝트에 남긴다.

## 8. 근거

FreePass Self Quote:
- `docs/SELF-QUOTE-CONTRACT.md`
- `src/lib/quote/spec.js`
- `src/lib/quote/build-request.js`
- `src/lib/quote/engines/welrix.js`
- `src/lib/share-link.js`
- `scripts/check-quote-contract.mjs`
- `scripts/check-welrix.mjs`
- merge revision: `56affca1fc4e419000afe3e42f8821e5458d2071`

AI Core:
- `src/engine/adapter-contract.mjs`
- `docs/coordination/FREEPASS_ADMIN_BACKEND_LEARNING.md`

## 9. 한 줄 결론

> FreePass Self Quote는 “Engine owns meaning; Adapter owns connection” 원칙을 외부 실계산 시스템과 실제 고객 견적 흐름에서 검증한 두 번째 사례이며, Snapshot·fail-closed·offline/live 검증 분리는 AI Core/DevCenter 공통 Backend Architecture의 학습 후보로 삼는다.

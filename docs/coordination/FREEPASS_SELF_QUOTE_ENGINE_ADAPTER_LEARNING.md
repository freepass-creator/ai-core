# FreePass Self Quote Engine / Adapter Learning — 2026-09-19

- 상태: `LEARNING_CANDIDATE / DO_NOT_AUTO-PROMOTE`
- 제품/도메인 소유권 정본: `freepass-creator/freepass-estimate`
- 현재 실행 구현 근거(신차): `freepass-creator/welrixtable`
- 중고차 reference: `freepass-creator/sonogong-estimator`
- 학습 대상: AI Core / DevCenter
- 핵심 원칙: **Authority target와 implementation evidence를 분리한다.**

## 1. 먼저 정정할 사실

AI Core의 이전 학습 문서는 FreePass Estimate에 `PROJECT.md`, `docs/NEW_CAR_ARCHITECTURE.md`, `apps/new/src/lib/quote/**`가 이미 존재하는 것처럼 기록했다.

2026-09-19 실제 GitHub main 재관측 결과:

- FreePass Estimate revision: `d29daa37119bece0f3d1c9ddb38437de0175b11b`
- 저장소 내용: **`README.md` 1개**
- 즉, FreePass Estimate는 **앞으로의 제품/도메인 정본 소유자**이지만 현재 실행 가능한 견적 엔진/Adapter/테스트가 이 저장소에 이관 완료된 상태는 아니다.

반면 현재 신차 견적의 실제 실행 근거는 Welrix Table에 있다.

- Welrix Table revision: `56affca1fc4e419000afe3e42f8821e5458d2071`
- 정본 계약: `docs/SELF-QUOTE-CONTRACT.md`
- 구현: `src/lib/quote/**`
- 자동검증: `npm run check:quote-contract`
- live parity: `npm run check:welrix-live`

따라서 AI Core는 다음 둘을 동시에 유지한다.

```text
Governance / Product Authority
  FreePass Estimate
        ↓ migration target
Current Implemented Evidence
  Welrix Table (new-car)
  Sonogong Estimator (used-car reference)
```

**소유권이 이동했다고 구현 증거까지 이동한 것으로 간주하지 않는다.**

## 2. 현재 Welrix 구현에서 실제로 학습할 수 있는 것

현재 검증된 신차 Self Quote 구조:

```text
UI
  ↓
Quote Engine — 공통 의미/단위
  ↓
Welrix Adapter — provider 매핑/단위변환/통신/오류
  ↓
Welrix /api/estimate — authoritative calculation
```

공통 의미:
- 보증금 10% = `10`
- 선납금 0% = `0`
- 수수료율 7% = `7`

Provider 전용 API 비율:
- `deposit_pct: 0.1`
- `prepay_pct: 0`
- `feeRate: 0.07`

단위 변환은 Adapter 안에서만 수행한다.

AI Core working invariant와 일치한다.

> Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state.

## 3. Authoritative Provider는 fail-closed

Welrix가 해당 채널의 authoritative 계산원이라면 다음 상황에서 다른 로컬 계산기로 조용히 fallback하지 않는다.

- HTTP 오류
- provider `ok !== true`
- 차량가/금액 비정상
- 요청 scenario 수와 결과 수 불일치
- 부분 결과
- NaN/음수 등 무결성 위반

정확하지 않은 금액을 정상처럼 보여주는 것보다 HOLD/FAIL로 멈추는 것이 우선이다.

공통 학습 후보:
- authoritative provider 선언
- fail-open / fail-closed 정책
- provider별 error taxonomy
- request/result cardinality continuity
- provider health와 live parity 분리

## 4. Snapshot continuity

공유 견적은 수신 시점에 임의 재계산하지 않고 계산 당시 Snapshot을 보존한다.

```text
실시간 계산
  ↓
확정 Snapshot
  ↓
공유
  ↓
수신자는 동일 Snapshot 조회
  ↓
조건 변경 시 새 계산/새 revision
```

이 패턴은 신청/주문/승인/계약/가격제안에도 재사용 후보가 된다.

## 5. FreePass Estimate가 현재 소유하는 것은 제품 방향과 UI 기준

현재 Estimate README에서 확정된 제품 구조:

- `/new` — 신차 장기렌터카
- `/new/cost` — 신차 원가설정
- `/used` — 중고 렌트/구독
- `/used/cost` — 중고 원가설정
- `/quotes` — 저장/공유/이력

모바일 선택 흐름:

`제조사 → 모델 → 파워트레인 → 필요 시 인승/구동 → 트림 → 색상 → 옵션`

- 단일선택 단계는 선택 즉시 다음으로 전진
- 잘못 선택하면 이전으로 돌아감
- 옵션/조건처럼 여러 입력이 필요한 단계만 명시적 Next
- PC를 축소한 모바일이 아니라 모바일 고유 흐름
- 새 UI를 임의 창작하지 않고 Welrix/Sonogong 원형 + 최신 FreePass 규격을 결합

이 규칙은 **제품 방향 정본**이지, 현재 Estimate 저장소에 실행 코드가 존재한다는 증거가 아니다.

## 6. Migration gate

FreePass Estimate를 실제 runtime SSOT로 판정하려면 최소 다음이 필요하다.

1. 실행 코드가 Estimate 저장소에 실제 landing
2. QuoteRequest/QuoteResult 계약 버전 명시
3. Welrix/new-car Adapter 이관 또는 명시적 외부 binding
4. used-car provider binding
5. `check:quote-contract` 동등 이상의 offline regression
6. authoritative provider live parity
7. Snapshot/share regression
8. mobile auto/manual navigation regression
9. production revision proof
10. 이전 reference 저장소와의 migration completion 기록

그 전에는:
- 제품 소유권 = FreePass Estimate
- 현재 구현 증거 = Welrix Table / Sonogong reference

로 분리한다.

## 7. AI Core가 가져갈 공통 규격 후보

- Authority target != implementation evidence
- Domain meaning / provider translation 분리
- provider-neutral request/result contract
- fail-closed authoritative provider
- positional/cardinality continuity
- Snapshot/revision continuity
- product UI state를 interaction contract로 검증
- offline contract test와 live parity를 분리
- source revision과 verification revision을 함께 증거화

## 8. 공통 승격 금지선

다음은 아직 AI Core가 소유하지 않는다.

- FreePass 견적 산식
- 차량/원가 정책
- Welrix body mapping
- Sonogong 중고 계산 규칙
- 견적 화면 세부 디자인

AI Core는 계약/증거/권한 분리 패턴만 학습한다.

## 9. 근거

FreePass Estimate:
- `README.md`
- revision `d29daa37119bece0f3d1c9ddb38437de0175b11b`

Welrix Table:
- `docs/SELF-QUOTE-CONTRACT.md`
- `src/lib/quote/spec.js`
- `src/lib/quote/engines/welrix.js`
- revision `56affca1fc4e419000afe3e42f8821e5458d2071`

Historical/used reference:
- `freepass-creator/sonogong-estimator`
- `freepass-creator/freepasserp4`

## 10. 한 줄 결론

> **FreePass Estimate는 견적 제품의 앞으로의 정본 소유자다. 하지만 2026-09-19 현재 실행 가능한 신차 Quote Engine/Adapter의 검증 근거는 아직 Welrix Table에 있다. AI Core는 소유권과 구현 증거를 섞지 않고 migration을 추적한다.**

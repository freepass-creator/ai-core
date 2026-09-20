# Shared Extraction Pilot — KRW display

## 대상

- FreePass ERP4 `lib/format.ts#wonKo`
- Welrix Table `src/lib/format.js#krw`

두 구현 모두 화면에 원화 금액을 `ko-KR` 콤마 + `원`으로 보여 주므로 이름만 보면 공통 formatter 후보처럼 보인다.

## exact source

- ERP4: `f01b91c7f68fc2f55d8d642bc3d39f5e07368967`
  - blob `f56678883830ab02330d021c8bc45ab388106eca`
- Welrix: `56affca1fc4e419000afe3e42f8821e5458d2071`
  - blob `f732e17dcd0b98da25ba12707c1f1ab2d89ea9c0`

## 관측된 의미 차이

공통:
- 0 → `0원`
- 1234.6 → `1,235원`
- 부작용 없음

차이:
- ERP4 `wonKo`: 음수는 `Math.max(0, ...)`로 0에 clamp한다.
- Welrix `krw`: `Math.round(n || 0)`이므로 음수를 보존한다.
- -1 입력:
  - ERP4 → `0원`
  - Welrix → `-1원`

입력 의미도 완전히 같다고 선언할 수 없다. ERP4는 `unknown`을 `Number()`로 명시 변환하고, Welrix는 JS 연산 coercion에 기대는 형태다.

## 판정

**HOLD — 현재 그대로는 EXTRACT_SHARED 금지.**

이 파일럿은 “비슷한 formatter 두 개를 발견했다”는 이유로 공통 패키지로 승격하면 안 된다는 실제 반례다.

공통화하려면 먼저 프로젝트들이 아래 중 하나를 명시적으로 선택해야 한다.

1. 음수 금액은 공통적으로 0으로 clamp한다.
2. 음수 금액을 보존한다.
3. 공통 core formatter는 중립 계약을 갖고 프로젝트 adapter가 음수 정책을 담당한다.

그 결정과 각 프로젝트 회귀검증 전에는 DevCenter의 기존 `fp4-format-preview`를 공통 권위로 승격하지 않는다.

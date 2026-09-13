# Precision-Speed Learning v0.1

목표는 **신속 정확**이다. 다만 어떤 시스템도 모든 오류의 부재를 보장할 수 없으므로, AI Core는 다음 원칙을 사용한다.

> 가장 빠른 경로를 선택하되, 현재 업무에 필요한 증거를 약화시키지 않는다.

## 1. 오류 정책

다음은 허용오차 0의 hard invariant다.

- false PASS
- stale source를 현재 근거로 재사용
- 승인 경계 우회
- 미검증 결과를 완료로 기록

그 외 오류는 숨기지 않고 빠르게 탐지·복구한다. 불확실성이 남으면 성공으로 밀어붙이지 않고 `HOLD`, 더 강한 검증, 또는 사람/Work 경로로 승격한다.

## 2. 속도 정책

속도는 검증을 줄여서 얻지 않는다. 다음 순서로 줄인다.

1. 현재 결정에 영향을 주는 문맥만 읽는다.
2. 이미 고정된 source SHA와 capability를 재사용한다.
3. 작은 작업은 GPT_DIRECT에서 끝낸다.
4. build/test/debug가 필요한 시점에만 WORK_CODEX를 사용한다.
5. 같은 설명을 Chat과 Work에서 반복하지 않고 Work Packet으로 전달한다.
6. 서로 독립인 작업은 병렬화하되 같은 파일/branch 동시 수정은 피한다.

## 3. 자기학습 데이터

완료된 작업은 최소한 다음 outcome을 남긴다.

- task signature
- route
- subject revision
- verification status
- elapsed seconds
- rework count
- context items loaded
- first-pass success
- false-pass 여부
- regression 여부

AI Core는 비슷한 task signature끼리만 비교한다. 서로 다른 작업의 성공을 섞어 일반화하지 않는다.

## 4. 라우팅 학습

현재 기본 라우팅과 후보 라우팅 모두 최소 표본을 확보한 뒤 비교한다. 후보는 다음 조건을 모두 만족해야 한다.

- false-pass rate = 0
- regression rate가 악화되지 않음
- verified rate가 악화되지 않음
- first-pass success가 유의미하게 악화되지 않음
- 속도, 재작업, 문맥량, 정확도 중 하나 이상 실제 개선

조건을 만족해도 즉시 채택하지 않는다. 결과는 `SHADOW_CANDIDATE`이며 다음 실제 Shadow Pilot에서 검증한다.

## 5. 검증 깊이

### FAST

작고 되돌리기 쉬운 업무. source revision, 완료조건, targeted check를 요구한다.

### STANDARD

개발/문서/법률 검토 및 다중 파일 업무. requirement traceability, regression, work result receipt를 추가한다.

### CRITICAL

위험 C/D, 권한 필요, 외부 효과가 있는 업무. independent review, rollback plan, human gate를 추가한다.

## 6. 자기개선 범위

AI Core가 학습하는 것은 모델 가중치 자체가 아니라 외부 운영체계다.

- Context 선택
- GPT/Work 라우팅
- Work Packet 구조
- 검증 깊이
- 실패 패턴
- 재사용 capability
- 학습 목적지(AIOPS / DevCenter / AI Core / Project Local)

운영 배포, 결제, 권한 변경, 법원 제출, 삭제, 물리적 위해와 같은 외부 고위험 행동의 권한을 스스로 확대하지 않는다.

## 7. 진화 인정 조건

새 코드나 규칙이 생긴 것만으로 진화가 아니다. 다음이 연결되어야 한다.

`이전 실패 재현 → 후보 메커니즘이 방지 → 정상 케이스 회귀 없음 → Shadow Pilot → 실제 outcome 개선`

이 연결이 확인되지 않으면 `DESIGN` 또는 `LOCALLY_TESTED` 상태에 머문다.

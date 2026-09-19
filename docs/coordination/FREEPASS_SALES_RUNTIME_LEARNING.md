# FreePass Sales Runtime / State Learning — 2026-09-19

- 상태: `LEARNING_CANDIDATE / SECOND-PROJECT-EVIDENCE_REQUIRED`
- 원천: `freepass-creator/freepass-sales`
- 관측 revision: `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`
- 목적: Sales에서 실제 운영 중 검증된 state/idempotency/security/continuity 패턴을 AI Core/DevCenter가 학습한다.
- UI 색/브랜드를 그대로 공통화하지 않는다.

## 1. Server truth와 local recovery를 분리

Sales는 여러 기기에서 공유해야 하는 운영 상태를 Firestore 정본으로 둔다.

- 고객: `leads/{휴대폰숫자}`
- 통화: `leads/{휴대폰숫자}/calls/{작업키}`
- 사용자: `users/{이메일}`
- 광고 가격 검수: `config/광고검수`

로컬 저장소는 실패 복구/초안/과거 기록 승격의 보조 수단이다.

공통 교훈:
- local cache/snapshot 존재 != server commit 완료
- 복구수단 != 운영 정본
- 여러 기기/세션이 공유하는 사실은 서버 정본을 갖는다

## 2. Action launch != business completion

Sales는 다음을 명확히 분리한다.

- 전화 앱을 열었다 != 통화 결과가 확정됐다
- 문자 앱을 열었다 != 실제 발송 완료됐다
- 저장 요청을 시작했다 != 서버 저장이 성공했다

따라서 AI Core runtime/result envelope에도:
- REQUESTED
- LAUNCHED
- SERVER_COMMITTED
- BUSINESS_CONFIRMED

같은 경계가 필요한 업무가 있다.

외부 앱 호출을 성공 결과로 오인하지 않는다.

## 3. Append-only / overwrite 방지

운영 통화 이력은 생성 뒤 수정/삭제하지 않는 방향을 사용한다.
Storage 녹음은 Security Rules에서:
- create 허용
- 동일 경로 overwrite 금지
- delete 금지

반례를 emulator CI로 검증했다.

공통 후보:
- 감사/증빙 artifact는 append-only 기본
- overwrite가 필요하면 별도 revision 또는 correction event
- 보안 규칙도 코드와 함께 회귀검증

## 4. Idempotent save semantics

Sales의 회귀 규칙:

- 저장 확인 timeout은 취소/성공 판정이 아니다.
- 같은 작업/동일 입력 재시도는 원 요청 Promise를 따른다.
- 같은 작업키인데 입력이 달라지면 자동 완료/초안 삭제/후속 실행을 막는다.
- 응답은 원래 고객/작업키에만 귀속한다.
- UI disabled만으로 중복 방지를 해결하지 않는다.

이 패턴은 Admin의 repository-level idempotency와 같은 방향이다.

## 5. Draft continuity

상세 이동/검색/재렌더 중에도 고객별 초안을 보존한다.

공통 후보:
- draft scope를 entity/work-key에 묶는다
- navigation과 write completion을 분리한다
- 비동기 응답이 다른 entity에 잘못 반영되지 않도록 identity를 고정한다

## 6. Promotion → Quote continuity

광고 상세에서 선택한 차량/트림을 `b/m/t` deep link로 견적기에 이어 준다.

검증 근거:
- 광고 25차종
- 443트림
- 견적기 DB 443/443 모델별 일치 확인

공통 교훈:
- 화면 간 이동은 표시명/가격이 아니라 안정 식별자를 사용
- upstream selection을 downstream에서 다시 추측하지 않는다
- conversion funnel 전체에서 selected entity continuity를 검증한다

## 7. Fail-closed customer price publishing

광고 가격은 일일 검수한다.
불일치가 확인되면 발송을 막고, 틀린 값보다 빈 값/확인중을 우선한다.

이는 견적 provider fail-closed와 같은 상위 원칙이다.

## 8. CI에서 배울 점

이미 검증된 것:
- Security Rules emulator
- Storage overwrite/delete negative tests
- 폐기 forms 신규 쓰기 차단
- 일반 Sales PR 검증 골격

남은 것:
- cross-platform browser runner
- focus 복원 반복검증
- `웹/app.js` 모듈화
- build/test 명령 의미 정리

공통화 시 “검증이 있는 기능”과 “현재 운영에 배포된 상태”를 분리한다.

## 9. AI Core / DevCenter 반영 후보

- server truth vs recovery cache contract
- external action launch vs confirmed completion
- append-only evidence storage profile
- work-key scoped idempotent save
- entity-bound draft continuity
- stable deep-link identity continuity
- fail-closed customer-facing price gate
- emulator/security-rules regression profile

두 번째 실제 프로젝트 증거가 있는 항목부터 공통 표준으로 승격한다.

## 10. 근거

- `docs/SSOT.md`
- `docs/UI-STANDARD.md`
- `docs/AI-AUDIT.md`
- `docs/HANDOFF.md`
- revision `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`

## 11. 한 줄 결론

> **Sales가 AI Core보다 앞선 핵심은 화면 모양보다 “실제 완료를 어떻게 증명하고, 재시도/이동/외부앱 호출 중 상태를 어떻게 틀리지 않게 보존하느냐”에 있다.**

# 프리패스 정산 워크스테이션 기능 점검 — 2026-09-10

## 작업 시작 기준

```text
task_id: freepass-settlement-workstation-function-2026-09-10
목적 / 완료 조건: 접수→인도완료→청구월 전이와 입력·중복·차량조회 경계를 코드로 고정하고 회귀검사한다.
대상 프로젝트 / 수정 허용 범위: C:\dev\freepasserp4 정산 기능 코드. UI 구조와 CSS는 제외한다.
기준 원본 / scope / 버전: feat/spring-atom-monitor, 시작 HEAD 2834609bfe5d050b55c1e507758adb84cbf5aa7e, 기존 dirty 작업트리 유지.
적용 UI 프로필 / 기존 부품: 기존 SettlementBoard·IntakeStation을 유지한다.
기존 기능 / 소비 위치: settlement engine, settlement atom, /api/settlement/board, PC·모바일 정산 화면.
충돌·미확정·예외: 기존 원장↔원자 3행 청구월 불일치. preview page export가 Next 빌드 규칙과 충돌.
담당 AI / 독립 검토 역할: Codex 구현·재현, 독립 검토자는 기능 반례만 읽기 전용 검사. Claude 구조 영역은 수정하지 않음.
실행할 확인 / 남길 증거: 기능 불변식, 엔진, 잠금 규격, 원자 규격, RTDB 검색, 타입/빌드, 체인 대조, 파일 해시.
승인 필요한 실제 행동: 운영 Firestore 쓰기·데이터 보정·배포는 이번 범위에 없음.
완료한 것 / 남은 것 / 다음 단계: 아래 판정 참조.
```

## 반영한 기능 규칙

- 계약기간 `24_2만`, `60개월`, `24`를 같은 개월 수로 저장한다.
- 청구월과 이월월은 실제 `YYYY-MM`, 접수일과 인도일은 실제 달력 날짜만 허용한다.
- 인도완료·인도일·청구월을 한 상태 전이로 묶고 API에서도 우회 저장을 막는다.
- 신규 접수의 기본 청구월은 빈값이다. 청구월을 넣으려면 인도일과 인도완료 상태가 필요하다.
- 늦은 차량 조회 응답이 현재 선택 차량을 덮거나 지우지 못한다.
- 신규 접수 ID는 SHA-256 복합키로 만들고 `create`로 동시 중복 저장을 막는다. 기존 짧은 ID의 실제 접수 내용도 먼저 대조한다.

## 고정 증거

| 파일 | SHA-256 |
|---|---|
| `app/api/settlement/board/route.ts` | `38469C9961514B6DE6170C96E04F1DFE5669C7F0B474ED4CAC35D7887A471B36` |
| `components/settlement/IntakeStation.tsx` | `CC6831D5A56BA5A9AFB2EE7FE6A96C5CD03402D62AEA3F54B64F32FE2CC25920` |
| `components/settlement/SettlementBoard.tsx` | `DF0C343A04A2BECA99C0EAFE68DCE79FE5F3B988243EFECC54DFCAAE61A17663` |
| `lib/domain/settlement-intake.ts` | `8925351BEAE8294359B39E71F12B29F43888EEEA5CE0FB370C99AE02D285A81E` |
| `scripts/check-settlement-workstation.mts` | `46864C3B338E9BACDB59971547B00BBEBA325218F7C79F45BFA73E41EB7F1CD5` |

## 검사 결과

| 검사 | 결과 | 증거 |
|---|---|---|
| `npm run check:settlement-workstation` | PASS | 기능 불변식 6묶음 통과 |
| `npm run check:engine` | PASS | 독립 정산 심장 14개 통과 |
| `npm run check:settlement` | PASS | 정산 시트 잠금 규격 통과 |
| `npm run check:atom` | PASS | 461행·71필드 구조 통과 |
| `npm run check:nortdb` | PASS | 정산 RTDB 소비 0건, 이관 도구 예외 2개 |
| `git diff --check` | PASS | 공백 오류 없음 |
| 독립 기능 재검사 | PASS | 치명·P1·P2 잔여 0건. 운영 실행·구조·CSS·기존 데이터 제외 |
| `npm run typecheck` | FAIL | 생성된 `.next/types`가 아래 preview page의 허용되지 않은 export를 검출 |
| `npm run build` | FAIL | 컴파일 뒤 `app/settlement/board/preview/page.ts`의 `useSampleApi` export가 Next 페이지 규칙 위반 |
| `npm run check:chain` | FAIL | F04 22행, 원자 19행. 0원 3행의 `billMonth` 불일치. 청구·지급 총액은 일치 |

## 판정

**기능 변경 범위 PASS, 프로젝트 전체 HOLD.** 기능 반례는 수정본 해시에서 해소됐다. 전체 종결에는 Claude가 맡은 preview 구조 오류의 수정·재빌드와, 원본 근거를 확인한 3행 청구월 시정·체인 재검사가 필요하다. 이번 작업은 운영 Firestore 쓰기, 원장 보정, 배포를 실행하지 않았다.

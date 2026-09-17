# 클로드 인계 — AI Core 비상 기능 구현

작업 ID: `EMG-P0` · 인계 버전: 0.2 · 작성일: 2026-09-15 (Asia/Seoul)
상태: `SPEC_READY_FOR_CLAUDE_REVIEW` / `RUNTIME_NOT_IMPLEMENTED`

사용자 요청: 비상매뉴얼 내용을 보완해 GitHub에 남기고, 사용자가 클로드에게 이어서 작업을 맡긴다. 이 파일 생성은 클로드의 수신·작업 시작·독립 검토 완료를 뜻하지 않는다.

## 0. 바로 이어서 할 한 가지

**기존 상태 판정 자산을 먼저 검토한 뒤, 외부 시스템에 접속하거나 변경하지 않는 비상 판정기와 모의 회귀 테스트를 별도 작업 브랜치에 구현한다.** 이번 첫 구현은 `EMG-P0`에서 끝낸다. 자동 복구·실데이터 수집·전역 잠금·자동 배포까지 확장하지 않는다.

입력한 증거의 누락·만료·대상 불일치·경쟁 쓰기·결과 불명을 찾아 `INVALID / HOLD / READY_FOR_REVIEW`와 이유를 반환한다. `READY_FOR_REVIEW`는 입력상 검토 준비도이며 실제 재개 승인이나 서비스 정상화가 아니다. 모든 결과에서 `execution_authorized: false`, `side_effects_performed: false`, `control_enforcement: NOT_IMPLEMENTED`, `evidence_authenticity: NOT_ATTESTED`를 유지한다.

## 1. 읽는 순서와 기준선

1. 현재 작업 대상의 최신 사용자 지시, 저장소 상태, 기존 작업 브랜치·미커밋 변경·작업 소유자를 확인한다. 공유 checkout에 자동 pull/merge/정리를 하지 않는다.
2. [WORK_READ_FIRST.md](../WORK_READ_FIRST.md), [MEMORY.md](../MEMORY.md), [현재 기억](../memory/CURRENT.md), [비상매뉴얼](EMERGENCY_RUNBOOK.md), [사고 양식](INCIDENT_TEMPLATE.md)을 읽는다.
3. 아래 기존 자산과 현재 채택 여부를 확인한다. branch 이름이나 최신 날짜만으로 통합 기준을 정하지 않는다.
4. 구현할 최소 파일 목록과 재사용/미사용 이유를 기록하고 `work/claude/emergency-p0-<고유작업값>` 형태의 별도 branch/worktree에서 진행한다. 기존 branch를 강제 이동하지 않는다.

인계 준비 시 확인한 문서 기준선은 `freepass-creator/ai-core@45457bf142467a9bfab97cd56a1e50ea8e63d946`이다. PR #23으로 비상매뉴얼 0.1이 main에 반영된 지점이며, 이번 0.2 문서의 출발점이다. 이 SHA로 main을 되돌리라는 뜻이 아니다. 착수 시 최신 문서 커밋과 실제 구현 기준 커밋을 따로 기록하고, 그 사이 변경으로 인계가 낡았는지 확인한다.

### 이미 있는 것과 아직 없는 것

| 자산 | 확인한 위치·수준 | 클로드가 할 판단 |
|---|---|---|
| 공통 비상 절차·양식·진입점 | 위 main 기준선의 Markdown. 문서 존재 확인 | 보완 내용을 적용하되 자동 차단 구현으로 취급하지 않음 |
| Control Tower 판정기 | [evaluate-control-tower.mjs](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/scripts/evaluate-control-tower.mjs). 소스 열람, 이번 세션 실행 안 함 | schema 검증, 이유 코드, 관측 만료, 승인/실행 분리의 재사용 가능성을 검사 |
| 판정 계약·호출기 | [control-tower.schema.json](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/contracts/control-tower.schema.json), [run-control-tower.mjs](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/scripts/run-control-tower.mjs). 경로 존재 확인 | 내용을 읽고 계약을 대조. 호환성·안전성 검증 전 가져오지 않음 |
| 작업 대장·checkpoint·진입점 검증 | [work-ledger.mjs](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/scripts/work-ledger.mjs), [checkpoint-work.mjs](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/scripts/checkpoint-work.mjs), [verify-main-state.mjs](https://github.com/freepass-creator/ai-core/blob/b438fca22bd60ac7f6efa1d509c701897e821e76/scripts/verify-main-state.mjs). 경로 존재 확인 | 기존 기록·검증을 재사용할지 판단. 비상 대장/실행기를 중복 생성하지 않음 |
| AIOps의 라이브 변경 기준 | [CONTROL_PLANE.md](https://github.com/freepass-creator/aiops/blob/f53ce189ac6018348fbbb2ad7512b1e8c6b4393e/docs/CONTROL_PLANE.md). 기존 열람 근거 | AIOps를 실제 대상으로 할 때 최신 정본을 재확인. Claude DESIGN/FINAL·사용자 직전 승인·Codex/lease 경계를 우회하지 않음 |

`b438fca...`는 작업 브랜치의 관측 시점이다. 통째로 main에 병합하거나, 그 코드를 main에 이미 있는 기능처럼 보고하지 않는다. 위 main 기준선에는 실행 코드·package.json·CI workflow가 없다. 착수 시 달라졌을 수 있으므로 다시 확인한다. 필요한 최소 실행/테스트 구성만 별도 PR로 제안한다.

## 2. 단계별 범위 — 한 번에 모두 구현하지 않는다

| 단계 | 산출물 | 범위와 종료 조건 |
|---|---|---|
| `EMG-P0` 현재 첫 작업 | 입력 계약, 순수 판정 함수, 로컬 실행 진입점, 합성 fixture, 회귀 검사, 검증 기록 | 라이브 연결 없이 아래 요구사항과 [인수 시나리오](EMERGENCY_ACCEPTANCE_TESTS.md)를 재현. 결과와 한계를 제출하고 종료 |
| `EMG-P1` 후속 검토 | 읽기 전용 상태 수집 adapter 제안·모의검증 | 기존 connector/registry 재사용, 최소 필드·수집 범위·권한·민감정보 제거 검토. 실제 비공개 데이터 조회는 해당 범위의 요청/권한 확인 후 |
| `EMG-P2` 별도 설계·승인 | 실제 쓰기 진입점의 차단·재개 통제 | 자격증명 격리, 단일 writer, 분산 실행의 오래된 소유자 차단, 승인 무효화, 복구 훈련을 별도로 검증. 이번 인계로 운영 적용하지 않음 |

P0 테스트 통과로 P1/P2를 자동 승인하지 않는다. 자동 복구·토큰 폐기·배포 취소·프로덕션 변경은 현재 작업 범위가 아니다.

## 3. P0 입력·출력 계약

가능하면 기존 계약을 확장하고, 별도 계약이 필요하면 호환되지 않는 이유를 남긴다. 파일명과 폴더는 실제 저장소 규격을 확인해 정한다. 아래 함수 형태는 설계 예시이며 현재 구현된 API가 아니다.

`evaluateEmergency(snapshot, trustedPolicy, evaluationTime)`

| 입력 묶음 | 필요한 의미 |
|---|---|
| 식별 | schema 버전, 비식별 점검/요청 ID, `SIMULATION` 등 증거 모드, 프로젝트·환경·리소스의 명시적 범위 |
| 정본 | 소스 SHA, 실제 대상 revision, 적용 정책 revision/digest, 관측시각·유효 조건, 준비했던 revision과 현재 관측의 차이 |
| 경쟁 실행 | 실행자별 관측/응답 시각, 진행 중 요청, lease 적용 범위·유효성, 리소스 측 통제의 확인/미확인. 중지 응답과 강제 차단을 별도 필드로 둠 |
| 실행 결과 | 요청·행동·대상·입력 식별값, 확인된 성공/확인된 미실행/결과 불명, 부분 성공의 대상별 목록. 원문은 금지 |
| 검토·승인 | 행동별 대상·환경·범위·revision·실행자·정책·유효기간과 승인 참조. 필수 여부는 별도 신뢰 정책에서 결정 |
| 검증 | 실제 검사 범위·결과·대상·revision·시각·필수 검사 목록. 계획·생략·자기검토와 독립 검토를 구분 |
| 재개 판단 | 보호할 정상 범위, 남은 blocker, 재개할 범위, 재중지 조건·관측 방식. 자동 감시 미구현을 명시 |

필수 여부를 사고 JSON의 `required: false`로 해제하지 못하게 한다. P0의 `trustedPolicy`는 검토된 로컬 정책 fixture다. 라이브 운영에서는 정책과 증거의 신뢰 경로를 별도로 검증해야 하며, 파일에 SHA나 승인 문자열을 적었다고 인증된 것은 아니다.

결과는 전체 요약과 **리소스별 판정**을 함께 반환한다. 전체 HOLD가 정상 리소스의 쓰기를 실제로 중지시키지는 않는다. 필수 출력은 상태, 이유 코드/필드 경로, 부족 증거, 보호할 범위, 다음 읽기 확인, 입력 식별값·정책 revision·평가 시각, 위 네 가지 안전 경계 필드다. 명령 실행용 payload는 만들지 않는다.

- `INVALID`: 잘못된 형식·버전·정의되지 않은 상태값·모순된 중복 식별자. 해당 입력의 긍정 판정 금지.
- `HOLD`: 형식은 유효하지만 필요한 정본·시각·관측·권한·검증·결과 중 하나라도 부족하거나 충돌함.
- `READY_FOR_REVIEW`: 이 입력과 정책 기준의 필수 조건을 충족한 검토 후보. 외부 사실의 진위·실제 차단·실행 권한은 별개다.

## 4. 구현 요구사항

| ID | 반드시 지킬 것 |
|---|---|
| `ER-01` | 입력과 정책을 명시적 schema로 검증. 필수 값 누락·알 수 없는 enum·중복 ID의 모순은 fail-closed. UNKNOWN은 정상값으로 기본 대체하지 않음 |
| `ER-02` | 프로젝트·환경·리소스·소스/대상 revision·정책·검사 범위가 일치해야 해당 증거를 사용. main 이름이나 최신 날짜로 정상 판정 금지 |
| `ER-03` | 평가 시각을 인자로 고정해 테스트 가능하게 하고, 실제 adapter는 신뢰된 현재 시각을 전달. 잘못된 날짜는 INVALID, 미래 관측·만료 증거는 HOLD. snapshot의 옛 as_of로 만료 우회 금지 |
| `ER-04` | 중지 요청/응답/강제 통제의 차이를 유지. 응답 불명·진행 중 쓰기·만료 lease·다른 실행 경로 미확인은 해당 리소스 HOLD |
| `ER-05` | timeout·부분 성공·중복 요청 충돌은 대상별로 대조. 재시도·보상 작업을 실행하지 않으며 결과 불명은 HOLD |
| `ER-06` | 행동별 승인과 필수 검토를 정책에 따라 검사. 범위/명령 식별값/revision/정책/실행자/기간 변경은 기존 승인의 재사용을 차단 |
| `ER-07` | 정상 개발 실패·단순 보류·실제 사고·사고 아님을 구분. 적용 불가 판정에는 정책 근거가 필요. 미확인을 적용 불가로 처리하지 않음 |
| `ER-08` | 네트워크·자격증명 조회·외부 명령 실행·Git 변경·live write 없는 순수 판정. 입력에서 동적 import·shell·파일 경로 실행을 허용하지 않음 |
| `ER-09` | 토큰·원문·서명 URL·개인정보를 결과/오류/fixture에 복제하지 않음. 허용 필드만 출력하며 raw 입력을 통째로 로그하지 않음 |
| `ER-10` | 같은 입력·정책·평가 시각에 같은 판정과 안정적 이유 코드. 필수 검사 0건·실패·생략·stale은 통과 아님. 결과는 실제 승인·강제 통제를 부여하지 않음 |

기존 Control Tower의 `execution_authorized: false`를 유지한다. 어댑터를 추가하면서 다른 반환 필드의 enabled/READY를 실제 실행 권한으로 재해석하지 않는다.

## 5. 테스트와 제출물

[검증 시나리오](EMERGENCY_ACCEPTANCE_TESTS.md)의 `EMG-T01`~`EMG-T24`를 P0에서 합성 입력으로 구현한다. 시나리오 표가 존재하는 것과 실행 통과는 다르다. 24건은 최소 사례 수이며 테스트 수를 늘린 것만으로 안정성 향상을 주장하지 않는다.

제출물은 최소 diff, 실제 실행 명령·종료코드·환경/버전, 요구사항별 시나리오 결과, 실패/생략/미확인, 증거 대상 SHA, 재사용 판단, 남은 후속 작업 한 가지다. 테스트 후 변경된 코드에는 이전 결과를 붙이지 않는다. fixture 결과를 실제 서비스 복구 결과로 집계하지 않는다.

클로드가 이 인계의 설계를 검토하는 것과 클로드가 작성한 코드의 자기검토는 구분한다. 구현 담당의 자기검토를 독립 검토로 표기하지 않는다. 독립 검토가 필요한 프로젝트에서는 실제 다른 검토자 결과와 정확한 SHA가 있어야 한다.

## 6. 완료·중지 조건과 GitHub 반환

P0 완료는 요구사항과 모의 검사가 재현되고, 의도하지 않은 외부 부작용이 없음을 해당 테스트 경계에서 확인하고, SHA에 묶인 결과가 GitHub에 남은 상태다. 독립 검토 미수행이면 그대로 표시하고 운영 채택을 주장하지 않는다.

다른 writer의 변경, 기준선 drift, 모호한 정책, 민감자료 노출, 실행 환경 불명, 필수 검증 실패가 있으면 그 범위의 통합·승격을 보류한다. 안전한 로컬 진단·수정은 계속할 수 있으나 원본 삭제·강제 push·다른 AI의 작업 덮어쓰기로 해결하지 않는다.

구현 결과는 작업 브랜치와 PR에 남긴다. 문서 main 반영, 코드 구현, 검증, 독립 검토, 정책 채택, 라이브 실행을 별도 상태로 보고한다. 사용자가 이번에 요청한 것은 문서 보완과 인계이며, 이 문서가 후속 코드의 main 병합이나 운영 실행을 자동 승인하지 않는다.

## 7. 다음 갱신 때 남길 최소 기록

| 항목 | 기록 기준 |
|---|---|
| 변경 계기 | 실제 발견 문제 또는 명시적으로 가설인 취약점. 허구 사고를 만들지 않음 |
| 변경 범위 | 파일·요구사항 ID·이전/새 revision, 새로 금지/허용되는 행동 |
| 증거 | 실제 검사·결과·실패·미수행, 영향받는 EMG-T ID |
| 상태 | 문서 작성 / 구현 / 모의 검증 / 독립 검토 / 운영 적용을 구분 |
| 다음 작업 | 담당, 정확한 대상, 한 가지 작업, 승인 경계 |

현재 상태: 문서와 인수 요구사항만 준비됨. P0 코드와 24개 모의 시나리오는 이번 인계에서 실행하지 않았음. 클로드의 수신·작업 개시는 미확인.

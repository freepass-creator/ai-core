# PR #20 / #21 통합 경계

## 2026-09-15 전용 통합 브랜치 현황

현재 결과는 [INTEGRATION_STATUS.md](integration/INTEGRATION_STATUS.md)를 우선한다. 아래 계약 초안·소유권 표는 당시 기록이다. 이번 통합 쓰기는 `codex/order-control-integration` 전용 worktree에서만 수행하며 공유 `C:/dev/ai-core`에는 쓰지 않는다. PR20 `b438fca`, PR21 `58f360b` 및 로컬 `e8e6662` 정책을 대조했다. adapter `c1cb32c`, intake `ba82f26`, improvement `2b14b4e`를 통합했으며 영속 mapping/outbox는 아직 HOLD다.

2026-09-15 통합 조정 반영. 대조 기준: PR #20 `fe9315535e31a6edb723562b2b3515fcdf01107e`, PR #21 `a0ac4bb1234e4c1759769f6e272959cda8f55d1e`. 아래는 통합 계약 초안이며 어댑터는 아직 구현되지 않았다.

## 책임

- PR #20: revision-bound project registry, 공통 work ledger, 실행·완료 조건 평가, 근거·권한 결합을 소유한다. `contracts/control-tower.schema.json`, `scripts/work-ledger.mjs`, `scripts/run-control-tower.mjs`를 그대로 사용한다.
- PR #21: 자연어 접수, 사용자에게 보여주는 오더, 인계 자료, 작업 확보 UI와 전송 계층을 소유한다. OrderStore는 접수·상호작용 기록이며 최종 공통 업무 상태의 별도 SSOT로 확대하지 않는다.
- 사용자는 말로만 요청한다. Codex가 접수·식별자 연결·실행 장소 선택·상태 조회를 수행한다. 명령어와 JSON 입력은 사용자 필수 절차가 아니다.

현재 #21의 SQLite 상태·close는 독립 시제품의 기록이다. 통합된 업무 완료나 실행 권한으로 사용하면 안 된다. 연결이 없는 오더는 UNLINKED로 보여주고 최종 실행·완료를 막는 어댑터가 필요하다. 아직 런타임에 이 연결 게이트가 구현됐다고 주장하지 않는다.

## 겹침과 필요한 어댑터

| 겹치는 부분 | 통합 규칙 |
|---|---|
| order_id와 work_id | 고유한 영속 매핑을 중앙에서 생성한다. UUID 형식 order_id는 #20의 work_id 패턴과 달라 그대로 대입할 수 없다. 여러 하위 업무는 별도 관계로 명시한다. |
| project 문자열과 저장소 매핑 | #20의 검증된 project_id/registry를 사용한다. #21 projectRepositories는 시제품용이며 별도 최종 registry로 키우지 않는다. |
| 요구 revision, 레코드 version, subject_revision | 각각 요구사항 버전, 낙관적 갱신 버전, 대상 Git 커밋이다. 서로 치환하지 않고 연결에 각각 고정한다. |
| claim/lease와 commitment/allocations | UI 확보는 작업 수락이나 자원 예약·실행 승인이 아니다. #20의 수락·기한·의존성·자원 검증을 통과한 실행만 연결한다. |
| 결과·GitHub 검사 메모와 evidence_receipts | 메모는 후보 근거다. 종류·대상 커밋·범위·출처를 검증한 뒤 #20 규격으로 연결한다. |
| REVIEW/CLOSED와 work 상태 | 이름으로 일대일 변환하지 않는다. UI close는 확인 의사로 전달하고, 정본 상태와 평가 결과를 다시 읽어 표시한다. |

어댑터가 제공할 기능: `linkOrder`, `readWorkProjection`, `submitWorkCommand`, `refreshControlResult`. 명칭은 설계 초안이다. 실제 쓰기는 #20의 appendLedgerEvent와 expectedHead를 사용하고 해시 체인·상태 전이·평가기를 복제하지 않는다. runControlTower의 READY도 `execution_authorized: false`라는 경계를 유지한다.

SQLite와 work ledger 두 저장소 사이에 원자적 트랜잭션이 있다고 가정하지 않는다. 고정 command_id/event_id와 outbox를 사용하고, 응답 유실 시 정본에서 동일 ID와 페이로드를 재조회한다. #20은 중복 event_id를 오류로 처리하므로 무조건 append 재시도하지 않는다. head 충돌이면 최신 정본을 읽고 명령을 재평가한다. 성공한 정본 기록을 UI에 반영하지 못하면 projection 대기로 남긴다. 반대로 UI 상태만으로 성공을 표시하지 않는다.

### 원장 기록 뒤 snapshot 투영의 revision gate

원장 append와 control snapshot 갱신 사이에도 요구 변경이 들어올 수 있다. snapshot을 쓰기 직전에 현재 OrderStore의 `requirement_revision`과 요구 digest를 영속 binding에 다시 대조한다. 둘 중 하나라도 다르면 이전 revision의 원장 이벤트는 불변 이력으로 보존하되 현재 snapshot에는 투영하지 않고 outbox를 `HOLD`로 기록한다. 이후 새 revision은 reroute와 별도 Work intake를 거쳐야 하며, 예전 Work의 제목·요구·READY 상태를 새 revision에 섞지 않는다.

snapshot 파일 교체 뒤 outbox 승인 전에 중단된 재시도도 예외가 아니다. 기존 Work 항목을 발견하면 ID·프로젝트·SHA만 대조하지 않고 전체 snapshot을 Control Tower로 다시 검증한 뒤에만 `SNAPSHOT_WRITTEN`으로 승격한다. 불완전하거나 손상된 기존 항목은 `CONTROL_SNAPSHOT_INVALID` HOLD로 남긴다.

## 브랜치 통합 순서

1. #20의 공통 계약과 원장 변경을 먼저 검토·고정한다. 위 커밋 이후 변경됐다면 다시 대조한다.
2. 별도 통합 브랜치에서 #20을 기반으로 #21 UI/전송 계층을 합친다. package.json, main-state workflow/verifier, README, episode 문서는 양쪽 의미를 대조해 합치며 전체 파일 덮어쓰기로 해결하지 않는다.
3. 위 매핑·정본 조회·명령 어댑터를 구현하고 #21의 완료/실행 경로가 #20을 우회하지 않도록 연결한다.
4. 분리된 테스트 원장으로 ID 중복, 요구/커밋 변경, 만료 lease, head 충돌, 응답 유실, 부분 쓰기, 권한 부재, 두 클라이언트 이어하기를 검증한다. 기존 테스트 통과만으로 통합 완료를 선언하지 않는다.
5. 실제 오더의 기존 이력은 보존하고 연결 계획과 대조 결과를 검토한다. 실제 원장 이전·서버 배포는 현재 수행하지 않는다.

현재 상태: 계약 경계와 통합 순서만 기록. 자동 AI 실행, work_id 매핑, 통합 게이트 및 실제 서버 실행은 미구현/미검증이다.

## 병렬 작업 소유권 — 2026-09-15

사용자가 필요한 세션을 열어 병렬 진행하도록 요청했다. 사용자 지시 창구와 최종 통합 담당은 현재 총괄 세션 하나로 유지한다.

| 역할 | 쓰기 소유 범위 | 경계 |
|---|---|---|
| 총괄·통합 | 기존 UI/원장 파일 및 package, workflow, README, episodes, 공통 계약의 통합 | 공유 C:/dev/ai-core 폴더의 유일한 쓰기 담당. 배포·실제 원장 이전 제외. |
| 원장 연결 어댑터 | src/integration/order-work-adapter.mjs, test/order-work-adapter.test.mjs, docs/integration/ORDER_WORK_ADAPTER.md | 전용 worktree. 정본 함수 의존성 주입, 읽기 projection과 명령 준비까지만. |
| 말로 하는 오더 접수 | src/intake/normalize-order-intent.mjs, test/normalize-order-intent.test.mjs, docs/integration/VOICE_FIRST_INTAKE.md | 전용 worktree. 추출 candidate의 순수 검증/정규화. 실제 음성·LLM·DB 연결 제외. |
| 독립 계약 검토 | 없음 | 기존 통합 세션은 읽기 전용. 공유 폴더 checkout/merge/commit/push 금지. |

각 구현 세션은 자신의 파일만 커밋하고 정확한 커밋 ID·변경 목록·검증 결과를 총괄에 전달한다. 소유 범위 밖 수정은 총괄에 요청한다. 공통 파일 수정과 최종 병합은 총괄이 순차 수행한다. 각 테스트는 분리된 임시 fixture만 사용하며 실제 오더 DB와 서비스 포트를 공유하지 않는다. 같은 계약을 변경해야 하는 선행 작업이 끝나기 전에는 의존 작업을 통합하지 않는다.

현재 메모리 확인 기준 가용 RAM 약 7.4GB로 구현 두 개와 가벼운 읽기 검토를 시작한다. 대규모 빌드/통합 테스트는 하나씩 실행한다. 추가 독립 작업이 생기면 자원과 소유 범위를 확인한 뒤 세션을 늘린다. 충돌 0을 보증하는 대신 파일 소유권·격리 폴더·순차 통합과 재현 가능한 검증으로 예방한다.

### 독립 검토에서 받은 통합 필수 점검

읽기 전용 검토 세션에서 다음 반례를 보고했다. 통합 담당이 재현·수정 검증하기 전까지 해소된 것으로 처리하지 않는다.

- PR20 READY work의 subject_revision이 null이면 runControlTower의 조건부 비교를 건너뛸 수 있다. READY 실행에는 존재 및 정확한 대상 SHA 일치를 요구해야 한다.
- 이벤트 observed_at의 역행과 평가 시각 이후 기록 처리 정책이 없다. 시각 검증과 현재 평가 문맥의 상한 검사를 추가 검토한다.
- 매핑은 `(order_id, requirement_revision)` 및 요구 digest에 결합해야 한다. 요구 변경 시 이전 work의 READY를 재사용하지 않고 HOLD/supersede 처리가 필요하다.
- UI CLOSED/confirmed boolean을 정본 CLOSED·권한·검증 근거로 승격하지 않는 반례를 어댑터 검사에 포함한다.
- 향후 outbox는 command/event ID와 payload digest를 결합한다. 동일 ID의 다른 내용은 HOLD이며 응답 유실 성공 판정은 정본 내용 일치로 한다.

검토자가 보고한 PR20 최신 SHA는 b438fca로, 고정 기준 이후 inventory 변경이라고 한다. 실제 통합 직전 원격 최신 SHA와 차이를 다시 조회한다.

## 단일 오더 창구와 Claude 병행 준비

### 요구 변경 연결 정책 — 총괄 결정

각 `(order_id, requirement_revision)`에 새 work_id를 발급한다. 기존 연결은 불변 이력으로 보존하고 같은 work_id를 다른 요구 버전으로 재매핑하지 않는다. 새 요구의 work는 RECEIVED부터 시작하며 예전 READY·근거·권한을 자동 승계하지 않는다. 기존 요구 연결은 현재 요구 실행 대상으로 선택할 수 없다.

record_version은 명령 준비 시점의 낙관적 동시성 관측값이다. note/claim 등으로 값이 바뀌는 것은 요구 변경과 다르므로 그것만으로 새 work_id를 발급하지 않는다. 기존 어댑터의 고정 record_version 계약은 이 기준으로 조정·검증할 필요가 있다.

어댑터는 제공된 전체 중앙 매핑에서 work_id의 요구 버전 간 재사용을 거부한다. readContext가 과거 매핑을 누락하거나 재작성한 사실까지 독자적으로 감지할 수는 없다. 영속 생성·이력 완전성·명령 직전 정본 재조회는 통합 담당이 구현할 필수 조건이며 아직 완료되지 않았다. 이 정책을 확정한 것과 런타임 강제가 완료된 것은 구분한다.

사용자 지시(2026-09-15): 업무 오더는 `AI Core · 업무 오더 총괄`(01a0a25c-d3c3-7fe1-818f-c30b47fc1310)에서만 접수한다. `AI Core · 이전 통합 기록 보관`(01a09e5b-3fe9-76b1-8d43-80575720f8f3)은 기존 문맥을 보존하는 읽기 전용 보관용이며 새 구현을 배정하지 않는다. 자율 고도화는 별도 전담 작업에서 수행한다.

Claude는 사용자 안내 기준 한국 시각 13:00에 한도 해제 예정이다. 시간이 됐다는 이유만으로 사용 가능/검토 완료로 간주하지 않는다. 실제 최소 비대화형 호출로 확인한 뒤 시작한다. 로그인·신뢰·한도를 우회하지 않는다.

Claude 첫 인계: 최신 원격 커밋을 고정하고 이 문서의 통합 필수 점검 및 adapter/intake 구현을 독립 검토한다. 핵심 반례는 READY+null SHA, 요구 revision 변경 후 옛 READY 재사용, UI confirmed의 권한 승격, source 발췌와 정본 ID/의미의 혼동이다. 결과는 심각도·파일/행·재현 입력·기대 거부·최소 수정안으로 받는다. 이전 검토자의 결론을 정답으로 전제시키지 않는다.

Codex는 정본 조회·구현·테스트·통합을 맡고, Claude는 설계/논리/반례 검토를 병행한다. Claude에는 우선 읽기 전용 비대화형 자문만 부여한다. 승인된 소유 파일 외 쓰기, 명령 실행, 실제 DB 접근, 외부 발송 권한을 넘기지 않는다. 프롬프트에는 필요한 코드와 비식별 요약만 제공한다. 비밀·개인정보·실제 오더 원문은 전달하지 않는다. Claude 결과 수신 전에도 독립적인 가역 작업은 계속하되, 필요한 검토를 통과한 것으로 표시하지 않는다.

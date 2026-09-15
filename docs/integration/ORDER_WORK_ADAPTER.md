# Order / Work 읽기 어댑터

## 기준과 범위

- PR20: `fe9315535e31a6edb723562b2b3515fcdf01107e`의 contracts, `verifyLedgerText`, `runControlTower`.
- 실제 결합 추가 검증: 원격 조회로 고정한 PR20 `b438fca22bd60ac7f6efa1d509c701897e821e76` (2026-09-15). 임시 detached checkout의 수정 없는 함수를 동적 import했다.
- PR21: `21b1e16d2ab5b1b658e03275da5a5ad5515c8931`의 OrderStore와 `docs/ORDER_CONTROL_INTEGRATION.md`.
- 별도 작업 트리의 새 모듈이며 두 PR을 통합하거나 정본 계약을 복제하지 않는다. PR20 기준에는 위 통합 문서가 없으므로 PR21 문서를 사용했다.
- 해시 체인·상태 전이·평가·원장·영속 매핑·outbox·자동 dual-write·전송은 구현하지 않는다.

## 연결 API

`createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower })`로 생성한다. 뒤 두 함수는 통합자가 PR20 정본 구현을 직접 주입한다. 요청 본문에서 함수를 받으면 안 된다.

`readContext(orderId)`는 **신뢰되는 최신 읽기 연결**이며 다음 객체를 반환한다.

| 필드 | 의미 |
| --- | --- |
| order | PR21 `get()` 결과. id, revision, version을 사용한다. |
| mappings | 삭제되지 않은 과거 요구 버전까지 포함하는 중앙 매핑 전체 이력. 부분 목록이나 요청자가 임의 작성한 목록은 금지한다. |
| registry, snapshot, ledgerText | 같은 읽기 시점으로 고정한 PR20 정본 입력. |
| usedCommandIds, usedEventIds | 명령 준비 시 필요한 전체 사용 ID 목록. 이벤트 ID는 검증된 정본에서 읽고 command ID는 미래 조정자가 관리한다. |

읽기 연결은 일관된 시점을 보장하거나 변경을 감지해 실패해야 한다. 이 어댑터는 DB 잠금이나 여러 저장소의 원자적 읽기를 제공하지 않으며, 오래된 캐시가 모든 입력에서 서로 일치하는 경우 최신 여부를 독립 증명할 수 없다. 통합자는 최신 정본을 읽고 필요한 버전 재조회를 구현해야 한다.

매핑은 정확히 여섯 필드다: `order_id`, `requirement_revision`, `record_version`, `work_id`, `project_id`, `subject_revision`. PR21 `order.id`는 ORD-UUID이며 PR20 work ID로 대입하지 않는다. `revision`은 요구 버전, `version`은 레코드 갱신 버전, `subject_revision`은 40자리 Git 커밋이다. 프로젝트 표시 문자열을 project_id로 추정하지 않는다.

총괄 결정(2026-09-15): `(order_id, requirement_revision)`마다 새 work_id를 발급하고 연결을 불변으로 보존한다. 한 오더의 여러 요구 버전 이력은 허용하지만 같은 쌍의 중복 또는 한 work_id를 여러 쌍에서 재사용하면 차단한다. 현재 요구의 연결만 projection으로 선택한다. 여러 하위 업무는 별도의 관계 설계가 필요하다.

- `linkOrder(mapping)`: 최신 자료와 기존 매핑에 대조한 `LINK_PREPARED`, `persisted:false`만 반환한다. 저장·갱신하지 않는다. 기존 연결의 정체성 변경은 충돌로 막는다. 신규 연결은 정본 work가 RECEIVED일 때만 준비한다. 옛 READY를 신규 연결로 승계할 수 없다.
- `readWorkProjection(orderId)` / `refreshControlResult(orderId)`: 매 호출 새로 읽고 검증한 정본 상태와 PR20 평가 결과를 표시한다. `LINKED`는 연결 검증 결과이며 실행 가능 또는 승인이라는 뜻이 아니다.
- `prepareWorkCommand(request)` / `submitWorkCommand(request)`: 이름 호환용 별칭도 **전송하지 않는다**. 요청은 `mapping`, `command_id`, `event_id`, `expected_head`, `intent`만 허용한다. intent는 `REQUEST_EXECUTION_REVIEW` 또는 `REQUEST_CLOSE_REVIEW`만 가능하다. 해당 정본 평가 gate가 허용할 때 `PREPARED_NOT_SENT`와 고정한 입력을 반환한다. 이는 검토 의사 봉투이며 PR20 ledger event가 아니다.

모든 결과의 `sent`, `execution_authorized`, `completion_authorized`는 false다. UI CLOSED/REVIEW/claim, lease token, 사용자 확인 메모는 승인이나 근거 receipt로 변환하지 않는다. 연결 없음은 UNLINKED, 중복·불일치·stale·정본 오류·읽기 실패는 HOLD다. 오래된 projection을 실패 결과에 붙이지 않는다.

record_version은 불변 연결 정체성이 아닌 낙관적 동시성 관측값이다. note/claim 등 갱신 후 projection은 현재 order.version을 반환하고 기존 work_id를 유지한다. 명령의 record_version이 현재 관측값과 다르면 `COMMAND_MAPPING_STALE`로 차단한다. link 준비 시에도 전달한 record_version은 현재값이어야 한다. subject_revision이 null인 초기 work는 연결을 막으므로 RECEIVED 생성 시 정본 Git 커밋 결합이 필요하다.

## 향후 통합 제약

준비는 ID 예약·중복 방지 트랜잭션이 아니다. 같은 명령을 두 클라이언트가 준비할 수 있다. 사용 ID 목록이 빠지면 준비를 차단하고 이미 사용된 ID는 같은 내용이어도 차단한다. 재전송·응답 유실 복구는 미래 조정자의 책임이다. 실제 append 전에 매핑, 요구/레코드 버전, Git 커밋, ledger head, ID 중복, 평가와 필요한 사용자 직전 승인을 다시 확인해야 한다. PR20 `appendLedgerEvent`와 expectedHead로 기록하고 head 충돌 시 재평가해야 한다. 준비 결과만으로 실행하거나 UI 완료를 기록하면 안 된다.

최상위 control 상태는 전체 snapshot 결과이며 다른 work로 인해 HOLD일 수 있다. 준비 gate는 선택한 work의 PR20 평가 결과를 사용한다. 승인 표시는 항상 false를 유지한다. 실제 UI close/claim 경로를 이 어댑터에 연결하는 작업은 총괄 통합 단계에 남아 있다.

## 검증

`node --test test/order-work-adapter.test.mjs`는 경계 단위검사를 실행한다. 실제 계약 검사에는 `ORDER_ADAPTER_PR20_CHECKOUT`을 위 SHA의 격리 checkout 절대 경로로 설정한다. 환경변수가 없으면 실제 계약 검사는 명시적으로 SKIP이다. 함수 import 전에 HEAD와 tracked clean 상태를 검사한다. 기존 설치된 ajv/ajv-formats를 읽기 연결하여 사용하며 새 의존성을 설치하지 않는다. 실제 계약 fixture는 정본 appendLedgerEvent로 임시 원장을 생성하고 검사 종료 시 삭제한다. 실제 .local DB나 운영 원장은 읽거나 쓰지 않는다.

2026-09-15 실행: 환경변수를 설정한 Node 검사 48/48 PASS, SKIP 0. 다음 결과를 구분한다.

- 정본 null subject_revision READY는 runControlTower에서 실행 gate가 열리는 반례가 재현됐다. 어댑터는 `SUBJECT_REVISION_STALE`로 차단한다. 공통 파일은 수정하지 않았다.
- 요구 변경과 오래된 매핑, 전체 이력에 같은 work_id를 재사용한 경우 차단된다. 새 요구의 별도 RECEIVED work는 연결 준비만 가능하며 실행 준비는 정본 gate에서 차단된다.
- UI CLOSED/confirmed는 정본 승인·근거 gate를 우회하지 못한다. 실제 append 후 stale head 명령과 stale append가 모두 차단된다.
- **알려진 한계 재현 검사**: 신뢰 연결이 과거 이력을 삭제하고 새로운 쌍만 제시하면 옛 READY 재사용을 판별할 수 없다. 이 검사의 PASS는 취약 조건을 재현했다는 뜻이며 안전성 통과가 아니다. 중앙의 불변 이력/완전성 보장은 총괄 통합 필수 조건이다. PR20 자체에는 요구 revision 결합 필드가 없다.

실제 DB·브라우저·서버 통합 완료를 주장하지 않는다.

고정 PR20 checkout 자체의 `node --test --test-timeout=15000 test/*.test.mjs`는 134/134 PASS, `node scripts/verify-main-state.mjs`도 PASS였다. 이 전체 검사는 PR20 기준 결과이며 어댑터가 통합된 전체 브랜치의 episode inventory 검사 결과는 아니다. checkpoint 회귀검사는 임시 로컬 Git 저장소와 로컬 bare origin을 사용한다. 실제 origin으로 push하지 않는다.

Claude Code를 도구 비활성·비대화형으로 독립 설계 검토에 호출했으나 주간 사용 한도로 실행되지 않았다. 독립 검토 통과로 계산하지 않는다.

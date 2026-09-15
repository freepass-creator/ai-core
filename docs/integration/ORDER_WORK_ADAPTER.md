# Order / Work 읽기 어댑터

## 기준과 범위

- PR20: `fe9315535e31a6edb723562b2b3515fcdf01107e`의 contracts, `verifyLedgerText`, `runControlTower`.
- PR21: `21b1e16d2ab5b1b658e03275da5a5ad5515c8931`의 OrderStore와 `docs/ORDER_CONTROL_INTEGRATION.md`.
- 별도 작업 트리의 새 모듈이며 두 PR을 통합하거나 정본 계약을 복제하지 않는다. PR20 기준에는 위 통합 문서가 없으므로 PR21 문서를 사용했다.
- 해시 체인·상태 전이·평가·원장·영속 매핑·outbox·자동 dual-write·전송은 구현하지 않는다.

## 연결 API

`createOrderWorkAdapter({ readContext, verifyLedgerText, runControlTower })`로 생성한다. 뒤 두 함수는 통합자가 PR20 정본 구현을 직접 주입한다. 요청 본문에서 함수를 받으면 안 된다.

`readContext(orderId)`는 **신뢰되는 최신 읽기 연결**이며 다음 객체를 반환한다.

| 필드 | 의미 |
| --- | --- |
| order | PR21 `get()` 결과. id, revision, version을 사용한다. |
| mappings | 중앙에서 관리하는 전체 고유 매핑 목록. 부분 목록이나 요청자가 임의 작성한 목록은 금지한다. |
| registry, snapshot, ledgerText | 같은 읽기 시점으로 고정한 PR20 정본 입력. |
| usedCommandIds, usedEventIds | 명령 준비 시 필요한 전체 사용 ID 목록. 이벤트 ID는 검증된 정본에서 읽고 command ID는 미래 조정자가 관리한다. |

읽기 연결은 일관된 시점을 보장하거나 변경을 감지해 실패해야 한다. 이 어댑터는 DB 잠금이나 여러 저장소의 원자적 읽기를 제공하지 않으며, 오래된 캐시가 모든 입력에서 서로 일치하는 경우 최신 여부를 독립 증명할 수 없다. 통합자는 최신 정본을 읽고 필요한 버전 재조회를 구현해야 한다.

매핑은 정확히 여섯 필드다: `order_id`, `requirement_revision`, `record_version`, `work_id`, `project_id`, `subject_revision`. PR21 `order.id`는 ORD-UUID이며 PR20 work ID로 대입하지 않는다. `revision`은 요구 버전, `version`은 레코드 갱신 버전, `subject_revision`은 40자리 Git 커밋이다. 프로젝트 표시 문자열을 project_id로 추정하지 않는다. 매핑은 1:1만 지원한다. 여러 하위 업무는 별도의 명시적 관계 설계가 필요하다.

- `linkOrder(mapping)`: 최신 자료와 기존 매핑에 대조한 `LINK_PREPARED`, `persisted:false`만 반환한다. 저장·갱신하지 않는다. 기존 매핑 변경은 충돌로 막는다.
- `readWorkProjection(orderId)` / `refreshControlResult(orderId)`: 매 호출 새로 읽고 검증한 정본 상태와 PR20 평가 결과를 표시한다. `LINKED`는 연결 검증 결과이며 실행 가능 또는 승인이라는 뜻이 아니다.
- `prepareWorkCommand(request)` / `submitWorkCommand(request)`: 이름 호환용 별칭도 **전송하지 않는다**. 요청은 `mapping`, `command_id`, `event_id`, `expected_head`, `intent`만 허용한다. intent는 `REQUEST_EXECUTION_REVIEW` 또는 `REQUEST_CLOSE_REVIEW`만 가능하다. 해당 정본 평가 gate가 허용할 때 `PREPARED_NOT_SENT`와 고정한 입력을 반환한다. 이는 검토 의사 봉투이며 PR20 ledger event가 아니다.

모든 결과의 `sent`, `execution_authorized`, `completion_authorized`는 false다. UI CLOSED/REVIEW/claim, lease token, 사용자 확인 메모는 승인이나 근거 receipt로 변환하지 않는다. 연결 없음은 UNLINKED, 중복·불일치·stale·정본 오류·읽기 실패는 HOLD다. 오래된 projection을 실패 결과에 붙이지 않는다.

매핑의 record_version은 정확 일치가 필요하므로 note/claim 등 PR21 갱신만 있어도 stale이 된다. 중앙 매핑 소유자가 새 버전을 검토해 다시 고정해야 한다. 어댑터가 이를 자동 추종하지 않는다. revision이 null인 초기 work도 연결을 막는다. 정본의 커밋 결합이 먼저 필요하다.

## 향후 통합 제약

준비는 ID 예약·중복 방지 트랜잭션이 아니다. 같은 명령을 두 클라이언트가 준비할 수 있다. 사용 ID 목록이 빠지면 준비를 차단하고 이미 사용된 ID는 같은 내용이어도 차단한다. 재전송·응답 유실 복구는 미래 조정자의 책임이다. 실제 append 전에 매핑, 요구/레코드 버전, Git 커밋, ledger head, ID 중복, 평가와 필요한 사용자 직전 승인을 다시 확인해야 한다. PR20 `appendLedgerEvent`와 expectedHead로 기록하고 head 충돌 시 재평가해야 한다. 준비 결과만으로 실행하거나 UI 완료를 기록하면 안 된다.

최상위 control 상태는 전체 snapshot 결과이며 다른 work로 인해 HOLD일 수 있다. 준비 gate는 선택한 work의 PR20 평가 결과를 사용한다. 승인 표시는 항상 false를 유지한다. 실제 UI close/claim 경로를 이 어댑터에 연결하는 작업은 총괄 통합 단계에 남아 있다.

## 검증

`node --test test/order-work-adapter.test.mjs` — Node 내장 도구와 메모리 fixture만 사용한다. 검증·평가 double로 DI 호출과 경계 반례를 검증하며 PR20 알고리즘 자체나 실제 DB·브라우저·서버 통합의 통과 증거는 아니다. 실제 PR20 함수 결합 테스트는 총괄 통합 시 수행해야 한다. 새 의존성, 포트, 실제 .local DB, 배포는 필요 없다.

Claude Code를 도구 비활성·비대화형으로 독립 설계 검토에 호출했으나 주간 사용 한도로 실행되지 않았다. 독립 검토 통과로 계산하지 않는다.

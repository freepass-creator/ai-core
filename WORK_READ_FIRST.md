# Work / Codex — Read This First

## Chat results must reach GitHub

Work performed in a chat must follow [Chat to GitHub handoff policy](docs/CHAT_GITHUB_HANDOFF_POLICY.md). The chat is a working surface, while the relevant project repository is the durable handoff record. Preserve only reviewed minimal context and evidence pointers; do not copy sensitive raw conversations into GitHub.

## 비상 진입점 — 해당 작업을 계속하기 전에

데이터 훼손·배포/보안 사고·AI 동시 수정·정본 불명확이 의심되면 [비상매뉴얼](docs/EMERGENCY_RUNBOOK.md)을 먼저 읽는다. 해당 작업의 추가 쓰기는 보류하고, 정상 서비스와 다른 작업은 보존한다.

[사고 기록 양식](docs/INCIDENT_TEMPLATE.md)에 확인 사실·미확인·승인·실행·검증을 구분한다. 문서 열람은 실제 작업 중지나 복구 실행을 뜻하지 않으며, 대상 프로젝트의 기존 권한·승인 기준을 대체하지 않는다.

AI Core 작업을 시작할 때 전체 Gmail/전체 Chat/전체 연구 branch를 재독하지 않는다.

## 현재 구조 문서 우선순위

통합 관련 문서를 읽을 때 아래 순서를 현재 정본으로 취급한다.

1. `WORK_READ_FIRST.md` — 현재 최우선 목표와 진입점.
2. `docs/AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md` — 지금 실제로 무엇을 합치고/연결할지 실행 기준.
3. `docs/GROUP_OPERATING_MODEL.md` — 본사·센터·자회사 구조 SSOT.
4. `docs/AI_CORE_OPERATING_PLAYBOOK.md` — 실제 회사 업무를 AI Core에서 처리하는 방식.
5. `docs/CONTROL_TOWER.md` + `docs/WORK_LEDGER.md` — 현재 업무 상태/판정 런타임.

### A/B/C/D 세션 공통 미션

현재 공통 오더는 [AI Core Phase 1 Closeout Order](docs/coordination/AI_CORE_PHASE1_CLOSEOUT_ORDER_2026-09-19.md)다. 다른 Repo 전면 고도화로 확장하기 전에 A/B/C/D가 Phase 1 exit gap을 점검하고 `BASELINE_LOCKED`에 필요한 최소 blocker를 끝낸다. 비차단 개선은 Phase 2로 넘긴다.

[AI Core Session Operating Directive](docs/coordination/AI_CORE_SESSION_OPERATING_DIRECTIVE_2026-09-19.md)를 함께 읽는다. **AI Core 고도화는 기존 문서/Repo 정리에 한정하지 않는다.** A는 revision-bound 조사·역수입/Gap 발굴을 맡고, B/C/D는 각자 UI/UX Platform, Core Contract Platform, Workflow Platform의 부족한 기능을 직접 설계·구현·검증한다. Order 세션은 전체 우선순위와 충돌 조정, 다음 오더를 담당한다. 실행 가능한 영역은 문서에서 멈추지 말고 code/schema/registry/validator/test/migration까지 연결한다.

`GROUP-G0-RESULT.md`, `CONTROL_TOWER_CONSOLIDATION.md`, `docs/integration/INTEGRATION_STATUS.md`와 과거 handoff/audit 문서는 **시점별 evidence/history**다. 현재 상태가 위 정본과 충돌하면 최신 정본과 현재 revision-bound evidence를 우선한다.

## 현재 최우선 목표 — AI Core 실제 합병·통합

[AI Core 통합 실행 최우선 지침](docs/AI_CORE_INTEGRATION_EXECUTION_DIRECTIVE.md)을 먼저 읽는다.

현재 목표는 문서/프레임워크를 더 만드는 것이 아니라, **물리적으로 흩어진 AI·개발·업무 자산을 inventory하고 합칠 것은 안전하게 합치고, 별도 프로젝트가 맞는 것은 그룹 작업공간에서 독립 관리하여 AI Core를 실제 업무의 기본 진입점으로 빠르게 사용 가능하게 만드는 것**이다.

첫 실행은 `AI-CORE-MERGE-P0`: 실제 GitHub/로컬 폴더·저장소·SSOT·배포·데이터 경계를 inventory하고 `MERGE_PHYSICAL / COLOCATE_ONLY / EXTRACT_SHARED / KEEP_SEPARATE / RETIRE`로 분류한 뒤, 우선 통합 대상 1~3개와 안전한 실행 순서를 제시한다.

## 중요 구조/통합 작업의 Multi-AI Council

[AI Core Multi-AI Council](docs/AI_CORE_MULTI_AI_COUNCIL.md)과 [AI 협업 프로토콜](docs/AI_COLLABORATION_PROTOCOL.md)을 따른다.

AI Core는 한 AI의 단독 판단을 최종값으로 쓰지 않는다. 중요한 구조·통합·공통화·복구 작업은 가능한 여러 AI/CLI가 동일 정본을 보고 검토하며, 결과를 `CONSENSUS / ADJUSTED_CONSENSUS / HOLD`로 조정한 뒤 움직인다.

GPT/Chat의 기획·검토 문서는 절대명령이 아니라 **검토 의견**이다. Codex는 실제 코드·재사용·impact·검증 관점에서 반박/보완하고, Claude는 사용자 결정·현재 정본·Codex 검토·다른 CLI 리뷰를 함께 읽고 구현 선택을 명시한다. Gemini CLI 등 현재 사용 가능한 다른 검토자가 있으면 Council에 포함할 수 있다.

**저장소를 넘나드는 SSOT 경계 문제**는 [`docs/AI-SSOT-AUDIT-LOG.md`](docs/AI-SSOT-AUDIT-LOG.md)를 쓴다(2026-09-16 신설) — Claude 구현/GPT 독립 감사 역할을 분리한 비동기 채널. Codex CLI 크레딧이 없을 때도 GPT가 GitHub에 남기면 Claude가 읽고 반영한다. 의미 있는 이슈가 있을 때만 적는다.

AI 이름보다 최신 사용자 결정, 현재 프로젝트 정본, revision-bound evidence가 우선한다. 모델 수·한도·가용성을 절대값으로 고정하지 않는다.

## 비상 기능 구현을 이어받는 경우

클로드 등 구현 담당은 [비상 기능 구현 인계서](docs/CLAUDE_EMERGENCY_HANDOFF.md)를 읽고 첫 작업 `EMG-P0`부터 진행한다. [검증 시나리오](docs/EMERGENCY_ACCEPTANCE_TESTS.md)는 통과해야 할 요구사항이지 이미 통과한 결과가 아니다. 운영 쓰기·자동 복구·전역 차단은 이번 문서 인계만으로 허용되지 않는다.

## 본사·자회사 통합을 이어받는 경우

통합 작업 담당은 [그룹 운영 모델](docs/GROUP_OPERATING_MODEL.md) → [AI Core 그룹 통합 마스터 기획안](docs/AI_CORE_GROUP_MASTER_PLAN.md) → [클로드 통합 인계서](docs/CLAUDE_GROUP_INTEGRATION_HANDOFF.md) 순서로 읽는다.

마스터 기획안은 “어떻게 만들 것인가”에 대한 GPT의 구현 기획/검토안이다. 사용자 확정 구조 원칙은 `GROUP_OPERATING_MODEL.md`이고, 실제 구현 전 Multi-AI Council과 대상 프로젝트의 현재 정본을 대조한다.

공통 기능은 본사로 정리하되 고유 제품·Git·데이터 SSOT·브랜드·배포는 독립 유지한다. 비상 기능 `EMG-P0`와는 별도 작업이며, 운영 전환·삭제·권한 변경은 이 인계만으로 허용되지 않는다.

## UI/UX 공통 기능 규격을 작업하는 경우

공통 UI/UX는 `docs/UI_UX_CONSTITUTION.md` → `docs/SCREEN_DESIGN_STANDARD.md` → `registry/ui-ux-features.json` 순서로 읽는다. Feature Registry가 기능별 상태·행동·검증 정본이고, `design-system/tokens.json`, `design-system/components.registry.json`, `design-system/interaction.contract.json`이 실행 가능한 projection을 제공한다. 신규 consumer는 검증된 legacy CSS를 보존한 채 `design-system/tokens.runtime.css` + `design-system/runtime-v2.css`를 staged adoption한다.

`npm run uiux:validate`와 `npm run uiux:runtime`가 모두 통과하지 않는 공통 규격 변경은 채택하지 않는다. 프로젝트별 브랜드·밀도·아이콘·도메인 문구는 제품 profile이 소유하지만, 공통 feature ID의 상태명·완료 의미·실패/재시도·접근성·엔진/어댑터 경계는 로컬에서 임의 분기하지 않는다. C가 데이터/API 의미를, D가 도메인 workflow를 소유하며 B는 이를 재정의하지 않는다. 새 공통 기능은 먼저 Registry에 등록하거나 만료가 있는 예외를 남긴다.

## 실제 회사 업무를 AI Core로 처리하는 경우

[AI Core 실제 업무 운영 플레이북](docs/AI_CORE_OPERATING_PLAYBOOK.md)을 읽는다. 사용자의 자연어 오더를 `업무 의미 → 프로젝트/정본 → capability → 실행자 → 승인 경계 → 검증 → 결과/후속`으로 연결한다.

OPS-P0의 분류 정본은 `registry/work-map.json` + `src/routing/work-router.mjs`다. `npm run workmap:validate`로 project/capability 연결을 검사하고, `npm run ops:route -- "과태료 처리해"`처럼 자연어 오더를 work type → project → canonical `capability_id` → 승인경계/완료조건으로 resolve한다.

실행 정본은 `registry/capabilities.json` + `src/engine/capability-engine.mjs`다. **Work Map은 “무슨 업무인가”, Capability Registry는 “실제로 무엇을 실행할 수 있는가”만 소유하며 자연어 라우팅을 두 벌 두지 않는다.** `npm run capability:validate`와 `npm run core:capability -- plan|run "<요청>"`을 사용한다. ACTIVE capability만 실행 후보이며 HOLD/REFERENCE는 이유를 남기고 fail-closed다. project/capability가 HOLD여도 업무 분류가 확정되면 오더 접수 자체는 남기고, 최초 `work_type_id / capability_id / target_revision`을 routing provenance로 보존한다.

저장된 오더는 `GET /api/orders/:id/capability`에서 **최초 routing provenance를 다시 자연어 해석하지 않고** Capability Engine 계획으로 연결한다. 요구 revision이 바뀌면 옛 route는 `ROUTING_REQUIREMENT_STALE`로 멈춘다. 새 요구를 다시 분류하려면 `POST /api/orders/:id/reroute`를 명시적으로 호출하며, 진행 중 claim/report가 있거나 같은 requirement가 이미 Work에 묶였으면 reroute하지 않는다.

`POST /api/orders/:id/work-intake`는 확정된 route를 내부 Work로 올리는 durable coordinator다. 기존 Order DB 안에 immutable binding/outbox를 먼저 기록하고, canonical work ledger에 `CREATED/RECEIVED`를 append한 뒤 control snapshot에 **권한 없는 skeleton item**만 추가한다. 같은 order/revision은 동일 work/event ID로 수렴하고 중간 실패는 다음 호출에서 reconcile한다. 이 단계는 실행·배포·외부 전송 권한을 만들지 않는다.

문서·코드가 만들어진 것과 실제 업무가 끝난 것을 구분하고, Work Result가 AI Core로 돌아와 다음 세션이 이어받을 수 있어야 한다.

## 계속 고도화되는 Chat/CIVILIZATION/DEVKIT 연구를 연결하는 경우

[AI Core Evolution Bridge](docs/AI_CORE_EVOLUTION_BRIDGE.md)와 `memory/RESEARCH_INDEX.md`를 읽는다. 연구 버전이나 테스트 수가 늘었다는 이유만으로 운영 규칙으로 승격하지 않는다.

고도화 결과는 `Research/Chat → Candidate → revision 고정 → 작은 실험 → 실제 업무/프로젝트 evidence → ADOPT/HOLD/REJECT → feedback` 순으로 이동한다. 실제 프로젝트의 상세/원본은 해당 프로젝트에 남기고 AI Core에는 공통 후보·증거 포인터·채택 상태만 남긴다.

## 로컬·서버 오더 작업(order-control-v1)을 이어받는 경우

2026-09-15 작업 방향: 저장소는 분리하고 공통 AI 기능·오더 창구를 AI Core에 모은다. 현재 범위는 [통합 상태](docs/integration/INTEGRATION_STATUS.md)와 `docs/episodes/ORDER-DESK-001.json`을 먼저 읽는다. OrderStore는 접수 기록이며 업무 상태 정본은 work 원장(Control Tower)이다. submitter 경계·read-only context reader·서버 readWorkProjection 배선에 더해, routed order를 **durable outbox → work ledger RECEIVED → snapshot skeleton → immutable binding**으로 연결하는 work-intake 경로가 있다. 지금 남은 것은 (a) 실제 운영 `orders.connection.json`의 workSources를 현재 설치의 registry/snapshot/ledger에 정확히 고정 (b) Work가 READY/authority 경계를 통과했을 때 canonical Capability Engine 실행과 Result 회수 연결 (c) 독립 고위험 검토와 운영 활성화다. 원천이 없으면 서버는 `WORK_SOURCE_MISSING_<원천>`으로 HOLD 하며, 없는 매핑을 「연결 안 됨」으로 단정하지 않는다.

## 기본 진입점

GitHub를 통해 이어가는 AI는 [AI 공용 단일 시작점](docs/coordination/AI_CONTINUATION.md)을 먼저 읽는다. 저장소 접근이 없는 무료 채팅에는 그 문서의 최소 Markdown 내보내기만 전달한다. 이어서 [공통 시작·패킷 경계](docs/coordination/CROSS_AI_ENTRYPOINT.md)를 읽는다. 총괄은 기존 중앙 작업/담당을 조회하고 현재 패킷·실행 위치·소유 파일을 제공한다. 조회 결과는 claim/실행 승인이 아니다. 중앙 연결과 실제 claim이 없으면 HOLD로 보고한다.

로컬·서버 작업은 `docs/SHARED_ORDER_EXECUTION.md`의 중앙 연결을 먼저 확인한다. GitHub에서 코드를 받았다고 별도의 업무 DB를 새로 만들지 않는다. `node scripts/orders.mjs meta`의 원장 ID와 현재 오더 요구 버전을 확인한 뒤 작업한다.

1. `MEMORY.md`
2. `memory/CURRENT.md`
3. 현재 Work Packet / 프로젝트 지침
4. 필요한 경우 `memory/CANONICAL.md`
5. 차세대 연구가 직접 관련될 때만 `memory/RESEARCH_INDEX.md`

## 메일 작업 진입

메일 요청이면 계정 탐색·설치·로그인 전에 [기존 도구 연결](memory/TOOL_CONNECTIONS.md)의 Mail connection reuse를 읽고 그곳의 기존 프로필과 도구를 재사용한다. 정상 경로·메타데이터가 확인되면 설치/로그인을 반복하지 않는다. 미확인/모호 계정을 기본 발신자로 선택하지 않는다. 검사기와 연결 정보는 발송 승인이 아니며 실제 메일 본문 조회도 요청 범위 안에서만 한다.

## 상태 경계

- `CURRENT/CANONICAL` = 현재 상속해야 할 압축 기억. 단, 대상 프로젝트 정본/최신 사용자 지시가 우선.
- `RESEARCH_INDEX` = 후보 연구 색인. 자동 채택 아님.
- Gmail = archive/provenance. 기본 작업 시작 시 전체 재독 금지.
- Chat notebook = 연구/판단 기록. 사람에 관한 확정 사실이나 운영 승인으로 해석 금지.

## 반환

Work는 구현 뒤 commit SHA, 실행 명령, 테스트/검증, 실패·생략, 남은 불확실성을 GitHub에 남긴다.

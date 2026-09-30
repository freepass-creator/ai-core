# 보관 가지의 GPT md — main 반영 판정 (2026-09-30)

> 대표 2026-09-30: 「gpt가 늘 md로 남겨놓은거 있는데 그거 다 반영됐는지 보고 … 메인으로 붙어서 가는지도 봐야 함」
> ★다시 세지 말고 이 표를 읽는다. 보관 가지가 새로 생기면 같은 방법으로 덧붙인다.

## 방법

- 대상: `origin/work/ai-core/archive-*` 여섯 가지. 보관 커밋은 main 트리 + 옛 가지 머리를 부모로 두므로, **부모(옛 머리)마다** main 과 md 를 대조했다.
- 203개 파일: main 과 같음 59 · main 에 90% 이상 들어감 21 → 반영됨. 나머지 **123개**를 Codex(작성자 쪽)가 파일마다 판정했다(읽기 전용, 공백 없이).
- 1차 판정: ADOPT 15 · SUPERSEDED 64 · RECORD_ONLY 44. ADOPT 15개는 모두 「main 에서 대체물을 못 찾음(모름)」 — 잃지 않으려고 후보로 둔 것.
- 2차: ADOPT 후보 중 표준 여섯은 main 정본과 내용으로 대조해 셋 SUPERSEDED · 셋 부분 반영(아래 표의 «결정»). **워크플로·일정 규격 9개는 아직 판정 전(HOLD)** — 다음 차례.

## 판정표

| 파일 | 1차 판정 | 까닭 | 결정(2026-09-30) | 보관 가지@머리 |
|---|---|---|---|---|
| `docs/research/a-session-aiops-cutover-audit-2026-09-20.md` | RECORD_ONLY | 2026-09-20 AIOps 전환 증분 감사 기록이다 | - | gpt-lanes-20260929@255220b |
| `docs/research/A_SESSION_REVIEW_ALLOCATOR_V1_2026-09-20.md` | SUPERSEDED | 당시 claim 기반 검토 배분은 현재 직접 협업·연속성 규격으로 대체됐다 | - | stalled-20260929@f2d83a8 |
| `docs/AI_CORE_MASTER_MAP.md` | SUPERSEDED | 과거 lane 조정 지도는 현재 헌법·교과과정이 역할과 독서 경로를 통합한다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/00_COORDINATION.md` | SUPERSEDED | L0 조정 역할은 현재 직접 협업 및 결과·인계 규격으로 대체됐다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/01_RESEARCH_BACKFILL.md` | SUPERSEDED | 연구·역수입 절차는 현재 진화 브리지의 후보 채택 흐름으로 대체됐다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/02_GLOBAL_UI_UX_STANDARD.md` | SUPERSEDED | UI 표준 lane의 역할과 경계가 최신 UI 헌법에 반영돼 있다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/03_CORE_CONTRACT_STANDARD.md` | SUPERSEDED | Core Contract lane의 범위와 산출물이 최신 계약 표준에 반영돼 있다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/04_WORKFLOW_STATE_STANDARD.md` | SUPERSEDED | Workflow lane의 상태·전이 책임이 최신 workflow 헌법에 반영돼 있다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/05_SECURITY_AUDIT_STANDARD.md` | SUPERSEDED | 보안·권한·감사 lane은 최신 P0 후보 계약으로 구체화됐다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/06_QUALITY_OBSERVABILITY_RELEASE.md` | SUPERSEDED | 품질·관측·릴리스 lane은 QA 후보와 공유 릴리스 게이트로 분리·구체화됐다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/lanes/07_GOVERNANCE_EVOLUTION.md` | SUPERSEDED | 거버넌스·진화 lane은 현재 진화 브리지와 자기진화 규격으로 대체됐다 | - | gpt-lanes-20260929@51ac0e4 |
| `docs/UI_UX_CONSTITUTION.md` | SUPERSEDED | origin/main에 더 최신 UI/UX 헌법이 같은 역할을 한다 | - | gpt-lanes-20260929@fb3d852 |
| `docs/UI_UX_MACHINE_CONFORMANCE.md` | SUPERSEDED | 기계 적합성 게이트는 최신 적합성 receipt와 feature binding으로 대체됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_CONTRACT_STANDARD.md` | SUPERSEDED | origin/main에 더 최신 Core Contract 표준이 존재한다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_FACT_EVIDENCE.md` | SUPERSEDED | 관측·추론·파생 사실과 provenance 규칙이 최신 Core Contract에 통합됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_PROOF_INPUT_BINDING.md` | SUPERSEDED | 증명 입력·revision·receipt 결속은 최신 실행 identity 계약에 통합됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_SCHEDULE_OBSERVATION.md` | ADOPT | 모름: main에서 schedule 관측과 실행 identity의 독립 경계를 같은 깊이로 다루는 계약을 찾지 못했다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/CAPABILITY_READINESS_GATE.md` | SUPERSEDED | origin/main에 더 최신 capability readiness gate가 존재한다 | - | gpt-lanes-20260929@374266c |
| `docs/workflow/COMPENSATED_MULTIWRITE.md` | SUPERSEDED | 보상 multi-write 원칙과 성숙도는 최신 상태기계·migration 규격에 반영됐다 | - | stalled-20260929@f2d83a8 |
| `docs/workflow/STATE_MACHINE_SPECIFICATION.md` | SUPERSEDED | origin/main에 더 최신 상태기계 명세가 존재한다 | - | stalled-20260929@f2d83a8 |
| `docs/workflow/SCHEDULE_TIMING_ASSESSMENT.md` | ADOPT | 모름: main에서 일정 관측을 조기·정시·지연·미관측으로 판정하는 독립 계약을 찾지 못했다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/PROJECT_AUDIT_READINESS.md` | SUPERSEDED | origin/main에 더 최신 프로젝트 감사 준비도 게이트가 존재한다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/AIOPS_AUDIT_HANDOFF_2026-09-20.md` | RECORD_ONLY | 2026-09-20 AIOps 프로젝트 감사 인계 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/CLOSURE_STATUS_2026-09-20-r2.md` | RECORD_ONLY | 2026-09-20 시점 Project 4 종료 상태 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/CLOSURE_STATUS_2026-09-20.md` | RECORD_ONLY | 후속 r2 이전의 Project 4 종료 상태 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/FREEPASS_ADMIN_AUDIT_HANDOFF_2026-09-20.md` | RECORD_ONLY | 2026-09-20 FreePass Admin 감사 인계 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/FREEPASS_ERP4_AUDIT_HANDOFF_2026-09-20-r5.md` | RECORD_ONLY | 2026-09-20 ERP4 감사 revision-bound 인계 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/FREEPASS_ERP4_AUDIT_HANDOFF_2026-09-20.md` | RECORD_ONLY | 후속 r5 이전의 ERP4 감사 인계 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/FREEPASS_ESTIMATE_AUDIT_HANDOFF_2026-09-20.md` | RECORD_ONLY | 2026-09-20 FreePass Estimate 감사 인계 기록이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/OWNERSHIP_SLA_STATUS_2026-09-20-r3.md` | RECORD_ONLY | 2026-09-20 당시 ownership·SLA 상태 스냅샷이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/handoffs/project-4/README.md` | RECORD_ONLY | Project 4 감사 인계 묶음의 당시 색인이다 | - | gpt-lanes-20260929@dbc0ad1 |
| `docs/PROJECT_REGISTRY_CANDIDATE.md` | SUPERSEDED | origin/main에 더 최신 Project Registry 후보 컴파일러 문서가 존재한다 | - | gpt-lanes-20260929@009c163 |
| `docs/SECURITY_AUDIT_MACHINE_ENFORCEMENT.md` | SUPERSEDED | 기계 강제 lane은 최신 보안·감사 P0 후보 계약에 통합됐다 | - | gpt-lanes-20260929@8bb6993 |
| `docs/SECURITY_AUDIT_PROMOTION_GATE.md` | SUPERSEDED | 승격 조건은 최신 보안·감사 P0 후보의 readiness·release 경계로 대체됐다 | - | gpt-lanes-20260929@b60597e |
| `docs/FREEPASS_PRODUCT_UI_PROFILE.md` | SUPERSEDED | origin/main에 더 최신 FreePass 제품 UI profile이 존재한다 | - | gpt-lanes-20260929@fb3d852 |
| `docs/UI_COMPOSITION_STANDARD.md` | ADOPT | 모름: SEARCH_ONLY 등 네 가지 검색 composition과 Query SSOT 세부 규칙이 main 문서에서 발견되지 않았다 | ADOPTED_PARTS → design-system/interaction.contract.json#search_context · registry/ui-ux-features.json(data.filter·form.search) | gpt-lanes-20260929@fb3d852 |
| `chat/CURRENT.md` | RECORD_ONLY | 당시 Chat 연구 방향과 구현 snapshot을 기록한 대화 상태 문서다 | - | stalled-20260929@abdf681 |
| `chat/README.md` | RECORD_ONLY | 보관된 Chat 연구 기록 묶음의 사용 안내다 | - | stalled-20260929@abdf681 |
| `chat/notes/2026-09-13-ai-essence-and-human-agency.md` | RECORD_ONLY | 2026-09-13 AI와 인간 agency에 관한 연구·대화 기록이다 | - | stalled-20260929@abdf681 |
| `CLAUDE.md` | SUPERSEDED | origin/main의 최신 Claude 진입 지침이 같은 역할을 한다 | - | local-20260929@62e41fd |
| `docs/coordination/ERP4_LOCAL_ROOT_CLEANUP_2026-09-20.md` | RECORD_ONLY | 2026-09-20 로컬 ERP4 정리 실행·HOLD 기록이다 | - | stalled-20260929@e8ccbf5 |
| `docs/ORDER_DESK_RUNBOOK.md` | SUPERSEDED | 로컬 order desk 절차는 최신 공유 주문 실행과 운영 playbook으로 대체됐다 | - | stalled-20260929@499e084 |
| `docs/handoffs/FIREBASE_OPERATING_DATA_MAP_2026-09-20.md` | RECORD_ONLY | 2026-09-20 Firebase 운영 데이터 조사·인계 기록이다 | - | stalled-20260929@54ca913 |
| `docs/RELEASE_AUTOMATION.md` | SUPERSEDED | 릴리스 자동화의 현재 경계는 공유 릴리스 게이트와 Delivery runtime이 담당한다 | - | stalled-20260929@9529948 |
| `docs/LOCAL_REPOSITORY_CLEANUP_PLAN_2026-09-20.md` | RECORD_ONLY | 2026-09-20 로컬 저장소 정리 계획 기록이다 | - | stalled-20260929@a53aa90 |
| `docs/LOCAL_REPOSITORY_CLEANUP_RESULT_2026-09-20.md` | RECORD_ONLY | 2026-09-20 로컬 저장소 정리 결과와 복구 영수증이다 | - | stalled-20260929@a53aa90 |
| `docs/handoffs/LOCAL-REPOSITORY-CLEANUP-2026-09-20.md` | RECORD_ONLY | 로컬 저장소 정리 작업의 날짜 박힌 인계 기록이다 | - | stalled-20260929@a53aa90 |
| `docs/ORDER_CONTROL_INTEGRATION.md` | SUPERSEDED | origin/main에 더 최신 Order Control 통합 경계가 존재한다 | - | stalled-20260929@c890822 |
| `docs/reviews/ORDER_LIFECYCLE_HARDENING_2026-09-20.md` | RECORD_ONLY | 2026-09-20 주문 생명주기 hardening 독립 검토 기록이다 | - | stalled-20260929@f428452 |
| `docs/RUNTIME_SET_CATALOG_CANDIDATE.md` | ADOPT | 모름: 실행 세트 ID·프로젝트 구현·working set을 함께 관리하는 동등한 main 카탈로그를 찾지 못했다 | ★HOLD — 판정 전 | stalled-20260929@9fffae4 |
| `docs/handoffs/RUNTIME_SET_CATALOG_HANDOFF_2026-09-21.md` | RECORD_ONLY | Runtime Set Catalog 후보 구현의 2026-09-21 인계 기록이다 | - | stalled-20260929@9fffae4 |
| `docs/improvement/CANDIDATE-004.md` | RECORD_ONLY | 사용자 부담 노출에 관한 관측과 제안 단계의 개선 후보 기록이다 | - | stalled-20260929@f08e79e |
| `docs/improvement/CYCLE-002.md` | SUPERSEDED | origin/main에 더 최신 Cycle 002 기록이 존재한다 | - | stalled-20260929@f08e79e |
| `docs/HANDOFF.md` | SUPERSEDED | origin/main의 최신 handoff가 현재 revision과 남은 작업을 갱신했다 | - | stalled-20260929@cb53be0 |
| `docs/reviews/SHARED_ORDER_REVIEW.md` | RECORD_ONLY | 공유 주문 설계에 대한 당시 독립 검토 기록이다 | - | stalled-20260929@06cbba7 |
| `docs/handoffs/FREEPASS_JPK_FIREBASE_METADATA_AUDIT_2026-09-20.md` | RECORD_ONLY | 2026-09-20 Firebase metadata·migration debt 감사 인계 기록이다 | - | stalled-20260929@08d7115 |
| `AGENTS.md` | SUPERSEDED | origin/main의 최신 저장소 작업 지침이 같은 역할을 한다 | - | local-20260929@62e41fd |
| `docs/CHAT_GITHUB_HANDOFF_POLICY.md` | SUPERSEDED | origin/main에 현재 사용 중인 동일 정책 문서가 존재한다 | - | stalled-20260929@0fe9e86 |
| `docs/FREEPASS_PRODUCT_DEFINITION_2026-09-20.md` | SUPERSEDED | 제품·서비스·데이터 책임 정의가 최신 그룹 모델과 사업 지식 문서에 통합됐다 | - | stalled-20260929@0fe9e86 |
| `docs/PROJECT_PARTITION_AS_IS_2026-09-20.md` | SUPERSEDED | origin/main에 현재 진입 문서가 직접 참조하는 동일 경계 문서가 존재한다 | - | stalled-20260929@0fe9e86 |
| `docs/coordination/ERP4_LOCAL_CLEANUP_RECEIPT_2026-09-20.md` | RECORD_ONLY | 2026-09-20 ERP4 로컬 정리 실행 영수증이다 | - | stalled-20260929@0fe9e86 |
| `docs/inventory/LOCAL_REPOSITORY_1TO1_MANIFEST_2026-09-20.md` | RECORD_ONLY | 2026-09-20 로컬 저장소 1:1 배치 상태의 시점 기록이다 | - | stalled-20260929@0fe9e86 |
| `design-system/README.md` | SUPERSEDED | 디자인 시스템 진입과 적용 순서는 최신 UI/UX 시작 문서가 담당한다 | - | stalled-20260929@c4413d8 |
| `docs/FREEPASS_UI_STANDARD.md` | ADOPT | 모름: MOB-SHELL-001 등 FreePass 전용 명명 규칙과 공통·제품 경계를 main에서 동일하게 찾지 못했다 | SUPERSEDED(2차 판정) | stalled-20260929@c4413d8 |
| `docs/coordination/UI_LEARNING_INTAKE.md` | RECORD_ONLY | UI 학습 후보를 당시 lane에 반환하던 절차 기록이다 | - | stalled-20260929@c4413d8 |
| `docs/handoffs/ISSUE-178-RENTAL-ERP-JPK-WORK-INTEGRATION.md` | RECORD_ONLY | Issue 178의 ERP·JPK Work 연동 설계와 상태를 남긴 인계 기록이다 | - | stalled-20260929@e464324 |
| `docs/PROJECT_NAMING_STANDARD.md` | ADOPT | 모름: TeamJPK·FreePass 프로젝트명과 ERP 세대명을 일관되게 판정하는 동등한 main 규격을 찾지 못했다 | ADOPTED_PARTS → docs/DEVELOPMENT_CONTINUITY_STANDARD.md §11 · contracts/project-registry.schema.json 설명 | stalled-20260929@37fd3e2 |
| `design-system/PUBLIC_PRODUCT_UI_STANDARD.md` | ADOPT | 모름: 공개 상품 화면의 desktop·mobile 카드·색상·타이포 규격이 main의 관리자 중심 표준과 동일하지 않다 | ADOPTED_PARTS → docs/FREEPASS_PRODUCT_UI_PROFILE.md §10.1 | stalled-20260929@27089d8 |
| `docs/DEVELOPMENT_EPISODE_PILOT.md` | SUPERSEDED | 개발 episode 실험은 최신 Development Runtime과 Self Evolution 흐름에 흡수됐다 | - | stalled-20260929@3c19861 |
| `docs/WORK_REFERENCE_DEVELOPMENT_EPISODE_PILOT.md` | SUPERSEDED | 실험용 Work 참조는 최신 개발 연속성·결과 규격으로 대체됐다 | - | stalled-20260929@3c19861 |
| `docs/CIVILIZATION_KERNEL.md` | SUPERSEDED | 상위 진화 구조의 살아 있는 부분은 최신 진화 브리지와 헌법에 정리됐다 | - | local-20260929@d222cde |
| `docs/CONTINUOUS_LEARNING.md` | SUPERSEDED | 학습 후보의 상태·증거·채택 규칙이 최신 진화 브리지에 통합됐다 | - | local-20260929@d222cde |
| `docs/HUMAN_ORCHESTRATION.md` | SUPERSEDED | 의도·기억·행동 분리와 Work Result 규칙이 최신 작업 헌법에 통합됐다 | - | local-20260929@d222cde |
| `docs/operations/AI_CORE_RECOVERY_MODE_2026-09-20.md` | SUPERSEDED | 복구 모드의 HOLD·증거·재개 순서는 최신 비상 runbook으로 대체됐다 | - | stalled-20260929@27d7f21 |
| `.ai-core/tasks/AI-CORE-WORK-001/TASK.md` | RECORD_ONLY | 특정 보관 가지 작업의 목표·금지사항을 고정한 task 기록이다 | - | stalled-20260929@6de66dd |
| `docs/CHAT_WORK_HANDOFF.md` | SUPERSEDED | Chat과 Work의 현재 인계 방식은 직접 협업·연속성 규격으로 대체됐다 | - | stalled-20260929@6de66dd |
| `docs/research/A_SESSION_DISCOVERY_ERP4_CLIENT_RELEASE_FRESHNESS_SECOND_EVIDENCE_2026-09-19.md` | RECORD_ONLY | 2026-09-19 ERP4 release freshness 두 번째 증거 조사 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_DISCOVERY_ERP4_RESTARTABLE_ROLLBACK_RUN_2026-09-19.md` | RECORD_ONLY | 2026-09-19 재시작 가능한 rollback 실행 조사 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_HOLD_PHASE1_MAIN_FREEZE_CONTRADICTION_2026-09-19.md` | RECORD_ONLY | Phase 1 main freeze 모순에 대한 날짜 박힌 HOLD 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_PROMOTION_MATRIX_2026-09-19.md` | SUPERSEDED | origin/main에 더 최신 promotion matrix가 같은 후보·성숙도 역할을 한다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_B_ADOPTION_DELTA_2026-09-19.md` | RECORD_ONLY | 2026-09-19 B lane 채택 delta 조사 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_DELTA_FREEPASSERP4_AUDIT78_2026-09-19.md` | RECORD_ONLY | ERP4 audit 78의 revision-bound delta 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_DELTA_FREEPASSERP4_AUDIT79_2026-09-20.md` | RECORD_ONLY | ERP4 audit 79의 후속 교정 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/research/A_SESSION_PHASE1_RETURN_PACKET_2026-09-19.md` | RECORD_ONLY | Phase 1 시점 상태·PASS·HOLD를 Order에 돌려준 기록이다 | - | stalled-20260929@8d91df6 |
| `docs/COGNITIVE_RUNTIME.md` | SUPERSEDED | Plan Slice·revision-bound handoff는 최신 Development Runtime에 통합됐다 | - | local-20260929@d222cde |
| `docs/DOCUMENT_DOMAIN_ARCHITECTURE.md` | SUPERSEDED | 문서 capability·pipeline 설계는 최신 Document Hub runtime으로 구체화됐다 | - | stalled-20260929@9cb9d4f |
| `docs/EVOLUTION_ENGINE.md` | SUPERSEDED | 결과 기반 학습 gate와 상태 분리는 최신 Self Evolution 규격이 담당한다 | - | stalled-20260929@9cb9d4f |
| `docs/FEDERATION_ARCHITECTURE.md` | SUPERSEDED | plane·center 구조는 최신 Hub Architecture와 그룹 통합 모델로 대체됐다 | - | stalled-20260929@9cb9d4f |
| `docs/PRECISION_SPEED_LEARNING.md` | SUPERSEDED | 위험도별 검증 깊이와 학습 조건은 최신 작업 헌법·교과과정에 반영됐다 | - | stalled-20260929@9cb9d4f |
| `docs/SELF_IMPROVEMENT_LOOP.md` | SUPERSEDED | 자기개선 loop와 안전 경계는 최신 Self Evolution 문서가 구체화한다 | - | stalled-20260929@9cb9d4f |
| `docs/WORK_REFERENCE_NEXT_GENERATION.md` | SUPERSEDED | 차세대 Work Result 최소 계약은 최신 작업 결과 규격으로 대체됐다 | - | stalled-20260929@9cb9d4f |
| `docs/WORK_REFERENCE_HUMAN_ORCHESTRATION.md` | SUPERSEDED | 도메인별 최소 관점과 인계 규칙은 최신 교과과정에 통합됐다 | - | stalled-20260929@9cb9d4f |
| `docs/HUMAN_STEWARDSHIP_OS.md` | SUPERSEDED | Human Stewardship는 main에서 미채택 연구 방향으로 명시·요약돼 있다 | - | stalled-20260929@9cb9d4f |
| `docs/WORK_REFERENCE_STEWARDSHIP.md` | SUPERSEDED | Stewardship 후보의 현재 지위와 적용 금지는 main 연구 색인이 관리한다 | - | stalled-20260929@9cb9d4f |
| `docs/CORE_APPLICATION_SERVICE_RUNTIME.md` | SUPERSEDED | Application Service 책임과 경계가 최신 Core Contract 및 채택 문서에 통합됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_CONNECTOR_RUNTIME.md` | SUPERSEDED | Connector 경계와 결과 의미가 최신 Core Contract와 Integration Hub에 반영됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_PORT_RUNTIME.md` | SUPERSEDED | Port 책임·connector 결속·receipt 규칙이 최신 Core Contract에 통합됐다 | - | stalled-20260929@f2d83a8 |
| `docs/CORE_REPOSITORY_RUNTIME.md` | SUPERSEDED | Repository·idempotency·least privilege 경계가 최신 Core Contract 채택안에 통합됐다 | - | stalled-20260929@f2d83a8 |
| `docs/UI_OPERATION_FEEDBACK_PROJECTION.md` | ADOPT | 모름: operation receipt를 UI 상태로 투영하면서 authority를 보존하는 독립 규격을 main에서 찾지 못했다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/operations/NO_ACTIONS_INTEGRATION_2026-09-20.md` | RECORD_ONLY | 2026-09-20 A/B/C/D no-actions 통합 결과와 제외 범위 기록이다 | - | stalled-20260929@f2d83a8 |
| `docs/workflow/COMPENSATION_RECEIPT_LINEAGE.md` | ADOPT | 모름: parent·child·compensation receipt 계보와 부분실패 결과를 같은 깊이로 규정한 main 문서를 찾지 못했다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/workflow/EFFECT_RECEIPT_BRIDGE.md` | ADOPT | 모름: effect receipt 결속·투영·모호성·자동 resume 조합 계약이 main에서 발견되지 않았다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/workflow/EFFECT_RESUME_PLAN_FRESHNESS.md` | ADOPT | 모름: 준비된 resume plan의 입력 digest·순서·stale 판정 계약이 main에서 발견되지 않았다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/workflow/EFFECT_RESUME_REPLAY.md` | ADOPT | 모름: effect별 성공·보상·실패 증거로 resume와 replay를 판정하는 상세 계약이 main에서 발견되지 않았다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/workflow/EXECUTION_LEASE_FENCING.md` | ADOPT | 모름: CAS lease와 fencing token으로 stale executor를 차단하는 workflow 계약이 main의 일반 지침보다 구체적이다 | ★HOLD — 판정 전 | stalled-20260929@f2d83a8 |
| `docs/workflow/RECOVERY_RECEIPT_NO_REPLAY.md` | SUPERSEDED | recovery no-replay의 logical identity와 성공증거 규칙이 최신 Core·Workflow 명세에 반영됐다 | - | stalled-20260929@f2d83a8 |
| `docs/reviews/2026-09-16-integration-monitor-gpt.md` | RECORD_ONLY | 2026-09-16 통합 진행상태에 대한 GPT 검토 기록이다 | - | stalled-20260929@4ca0b9c |
| `docs/reviews/2026-09-16-session-continuity-gpt.md` | RECORD_ONLY | 2026-09-16 세션 기억·중복작업 방지에 대한 GPT 검토 기록이다 | - | stalled-20260929@4ca0b9c |
| `docs/SHARED_WORK_UI_V2.md` | SUPERSEDED | 공유 Work UI pilot의 토큰·화면 원칙은 최신 UI 헌법과 화면 규격으로 대체됐다 | - | stalled-20260929@75b6cd2 |
| `docs/coordination/AI_CORE_SESSION_OPERATING_DIRECTIVE_2026-09-19.md` | SUPERSEDED | origin/main에 최신 변경 이력을 포함한 동일 운영 지시서가 존재한다 | - | local-20260929@c9e9ed4 |
| `docs/operations/README.md` | SUPERSEDED | 운영 상태 readback 진입은 최신 운영 playbook과 통합 상태 문서가 담당한다 | - | local-20260929@c9e9ed4 |
| `docs/portfolio/PROJECT_EVIDENCE_20260915.md` | RECORD_ONLY | 2026-09-15 프로젝트 분류 근거와 당시 관측 revision 기록이다 | - | local-20260929@8366de3 |
| `docs/portfolio/PROJECT_LIFECYCLE_REVIEW_20260915.md` | RECORD_ONLY | 2026-09-15 프로젝트 정리·보관 후보 검토 기록이다 | - | local-20260929@8366de3 |
| `docs/portfolio/TRANSCRIPTION_CAPABILITY_20260915.md` | RECORD_ONLY | 2026-09-15 전사·보관 capability 조사와 미확인 경계 기록이다 | - | local-20260929@8366de3 |
| `docs/UI_UX_NEW_PROJECT_STARTER.md` | ADOPT | 모름: 새 프로젝트가 즉시 적용할 수 있는 짧은 UI starter 자체는 main의 장문 진입 문서와 역할이 다르다 | SUPERSEDED(2차 판정) | local-20260929@5bcf1f8 |
| `docs/reviews/UI_UX_STARTER_CLAUDE_HANDOFF_2026-09-22.md` | RECORD_ONLY | UI starter에 대한 Claude 검토 요청·재현 인계 기록이다 | - | local-20260929@5bcf1f8 |
| `docs/reviews/UI_UX_STARTER_INDEPENDENT_REVIEW_2026-09-21.md` | RECORD_ONLY | UI starter에 대한 2026-09-21 독립 검토 기록이다 | - | local-20260929@5bcf1f8 |
| `templates/ui-starter/README.template.md` | ADOPT | 모름: 제품별 UI 규격과 필수 검증을 생성물에 고정하는 동등한 main 템플릿을 찾지 못했다 | SUPERSEDED(2차 판정) | local-20260929@5bcf1f8 |
| `docs/AI-SSOT-AUDIT-LOG.md` | SUPERSEDED | origin/main의 동일 감사 로그에 더 최신 사건과 판단이 누적돼 있다 | - | local-20260929@c41ab55 |
| `docs/HUMAN_STEWARDSHIP.md` | SUPERSEDED | Human Stewardship의 최소 계약은 main canonical memory에 연구 방향으로 요약돼 있다 | - | local-20260929@d222cde |
| `docs/OUTCOME_FEEDBACK_INCREMENT.md` | SUPERSEDED | 결과 feedback·후속 episode 검증은 최신 Self Evolution 규격으로 대체됐다 | - | local-20260929@d222cde |
| `docs/SHADOW_PILOT_V0.6.md` | SUPERSEDED | shadow pilot의 주장·비교·중단 조건은 최신 진화 trial·외부 입증 gate로 대체됐다 | - | local-20260929@d222cde |
| `ARCHIVE_ONLY.md` | RECORD_ONLY | 보관 가지가 연구 archive임을 표시하는 표지 문서다 | - | research-history-20260926@6466b2f |

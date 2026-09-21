# AI Core

AI Core is the group's **AI academy**: a shared foundation where AIs learn the same working discipline through real work, preserve continuity, verify outcomes and accumulate evidence-backed knowledge.

## 현재 방향: AI 협업 기반

사용자는 각 AI에서 직접 업무한다. AI Core는 **AI 사관학교**로서 어떤 AI가 작업하더라도 정본 확인·재사용·검증·인계·노하우 축적 방식이 일관되게 작동하도록 훈련 기준을 제공한다. [AI 사관학교 헌법](docs/AI_WORKING_STANDARD.md)이 최상위 공통 규격이며, 중앙 오더 접수는 일반 업무의 선행 조건이 아니다. 아래 오더 데스크 내용은 기존 중앙 오더 경로의 구현 상태다.

모든 AI는 디자인·규격·개발·문서·데이터·운영을 시작하기 전에 AI Core에서 `목적 → 정본 → 적용 규격 → 재사용할 노하우 → 완료 검증`을 확인하고 대상 프로젝트로 간다. 이 과정은 접수 절차가 아니라 작업 품질을 맞추는 짧은 필수 사전점검이다.

문서를 읽었다고 선언하는 데서 끝내지 않는다. `npm run academy:start -- --task "<사용자 결과>" --root <대상 저장소> --track development`가 헌법·업무별 최소 규격·프로젝트 지침을 읽고 실제 Git revision과 검증 명령을 고정한 receipt를 만든다. `READY` receipt부터 작업을 시작하며, 새 자산은 재사용 판정이 없으면 `HOLD`한다.

프로젝트가 독립적으로 시작할 수 있는 규격 묶음이 필요하면 같은 명령에 `--kit .ai-core`를 붙인다. `.ai-core/`에는 업무별 규격 사본, 버전·해시 manifest, 시작 안내, 완료 양식과 로컬 무결성 검사기가 설치된다.

키트는 전체 프로젝트 registry, capability registry와 업무 지도를 `catalog/`에 함께 싣는다. 새 AI는 현재 관리 프로젝트와 가능한 업무를 이 목록에서 먼저 확인하고, 프로젝트 고유 정본과 최신 상태만 재관측한다.

쌓여 있는 Markdown을 전부 매번 읽지 않는다. [AI 사관학교 실전 교범과 교과과정](docs/AI_ACADEMY_CURRICULUM.md)에서 업무별 최소 독서 경로를 고르고, 헌법·현행 표준·연구 후보·과거 evidence를 구분해 사용한다.

이 PC의 필수 진입점인 Codex·Claude가 헌법과 교과과정에 연결됐는지는 `npm run academy:validate`로 확인한다. Gemini·Cursor 진입점은 선택 상태로만 보고하며 전체 판정을 막지 않는다. 이 검사는 규칙 파일 설치만 검증하고 로그인·한도 또는 실제 준수까지 PASS로 간주하지 않는다.

기본 협업은 사용자 결정에 따라 `Codex + Claude Code`만 사용한다. Cursor와 Gemini는 설치 여부와 관계없이 자동 호출하지 않으며, 사용자가 해당 작업에서 직접 지정할 때만 사용한다.

새 파일·모듈·문서·자동화를 만들기 전에는 `npm run reuse:check -- "<만들려는 것>" --root <대상 경로>`로 기존 capability와 실제 자산을 먼저 찾는다. 기존 후보를 재사용·확장하지 않는 이유가 없으면 신규 생성을 진행하지 않는다.

## 현재 작업: 공통 AI 오더 데스크

통합 기준: PR #20의 work 원장이 업무 상태의 정본이고 PR #21의 OrderStore는 접수·claim 기록이다. 읽기 어댑터와 임시 DB의 후보→확인→work 연결은 [격리 통합 실험](docs/integration/INTEGRATION_STATUS.md)으로 검증한다. 영속 매핑·outbox는 미완이므로 운영 연결과 실행·최종 완료는 HOLD다. 사용자는 말로만 요청하고 기술 입력은 담당 AI가 처리한다.

2026-09-15 사용자 요청으로 `work/codex/order-control-v1`에 로컬 오더 접수·담당 배정·공통 AI 인계·처리 이력·결과 확인 기능을 구현했다. 저장소는 분리하고 모든 업무 상태와 공통 처리 기능을 AI Core에 모으는 방향이다. 이름은 임시 **이음**이며 사용자와 상의 중이다.

Node.js 24.19 이상에서 격리 UI 실험은 `npm run orders:serve -- --standalone --db :memory: --port 4319`로 실행한다. CLI는 `npm run orders -- help`, 검증은 `npm test`를 사용한다. 실제 DB로의 이전이나 운영 서버 연결은 이 실험에 포함되지 않는다.

현재 UI는 **접수·결과 확인을 기록하는 수동 인계 도구**다. 결과 확인 후에도 REVIEW를 유지하며 정본 CLOSED를 만들지 않는다. [공유 실행 안내](docs/SHARED_ORDER_EXECUTION.md)는 기존 접수 전송 설계 기록이다. 실제 원격 연결·자동 실행·인증된 검토자 증명은 미완이다. 아래 `main` 설명과 `DEV-EPISODE-001`은 상속한 이전 개발선의 기록이다.

The adopted operating target is a **group workspace with independent subsidiaries**:

- headquarters: AI Core, planning, DevCenter, management support and shared services;
- subsidiaries: ERP, sales, settlement, homepage, legal, content and other independent products;
- each subsidiary keeps its own repository, SSOT, data, brand, release and deployment boundaries;
- common capabilities are shared through versioned contracts/packages/templates, not copy-paste or forced uniformity.

See [Group Operating Model](docs/GROUP_OPERATING_MODEL.md).

## Emergency entrypoint

For suspected data damage, deployment/security incidents, conflicting AI writes or an unresolved source of truth, read the [Emergency Runbook](docs/EMERGENCY_RUNBOOK.md) before continuing the affected work. Record findings with the [Incident Template](docs/INCIDENT_TEMPLATE.md).

Hold affected writes; preserve unrelated healthy services and work. This is a documented response procedure, not an implemented global kill switch or permission to restore data, deploy, revoke credentials or merge branches. Project-specific authority and approval requirements remain in force.

Implementation handoff: [Claude work packet](docs/CLAUDE_EMERGENCY_HANDOFF.md) and [acceptance scenarios](docs/EMERGENCY_ACCEPTANCE_TESTS.md). Start with the offline, advisory-only `EMG-P0` scope. These are specifications, not completed runtime functionality or authorization for live operations.

## Principles

- The user can issue natural-language orders from AI Core sessions/sections without naming repositories or executors each time.
- AI Core finds the authoritative project/source and pins its revision; it does not create a second SSOT.
- Reuse existing DevCenter and project capabilities before creating new ones.
- Separate artifact, verification, authorization, execution and outcome states.
- GitHub is the durable development/handoff SSOT. The local `AI-CORE-GROUP` workspace is the standard execution layout for co-locating independent repositories.
- Shared services do not grant new production, live-data, permission, payment, deletion or legal authority.
- Common standards define quality and collaboration baselines; subsidiary business logic, brand and user experience remain independent.

## Current implementation

The repository provides memory, development contracts, safe concurrent checkpoints, UI/UX samples, self-evolution gates and a fail-closed control-tower snapshot evaluator. It does not yet implement the full group workspace/runtime or monitor source systems by itself.

`main`에는 실행 가능한 오케스트레이터가 없다. The evaluator only calculates gates from a supplied snapshot and always keeps execution authority external.

Conceptual route:

`Task → Intent Router → Project/Source Resolve → Capability Plan → Execution Route → Work Packet → Proof Bundle`

The next implementation step is the local group workspace, project registry, Project Capsules and one non-production subsidiary pilot defined in `docs/GROUP_OPERATING_MODEL.md`.

Run the bounded local checks and evaluator:

```powershell
npm test
npm run verify
npm run form:validate -- examples/development-form.json
npm run control:evaluate -- examples/control-tower.json
npm run control:run -- examples/project-registry.json examples/control-tower.json examples/work-ledger.jsonl
npm run registry:validate -- examples/project-registry.json
```

The evaluator reports whether an item is ready to prepare, execute or close. It never grants execution authority. See [Control Tower](docs/CONTROL_TOWER.md) and [Concurrent Work](docs/CONCURRENT_WORK.md).

Project routing starts from the revision-bound registry. Work state changes use the append-only, optimistic-concurrency ledger described in [Work Ledger](docs/WORK_LEDGER.md).

The repository/task consolidation boundary and refreshable local checkout inventory are documented in [Control Tower Consolidation](docs/CONTROL_TOWER_CONSOLIDATION.md).

## Repository relationships

- `freepass-creator/ai-core`: group headquarters order, memory, coordination and learning
- `freepass-creator/devcenter`: headquarters development standards, registry, shared assets and verification
- `freepass-creator/aiops`: source for shared integration candidates plus operations-domain procedures
- subsidiary repositories: actual product code, project SSOT and real outcomes

Read `WORK_READ_FIRST.md`, then `MEMORY.md`, `memory/CURRENT.md`, `memory/RESEARCH_INDEX.md`, the current Work Packet and the target subsidiary's authoritative project sources.

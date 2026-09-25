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

## 현재 작업: 공통 AI 오더·실행 경로

일반 업무는 중앙 오더를 먼저 만들 필요가 없다는 현재 헌법을 유지한다. 다만 중앙 오더 경로를 사용하는 업무에서는 **자연어 routed intake → Work Map/Capability plan → immutable binding/outbox → durable Work/snapshot** 경로가 main에 연결돼 있다.

현재 main은 동일 order/revision의 중복·동시 intake를 하나의 durable Work로 수렴시키고, 이미 binding된 requirement의 조용한 reroute를 막는다. 즉 과거 README의 “영속 매핑·outbox가 미완이라 실행 연결 전체가 HOLD”라는 설명은 더 이상 현재 구현 수준을 정확히 나타내지 않는다.

반대로 **Work가 만들어졌다는 사실은 외부 업무 결과 성공이 아니다.** Result Delivery의 durable replay/crash recovery와 project-side request identity 결속은 아직 진행 중이며, 특히 AI Core PR #183과 AIOps PR #9가 핵심 미완 경계다. 이 부분이 exact-head/merge-ref behavior test를 통과하기 전에는 safe recovery를 VERIFIED/STABLE로 올리지 않는다.

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

## Canonical development lines

같은 관심사의 구현 정본을 두 벌 이상 두지 않는다. Development Continuity, UI/UX, Core Contract, Capability Runtime, Workflow, Integration Connector, AIOps import의 현재 정본과 역사자료 경계는 [Canonical Development Lines](docs/CANONICAL_DEVELOPMENT_LINES.md)와 `registry/canonical-development-lines.json`에서 관리한다. 과거 브랜치나 imported 문서의 "정본" 표현은 현재 main의 권위를 대체하지 않는다.

## Current implementation

Current main now includes executable Academy start/verification gates, revision-bound project/capability/work-map registries, routed Order→Work durable intake, capability runtime paths, workflow/recovery contracts, and SHADOW shared-service extraction with provenance/parity tests. It is therefore more than a documentation-only evaluator.

`main`에는 실행 가능한 오케스트레이터가 없다. AI Core is **not** a universal autonomous production orchestrator and does not grant live execution authority by itself. Project credentials, production writes, deployments, external sends and real-world outcomes remain inside each project's authority boundary. Result Delivery safe recovery and several verification guards are still open work, so a created Work or green partial check must not be reported as completed external execution.

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

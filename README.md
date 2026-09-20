# AI Core

AI Core is the group headquarters for user orders, shared memory, planning, routing, approvals, evidence and follow-through.

## 두 개의 단일 입구

- **로컬/Codex 작업:** 사용자는 하나의 지정된 로컬 대화에서만 지시한다. 작업자는 [WORK_READ_FIRST.md](WORK_READ_FIRST.md)에서 시작해 실제 checkout, 파일, 명령, 테스트와 로컬 증거를 다룬다.
- **GitHub 채팅 작업:** 사용자는 하나의 지정된 채팅에서만 지시한다. 채팅 AI는 [AI_CONTINUATION.md](docs/coordination/AI_CONTINUATION.md)에서 시작해 GitHub 정본의 문서·코드·검토·PR 작업을 이어간다.

두 입구는 같은 업무를 동시에 구현하지 않는다. 시작할 때 최신 remote revision과 현재 담당을 확인하고, 끝날 때 commit·검증·HOLD·다음 담당을 남긴다. 다른 AI용 `CLAUDE.md`, `GEMINI.md`와 세부 문서는 이 두 입구를 가리키는 포인터이지 별도 지시함이나 별도 원장이 아니다.

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

# AI Core

AI Core is the group headquarters for user orders, shared memory, planning, routing, approvals, evidence and follow-through.

## 현재 작업: 공통 AI 오더 데스크

통합 기준: PR #20이 공통 작업 원장·정책 평가를 소유하고, PR #21은 자연어 접수·claim UI 계층으로 연결한다. [통합 계약 초안](docs/ORDER_CONTROL_INTEGRATION.md)의 어댑터는 아직 구현되지 않았다. 사용자는 말로만 요청하고 기술 입력은 담당 AI가 처리한다.

2026-09-15 사용자 요청으로 `work/codex/order-control-v1`에 로컬 오더 접수·담당 배정·공통 AI 인계·처리 이력·결과 확인 기능을 구현했다. 저장소는 분리하고 모든 업무 상태와 공통 처리 기능을 AI Core에 모으는 방향이다. 이름은 임시 **이음**이며 사용자와 상의 중이다.

Node.js 24.19 이상에서 `npm run orders:serve -- --db C:\dev\ai-core\.local\orders.sqlite`를 실행하고 `http://127.0.0.1:4318`을 연다. CLI는 `npm run orders -- help`, 검증은 `npm run test:orders`를 사용한다. 사용자가 어떻게 요청하고 다른 AI가 어떻게 이어받는지는 [오더 사용 안내](docs/ORDER_GUIDE.md)에 설명했다.

현재 버전은 **하나의 중앙 원장을 로컬·서버에서 공유하는 수동 인계 도구**다. [공유 실행 안내](docs/SHARED_ORDER_EXECUTION.md)의 SSH 연결과 GitHub 검사 초안을 추가했다. 실제 원격 서버 연결은 대기 중이다. AI 자동 호출·외부 작업 자동 실행·인증된 검토자 증명은 제공하지 않는다. 아래 `main` 설명과 `DEV-EPISODE-001`은 상속한 이전 개발선의 상태이며, 이번 오더 데스크 작업과 별도다.

The adopted operating target is a **group workspace with independent subsidiaries**:

- headquarters: AI Core, planning, DevCenter, management support and shared services;
- subsidiaries: ERP, sales, settlement, homepage, legal, content and other independent products;
- each subsidiary keeps its own repository, SSOT, data, brand, release and deployment boundaries;
- common capabilities are shared through versioned contracts/packages/templates, not copy-paste or forced uniformity.

See [Group Operating Model](docs/GROUP_OPERATING_MODEL.md).

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

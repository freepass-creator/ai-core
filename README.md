# AI Core

AI Core is the group headquarters for user orders, shared memory, planning, routing, approvals, evidence and follow-through.

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
```

The evaluator reports whether an item is ready to prepare, execute or close. It never grants execution authority. See [Control Tower](docs/CONTROL_TOWER.md) and [Concurrent Work](docs/CONCURRENT_WORK.md).

## Repository relationships

- `freepass-creator/ai-core`: group headquarters order, memory, coordination and learning
- `freepass-creator/devcenter`: headquarters development standards, registry, shared assets and verification
- `freepass-creator/aiops`: source for shared integration candidates plus operations-domain procedures
- subsidiary repositories: actual product code, project SSOT and real outcomes

Read `WORK_READ_FIRST.md`, then `MEMORY.md`, `memory/CURRENT.md`, `memory/RESEARCH_INDEX.md`, the current Work Packet and the target subsidiary's authoritative project sources.

# AI Core Master Map

- Version: 0.1
- Date: 2026-09-19 (Asia/Seoul)
- Status: WORKING COORDINATION MAP
- Scope: AI Core completion domains, dependencies and promotion gates
- Live session assignment/status SSOT: `docs/handoffs/SESSION-MISSIONS.md`
- Structural SSOT remains `docs/GROUP_OPERATING_MODEL.md`.
- Runtime/work routing SSOT remains `registry/work-map.json`, `registry/capabilities.json`, `registry/projects.json`.
- This map does not replace those SSOTs; it coordinates the work needed to mature them.

## 1. Why this map exists

AI Core already has strong but distributed maps: group operating model, integration master plan, Control Tower, Work Map, Project Registry, Capability Registry, UI/UX inventory and Cross-AI entrypoint.

The missing layer is one executive map that answers:

1. what major standardization fronts remain;
2. which lane/session owns each front;
3. what may run in parallel;
4. what evidence is required before a candidate becomes a common standard;
5. how learning from subsidiary repositories is promoted into AI Core without creating a second SSOT.

## 2. North-star architecture

```text
User order
  -> AI Core intent / work routing
  -> project + authoritative source resolution
  -> common contract / capability / workflow policy
  -> project adapter or project-owned runtime
  -> verification / evidence / receipt
  -> learning candidate
  -> reviewed common standard
```

AI Core is headquarters. Product repositories remain independently owned subsidiaries. Common rules are promoted only when reusable and evidence-backed.

## 3. Standardization domains

This table defines durable work domains, not live session ownership. Current session names, ACTIVE/HOLD state and actual operator assignment belong only in `docs/handoffs/SESSION-MISSIONS.md`.

| Lane | Domain | Primary outcome | Can run now | Main dependency |
|---|---|---|---|---|
| L0 | Coordination / Master Map | keep one global map, dependencies, status, handoff | YES | none |
| L1 | Research / Repository Backfill | discover what subsidiaries do better/worse than AI Core | YES | none |
| L2 | Global UI/UX Standard | international-grade interaction/component standard | YES | L1 evidence helps |
| L3 | Core Contract Standard | canonical data, API, event, adapter, error, identity contracts | YES | L1 evidence helps |
| L4 | Workflow / State Standard | canonical state machine, transition, idempotency, recovery | YES, design first | L3 primitives |
| L5 | Security / Authority / Audit | authn/authz, scopes, secrets, PII, audit and irreversible boundaries | YES, audit first | L3 identity/events |
| L6 | Quality / Observability / Release | testing, SLO/health, logs, tracing, CI/CD, release evidence | YES, baseline first | L3/L4 interfaces |
| L7 | Governance / Evolution | versioning, ADR, deprecation, exceptions, adoption/lock policy | YES | all lanes feed it |

Detailed domain briefs live in `docs/lanes/`. They are reusable scopes/checklists, not separate live session registries.

## 4. Dependency graph

```text
L1 Research --------------------+--------------------+
  |                             |                    |
  v                             v                    v
L2 UI/UX                    L3 Core Contract     L5 Security
                                |
                                v
                           L4 Workflow
                                |
                                +----------+
                                           v
                                  L6 Quality/Release
                                           |
                                           v
                                  L7 Governance/Lock

L0 Coordination observes and reconciles every domain. Live session-to-domain mapping is maintained only in `docs/handoffs/SESSION-MISSIONS.md`.
```

No lane waits for another lane to finish completely. Dependencies mean “consume the latest verified primitive before locking”.

## 5. Promotion states for common standards

Every candidate standard should move through:

- `DISCOVERED`: observed in a project, external standard or existing AI Core asset.
- `CANDIDATE`: normalized into a proposed common rule.
- `VERIFIED`: evidence/tests show the rule works in at least one real target context.
- `ADOPTED`: AI Core/DevCenter common standard is updated and consumer guidance exists.
- `LOCKED`: compatibility/versioning and regression checks prevent silent drift.
- `DEPRECATED`: replacement and migration path are documented.

Research or a document alone must not jump directly to `LOCKED`.

## 6. What each lane must return to L0

Every lane returns a compact packet with:

- current status;
- files/revisions reviewed;
- what AI Core already did better;
- what external/project source did better;
- adopted changes;
- rejected/held changes and why;
- tests/evidence;
- remaining blockers;
- next dependency requested from another lane.

Use `docs/coordination/RETURN_PACKET.md` as the minimal handoff pattern; link lane-specific evidence instead of duplicating it.

## 7. Shared non-negotiables

1. Project SSOT stays in the project unless a rule is genuinely common.
2. AI Core owns routing, common contracts, coordination, common policy and evidence links; it does not clone product business truth.
3. Adapter boundaries translate project/provider specifics into canonical contracts.
4. State changes require explicit transition rules, authority and idempotency.
5. External/irreversible writes are separate from planning, preparation and verification.
6. Every common standard needs versioning, tests and an exception path.
7. Internationalization means locale, language, date/time, number/currency, input method, accessibility and bidirectional/layout tolerance — not translation only.
8. “Implemented” and “verified in a real consumer” are separate states.

## 8. Current baseline already present

The following existing assets should be extended rather than recreated:

- `registry/projects.json` — project inventory
- `registry/work-map.json` — work classification/routing
- `registry/capabilities.json` — executable capability catalog
- `contracts/*.schema.json` — current contract schemas
- `docs/UI_UX_INVENTORY.md` + `design-system/*` — UI/UX baseline
- `docs/DEVELOPMENT_COVERAGE.md` — seven-layer delivery coverage
- `docs/CONCURRENT_WORK.md` — parallel writer discipline
- `docs/coordination/*_LEARNING.md` — project-to-core learning evidence
- `memory/RESEARCH_INDEX.md` — research candidate index
- `docs/AI_CORE_EVOLUTION_BRIDGE.md` — candidate-to-adoption flow

## 9. Completion target

AI Core can be considered structurally mature when:

- every active project is revision-bound in Project Registry;
- every common business/technical boundary has a versioned contract;
- adapters isolate provider/project-specific differences;
- workflows have explicit states, transitions, retries and terminal outcomes;
- authority/audit boundaries are machine-checkable;
- UI/UX consumers can conform through tokens/components/pattern tests;
- quality/release evidence is reproducible;
- exceptions and deprecations are governed;
- a new developer or AI can start from this map, select one lane/project, and work without inventing a parallel standard.

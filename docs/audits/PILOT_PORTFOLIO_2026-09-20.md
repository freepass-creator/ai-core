# AI Core Project Audit Portfolio — 2026-09-20

Status: `READ_ONLY PORTFOLIO SYNTHESIS / NO AUTO-PROMOTION`

Audited projects:

1. FreePass Admin
2. FreePass ERP4
3. FreePass Estimate
4. AIOps

All project audits are revision-bound and read-only. This synthesis does not change project code or canonical Core contracts.

## Aggregate result

| Axis | Admin | ERP4 | Estimate | AIOps | Portfolio reading |
|---|---|---|---|---|---|
| UI/UX | MIGRATION_GAP | MIGRATION_GAP | CORE_MATCH | UNKNOWN | Core is usable; consumer adoption is uneven |
| Data / SSOT | CORE_MATCH | CORE_MATCH | CORE_MATCH | CORE_MATCH | strongest shared axis |
| Engine / Adapter | CORE_MATCH | CORE_MATCH | CORE_MATCH | CORE_MATCH | strongest shared axis |
| API / Event / Error | CORE_MATCH | MIGRATION_GAP | CORE_MATCH | CORE_MATCH | core is strong; ERP4 HTTP surface needs bounded adoption |
| Workflow | CORE_MATCH | MIGRATION_GAP | UNKNOWN | MIGRATION_GAP | machine standard exists; project bindings lag |
| Security / Audit | RESEARCH_ADVISORY | RESEARCH_ADVISORY | RESEARCH_ADVISORY | RESEARCH_ADVISORY | biggest Core maturity gap |
| QA / Observability | RESEARCH_ADVISORY | RESEARCH_ADVISORY | RESEARCH_ADVISORY | RESEARCH_ADVISORY | biggest Core maturity gap |
| Build / Deploy / Governance | MIGRATION_GAP | PROJECT_AHEAD | MIGRATION_GAP | MIGRATION_GAP | Core needs stronger canonical governance profile |

Counts across 32 axis observations:

- CORE_MATCH: 13
- PROJECT_AHEAD: 1
- MIGRATION_GAP: 8
- RESEARCH_ADVISORY: 8
- UNKNOWN: 2

## What is ready now

### Data / SSOT

Four independent product/operation domains align strongly around:

- canonical owner/writer;
- source provenance;
- snapshot/revision;
- freshness;
- no silent fallback;
- current projection vs immutable history.

This is no longer an abstract standard. It has broad project evidence.

### Engine / Adapter

Four independent projects align around:

- domain meaning separated from provider/storage connection;
- Port/Adapter boundaries;
- provider-specific translation isolated;
- fail-closed behavior;
- execution evidence;
- project authority retained during SHADOW adoption.

This is also ready for broad audit use.

## Core P0 gap #1 — Security / Audit

The Core currently has research findings, but project evidence is already rich enough to design a canonical P0.

### Evidence from AIOps
- exact-subject approval: plan/template/target digests;
- command binding;
- TTL;
- separation of duties;
- BLOCK precedence;
- emergency override by risk class;
- non-overridable protected actions;
- append-only hash chain;
- second-ledger cross-check.

### Evidence from ERP4
- Firebase/Storage allow + deny tests;
- role/account smoke;
- PII scrub;
- candidate rules vs production rules separation;
- security release gate.

### Evidence from Estimate
- server-side credential boundary;
- no upstream secret/error-detail leakage;
- public/internal error message separation.

### Evidence from Admin
- Actor/Port boundary;
- intentional absence of fake production auth adapter.

### Proposed canonical Security/Audit P0

1. Principal / Actor contract
2. AuthN adapter boundary
3. AuthZ context: role + org + scope + action + resource
4. action risk class
5. exact-subject approval envelope
6. TTL + command/target binding
7. separation of duties
8. emergency override policy + non-overridable class
9. sensitive-field / PII audit redaction
10. audit criticality
11. tamper-evidence profile
12. DB/Storage negative-control profile
13. account/ownership lifecycle
14. security release gate

## Core P0 gap #2 — QA / Observability

### Evidence from ERP4
- checker manifest;
- required/manual/pending classification;
- known-bad / negative-control harness;
- domain-shared ops-watch.

### Evidence from Estimate
- semantic contract -> checker manifest;
- verification freshness;
- exact-revision CI;
- provider failure/privacy matrix.

### Evidence from AIOps
- freshness fail-closed;
- health states that distinguish waiting vs failure;
- terminal manifest required for completion;
- scheduler health model.

### Evidence from Admin
- clean typecheck/test/build baseline;
- production proof explicitly separate from CI.

### Proposed canonical QA/Observability P0

1. checker manifest
2. required/manual/not-applicable/pending classification
3. negative-control / known-bad requirement
4. QA result envelope
5. evidence level: fixture/emulator/preview/production
6. health model: liveness/readiness/dependency/freshness
7. source freshness contract
8. terminal completion evidence
9. structured telemetry correlation context
10. logs/metrics/traces profile
11. scheduler/job heartbeat/checkpoint
12. production revision readback
13. alert severity/ownership
14. verification-contract freshness

## Core P0 gap #3 — Build / Deploy / Governance

ERP4 is the only audited project scored PROJECT_AHEAD here.

Reusable evidence:

- explicit checker manifest;
- checks that prove they can fail;
- merge/build/deploy/production separation;
- production release concurrency;
- exact revision verification;
- rollback evidence.

Across the portfolio, however:

- all four observed relevant branches are currently unprotected;
- several CI path filters are asymmetric or incomplete;
- production proof is unavailable for Admin/Estimate and independently unresolved for ERP4 in this audit;
- project registry freshness can lag active work branches.

### Proposed canonical Governance P0

1. checker manifest schema
2. branch/check enforcement profile
3. source/build/deploy/production state model
4. revision-bound release proof
5. rollback contract
6. environment contract
7. contract/checker freshness
8. ADR / decision record
9. exception registry
10. deprecation/removal lifecycle
11. artifact provenance/SBOM risk profile
12. project observation freshness gate

## Project-local next moves after Core P0

### Admin
- UI consumer conformance
- production ActorProvider/AuthZ after Security P0
- production target/revision proof

### ERP4
- UI consumer conformance
- bounded API error/request pilot
- bounded D workflow SHADOW
- fix SSOT Source Contract push-path asymmetry
- branch protection after checks stabilize

### Estimate
- promote candidate canonical branch to main
- refresh Core project observation
- observable production target/revision
- second independent external provider proof

### AIOps
- include approval/with-lease suites in required CI
- fix finance adapter push-path asymmetry
- unified checker manifest / verify entrypoint
- bounded D workflow SHADOW
- independently observe scheduler runtime state

## Operating conclusion

AI Core is already suitable for **read-only project audits and migration planning**.

It is not yet suitable for declaring **full company-wide conformance**, because the two most risk-sensitive axes — Security/Audit and QA/Observability — are still research-only, and Build/Deploy/Governance is only partially canonical.

The next highest-leverage Core work is therefore **not another generic framework**. It is to canonicalize the proven cross-project mechanisms above and wire them into machine gates.

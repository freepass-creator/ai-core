# AI Core → Development Center Hub Execution Handoff v1

Status: ACTIVE execution handoff  
Development Center baseline: `freepass-creator/devcenter@05e1513af9f2bab3b3ecb1ab580bcc9b6dfd6ecd`

## Purpose

AI Core owns company-wide contracts and invariants. Development Center is the official development execution plane that applies those contracts to real projects.

This handoff prevents AI Core and Development Center from becoming two competing implementation centers.

## Official Development Center structure

Development Center routes development work through exactly seven Hubs:

1. Design Hub
2. Data Hub
3. Document Hub
4. Engineering Hub
5. Integration Hub
6. Quality Hub
7. Delivery Hub

`operations / standards / registry / ssot / inspection / engine / runs` remain the Development Center Control Plane and are not an eighth Hub.

## Ownership boundary

### AI Core owns

- company-wide Constitution / Contract
- stable IDs and machine semantics
- UI/UX feature semantics
- Core data/API/event/error/result contracts
- workflow/state/approval/retry/compensation/audit semantics
- cross-project governance rules
- capability and work routing at company-work level

### Development Center owns

- development-task routing into one Primary Hub plus Secondary Hubs
- practical implementation patterns and reusable assets
- applying Core contracts to project code
- project-facing design/data/document/engineering/integration execution
- conformance evidence and delivery evidence
- reverse-import candidates from verified project implementations

### Projects own

- product/domain-specific behavior
- brand profile where allowed
- project Git and deployment configuration
- operational data SSOT
- product-specific business workflow and approved source

## Development request flow

```text
User development request
  ↓
AI Core contract / invariant lookup
  ↓
Development Center Hub Router
  ↓
Primary Hub + Secondary Hubs
  ↓
Project implementation
  ↓
Quality Hub evidence
  ↓
Delivery Hub evidence when deployment/release is in scope
  ↓
Result / candidate feedback to AI Core
```

## Key routing examples

- “전체 디자인 통일” → Design Hub + Quality Hub
- “데이터 SSOT/Schema 정리” → Data Hub + Quality Hub
- “Firebase 연동 구조 변경” → Integration Hub + Engineering Hub + Quality Hub
- “계약서/제안서 양식 통일” → Document Hub + Design Hub + Quality Hub
- “공통 Repository/Adapter 패턴 만들기” → Engineering Hub + Quality Hub
- “배포/롤백 준비” → Delivery Hub + Quality Hub

## UI/UX specific boundary

Canonical project-entry preflight: `docs/UI_UX_START_HERE.md` and `registry/ui-ux-entrypoint.json`.

A UI/UX request must resolve the intended AI Core source bundle digest, product profile, feature IDs and brand SSOT **before** Development Center Design Hub implementation starts. Root `registry/design-hub-binding.json` must match the current canonical files; stale digest is HOLD, not a license to invent local styling.

AI Core B remains the normative owner of UI/UX Constitution, feature IDs, common behavior, accessibility/internationalization requirements and canonical machine contracts.

Development Center **Design Hub is the official execution entrypoint** for requests such as:

- unify design across products
- apply common tokens/components/patterns
- map a project screen to Core feature IDs
- implement visual/layout changes
- collect Approved/Rejected project design evidence
- prepare visual QA for Quality Hub

Therefore “design unification” must not create an independent second design standard in Development Center. The Design Hub consumes a pinned AI Core UI/UX revision and applies it.

## Data specific boundary

AI Core C remains the normative owner of generic Core/Data contracts. Development Center Data Hub operationalizes those contracts, while domain platforms such as FreePass Data remain project implementations and evidence sources.

## Fail-closed rule

If Development Center cannot resolve a development request to its registered Hub structure, it must HOLD rather than invent a new Hub or silently redirect responsibility.

Current executable router baseline:
- `freepass-creator/devcenter/hubs/registry.json`
- `freepass-creator/devcenter/hubs/routing-rules.json`
- `freepass-creator/devcenter/scripts/hub-router.mjs`

## Revision rule

This document pins the Development Center baseline used to define the execution boundary. A later DevCenter revision may supersede it only after the same seven-Hub/control-plane invariant is rechecked.

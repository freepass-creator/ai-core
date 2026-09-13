# AI Core Federation Architecture v0.1

Status: DESIGN candidate. This document defines logical institutions and cross-cutting planes. It does not rename repositories, grant execution authority, or imply production adoption.

## 1. Problem

AI Core is growing beyond a single orchestrator. AIOPS, DevCenter and DocsHub already own different forms of truth, while projects, Chat, Work/Codex and future tools execute real work. If these assets are merely merged into one repository, SSOT boundaries become ambiguous. If every new domain becomes an independent hub, the system fragments.

The solution is a federation: horizontal planes govern all work; vertical centers own domain capabilities; projects remain the reality layer.

## 2. Horizontal planes

### Control Plane
Authority, risk class, approval boundary, policy conflict, protected actions and execution permission.

### Intelligence Plane
Task interpretation, world/context model, source selection, conflict handling, decision history and context compilation.

### Capability Plane
Registry/graph of what the system can do, where the authoritative implementation lives, required inputs, outputs, constraints and verification profile.

### Execution Plane
Role-based execution. Roles are stable (`planner`, `implementer`, `reviewer`, `researcher`, `renderer`, `tester`); models/tools are replaceable implementations such as Chat, Work/Codex or future agents.

### Evidence Plane
Source revisions, commit SHAs, test receipts, render/PDF checks, human review, official-source verification and actual outcomes. The executor's statement is not sufficient evidence by itself.

### Evolution Plane
Observe → diagnose → propose → sandbox test → independent review → shadow pilot → outcome check → promote/reject/revert. Learning candidates never self-grant execution authority.

## 3. Vertical centers

### Work Center
Business/operations/management/communication/decision playbooks and generalized operational experience. Current AIOPS repository can remain a physical source while the logical institution is separately identified.

### Dev Center
Software architecture, reusable components, engineering standards, tests, build/runtime verification and inspection practices.

### Doc Center
Document templates, information hierarchy, A4/print/PDF layout, proposal/report/contract forms and document rendering rules. DocsHub remains the presentation SSOT; Dev Center stores pointers and QA capabilities rather than duplicating templates.

### Data Center (expected next center)
Schema, metric definitions, calculation semantics, normalization, data quality and analytical contracts. Create only when its independent SSOT and verification lifecycle are mature enough.

### Research Center (expected next center)
External-source discovery, freshness, source authority, market/technical/legal research and citation provenance.

### Conditional centers
Legal Center and Simulation Center are not mandatory now. They should spin out only when their capability graph, SSOT and verification lifecycle exceed what combinations of existing centers can reliably handle.

## 4. Reality layer

Projects own product/business truth and live artifacts. Centers do not become new project SSOTs. AI Core composes capabilities from centers and sources from projects without copying ownership.

## 5. Stable logical IDs vs repository names

Repository names are implementation details. Logical institutions use stable IDs:

- `core.ai`
- `plane.control`
- `plane.intelligence`
- `plane.capability`
- `plane.execution`
- `plane.evidence`
- `plane.evolution`
- `center.work`
- `center.dev`
- `center.doc`
- `center.data`
- `center.research`

Aliases may point to historical repositories such as `aiops`, `devcenter`, `docshub`. Renaming a repository must not change the logical institution identity.

## 6. Capability graph

Each capability should expose at least:

- stable capability ID
- owner institution
- authoritative source pointer + revision
- inputs and outputs
- applicable and non-applicable conditions
- verification profile
- execution constraints
- current adoption state
- evidence/outcome links

Example:

`doc.template.strategy_report` → owner `center.doc` → source `docshub/app.js@<sha>` → verify content/layout/pagination/pdf.

`dev.ui.product_card` → owner `center.dev` → source component pointer → build/test/regression profile.

`work.approval.external_action` → owner `center.work` + governed by `plane.control`.

## 7. Universal task flow

Intent → Risk/Authority → Source Resolution → Context Compilation → Capability Composition → Executor Selection → Verification Plan → Execution → Evidence → Outcome → Evolution.

A task may use multiple centers. Example: a market report can use Research Center for external facts, Work Center for business interpretation, Doc Center for rendering, Evidence Plane for source/render verification, and Evolution Plane for later learning.

## 8. Center creation gate

Do not create a center just because a domain name exists. A new center should normally demonstrate at least three of these four properties:

1. independent SSOT or authoritative source set;
2. reusable capability inventory;
3. distinct verification lifecycle;
4. sustained repeated use across projects.

Otherwise keep it as a capability family inside an existing center.

## 9. Safety and authority

Federation architecture does not weaken existing controls. Production deployment, live data mutation, deletion, permissions, payment, legal filing and other high-impact external actions remain separately authorized. Planes coordinate decisions; they do not manufacture authority.

## 10. Current implementation status

Already explored in separate research branches: source/context/capability resolution, Chat↔Work handoff, self-improvement loop, precision-speed learning and document domain integration. This architecture unifies those ideas into a stable topology but is not yet integrated into main or independently validated.

## 11. Next validation

Use one real but non-operational task that crosses at least two centers. Freeze source revisions, generate a capability graph, execute through Chat/Work handoff, collect evidence and compare outcome/rework/context use. The architecture is valuable only if it reduces ambiguity/rework without creating false confidence or extra ceremony.

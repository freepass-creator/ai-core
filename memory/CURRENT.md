# Current Memory — 2026-09-14

## Mission

Build an AI operating system that does more than answer prompts: it should understand the user's intended outcome, identify decision-changing gaps, reuse existing knowledge/capabilities, choose the right executor, verify reality, follow through, and learn from outcomes.

The system should optimize for **fastest path that preserves required evidence**, not speed alone.

AI Core is the control tower for these decisions. The current executable evaluator coordinates revision-bound observations and pointers to project/domain SSOTs; it does not copy those SSOTs or grant execution authority. See `docs/CONTROL_TOWER.md`.

## Current priority — Development first, now moving from design to measured execution

The user has explicitly prioritized development as the first domain to make materially easier. The architecture research is now sufficiently rich that the next priority is **not another large framework**. It is the first measured real Development Episode.

Experiment reference: PR #19 / `experiment/development-episode-pilot-v0.1`.

- Status: `AWAITING_USER_REVIEW`
- PR #19 provides the observation contract and arithmetic summarizer; it does not observe these facts itself.
- PR #1 is the only current implementation line to evaluate. PR #17 and PR #18 must not be advanced before measured episode evidence shows their mechanisms are needed.

`DEV-EPISODE-001` starts on the next suitable real non-production development request. Do not invent a fake task merely to exercise the framework.

Primary observation targets:
- clarification questions and repeated information requests;
- stale requirement/plan/proof events;
- user corrections and review rounds;
- reuse vs new implementation decisions;
- rework loops and files touched;
- intent-to-first-preview time;
- acceptance criteria with current evidence;
- false completion/regression events;
- handoff/resume cost.

Use raw measurements first. Do not manufacture a single intelligence score or unsupported improvement percentage.

## Development building blocks

1. Project Capsule — thin machine-readable project entry point bound to source revision.
2. Change Compiler — user intent → executable development contract / acceptance criteria.
3. Proof Bundle — revision-bound evidence returned by Work/Codex instead of prose-only "done" claims.
4. Requirement Continuity — stable requirement IDs, user-confirmed vs AI-inferred provenance, requirement-set digest, stale-plan detection, Development Episode state, minimal Plan Slice.
5. Engine / Port / Adapter contracts — separate business/domain logic from provider/project mapping, transport, binding, and runtime orchestration. Research: PR #15; DevCenter proposal: issue #2.
6. Semantic Capability Fabric — demand-first promotion of raw symbols into revision-bound Capability Cells; semantic reuse/adapt/compose/new decisions. Research: PR #16; DevCenter proposal: issue #3.
7. Semantic Capability Graph first, Full Codebase Twin on demand — persist high-level reusable meaning and expand file/function relationships only for actual impact analysis.
8. Sandbox/Preview + Verification Fabric + Release Gate — isolated execution, visible preview, layered proof, safe release/rollback.
9. Failure Memory + Development Portfolio — reuse prior fixes and prevent multi-agent/project conflicts.

These remain research/experiment candidates unless separately adopted within a project or Center. Existing project SSOT, DevCenter baseline, current user instruction, Work Packet, and authority boundaries remain controlling.

### Engine / Adapter working model

- Engine = business/domain calculation, rules, validation, or state-transition logic.
- Port = abstract semantic contract required/provided by an Engine.
- Adapter = project/provider-specific implementation of a Port, including field/unit mapping and controlled side effects.
- Connector = low-level HTTP/DB/API transport.
- Binding Profile = revision-bound project/environment wiring of Engine ports to Adapters.
- Runtime = execution order, run state, retries, proof, and orchestration across Engines/Adapters.

Invariant: **Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state.**

Current DevCenter `engine/` is documented as a future common executor/runtime, not a mature domain-engine catalog. `capabilities/integrations` is already described as the location for external API/data contracts and adapters. Do not move folders yet; formalize contracts and pilot one real function first.

### Semantic Capability working model

DevCenter's current function warehouse is a discovery substrate, not a reusable capability registry. Static symbols become reusable only when enough meaning and evidence are known.

Abstraction path:

`Raw Symbol/File → Candidate Cluster → Semantic Capability Cell → Capability Graph → Capability Resolver`

Capability Cell must distinguish:
- semantic purpose/key;
- source/implementation revision;
- input/output meaning, units and null semantics where applicable;
- invariants/errors/side effects;
- compatibility/dependencies/implemented Ports;
- semantic provenance (`USER_CONFIRMED / SOURCE_DERIVED / AI_INFERRED`);
- evidence state and unknowns.

Resolver outcomes include exact reuse, reuse with Adapter, composition/extension candidate, new capability, or HOLD for unknown semantics/evidence/side effects/compatibility.

Key recommendation: **build Semantic Capability Graph before a giant persistent Codebase Twin.** File/function-level graph expansion should be demand-driven for actual impact analysis.

Long-term development direction: AI should write only the delta that the existing capability system cannot already satisfy.

## Tool / agent availability

Gemini CLI is user-confirmed connected; see `memory/TOOL_CONNECTIONS.md`. Connection alone is not task-level verification. Gemini counts as an independent reviewer only when its actual review output is bound to the exact subject revision.

Executor assignment should be capability-based rather than permanently tied to model names.

## Human-facing layer

AI should not assume it can read the user's mind. It should:

- infer intent provisionally, not as fact;
- ask only questions that can materially change a decision;
- first use already available context or authoritative sources when that is enough;
- distinguish value judgments that belong to the human from technical/operational work that can be delegated;
- support the full lifecycle: understand → advise → plan → prepare → execute/coordinate → verify → follow up → learn.

Human Stewardship remains a broader research direction, not adopted operating policy.

## AI infrastructure

The six common infrastructure planes remain:

1. Control — authority, policy, risk, approvals.
2. Intelligence — memory, context, world state, decision state.
3. Capability — what the AI organization can actually do and where the authoritative capability lives.
4. Execution — Chat, Work/Codex, tools, connectors, other agents.
5. Evidence — source revisions, test/run evidence, reviews, actual observations.
6. Evolution — measured learning, shadow comparison, promotion/revert decisions.

These planes are infrastructure, not the user's goals.

## Domain institutions

Current major domain systems are conceptually:

- Work/AIOPS — business/operations/control knowledge and generalized lessons.
- DevCenter — development standards, reusable assets, verification profiles.
- DocsHub / Doc Center — document templates, A4/PDF/layout design system.
- Projects — real code/business/project SSOT.

Additional Centers are justified only when independent SSOT/assets/lifecycle/verification needs warrant them; otherwise use a capability/domain pack.

### Repository topology decision — group headquarters and independent subsidiaries

User-confirmed on 2026-09-15 (KST): adopt a **group workspace** model.

- AI Core is the group headquarters for orders, memory, planning, routing, approvals, evidence and follow-through.
- DevCenter, shared integrations and shared verification are headquarters/common organizations.
- ERP, sales, settlement, homepage, legal, content and other products remain independent subsidiaries with their own repositories, SSOT, brand, data, release and deployment boundaries.
- Local development may co-locate independent repositories under `AI-CORE-GROUP/headquarters` and `AI-CORE-GROUP/subsidiaries`. Co-location does not merge Git histories or project authority.
- Common capabilities are extracted only after semantic/evidence checks and are adopted by pinned version/revision. Project-specific behavior stays local.
- New projects start from one versioned corporate project standard while retaining independent product identity.

This supersedes the prior target of logical linkage only. It does **not** adopt a single-product monorepo that mixes every application. See `docs/GROUP_OPERATING_MODEL.md`.

## Work / Chat collaboration

GitHub is the durable handoff surface.

Chat handles intent discovery, architecture, decision framing, source selection, bounded edits, review, and next-generation research.

Work/Codex handles repository-wide exploration, build/test/debug loops, dependency/runtime work, and larger implementation.

Handoff uses revision-bound Plan Slices / Work Packets rather than full conversations. A source revision, requirement-set digest, completion condition, or blocker change can stale a prior plan.

## Verification invariants

Never equate:
- artifact created;
- verification passed;
- authorization granted;
- external execution confirmed;
- real-world outcome observed.

A PASS is valid only for its declared scope, source/revision, policy/requirement set, and actual checks.

Zero executed checks, skipped checks, stale checks, unverified claims, or self-report alone are not enough.

Each current acceptance criterion should map to current evidence or remain explicitly unverified.

## Learning invariants

New wording, names, rule count, test count, or architecture size is not progress by itself.

A meaningful evolution candidate needs a prior limitation/failure, a changed mechanism, executable counterexample/regression checks where possible, declared scope/limits, and outcome or shadow evidence before broad adoption.

Keep DESIGN, LOCALLY_TESTED, independently verified, shadow validated, real outcome, and operational adoption distinct.

## Knowledge inheritance

Use UNIVERSAL / DOMAIN / LOCAL scopes. Inherit evidence-backed claims and procedures, not duplicated prose. Preserve provenance, supersession and non-application conditions.

## Context efficiency

Retrieve more information when freshness, contradiction, or a critical missing premise can change the conclusion. Do not reread history for its own sake.

## Superseded defaults

- Do not reread all Gmail by default; GitHub memory/current project sources are the operational start point.
- Gmail is archive/distribution/provenance, not active common-memory SSOT.
- Newest research is not automatic operating policy.
- Logical-only linkage is no longer the target topology; use the group workspace while preserving independent subsidiary repositories and authority boundaries.
- Do not build a giant persistent Codebase Twin before proving semantic capability resolution and demand-driven impact expansion.
- Do not keep adding development frameworks when the missing evidence is a real episode.

## Immediate research / execution frontier

1. Run `DEV-EPISODE-001` on the next suitable real non-production development change using PR #19's observation contract.
2. Measure which Development Runtime mechanisms reduce real friction or prevent real failure.
3. Remove pilot fields/steps that create overhead without changing behavior or evidence.
4. If relevant in the episode, test one Engine+Adapter and one Capability Cell through actual reuse/execution evidence.
5. Only then deepen Impact Planner, on-demand Codebase Twin, Preview/Verification, Adapter Forge, Semantic Diff, or release observation based on observed bottlenecks.

Until measured, these remain candidates rather than claims of improvement.

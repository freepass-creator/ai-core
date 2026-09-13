# Current Memory — 2026-09-13

## Mission

Build an AI operating system that does more than answer prompts: it should understand the user's intended outcome, identify decision-changing gaps, reuse existing knowledge/capabilities, choose the right executor, verify reality, follow through, and learn from outcomes.

The system should optimize for **fastest path that preserves required evidence**, not speed alone.

## Current priority — Development first

The user has explicitly prioritized development as the first domain to make materially easier. Near-term research and implementation should therefore focus on reducing repeated explanation, repeated repository discovery, handoff loss, stale requirements, manual verification, preview friction, release uncertainty, and duplicated integration logic.

First development research reference: `docs/DEVELOPMENT_RUNTIME.md`.

Priority building blocks:

1. Project Capsule — thin machine-readable project entry point bound to source revision.
2. Change Compiler — user intent → executable development contract / acceptance criteria.
3. Proof Bundle — revision-bound evidence returned by Work/Codex instead of prose-only "done" claims.
4. Requirement Continuity — stable requirement IDs, user-confirmed vs AI-inferred provenance, requirement-set digest, stale-plan detection, Development Episode state, minimal Plan Slice.
5. Engine / Port / Adapter contracts — separate business/domain logic from provider/project mapping, transport, binding, and runtime orchestration. Research: PR #15 / `research/engine-adapter-contract-v0.1`; DevCenter adoption proposal: issue #2.
6. Codebase Twin + Impact Planner — read-only code graph and minimal-change impact planning.
7. Sandbox/Preview + Verification Fabric + Release Gate — isolated execution, visible preview, layered proof, safe release/rollback.
8. Failure Memory + Development Portfolio — reuse prior fixes and prevent multi-agent/project conflicts.

These are research candidates, not adopted project rules. Existing project SSOT, DevCenter baseline, Work Packet, and authority boundaries remain controlling.

### Engine / Adapter working model

- Engine = business/domain calculation, rules, validation, or state-transition logic.
- Port = abstract semantic contract required/provided by an Engine.
- Adapter = project/provider-specific implementation of a Port, including field/unit mapping and controlled side effects.
- Connector = low-level HTTP/DB/API transport.
- Binding Profile = revision-bound project/environment wiring of Engine ports to Adapters.
- Runtime = execution order, run state, retries, proof, and orchestration across Engines/Adapters.

Invariant: **Engine owns meaning; Adapter owns connection; Connector owns transport; Runtime owns execution state.**

Current DevCenter `engine/` is documented as a future common executor/runtime, not a mature domain-engine catalog. `capabilities/integrations` is already described as the location for external API/data contracts and adapters. Do not move folders yet; formalize contracts and pilot one real function first.

## Current model

### Human-facing layer

AI should not assume it can read the user's mind. It should:

- infer intent provisionally, not as fact;
- ask only questions that can materially change a decision;
- first use already available context or authoritative sources when that is enough;
- distinguish value judgments that belong to the human from technical/operational work that can be delegated;
- support the full lifecycle: understand → advise → plan → prepare → execute/coordinate → verify → follow up → learn.

The latest research direction extends this from task orchestration to **Human Stewardship**: direction, reality, foresight, choice, commitments, resources, human agency, resilience, and growth. This is still research, not adopted operational policy.

### AI infrastructure

The six common infrastructure planes are:

1. Control — authority, policy, risk, approvals.
2. Intelligence — memory, context, world state, decision state.
3. Capability — what the AI organization can actually do and where the authoritative capability lives.
4. Execution — Chat, Work/Codex, tools, connectors, other agents.
5. Evidence — source revisions, test/run evidence, reviews, actual observations.
6. Evolution — measured learning, shadow comparison, promotion/revert decisions.

These planes are infrastructure; they are not themselves the user's life/work goals.

### Domain institutions

Current major domain systems are conceptually:

- Work/AIOPS — business/operations/control knowledge and generalized lessons.
- DevCenter — development standards, reusable assets, verification profiles.
- DocsHub / Doc Center — document templates, A4/PDF/layout design system.
- Projects — real code/business/project SSOT.

Additional centers should not be created just because a topic exists. A separate center is justified only when it has sufficiently independent SSOT/assets, lifecycle, and verification needs. Otherwise use a Domain Pack/capability family.

### Repository topology decision

AI Core is the **logical parent/orchestrator**, but AIOPS, DevCenter, Design/Doc Center and projects remain **physically independent repositories/systems for now**. Do not move them under the `ai-core/` directory merely to make the filesystem resemble the organization chart.

Reconsider physical consolidation only when all of the following are materially true:

- the systems no longer need meaningfully independent SSOT/lifecycle/CI/authority boundaries;
- cross-repository handoff cost is repeatedly larger than the isolation benefit;
- path/registry/CI migration can be done without creating duplicate SSOTs;
- rollback and compatibility for existing projects/agents are prepared.

Until then, represent hierarchy through institution/capability pointers rather than repository nesting.

## Work/Chat collaboration

GitHub is the handoff surface.

Chat should do intent discovery, architecture, decision framing, source selection, bounded edits, review, and next-generation research.

Work/Codex should handle repository-wide exploration, build/test/debug loops, dependency/runtime work, and larger implementation.

Handoff should use a revision-bound Plan Slice / Work Packet rather than copying the whole conversation. A source revision, requirement-set digest, completion condition, or blocker change can make a prior plan stale.

## Verification invariants

Never equate these states:

- artifact created
- verification passed
- authorization granted
- external execution confirmed
- real-world outcome observed

A PASS is not permanent. It is valid only for its declared scope, source/revision, policy/requirement set, and actual checks.

Zero executed checks, skipped checks, stale pre-fix checks, unverified claims, or a passing self-report are not enough.

For requirement-driven work, evidence should trace back to the current required completion criteria. If the requirement set changes, an old receipt is stale.

## Learning invariants

A new document, name, rule count, or test count is not itself progress.

A meaningful evolution candidate needs:

- a concrete prior failure or gap;
- a changed behavior/mechanism;
- executable counterexample/regression checks where possible;
- declared scope and remaining limits;
- outcome or shadow evidence before broad adoption.

Keep DESIGN, LOCALLY_TESTED, independently verified, shadow validated, real outcome, and operational adoption distinct.

## Knowledge inheritance

Use three scopes:

- UNIVERSAL — reusable only after transfer conditions and non-application conditions are explicit and cross-domain evidence exists.
- DOMAIN — specific to a capability/domain.
- LOCAL — project/case/session-specific.

Inherit evidence-backed claims and procedures, not repeated prose. Duplicated wording is not duplicated evidence.

## Context efficiency

Do not reread history for its own sake. Retrieve more information when one of these can change the conclusion:

- freshness/currentness;
- contradiction;
- critical missing information.

The ideal memory query is: **what missing fact could change the decision, and what is the minimum trustworthy source that resolves it?**

## Superseded defaults

- Old default: every AI starts by rereading all `[AI AIOPS]` Gmail.  
  Current default: start from this GitHub memory and current project sources; go back to Gmail only for provenance/history gaps.

- Old default: Gmail can function as the active common-memory SSOT.  
  Current default: Gmail is archive/distribution/provenance; current operational memory is versioned in GitHub and project-specific adopted standards remain in their owner systems.

- Old default: newest research mail automatically becomes the operating standard.  
  Current default: research and adoption are separate states.

- Old temptation: make the filesystem mirror the conceptual hierarchy by moving every Center under AI Core.  
  Current default: keep logical hierarchy and physical repository ownership separate until consolidation has a measured operational advantage.

## Immediate research frontier

1. Development Runtime + Continuity + Engine/Adapter contracts: shadow-test Project Capsule / Change Compiler / Proof Bundle / Living Requirement Graph / Development Episode / one Engine+Adapter pilot first, then Codebase Twin / Impact Planner / Preview+Verification.
2. Human Stewardship: test whether goal/portfolio/agency/follow-through framing improves actual human outcomes.
3. Commitment Graph: track active promises, deadlines, dependencies, waiting-on, blockers, and superseded commitments.
4. Opportunity Radar: surface high-value opportunities/risks with evidence without auto-executing them.
5. Simulation/Foresight: test reversible scenarios before expensive/irreversible action.
6. Real shadow pilots across development, documents, and non-development human workflows.

Until those are tested, they remain research candidates.

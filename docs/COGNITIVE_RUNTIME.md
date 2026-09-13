# AI Core Cognitive Runtime v0.1

Status: DESIGN candidate. This document extends the Federation Architecture; it does not replace adopted AIOPS/DevCenter/DocsHub rules and grants no execution authority.

## Why this layer is needed

Federation Architecture answers **who owns what**. The next problem is **how AI Core maintains a coherent working mind across Chat, Work, tools, Centers, and time**.

Without a cognitive runtime, even a good federation stays reactive: each agent rereads files, reconstructs goals, loses why a decision was made, and treats every handoff as a fresh task. The runtime makes the current goal, current world, current plan, evidence, uncertainty, and learning state explicit.

## Runtime model

AI Core maintains eight linked structures. They are pointers and state, not copies of domain SSOT.

1. **Invariant Kernel** — non-negotiable system invariants: authority is separate from verification; false PASS is not accepted; stale sources cannot silently authorize current conclusions; research candidates do not auto-adopt.
2. **Goal Graph** — goals, subgoals, success conditions, constraints, priorities, dependencies.
3. **World State** — current observations with source, revision, freshness, certainty class, and conflict status.
4. **Task Graph** — executable or reviewable work units with dependencies, owners, blocked reasons, and handoff state.
5. **Decision Ledger** — decisions, alternatives considered, evidence used, reversibility, expiry/review trigger.
6. **Evidence Index** — evidence pointers tied to the exact subject revision and requirement they support.
7. **Outcome Stream** — what actually happened after execution, separate from the plan and from the executor's claim.
8. **Learning Queue** — candidate improvements ranked by information value, recurrence risk, and expected reduction of rework/error.

## Cognitive cycle

```text
SENSE
  ↓
RECONCILE WORLD STATE
  ↓
IDENTIFY DECISION GAP
  ↓
PLAN MINIMUM NEXT ACTION
  ↓
ROUTE TO CHAT / WORK / TOOL / HUMAN GATE
  ↓
EXECUTE OUTSIDE THE RUNTIME
  ↓
VERIFY AGAINST EVIDENCE CONTRACT
  ↓
UPDATE WORLD + DECISION + OUTCOME
  ↓
QUEUE LEARNING CANDIDATE
```

The runtime itself **plans and records**. It does not turn a plan into permission.

## Minimum-next-action principle

The default objective is not "do the most work". It is:

> Choose the smallest reversible action that can materially reduce the decision gap while preserving the required evidence and authority boundaries.

This prevents three common wastes:
- reading the whole history when one source revision resolves the decision,
- sending a small bounded edit to Work/Codex when Chat can finish it,
- running expensive implementation before a blocking design ambiguity is resolved.

## Three clocks

AI Core must reason with three different clocks.

### Task clock
Is the current task advancing toward its done condition?

### World freshness clock
Have external facts, source revisions, dependencies, policies, or project state changed enough to invalidate the current plan?

### Learning clock
Is there enough repeated outcome evidence to change the future routing/policy, or is the apparent improvement only noise?

A task can be complete while the learning clock remains insufficient. A routing policy can be useful while a world-state fact is stale. These states must not be collapsed.

## Decision gaps

A decision gap exists when one missing or conflicting fact can change the next action, route, or conclusion. AI Core should fetch or ask only for gaps that matter to the decision.

Types:
- `FRESHNESS_GAP`
- `SOURCE_CONFLICT`
- `MISSING_REQUIRED_FACT`
- `MISSING_CAPABILITY`
- `MISSING_EVIDENCE`
- `AUTHORITY_GAP`
- `PLAN_DEPENDENCY_BLOCK`

## Plan Slice: the Work-facing contract

Work/Codex should not receive the whole AI Core memory. It receives a **Plan Slice**:

```json
{
  "goal_node": "G-12",
  "task_id": "T-42",
  "objective": "...",
  "allowed_scope": ["..."],
  "forbidden_scope": ["..."],
  "source_revision_set": [{"location":"...","sha":"..."}],
  "done_when": ["..."],
  "evidence_required": ["..."],
  "known_uncertainties": ["..."],
  "handoff_return": ["commit_sha","checks","failures","skips","residual_risk"]
}
```

This is intentionally smaller than full conversation history.

## Counterfactual planning

Before expensive execution, AI Core may compare multiple candidate next actions in shadow:

- What decision gap does this action close?
- Is it reversible?
- What evidence will it produce?
- What is the expected context/execution cost?
- Can a cheaper action answer the same question?
- What failure would this action introduce?

This is a planning comparison, not a claim of real-world causal effect.

## Drift handling

Plans become stale when any bound source changes. A plan slice must be recompiled when:
- project/source SHA changes,
- an authoritative policy changes,
- a blocker resolves or appears,
- the user changes the goal or done condition,
- Work returns evidence contradicting an assumption.

A stale plan is never silently patched into "still valid".

## Self-improvement boundary

The self-improvement system may automatically:
- detect repeated rework/failure patterns,
- propose routing/context/verification changes,
- generate branch/PR candidates,
- run synthetic or explicitly authorized non-production tests,
- compare shadow outcomes.

It may not automatically:
- grant itself new tool or data authority,
- weaken protected invariants,
- deploy to production,
- merge policy changes merely because they score better,
- treat its own evaluator as independent verification.

## Work reference rule

Work should treat this branch as **forward architecture guidance**, not as adopted production policy. Implementation should preserve compatibility with these contracts where cheap and safe, but current Work scope remains the active Work Packet and adopted project rules.

## Next validation

The first useful Shadow Pilot is a real non-production task that passes through Chat → Work → Chat review. Capture:
- context items loaded,
- handoff payload size,
- rework count,
- elapsed time,
- first-pass verification,
- stale-plan events,
- missing-context events.

Compare a normal handoff against a Plan Slice handoff. Only actual outcome deltas justify adoption.
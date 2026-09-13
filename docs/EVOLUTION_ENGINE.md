# AI Core Evolution Engine v0.1 — outcome-based learning gate

## Purpose
AI Core must not call every new rule, file, model opinion, or passing test an evolution. A change becomes a learning candidate only when there is evidence that it changed real behavior in a declared scope.

## Core loop
Task -> Prediction -> Execution -> Evidence -> Outcome -> Comparison -> Learning Candidate -> Transfer Gate -> Adopt / Hold / Reject.

## Separation of states
- DESIGN: mechanism described, not executed.
- LOCALLY_TESTED: self-authored synthetic checks ran.
- INDEPENDENTLY_VERIFIED: a different verifier reproduced the declared result.
- SHADOW_VALIDATED: compared on a real but non-authoritative/non-production task without changing the live outcome.
- OUTCOME_VERIFIED: the intended real-world result was observed with a declared measurement window.
- ADOPTED_LOCAL / ADOPTED_DOMAIN / ADOPTED_UNIVERSAL: adoption scope after evidence review.

A higher state never follows merely from elapsed time, number of tests, number of commits, or AI agreement.

## Evolution Gate
Every candidate must declare:
1. `before_failure`: what the previous system could miss or do badly.
2. `mechanism`: what behavior changes now.
3. `prediction`: observable expected effect before the test.
4. `evidence`: revision-bound checks or observation.
5. `outcome`: what actually happened.
6. `cost`: additional time, tool use, false blocks, complexity.
7. `scope`: LOCAL / DOMAIN / UNIVERSAL candidate.
8. `limits`: known non-coverage.

A candidate is HOLD when evidence is missing, stale, self-referential for a claim requiring independence, or the outcome window is not complete.

## Transfer Gate
Promotion from LOCAL -> DOMAIN -> UNIVERSAL requires both positive and negative applicability conditions.

Required questions:
- What invariant is being transferred?
- Which assumptions made the original result possible?
- Which domains share those assumptions?
- In what conditions would the rule create false blocking or useless overhead?
- Is there at least one successful transfer outside the origin context before UNIVERSAL adoption?

No rule is UNIVERSAL merely because it sounds general.

## Cost-aware evolution
Improvement is multi-objective. AI Core records, where observable:
- rework_count
- first_pass_success
- blocked_false_positive_count
- context_items_loaded
- repeated_context_count
- work/codex execution count
- elapsed execution time
- unresolved/held decisions

These metrics are evidence, not billing truth. They must not be converted into unsupported monetary or intelligence claims.

## Learning destination
- Business meaning, operational incident, authority boundary -> AIOPS candidate.
- Development standard, reusable component, verifier/fixer -> DevCenter candidate.
- Routing, context selection, handoff, evidence/adoption logic -> AI Core candidate.
- Project-specific choice -> stays LOCAL in the project unless Transfer Gate passes.

## Safety boundary
Evolution Engine proposes adoption state; it does not grant execution authority. Deployment, live data, deletion, permissions, payment, filing, or other external consequential actions keep their owner-system approval gates.

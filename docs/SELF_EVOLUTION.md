# AI Core Self-Evolution Contract

Status: `PROPOSED`

## Definition

AI Core has evolved only when an observed limitation causes a bounded change in future behavior and a later comparable real episode shows that the change improved the intended outcome without weakening safety, evidence or user control.

New prose, files, tests, version numbers, model agreement and synthetic examples are artifacts. They are not evolution evidence.

## Loop

1. **Observe** — record a real episode, its revision, requirements, failures, user corrections, rework, verification and outcome. Unknown stays unknown.
2. **Diagnose** — state the smallest supported cause hypothesis. Keep competing hypotheses when evidence cannot distinguish them.
3. **Propose** — define one behavioral change, its exact scope, expected effect, failure conditions and rollback.
4. **Falsify** — add a counterexample that would have caught the original failure. Passing a self-authored test permits a trial, not adoption.
5. **Trial** — apply the change to a later suitable real episode. Do not rewrite the baseline or choose only favorable episodes.
6. **Decide** — compare an evidence vector. Promote only within the tested scope; hold or reject when evidence is missing or harm appears.
7. **Watch** — retain provenance, monitor later outcomes and revert or narrow the rule when a counterexample appears.

## Evidence vector

Do not collapse quality into one score. Compare in this order:

1. unresolved critical or major defects;
2. false completion, evidence loss and authority violations;
3. real outcome and acceptance-criteria coverage;
4. user corrections and rework;
5. time, tool calls and cost.

A faster result does not win if an earlier dimension worsens. A tie or incomparable result remains `HOLD`.

## Promotion states

- `OBSERVED_LIMITATION`: real failure or friction is revision-bound.
- `CHANGE_CANDIDATE`: cause hypothesis, scope, behavior delta, counterexample and rollback are explicit.
- `LOCALLY_TESTED`: deterministic checks pass on the candidate revision.
- `TRIAL_READY`: no unresolved P0/P1, required authority is intact and a comparable future episode is identified.
- `OUTCOME_OBSERVED`: the trial episode is closed and its evidence is current.
- `ADOPTION_CANDIDATE`: baseline and trial support the change within the tested scope and independent review finds no material regression.
- `ADOPTED_LOCAL`, `ADOPTED_DOMAIN` or `ADOPTED_UNIVERSAL`: an authorized decision records the exact scope and revision.
- `HOLD`, `REJECTED` or `REVERTED`: missing evidence, harm, conflict or later counterexample prevents continued promotion.

No state transition grants operational execution authority. AI Core may prepare a branch, tests, evidence and a recommendation. Merge, deployment, external mutation and other consequential actions retain their existing approval gates.

The local evaluator consumes ordinary JSON as untrusted claims. It never returns `ADOPTION_CANDIDATE`. Even when the supplied comparison is favorable, its highest result is `HOLD_EXTERNAL_ATTESTATION_REQUIRED` with a provisional finding. A future external verifier would need an allowlisted identity or signature system that binds the candidate before trial and binds both complete episodes, revisions, requirements, metrics, safety counts, comparison conditions, outcomes and reviewer identities. That trust system is not implemented here.

Candidate content is hashed and must include its revision, registration time and trial start time. This detects later mutation but does not prove that registration actually occurred at that time. The external attestation requirement preserves that unknown.

The trial must end with zero unresolved P0/P1 defects, authority violations, evidence-loss events, user-control violations, false-completion events, regressions, verification failures and unverified acceptance criteria. Counts must be non-negative integers and evidence coverage must be complete. A baseline violation cannot normalize the same violation in a trial.

## Required candidate record

Every proposed evolution must identify:

- source episode and observed limitation;
- cause hypothesis and confidence;
- exact behavior before and after;
- scope and non-application conditions;
- counterexample and executable check;
- expected benefit and possible harm;
- rollback method;
- baseline and future trial episode;
- current state and evidence references.
- distinct baseline and trial episode IDs;
- a shared task/requirement family, observation window and metric schema;
- ordered observation times and an actual outcome for both episodes.

If any of these is absent, the result is `HOLD_INCOMPLETE_CANDIDATE`.

## Anti-self-deception rules

- The author cannot mark its own change independently verified.
- A commit reference proves existence, not correctness or outcome.
- Zero is not used for an unobserved value.
- An open episode cannot prove post-completion outcome.
- Requirements and evidence cannot be changed after seeing the trial merely to improve the comparison.
- A local lesson cannot become domain or universal without evidence from that broader scope.
- Repeated failure narrows, reverts or rejects a rule; it does not trigger more framework by default.

## Current decision

`DEV-EPISODE-001` is still open, has no frozen subject/proof revision, has an unknown baseline and has one unverified criterion. It can supply an observed limitation and candidate mechanism, but it cannot yet prove that AI Core evolved.

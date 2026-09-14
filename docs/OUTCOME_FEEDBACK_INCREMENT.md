# Outcome feedback increment — 2026-09-14

## Purpose and implementation

Base: origin/feature/cognitive-runtime-v0.6. Work branch: improvement/outcome-feedback.
The user requested purpose-driven self-improvement and commits for each validated change.

1. Group conversation lessons by rule key AND exact domain set. Identically named lessons in different domains no longer silently merge or supersede one another.
2. Existing conversation_observations now feed work_packet.learning_contract.next_task_experiments. Relevant domain candidates carry proposed behavior, applicability conditions, failure conditions, counterexample, proposed check and evidence pointers.
3. Missing experiment design stays NEEDS_TEST_DESIGN. Complete design is PROPOSED only. Invalid/conflicting batches emit no experiments. Results remain UNOBSERVED; proposals do not grant authority or adoption.

## Use

Pass sanitized, source-bound observations through the existing orchestrate environment.conversation_observations input. Read next_task_experiments in the returned work packet. Confirm actual applicability before using a proposal; domain overlap alone is not applicability proof. Record the candidate fingerprint, task, subject revision, actual check execution and regressions before assessing any improvement.

## Limits

No automatic observation persistence, trusted evidence retrieval, outcome comparison or rule adoption is implemented by this increment. Callers must supply prior observations again. These are advisory proposals, not executable actions or authenticated proof. Domain-set separation does not resolve overlapping-domain policy conflicts; existing project policy and review remain controlling. No measured improvement percentage is claimed.

## Validation

Regression coverage includes domain isolation, irrelevant-domain exclusion, invalid-feedback blocking, incomplete experiment design, no automatic adoption, and the real orchestrate-to-work-packet path. Existing tests remain required.

Independent review attempts: Cursor read-only review blocked by Workspace Trust; Claude tool-free conceptual review blocked by weekly limit; Gemini conceptual review blocked by directory trust. None counted as passed. Independent review remains outstanding. No trust bypass, remote push, merge or deployment performed.

Final local checks: node --test 242/242 PASS, zero failures/skips; npm run demo PASS (offline HOLD preserved); npm run demo:page generated successfully (visual UI not reviewed); git diff --check PASS.

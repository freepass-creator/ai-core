# Development Episode Pilot v0.1

Status: EXPERIMENT_DESIGN

## Purpose

Move AI Core development research from synthetic design to measured real-work evidence.

The first pilot does **not** try to prove every Development Runtime idea. It tests whether a bounded development episode can reduce repeated explanation, stale work, unnecessary implementation, and false completion without weakening evidence or user control.

The pilot should be used on the **next suitable non-production development change** rather than inventing work only to satisfy the framework.

## Pilot spine

`USER REQUEST → PROJECT RESOLVE → CAPSULE SNAPSHOT → CHANGE COMPILE → REQUIREMENT SET → CAPABILITY QUERY → MINIMAL PLAN → EXECUTE → VERIFY → PREVIEW/PROOF → USER REVIEW → EPISODE CLOSE`

If Engine/Port/Adapter or Semantic Capability reuse is relevant, insert those steps. If not relevant, record `NOT_APPLICABLE`; do not force architecture into a trivial change.

## Episode states

- `OPEN`
- `UNDERSTANDING`
- `READY_TO_EXECUTE`
- `EXECUTING`
- `VERIFYING`
- `AWAITING_USER_REVIEW`
- `READY_TO_RELEASE`
- `CLOSED`
- `HOLD`
- `SUPERSEDED`

## What must be captured

### 1. Intent and requirements
- original user request summary
- clarified/confirmed intent
- stable requirement IDs
- requirement provenance: `USER_CONFIRMED / SOURCE_DERIVED / AI_INFERRED`
- unanswered decision-changing questions
- requirement-set digest

### 2. Project context
- repository/project
- subject/base revision
- Project Capsule revision or snapshot status
- authoritative sources used
- stale/missing context detected

### 3. Capability/reuse decision
- capabilities searched
- candidate reuse assets
- reuse result: exact / adapter / compose / extend / new / hold
- reason for rejecting a reuse candidate
- new reusable asset created, if any

### 4. Execution
- executor(s)
- execution branch/worktree
- changed files/modules
- user-visible behavior changed
- side effects or migrations
- retries/rework loops

### 5. Verification and proof
Each acceptance criterion must map to at least one evidence path or be explicitly `UNVERIFIED`.

Capture:
- commands/checks actually executed
- pass/fail/skip/unknown
- preview or interaction evidence when applicable
- independent review status
- proof revision
- known risks / unknowns

### 6. Outcome
- user accepted first preview? yes/no
- user requested correction count
- release status
- rollback needed? yes/no
- observed defect after completion, if any

## Metrics

The pilot reports raw counts/times first; do not compress them into a single score.

### Human-friction metrics
- `clarification_question_count`
- `repeated_information_request_count`
- `user_correction_count`
- `user_review_round_count`

### Context/continuity metrics
- `repo_orientation_minutes`
- `context_reread_count`
- `stale_plan_events`
- `stale_proof_events`
- `resume_time_minutes` after executor/session handoff

### Implementation metrics
- `candidate_reuse_count`
- `reused_capability_count`
- `new_capability_count`
- `files_touched_count`
- `rework_loop_count`
- `intent_to_first_preview_minutes`

### Evidence/reliability metrics
- `acceptance_criteria_total`
- `criteria_with_current_evidence`
- `false_completion_events`
- `regression_events`
- `unverified_criteria_count`

## Comparison method

For the first pilot, use a simple internal baseline rather than pretending to have a controlled experiment.

Compare against the most similar recent development workflow when evidence exists:
- repeated explanation
- number of correction loops
- time to first visible result
- completeness of proof
- whether stale requirements or stale proof occurred

If no trustworthy baseline exists, record `BASELINE_UNKNOWN`. Do not fabricate improvement percentages.

## Stop / HOLD conditions

Stop only the affected action when:
- user intent materially changes and the current requirement set becomes stale;
- subject revision drifts during verification;
- a required source/SSOT cannot be resolved;
- required proof is unavailable;
- another agent owns an overlapping write scope;
- production/live-data/destructive authority is needed and not granted.

Reversible preparation may continue when the blocked action can be isolated.

## Multi-agent roles for the pilot

Roles are capability-based, not model-name based.

- Intent/architecture: Chat or equivalent
- Repo-wide implementation/debug: Work/Codex or equivalent
- Structure/reference/data-relationship review: Gemini/Cursor may be used when actually available
- Independent final verification: must not be the same actor/process that produced the relevant change unless independence is not required for that criterion

A connected model does not count as a reviewer until its actual output is bound to the subject revision.

## Episode 001 trigger

`DEV-EPISODE-001` starts on the next suitable real non-production development request.

Do **not** create a fake implementation task merely to start the metric clock.

At episode start, instantiate the observation log from `contracts/development-episode-observation.schema.json`.

## Promotion rule

One successful pilot does not make the system an operating standard.

After at least one real episode:
1. identify what actually reduced friction;
2. identify any framework overhead;
3. remove fields/steps that did not change behavior or evidence;
4. keep mechanisms that prevented a real failure or measurably reduced work;
5. then decide whether to run a second shadow pilot or adopt a narrow subset.

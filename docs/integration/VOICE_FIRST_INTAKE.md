# Voice-first candidate intake

## Scope and authority

`normalizeOrderIntent(candidate, context)` is a synchronous, pure ES module shared by AI clients. It performs no speech recognition, LLM call, natural-language parsing, DB access, session execution, clock access, or persistence. Its output is an intake candidate, **not** a control-tower contract, work command, approval, or completed order.

Reviewed boundaries: PR20 `fe9315535e31a6edb723562b2b3515fcdf01107e` control-tower/work-ledger contracts and PR21 `21b1e16d2ab5b1b658e03275da5a5ad5515c8931` contracts and `docs/ORDER_CONTROL_INTEGRATION.md`. Original schemas and evaluators remain authoritative and are not copied here.

## Input contract

- `source`: `{ message_id, origin, text }`; origin is `user`, `agent`, or `document`. The host must supply the original message and authenticated origin; model-supplied source metadata is not proof of identity.
- `intent`: claim with value `new`, `resume`, `change`, `status`, or `stop`.
- `targets`: array of claims whose values are candidate **order IDs**, not work IDs. No current-session or first-match fallback.
- Optional claims: `request`, `execution_location` (`local`, `server`, `unspecified`), `deadline`, `completion_condition`, `approval`.
- Every claim is `{ value, evidence: [{ start, end, quote }] }`. Offsets use JavaScript UTF-16 code units with exclusive end. Quotes must exactly match the source range. Request is required for `new` and `change`.
- Evidence may additionally carry `message_id`; if supplied it must equal `source.message_id` and is retained in output. Legacy evidence without that field remains scoped to the enclosing source. A foreign explicit message ID is rejected even if its quote happens to match.
- Preserve text bytes as decoded into JavaScript strings: do not normalize Unicode before comparing spans. Emoji occupy two UTF-16 units; code-point offsets are not interchangeable. Tests cover emoji offsets and visually equivalent composed/decomposed text.
- `context.target_snapshot`: `{ ref, revision, order_ids }` from a caller-controlled canonical lookup. Required when targets are supplied. Pass a minimal snapshot, not a DB handle. This module cannot authenticate or assess freshness of that snapshot.

Example extraction from “A 작업 이어서 서버에서 해줘”: use `resume`, target `A`, and location `server`, each with a matching evidence span. Caller-provided canonical snapshot must contain A. This produces `CANDIDATE_VALIDATED` with `execution_authorized: false`. No deadline, completion condition, deployment or permission is inferred. The user supplies speech/text; the host constructs this object.

## Extraction versus validation

The model proposes semantic interpretations. This module validates value types/enums, exact evidence ranges and target membership. A matching quote does **not** prove the interpretation: even an approval claim attached to unrelated but matching text remains untrusted. All outputs retain `semantic_confirmation: REQUIRED`, `authorization_status: NOT_EVALUATED`, and `execution_authorized: false`.

Missing or invalid inputs produce `NEEDS_CLARIFICATION`, machine-readable `issues`, and a short Korean question. Multiple distinct targets return choices without selecting one. Duplicate IDs collapse. Existing-target IDs with `new` require clarification. Agent/document origins require user confirmation. Unknown extra keys are ignored and never become authority fields. Optional deadline wording remains literal (e.g. “내일”); no timezone or date is invented. Stop is an intent candidate, not a cancellation command.

## Integration obligations

The coordinator must connect canonical target lookup and subsequent command/evaluation functions through host dependency injection. No canonical evaluator is required or invoked at this intake stage. Re-read the target snapshot before a state-changing action; source identity, semantic confirmation, order/work mapping, revision checks, expectedHead, authorization and completion remain downstream responsibilities. Never map `CANDIDATE_VALIDATED` to READY, execution approval or CLOSED. An empty target for status/resume/change/stop asks for clarification; global status is not inferred.

The module creates no identifiers or timestamps and retains source text only in its returned object. The host owns sensitive-data handling, size limits, and transport. Inputs are JSON-shaped data, not objects with executable getters. Multi-message evidence must be split into separately attributed candidates by the host; ranges cannot silently refer to another message.

## Bounded verification

Run `node --test test/normalize-order-intent.test.mjs`. Tests cover all five intents, server versus approval, missing/unknown/ambiguous targets, invalid evidence, missing fields, origin confirmation, immutable inputs, deterministic output, literal deadlines and semantic overclaim counterexamples. These tests do not prove an LLM extractor, actual speech/UI flow, live lookup, or integrated execution gate.

## Follow-up counterexamples and required host inputs

| User utterance | Candidate handling |
|---|---|
| 아까 하던거 이어줘 | `resume` with A and B stays ambiguous; input order never selects a target. |
| 서버에서 해줘 | Location alone cannot establish an intent or target, much less deployment approval. |
| 그건 하지마 | `stop` without a target requires clarification; even a wrong `resume` extraction cannot authorize execution. |
| 완료는 아니고 검토만 | Missing change details require clarification; a wrong extraction cannot create CLOSED or completion. |
| 이전 조건 바꿔 | `change` requires a request; supplying generic wording still requires semantic clarification of which condition and replacement. |

The coordinator/adapter must supply these independently of the model:

1. Authenticated original message identity, origin and exact text in `source`. Compare against the received message before calling. If the candidate and its source text/ID are jointly forged to agree, this module cannot discover the forgery. Explicit evidence IDs detect mismatched attribution, not authenticity. No separate trusted-source input has been introduced here.
2. Minimal canonical order lookup result as `context.target_snapshot` with its query ref, opaque revision and order IDs. Do not substitute model-recalled IDs or another session's snapshot. `revision` is preserved verbatim and is neither a timestamp nor proof of recency. This module has no independent current revision or clock; an internally valid old snapshot can still yield `CANDIDATE_VALIDATED`.
3. A fresh canonical re-read and revision comparison before adapter action. If the snapshot changed, re-resolve the target and re-evaluate the command. The intake snapshot revision is not automatically a requirement revision, subject Git revision, work-ledger head or order record version. Integration must define those mappings without conflating them.
4. Semantic confirmation of referents, negation, review-only scope and requested changes, followed by canonical authorization/state gates. Exact source spans can support an incorrect model interpretation. Never use candidate status or `approval_candidate` as permission, and never fall back to the sole surviving target if another target has invalid evidence.

Remaining unverified: source authentication, coordinated source/evidence forgery, live snapshot freshness, referent/negation understanding, and adapter enforcement. These are explicit host integration obligations, not capabilities established by the bounded tests. No external reviewer/API was called during this follow-up under the task's external-API prohibition.

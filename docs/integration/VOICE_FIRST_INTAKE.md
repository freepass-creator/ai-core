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

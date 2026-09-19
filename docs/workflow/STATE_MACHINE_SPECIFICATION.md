# State Machine Specification

Status: **D SESSION CANONICAL STANDARD v1.0**

Machine contract: `contracts/workflow.schema.json`  
Primitive/domain registry: `registry/workflows.json`  
Runtime: `src/workflow/engine.mjs`  
Validator: `scripts/validate-workflows.mjs`

## 1. State model

A domain workflow has one or more orthogonal `state_axes`. Each axis owns an explicit initial state and a finite state set.

State kinds:

- `NORMAL`
- `HOLD`
- `FINAL`
- `FAILURE`
- `CANCELLED`

A UI may derive a headline/display state from multiple axes and facts. A derived label is not writable state unless the domain workflow explicitly defines it as such.

Facts and state are different:

- **Fact**: evidence-bearing data about reality.
- **State**: authoritative lifecycle position on one axis.
- **Derived state**: computed summary.
- **Display state**: presentation label.

## 2. Transition Contract

Every transition declares all of the following:

- `transition_id`
- semantic `purpose`
- target `axis_id`
- allowed previous states `from[]`
- next state `to`
- `command_id`
- resulting `event_type`
- `guards[]`
- `required_evidence[]`
- transition-level `permissions[]`
- approval policy
- side effects
- failure policy
- retry policy
- optional timeout
- optional SLA
- automation mode
- manual override policy
- audit requirement
- reversibility / compensation

An empty policy must be explicit. Omitted policy is never interpreted as permission.

## 3. Command / Event Mapping

**Command** means requested intent.  
**Event** means an occurrence that the workflow accepted as fact.

Examples:

- command: `contract.complete`
- event: `contract.delivery.completed`

A rejected command does not emit the success event.

Recommended event naming:

`<domain>.<entity>.<past-tense-action>`

D owns the event's business meaning. C owns the transport envelope and API/error representation.

## 4. Transition identity and duplicate safety

For idempotent commands the runtime computes a canonical digest from:

- workflow id + version
- transition id
- command id
- entity id
- canonical command payload digest

Rules:

- same idempotency key + same canonical intent -> replay prior result
- same idempotency key + different canonical intent -> `IDEMPOTENCY_CONFLICT`
- replay is checked before current-revision rejection, so a safely completed request can be repeated after the projection advanced
- new intent must still match `expected_revision`

The raw command payload does not need to be copied into audit history; the digest is sufficient for identity and minimizes data duplication.

## 5. Guard vs Evidence

A **Guard** answers:

> May this transition start?

Built-in guard kinds:

- `FACT_PRESENT`
- `FACT_EQUALS`
- `CUSTOM`

`CUSTOM` fails closed unless an explicit evaluator is installed.

**Evidence** answers:

> What proves the required occurrence actually happened?

Evidence verification modes:

- `HUMAN_REPORTED`
- `SYSTEM_VERIFIED`
- `EXTERNAL_AUTHORITY`

A human report does not satisfy a system-verified requirement. Provider-specific status strings must first pass through the relevant adapter.

## 6. Approval Pattern

Approval is transition-scoped and is separate from execution permission.

Policies:

- `NONE`
- `ANY_ONE`
- `ALL`

A non-NONE approval must declare roles. `separation_of_duties=true` prevents the executing actor from satisfying the approval requirement in the same decision.

Suggested actor semantics remain distinct even when one person can hold multiple roles:

- requester
- approver
- executor
- verifier

## 7. Reject / Hold / Cancel / Fail / Resume

Transition purpose is explicit.

- `HOLD` targets a HOLD state.
- `RESUME` originates from a HOLD state.
- `CANCEL` targets a CANCELLED state.
- `FAIL` targets a FAILURE state.
- terminal states have no normal outbound transitions.
- terminal correction requires `RESTORE` or `CORRECTION`.

Cancellation is not deletion. Hold is not completion.

A production defer/snooze flow should preserve a `resume_at`, due condition, or equivalent fact and should suppress repeated work until that condition is due.

## 8. Retry / Failure Pattern

Retry policy declares:

- strategy: `NONE | FIXED | EXPONENTIAL | MANUAL`
- `max_attempts`
- `base_delay_ms`
- retryable error codes

Retries are bounded. The state-machine engine returns a retry plan; it does not recursively call external systems.

On exhaustion, policy is explicit:

- `FAIL`
- `HOLD`
- `COMPENSATE`
- `ESCALATE`

A compensation outcome requires an explicit compensation transition.

A lost or ambiguous external response must be reconciled against authoritative evidence before replay. This preserves the existing durable-coordination rule: **re-read, do not blindly replay**.

## 9. Rollback / Compensation / Correction

Rollback never erases history.

A reversible transition points to an explicit compensation transition. Compensation emits its own event and audit record.

Use semantic recovery correctly:

- `ROLLBACK`: reverse an uncommitted/technical step when domain meaning permits.
- `COMPENSATION`: perform a new action that counteracts an already committed effect.
- `RESTORE`: reopen or restore a terminal domain object under an explicit rule.
- `CORRECTION`: append a corrected fact/event while preserving the original history.

## 10. Timeout / SLA / Escalation

Timeout and SLA are distinct.

**Timeout**: an attempted operation did not reach an expected result within a duration.  
**SLA**: a business obligation remained open beyond its allowed duration.

Timeout may:

- HOLD
- FAIL
- ESCALATE
- trigger another declared transition

SLA breach names an event and may point to an escalation transition.

Declaring timing metadata does not itself schedule a job. The automation runner consumes it.

## 11. Automation Pattern

Modes:

- `MANUAL`
- `AUTOMATED`
- `HYBRID`

Manual and automated execution use the same transition definition. Automation does not gain a second hidden state machine.

An automation runner may select due transitions, but the actual decision still evaluates:

- current state
- expected revision
- permissions/authority
- guards
- evidence
- approval
- audit

## 12. Manual Override

Manual override is opt-in per transition.

It may bypass only explicitly listed categories:

- `GUARDS`
- `EVIDENCE`

It never bypasses:

- command/transition binding
- idempotency
- optimistic concurrency
- approval separation of duties
- audit creation

Override permissions are separate from normal transition permissions, and a reason can be mandatory.

## 13. Audit Pattern

Every accepted transition yields a domain event and a separate audit record.

Minimum audit fields:

- workflow id/version
- entity
- transition + command
- canonical command-payload digest / intent fingerprint
- actor
- changed time
- reason when required
- from/to state
- expected/resulting revision
- request/idempotency ids
- evidence refs
- approval actors
- manual override usage

The event records domain history. The audit record records accountability. Both are append-only semantics.

## 14. Current Projection vs History

Current projection is optimized for read/query. Event/audit history is the immutable explanation of how the projection arrived there.

A domain may use:

`event stream -> projector -> current projection`

or a transactional current-state table plus append-only transition history.

Either way, history and current projection must be reconcilable; updating a current status must not silently rewrite prior events.

## 15. Workflow Registry

`registry/workflows.json` contains two layers:

1. `primitives` — company-wide semantics and evidence/adoption level.
2. `workflows` — domain-specific state machines.

A workflow being registered does not make its state names universal.

The registry supports `CANONICAL | SHADOW | PILOT | DEPRECATED` domain adoption states.

## 16. Obligation Pattern

The schema supports:

`opening event + due rule + closing event(s) = open obligation`

This is currently **PILOT**, not mandatory company-wide, because cross-project verification is not yet complete.

Typical examples:

- invoice issued -> receipt matched
- document requested -> document received
- vehicle delivered -> returned/recovered

## 17. Workflow Validator

`npm run workflow:validate` validates both JSON Schema and semantic consistency.

Checks include:

- duplicate IDs
- initial state existence
- state terminal/kind consistency
- guard fact references
- transition axis/from/to references
- command/event/guard/evidence references
- approval-role consistency
- hold/resume/cancel/fail state semantics
- terminal outbound restrictions
- retry bounds
- compensation references
- failure state kind
- timeout transition references
- SLA breach/escalation references
- obligation event references
- non-terminal state without outbound transition warning

## 18. B-session UI read contract

B should consume engine output rather than duplicate workflow logic.

A standard action projection exposes:

- current state(s)
- transition/action id
- command id
- from/to
- purpose
- `eligible`
- stable reason codes when ineligible

The UI may choose how to display or disable an action. It may not redefine whether the transition is valid.

## 19. Aggregate / child workflow rule

The second-pass AI Core audit found an important pattern in `src/orders/store.mjs`:

- an Order has a projection status
- child Tasks each have their own lifecycle
- lease/heartbeat is execution coordination
- requirement revision invalidates prior reports
- user acceptance is recorded without claiming canonical completion

D therefore distinguishes:

1. **child workflow state** — e.g. a task lifecycle
2. **execution lease facts** — owner/token/expiry/attempt
3. **parent aggregate projection** — derived from child states
4. **requirement revision** — the epoch to which evidence belongs
5. **canonical business completion** — separate authority when another domain owns it

A parent status that is derived from children should not be independently writable merely because it is displayed as a status.

Heartbeat/lease extension is normally coordination CRUD/fact update, not a business transition. Claim, block, report, invalidate/revise and cancel may be transitions because they change workflow meaning.

Fork/join or multi-task completion should be represented by explicit guards over child facts/projections rather than a hidden UI rule.

## 20. Existing AI Core Work Ledger bridge

The current `scripts/work-ledger.mjs` remains authoritative for the AI Core Work lifecycle during this checkpoint.

Its `RECEIVED -> ... -> CLOSED` states are an AI Core domain workflow, **not company-wide primitives**.

Migration sequence:

1. encode the exact current ledger machine as a SHADOW domain workflow
2. replay existing ledger tests against both implementations
3. preserve REOBSERVED revision semantics
4. preserve hash-chain and evidence-required closure
5. preserve lost-response reconciliation
6. replace hard-coded lookup only after parity evidence
7. run complete regression and main-state verification
8. promote only after revision-bound evidence

This v1 therefore introduces the common contract without silently changing current ledger authority.


## Work Ledger SHADOW parity checkpoint

`registry/workflows.json` now contains `ai-core.work-lifecycle@0.1.0` with `adoption_status=SHADOW`.

It models the current Work Ledger state graph without taking authority away from `scripts/work-ledger.mjs`.

The SHADOW includes:

- all current Work Ledger states
- all 30 normal transition pairs
- 3 same-state REOBSERVE transitions for RECEIVED / PLANNED / IN_PROGRESS
- project identity preservation
- normal-transition subject revision immutability
- verification-presence vs verified-revision-value separation
- verified-path gating
- evidence + non-null revision closure rules
- BLOCKED behavior both before and after verification

Source authority is machine-pinned to:

- repository
- audited source revision
- exact Git blob SHA for `scripts/work-ledger.mjs`
- exact Git blob SHA for `contracts/work-ledger-event.schema.json`

A SHADOW workflow without source authority is invalid.

The parity test suite compares the current Ledger and D SHADOW against the same candidate transitions, including the full 11×11 state-pair matrix. If the source blobs change, the source-lock test fails until the SHADOW is re-audited.

This is a migration gate, not a replacement switch.


## Order / Task SHADOW parity checkpoint

`registry/workflows.json` contains `ai-core.order-task-lifecycle@0.1.0` as SHADOW.

The machine extracts the child-task lifecycle currently embedded in `OrderStore.mutate()`:

- PENDING
- RUNNING
- BLOCKED
- REPORTED

Explicit transitions cover:

- assign/reassign
- initial claim
- blocked resume
- expired-lease reclaim
- report
- block
- parent-revision invalidation back to PENDING

The SHADOW intentionally does **not** model heartbeat as a business transition. Heartbeat is an audited lease fact update that preserves RUNNING.

Guards mirror current OrderStore behavior for:

- valid/assigned actor
- active vs inactive lease
- token/actor lease ownership
- dependency completion
- requirement revision match
- report content/evidence validity
- required reason validity

Parent Order status remains a derived aggregate:

- all child tasks REPORTED -> REVIEW
- any BLOCKED -> BLOCKED
- any RUNNING or REPORTED -> ACTIVE
- otherwise -> NEW
- CANCELLED/CLOSED remain terminal overrides

The current close action records `USER_ACCEPTED_NOT_CANONICAL` and leaves the parent in REVIEW. D preserves that distinction rather than manufacturing canonical completion.

The SHADOW is source-pinned to the exact `src/orders/store.mjs` Git blob and parity-tested against the real OrderStore.

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

### 9.1 Sequential multi-effect compensation

여러 effect를 순차 적용하는 write path는 트랜잭션처럼 가장해서는 안 된다. `workflow.compensated-multiwrite` PILOT은 다음을 요구한다.

1. 각 effect는 domain-specific compensation을 `REQUIRED`로 선언하거나, compensation이 `NOT_REQUIRED / FORBIDDEN`인 이유를 명시한다.
2. 후속 effect 실패 시 실제로 적용된 이전 effect만 대상으로 한다.
3. required compensation은 적용 역순으로 실행한다.
4. compensation 성공은 원래 실패를 성공으로 바꾸지 않는다. 원래 실패는 그대로 보고한다.
5. compensation 실패/누락은 `PARTIAL_STATE`로 명시하고 escalation 대상으로 남긴다.
6. effect와 compensation 모두 audit evidence를 남긴다.

Machine authority:
- `contracts/workflow-compensation.schema.json`
- `registry/workflow-compensation-policies.json`
- `src/workflow/compensation.mjs`
- `scripts/validate-workflow-compensation-policies.mjs`

첫 근거는 Renman이며, 두 번째 독립 프로젝트 전까지 `PILOT / PROJECT_VERIFIED`를 유지한다.

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

### 10.1 Schedule timing assessment

스케줄 기반 실행은 예정 logical slot, 실제 dispatch, execution attempt, eventual completion을 분리한다.

`workflow.schedule-timing-assessment`는 현재 `PROPOSED`이며 회사 공통 late/missed 임계값을 갖지 않는다. Domain policy가 `late_after_ms`와 `missed_after_ms`를 명시해야만 timing classification을 계산할 수 있다.

- dispatch 관측 + late threshold 이내 → `ON_TIME`
- dispatch 관측 + late threshold 초과 → `LATE`
- dispatch 미관측 + miss threshold 이전 → `UNKNOWN`
- dispatch 미관측 + miss threshold 도달 → `MISSED`

C는 `core.schedule-observation/v1`로 관측 envelope를 소유하고, D는 threshold/assessment policy를 소유한다. 이 integration branch에서는 C 계약이 AVAILABLE이지만 구체 threshold와 구현 근거가 없으므로 아직 PILOT으로 승격하지 않는다.

Machine authority:
- `contracts/workflow-schedule-timing.schema.json`
- `registry/workflow-schedule-timing-policies.json`
- `src/workflow/schedule-timing.mjs`
- `scripts/validate-workflow-schedule-timing-policies.mjs`

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

Maturity semantics are evidence-bound:

- **SHADOW** — D has a model, but the source project remains runtime authority. A SHADOW may be `SOURCE_MODELED` or `SOURCE_PARITY_VERIFIED`.
- **PILOT** — the source project actually routes an approved runtime scope through the D decision/projection contract. `RUNTIME_PILOT` evidence is mandatory.
- **CANONICAL** — D is the authoritative workflow runtime for the declared scope. Internal AI Core workflows may already be canonical without cross-repository adoption evidence.
- **DEPRECATED** — retained for migration/history and not for new adoption.

A green source-side parity test does **not** by itself turn SHADOW into PILOT.

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


## Work Ledger canonical runtime + parity checkpoint

`registry/workflows.json` now contains `ai-core.work-lifecycle@0.1.0` with `adoption_status=CANONICAL`.

`scripts/work-ledger.mjs` now consumes this Registry graph directly. D owns the lifecycle state graph; Work Ledger retains append-only event/hash/revision/evidence history authority.

The canonical Registry model includes:

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

The parity test suite compares Work Ledger behavior and the D Registry model against the same candidate transitions, including the full 11×11 state-pair matrix. Source drift fails until the integration provenance is refreshed and parity is re-audited.

This checkpoint completed the first runtime migration: the hard-coded Work Ledger transition map was removed. Frozen legacy-matrix tests and the full parity suite protect behavior during the authority split.


## Order / Task canonical runtime + parity checkpoint

`registry/workflows.json` contains `ai-core.order-task-lifecycle@0.1.0` as CANONICAL.

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

The canonical workflow intentionally does **not** model heartbeat as a business transition. Heartbeat is an audited lease fact update that preserves RUNNING.

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

OrderStore consumes the canonical workflow through `src/workflow/order-task-runtime.mjs`. Integration provenance is source-pinned to the exact `src/orders/store.mjs` Git blob and parity-tested against the real store.


## Capability Execution canonical runtime + parity checkpoint

`ai-core.capability-execution@0.1.0` is registered as CANONICAL.

Persistent coordination lifecycle:

- RESERVED
- RESULT

Important distinction:

- reconciliation `HOLD / EXECUTION_OUTCOME_UNKNOWN` is not a stored lifecycle state
- when no authoritative terminal receipt exists, the persistent request remains RESERVED
- a terminal receipt may reconcile to a RESULT whose result status is SUCCEEDED, FAILED or HOLD
- result status is a Result/Fact semantic, not another hidden lifecycle state

The canonical workflow preserves:

- durable request-id reservation
- same request/same payload replay
- same request/different payload conflict
- safe receipt persistence that drops `outcome.data`
- exact result context/capability/revision error codes
- identical-result replay after RESULT
- conflicting-result rejection
- reconcile-before-retry
- terminal receipt success/failure/hold mapping

Source authority is pinned to the exact coordinator and receipt-reader blobs.

## Cross-machine Bridge Registry

`registry/workflow-bridges.json` defines the current explicit relationships among the three AI Core machines.

Current SHADOW bridges:

1. parent Order REVISE -> all child Task `order-task.invalidate` in the same transaction
2. child Task lifecycle -> derived parent `order.status`
3. Capability RESULT -> Work evidence feed only
4. Reconciled Capability RESULT -> Work evidence feed only

For both Capability-to-Work bridges:

- dispatch mode is NONE
- no Work command is named
- direct transition is forbidden
- existing Control Tower / Work Ledger authority remains required

This prevents a capability receipt from becoming an accidental Work completion event.


## Recovery Slot No-Replay Pilot

A-session production evidence from FreePass ERP4 exposed a recovery-specific gap not covered by ordinary request idempotency.

The verified failure class:

`native logical execution succeeds -> recovery reconciliation misses that success -> fallback replays the same logical execution`.

D registers this as:

- primitive: `workflow.recovery-slot-no-replay`
- policy registry: `registry/workflow-recovery-policies.json`
- adoption: **PILOT**
- evidence: **PROJECT_VERIFIED**
- source project: `freepasserp4`

The policy requires:

1. native, fallback and downstream paths share one **logical execution identity**
2. recovery eligibility is evaluated only after success-evidence reconciliation
3. successful native execution suppresses fallback
4. successful prior recovery suppresses another recovery
5. recovery cursor/slot progress is monotonic
6. replay after known success is forbidden
7. ambiguous outcome results in **HOLD**, not blind retry

This does not import ERP4-specific times, workflow names or run IDs.

### C-session dependency

D owns the recovery state-machine semantics, but the cross-path identity field contract belongs to C.

The recovery policy therefore records:

`identity_owner=C / identity_contract_status=PENDING`

Until C binds the shared logical execution identity contract and a second independent project proves the same failure/implementation class, this policy must not be promoted to COMMON_ADOPTED.

## 21. Monotonic progression and forward-skip integrity

Some workflows have an ordered durable progression where later valid business facts may skip intermediate UI milestones. D models this separately from ordinary one-edge transitions through the Workflow Progression contract.

Machine authority:

- `contracts/workflow-progression.schema.json`
- `registry/workflow-progressions.json`
- `src/workflow/progression.mjs`
- `scripts/validate-workflow-progressions.mjs`

Rules:

1. Progression order is explicit; array order in a normal state axis is not silently treated as business rank.
2. Backward durable progress is forbidden unless a separate correction/restore workflow explicitly exists.
3. Forward skip may be allowed by the progression contract.
4. Skipped intermediate states must not receive fabricated completion events, timestamps or stronger evidence merely to fill the sequence.
5. A later target may logically imply a prerequisite fact. That inference must be explicit and provenance-bearing.
6. An inferred weaker prerequisite must not be promoted into a stronger fact. Example: “quote was presented” does not prove “quote was sent.”
7. Transient contact/transport outcomes must not regress previously proven durable business progress.
8. C owns the typed provenance/evidence envelope; D owns when the workflow requires inferred-prerequisite provenance.

The first project-verified source is FreePass Sales. The reusable primitive `workflow.forward-skip-evidence-integrity` remains PILOT until a second independent project verifies the same rule.


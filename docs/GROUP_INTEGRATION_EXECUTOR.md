# Group Integration Executor Boundary v1

## Purpose

This runtime connects the existing integration chain without embedding project-specific cross-repository mutations into AI Core.

`createGroupIntegrationExecutor()` orchestrates:

1. Work Packet presence;
2. classification-specific executor adapter lookup;
3. preflight repository observation and seal;
4. canonical authority verification;
5. a second repository observation after authority verification;
6. adapter execution;
7. independent result verification;
8. canonical `core-receipt/v1` construction.

## Fail-closed defaults

The executor ships with **zero built-in mutation adapters**.

If a classification/action adapter has not been explicitly registered, execution returns:

`INTEGRATION_EXECUTION_ADAPTER_MISSING`

This prevents the mere existence of the common executor from enabling cross-repository writes.

## Preparation vs execution

`perform=false` returns `PREPARED` and performs no observation, authority check, filesystem/Git mutation or external effect.

`perform=true` additionally requires:

- attempt ID;
- actor;
- correlation ID;
- exact-revision preflight;
- verified authority with a durable authority reference;
- final re-observation after authority verification.

## Execution/verification separation

The mutation adapter and post-execution verifier are separate injected dependencies.

An adapter cannot mark itself authorized or complete. The runtime rejects adapter results containing:

- `execution_authorized=true`
- `completion_authorized=true`

A claimed `SUCCEEDED` execution becomes a receipt only if the independent verifier supplies every check required by the Work Packet and all are PASS.

If adapter execution throws, the runtime returns `INTEGRATION_EXECUTION_OUTCOME_UNKNOWN` rather than guessing whether a partial write happened.

## Authority boundary

The executor does not define a new authority schema. It accepts an injected canonical authority verifier which must return:

```js
{ ok: true, ref: "durable-authority-evidence-ref" }
```

That durable ref is bound into `core-receipt/v1`.

## Intended chain

`Inventory -> Plan (#146) -> Work Packet (#147) -> Preflight (#148) -> Executor -> independent verification -> core-receipt/v1 -> Work Ledger`

Project/classification-specific mutation adapters remain separate follow-up work and should be introduced one at a time with their own evidence and rollback tests.


## Unknown-outcome rule

A thrown adapter error after authority/preflight is **not** represented as `performed=false`. The runtime cannot know whether the target changed before the error was observed, so it returns:

- `effect_state: "UNKNOWN"`
- `performed: null`
- `outcome_known: false`

If the adapter reports that it performed the operation but post-execution verification becomes unavailable, the runtime preserves:

- `effect_state: "PERFORMED"`
- `performed: true`
- `external_effect: true`

and returns HOLD. This keeps reconciliation honest and prevents a potentially mutated repository from being retried as though nothing happened.

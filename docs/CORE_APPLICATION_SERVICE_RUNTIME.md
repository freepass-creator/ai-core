# Core Application Service Runtime v1

Status: **C POST-BASELINE IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

AI Core already defines `core-application-service/v1` and optional `service_bindings` in the Binding Profile. This runtime makes that contract executable without collapsing Application Service, Domain Engine, Port, Adapter, Connector, or Workflow responsibilities.

Implementation:
- `src/engine/application-service-runtime.mjs`
- shared Adapter boundary: `src/engine/adapter-invocation-runtime.mjs`
- binding resolver: `src/contracts/engine-adapter-contract.mjs`
- tests: `test/application-service-runtime.test.mjs`

## Runtime invariants

1. Every required Service port must resolve exactly once.
2. A PARTIAL/STALE/FAILED/NOT_RUN binding may be inspected but strict execution is HOLD.
3. A required actor is checked before any Port invocation.
4. A required idempotency key is checked before any side-effect Port invocation.
5. Service implementation receives only the ports declared by the revision-bound Service binding.
6. Adapter invocation, Connector restrictions, timeout and canonical Adapter Result normalization reuse the same runtime as Engine Port execution.
7. Undeclared Service error codes cannot silently become canonical service failures.
8. Service Runtime does not grant execution authority.
9. D still owns business workflow state, retry/resume/escalation and compensation.

## FreePass Admin shadow

Current observed Admin revision:
`2aede7df82591470308f25bd3ccd4e5358aa7c3c`

The Application Service requires:
- `application.repository`
- `product.read`
- `actor.provider`

Current development binding resolves only the first two.

Therefore AI Core intentionally records the Admin Service binding as **SHADOW / PARTIAL / HOLD**. It does not invent an actor adapter and does not claim Service Runtime validation.

The development file adapters are separately bound to a FILESYSTEM Connector that represents the current JSON file transport. This is development evidence only and does not imply the production Firestore adapter exists.

## Verification state

GitHub Actions are intentionally not used under the current user-directed mode. Code/tests are implemented but **NOT CI VERIFIED**.


## Adapter vs Repository binding

A Service Port binds to exactly one target:
- Adapter — provider/project mapping or integration boundary;
- Repository — persistence boundary.

The runtime inspects the Binding Profile and routes the Port call through the corresponding runtime.

For Repository bindings the Service call names the explicit `repository_operation_id`. This keeps a broad persistence Port from silently opening unrelated storage operations.

FreePass Admin is the first SHADOW case where:
- `application.repository` -> Repository
- `product.read` -> Repository
- `actor.provider` -> unresolved

Therefore the current Admin Service remains HOLD even though both persistence Ports are structurally modeled.


## Parent / child receipt lineage

`runWithReceipt()` creates:

1. child receipt for each Adapter/Repository Port execution;
2. one parent Service `core-receipt/v1`;
3. parent `child_receipts[]` references back to the exact child receipts.

The parent receipt does not copy child payloads. It records only lineage references, parent input/output digests, compact evidence and optional proof-input binding.

A Service HOLD or FAILED result does not erase child receipts that already exist. This preserves partial execution evidence for later D workflow recovery/compensation decisions.

Receipt lineage is execution evidence only. It does not mark workflow completion.

# Core Repository Runtime v1

Status: **C EXPERIMENTAL IMPLEMENTATION / NOT CI VERIFIED**

## Purpose

Repository is the persistence boundary for aggregate/entity storage semantics. It is not a synonym for Adapter and it does not own business workflow state.

Canonical path:

```
Application Service
  -> Port
  -> Repository
  -> Connector
  -> Storage / Database / File
```

An Adapter remains appropriate for provider/project mapping or external-system translation. A Repository is appropriate when the Port is implemented by persistence semantics such as lookup, create, mutate, uniqueness, versioning and atomic writes.

## Machine assets

- `contracts/core-repository.schema.json`
- `contracts/core-repository-result.schema.json`
- `src/contracts/repository-contract.mjs`
- `src/engine/repository-runtime.mjs`
- `test/repository-runtime.test.mjs`

## Required semantics

A Repository declares:

- repository id/version;
- implemented Port id/version;
- project scope;
- entity/aggregate scope;
- operation set;
- operation kind and side-effect flag;
- idempotency ownership;
- expected-revision requirement;
- atomicity scope and partial-write possibility;
- concurrency mode and lost-update protection;
- revision policy;
- optional Connector binding;
- stable error codes;
- verification profile.

### Idempotency ownership

`REQUIRED`
: Repository invocation requires an explicit idempotency key.

`SUPPORTED`
: Repository semantics support idempotent behavior but the key may be carried in domain input or another approved mechanism.

`CALLER_ENFORCED`
: The calling Application Service/workflow owns idempotency. Repository must not claim it independently.

`NOT_APPLICABLE`
: Read-only/non-idempotency-sensitive operation.

This distinction prevents a Service-level idempotency guarantee from being falsely recorded as a storage-layer guarantee.

## Connector least privilege

Repository Connector binding is per Repository operation, not one global allow-list.

Example:

- `application.get` -> `application.read`
- `application.create-sequenced` -> `application.read + application.mutate`

A read operation cannot escalate itself into a write Connector operation through the Core facade.

## Runtime boundary

`createRepositoryRuntime()` enforces before persistence execution:

- known operation;
- project scope;
- required idempotency key;
- required expected revision;
- per-operation Connector allow-list.

Runtime returns `core-repository-result/v1`.

It does not decide:
- retry/backoff;
- compensation;
- business completion;
- workflow transitions.

Those remain D-owned.

## FreePass Admin shadow

Current observed source revision:

`2aede7df82591470308f25bd3ccd4e5358aa7c3c`

Observed implementation:

- `JsonFileStore` serializes write mutations within the process;
- write path uses temporary file + rename;
- application create has submissionId duplicate protection;
- product save owns monotonic integer version increment;
- production Firestore is documented as separate future/production persistence.

AI Core therefore records the JSON file repositories as **development SHADOW evidence only**. It does not infer production Firestore behavior.

## Verification state

Implemented on `work/ai-core-no-actions-20260920`.

GitHub Actions are intentionally not used under the current user-directed mode. No VALIDATED/canonical promotion is claimed.

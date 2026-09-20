# Core Connector Runtime v1

Status: **C EXPERIMENTAL IMPLEMENTATION / NOT CI VERIFIED**

## Boundary

Connector is the lowest reusable technical transport layer under an Adapter.

```
Engine -> Port -> Adapter -> Connector -> External System
```

Connector owns:
- HTTP / database / queue / filesystem / SDK / IPC transport;
- transport operation identity;
- credential **reference** transport, never secret values in contract artifacts;
- timeout and abort primitives;
- low-level transport evidence.

Connector does not own:
- canonical business meaning;
- provider field/unit mapping;
- provider error → Core error mapping;
- retry/backoff workflow;
- business completion.

Those remain Adapter/C and Workflow/D responsibilities.

## Machine assets

- `contracts/core-connector.schema.json`
- `contracts/core-connector-result.schema.json`
- `src/engine/connector-runtime.mjs`
- `test/connector-runtime.test.mjs`

## Result semantics

`core-connector-result/v1` returns only:
- `SUCCEEDED | FAILED`;
- transport `failure_kind = TIMEOUT | UNAVAILABLE | AUTH | PROTOCOL | ABORTED | UNKNOWN`;
- correlation id;
- data/evidence/raw reference;
- start/end timestamps.

It intentionally has no `retryable` field.

Adapter interprets transport failure into provider/Core error semantics. D decides retry/backoff/resume/escalation.

## Current maturity

This is an executable Core-missing capability added after Phase 1. It remains EXPERIMENTAL until project adoption proves the contract boundary.

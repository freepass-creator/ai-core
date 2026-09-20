# Group Integration Preflight Seal & Core Receipt Binding v1

## Purpose

This layer sits after the integration Work Packet compiler and before any actual cross-repository execution.

It provides two functions:

1. **Preflight seal** — verifies that the repository is still at the packet's exact revision, the observed worktree is clean, and classification-specific preflight checks are PASS.
2. **Execution receipt builder** — records an already-performed execution using the existing canonical `core-receipt/v1` contract.

No new competing receipt schema is introduced.

## The preflight seal is not a lock service

The seal contains a digest of the packet identity and the observed preflight state.

It is explicitly **not**:

- a mutex;
- a lease;
- a distributed lock;
- execution authorization.

Its policy is `REOBSERVE_IMMEDIATELY_BEFORE_EXECUTION`. The executor must observe the real repository again immediately before a write.

The seal always returns `execution_authorized=false`.

## Receipt boundary

`buildIntegrationExecutionReceipt()` reuses `core-receipt/v1`.

A performed execution requires an `authorization_ref`. A receipt with status `SUCCEEDED` additionally requires:

- `performed=true`;
- every verification check required by the Work Packet to be present;
- every required verification result to be PASS;
- evidence references bound into the receipt.

The builder does not grant authority; it only refuses to represent a performed execution without an authority evidence reference.

## Chain

`Inventory -> Plan -> Work Packet -> Preflight Seal -> external/canonical authority -> execution -> verification -> core-receipt/v1 -> Work Ledger result`

The actual executor and authority provider remain separate.

## Verification

```bash
node --check src/engine/group-integration-preflight.mjs
node --test test/group-integration-preflight.test.mjs
```

Isolated verification for this change: syntax PASS and 7/7 focused tests PASS. Stable ID and reason-code compatibility with core-receipt/v1 are also enforced.

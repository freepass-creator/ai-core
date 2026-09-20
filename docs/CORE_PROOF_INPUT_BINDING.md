# Core Proof Input Binding v1

Status: **C SESSION CANONICAL CANDIDATE / PROJECT_VERIFIED PILOT**

## Problem

A PASS result becomes stale when the evidence-producing inputs change. Binding only to a subject revision or one aggregate input label is insufficient when the proof depends on source bytes, checker implementation, fixtures, schemas or configuration.

## Contract

- schema: `contracts/core-proof-input-binding.schema.json`
- runtime helper: `src/contracts/proof-input-binding.mjs`
- registry id: `core.proof-input-binding.v1`

The binding records each proof input as `{role, ref, digest, revision}` and derives one deterministic `input_set_digest` from the sorted canonical set.

Recognized roles are `SOURCE`, `CHECKER`, `FIXTURE`, `CONFIG`, `SCHEMA`, `DEPENDENCY`, and `OTHER`.

## Freshness semantics

- exact same canonical input set -> `CURRENT`
- source/checker/fixture/config/schema/dependency added, removed or digest/revision changed -> `STALE`
- stored binding digest does not match its own input list -> `INVALID`

`STALE` is not a failed business result. It means the prior proof no longer proves the current inputs and must be rerun before it is counted as current evidence.

## Receipt binding

`core-receipt/v1` may carry optional `proof_input_binding`. This is additive within v1. Result objects continue to point to receipts rather than duplicating proof input data.

## Source evidence

Reverse-imported from `freepass-creator/devcenter@6a838a28b3c25b068e5bbe010071fd1de0242d30`, where acceptance/card evidence hashes original sources, checker implementations and fixtures, and explicitly invalidates prior evidence when source bytes or test implementation changes.

Evidence maturity remains **PROJECT_VERIFIED** until an independent second project proves the same reusable behavior. The Core pilot contract may be adopted without claiming `CROSS_PROJECT_VERIFIED` maturity.

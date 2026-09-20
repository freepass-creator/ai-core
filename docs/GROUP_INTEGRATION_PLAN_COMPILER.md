# Group Integration Plan Compiler v1

## Purpose

This module implements the **planning boundary** for `core.group-integration`.

It does not merge repositories, move folders, retire projects, extract shared code, change deployment targets or mutate any project Registry.

It takes an inventory whose classification has already been explicitly stated as one of:

- `MERGE_PHYSICAL`
- `COLOCATE_ONLY`
- `EXTRACT_SHARED`
- `KEEP_SEPARATE`
- `RETIRE`

and determines whether enough evidence exists to prepare a reviewed execution packet.

## Why classification is not inferred

The Integration Execution Directive explicitly requires checking Git, local dirty state, SSOT, deployment, environment, duplication and rollback before deciding physical treatment. Repository shape alone is insufficient.

Therefore:

- `classification_inference=false`
- callers must provide the classification;
- missing classification fails closed.

## Additional gates

### MERGE_PHYSICAL

Requires:

- CLEAN dirty state;
- revision evidence;
- reviewer consensus;
- rollback readiness;
- evidence for declared approvals when approvals are required.

### EXTRACT_SHARED

Additionally requires evidence from at least two source projects and an extraction rollback plan.

### RETIRE

Additionally requires an explicit user-decision reference and a recovery plan.

## Output boundary

An item can become `READY_FOR_REVIEWED_EXECUTION`, but every item still carries:

`execution_authorized=false`

The compiler only produces deterministic planned steps. Actual cross-repository writes require a separate Work Packet, authority check and revision revalidation immediately before execution.

## Proposed lifecycle

`Inventory -> explicit classification -> Plan Compiler -> Council/approval -> Work Packet -> isolated execution -> verification -> cutover/hold`

This PR intentionally does not modify `registry/capabilities.json` while another branch owns that file.

## Verification

```bash
node --check src/engine/group-integration-plan.mjs
node --test test/group-integration-plan.test.mjs
```

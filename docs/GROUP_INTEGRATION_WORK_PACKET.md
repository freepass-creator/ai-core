# Group Integration Work Packet Compiler v1

## Purpose

This compiler takes an already-reviewed `ai-core-group-integration-plan/v1` and prepares execution packets only for items whose `execution_readiness` is `READY_FOR_REVIEWED_EXECUTION`.

It does not execute any step.

## Safety boundary

Every packet is pinned to:

- one repository;
- one exact source revision;
- one explicit integration classification;
- the plan's evidence and approval references.

Every packet also sets:

- `authority.status = PENDING`;
- `execution_authorized = false`;
- immediate pre-execution revision/dirty-state revalidation;
- required post-execution verification;
- no automatic completion.

HOLD plan items are skipped rather than weakened into executable packets.

## Classification-specific checks

- `MERGE_PHYSICAL`: target parity + rollback verification.
- `COLOCATE_ONLY`: filesystem/path dependency verification.
- `EXTRACT_SHARED`: source-project parity + consumer compatibility + rollback.
- `KEEP_SEPARATE`: project authority must remain unchanged; Git histories must not be merged.
- `RETIRE`: replacement/non-use + recovery verification before retirement.

## Intended chain

`Inventory -> Plan Compiler -> Work Packet Compiler -> fresh authority -> isolated execution -> verification -> Work Ledger result`

The packet compiler is deliberately separate from execution authority and from the Work Ledger.

This PR is stacked on the Group Integration Plan Compiler branch and adds only new files.

## Verification

```bash
node --check src/engine/group-integration-work-packet.mjs
node --test test/group-integration-work-packet.test.mjs
```

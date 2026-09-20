# Business Planning Capability Adapter v1

## Purpose

This module prepares a deterministic **business decision frame** for AI Core.

It is not a strategy oracle and it does not choose a preferred business option. Its job is to preserve the distinction between:

- observed/source-derived facts;
- user-confirmed facts and decisions;
- AI-inferred facts;
- proposed decisions;
- confirmed decisions;
- unknowns and decision gaps;
- constraints and unranked options.

## Hard boundaries

- `AI_INFERRED` decisions cannot be marked `CONFIRMED`.
- `SOURCE_DERIVED` facts or decisions require a `source_ref`.
- No option is automatically selected or ranked.
- No external action is authorized.
- Missing objective fails closed.
- This adapter does not create a second business-project SSOT. Project-specific facts and decisions stay in the target project.

## Proposed capability binding

After current registry-writing work is finished, `core.business-planning` can be reviewed for binding as:

```json
{
  "status": "ACTIVE",
  "mode": "READ_ONLY",
  "adapter": {
    "kind": "PROJECT_MODULE",
    "entrypoint": "src/engine/business-planning-adapter.mjs",
    "export": "aiCoreBusinessPlanning"
  },
  "inputs": [
    { "name": "objective", "required": true }
  ]
}
```

This document is a proposed binding only. This PR intentionally does not edit `registry/capabilities.json` because another active PR owns that file.

## Verification

```bash
node --check src/engine/business-planning-adapter.mjs
node --test test/business-planning-adapter.test.mjs
```

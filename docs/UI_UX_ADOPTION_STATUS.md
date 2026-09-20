# UI/UX Consumer Adoption Status

## Current verdict

The L2 standard is **not yet Definition-of-Done complete**.

The machine/runtime standard exists in AI Core, but two materially different products have not yet adopted the B2 contracts and passed the same conformance checks.

## Current evidence sources

### FreePass Sales

Observed revision: `fe69f76d81f4b9acd6f67f7b3f4ef5619f5e33d1`

Status: `EVIDENCE_ONLY`

Sales supplied proven lessons for save/idempotency, external-action completion boundaries, draft continuity and input/runtime behavior. That does **not** mean Sales has already consumed the B2 runtime.

### ERP4

Observed revision: `2d9fd07075aae7d6d64687fabbf61126e166c34c`

Status: `EVIDENCE_ONLY`

ERP4 supplied proven lessons for search/filter/sort/list same-snapshot behavior, stabilization gates and responsive operational integrity. That does **not** mean ERP4 has already consumed the B2 runtime.

## Promotion path

`EVIDENCE_ONLY → MAPPED → PILOT → CONFORMANT`

A product becomes `CONFORMANT` only when:

1. its used common behavior is mapped to canonical feature IDs;
2. B2 token/component/pattern/screen contracts are consumed or an approved governed compatibility binding is used;
3. the common conformance matrix passes;
4. browser/interaction evidence is revision-bound;
5. exceptions are registered and unexpired;
6. the exact product revision is recorded.

## Definition of Done

`registry/ui-ux-consumers.json` requires **2 CONFORMANT consumers** before the L2 completion status can become `SATISFIED`.

Until then, B2 may be canonical as a standard, but the cross-product adoption objective remains open.

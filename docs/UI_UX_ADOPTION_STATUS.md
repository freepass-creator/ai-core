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

Status: `MAPPED`

ERP4 PR #435 pins AI Core B Feature Registry v1.3.0, declares its shared feature bindings in `.ai-core/ui-ux.consumer.json`, and the full ERP4 CI including the new `uiux:map` gate and Production build passed at revision `de8823e754ee9f03c9d95a62fc031610cb7859c2`. This establishes a canonical mapping relationship, but not yet PILOT/CONFORMANT browser-globalization evidence.

### FreePass Admin

Observed revision: `c16e55e0e449e74aa4403861be89bcbb5f77ee97`

Status: `MAPPED`

FreePass Admin PR #35 pins AI Core Feature Registry v1.3.0, records 11 common feature bindings, pins the user-approved Admin visual authority, and connects Development Center Design Hub compile/visual inputs. The current Next UI is explicitly not claimed PILOT or CONFORMANT because it still differs from the approved rev 5 visual authority and has no browser visual receipt yet.

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

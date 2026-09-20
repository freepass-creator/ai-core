# UI/UX Deprecated / Migration Standard v1.0

## Lifecycle

`DISCOVER → MAP → ADAPT → VERIFY → CUTOVER → DEPRECATE → REMOVE`

A project is not migrated because CSS was copied. It is migrated when its common features map to canonical IDs and the required verification passes.

## Compatibility layers

- `design-system/tokens.css` and `design-system/components.css` are the current compatibility layer with historical browser receipts.
- `design-system/tokens.runtime.css` and `design-system/runtime-v2.css` are the B2 runtime projection for new adoption and staged migration.
- Product-specific visual profiles remain separate.

## Migration procedure

1. inventory local components and patterns;
2. map each reusable behavior to a canonical `feature_id`;
3. identify C-owned data/API meaning and D-owned workflow state;
4. replace local tokens with semantic Core tokens;
5. add runtime-v2 only after collision review;
6. run `uiux:validate` and `uiux:runtime`;
7. run browser/visual regression matrix;
8. register temporary exceptions with expiry;
9. cut over screen by screen;
10. remove local duplicates only after evidence proves no consumer still depends on them.

## Deprecation rule

A shared item may be deprecated only when it has:

- stable deprecated ID or selector;
- replacement or explicit no-replacement decision;
- migration note;
- first deprecated revision;
- review/removal date;
- known consumers or a documented discovery method.

Removal without consumer evidence is forbidden.

## Local divergence

A product may keep brand, density, icon and domain copy differences. It may not fork common interaction semantics under a new local name simply to avoid migration.

## Rollback

Runtime-v2 adoption must be reversible by removing the runtime projection layer while preserving the previous verified compatibility layer. Rollback does not authorize reintroducing a known accessibility or data-integrity defect.

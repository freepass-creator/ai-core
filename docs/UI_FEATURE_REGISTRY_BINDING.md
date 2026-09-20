# UI/UX Feature Registry Binding Rules v1.0

## One meaning per feature ID

`registry/ui-ux-features.json` is the common reusable UI/UX feature SSOT. A product references a stable feature ID; it does not copy the feature and rename its states locally.

## Binding layers

`feature_id → component/pattern → interaction contract → screen composition → product profile`

- Component-kind features must have an entry in `design-system/components.registry.json`.
- Cross-component behavior must reference feature IDs from `design-system/interaction.contract.json`.
- Screen implementations may compose multiple feature IDs.
- Product profiles select brand/density/domain copy but do not fork common state/completion semantics.
- Engine/adapter features keep their explicit binding from the Feature Registry.
- C data contracts and D workflow states are referenced, not duplicated into B.

## Adoption declaration

A consumer screen should be able to declare:

- screen/surface ID
- feature IDs used
- product profile
- exceptions, if any
- evidence/verification revision

This declaration may live in the target project's AI Core configuration until a group-wide consumer manifest is introduced.

## Adding a feature

1. Prove it is reusable rather than project-only.
2. Select or create a stable feature ID.
3. Define required states, rules, verification and evidence.
4. Bind component/interaction/runtime implementation where applicable.
5. Add negative tests so silent removal fails.
6. Record A-session evidence and revision.
7. Add migration guidance if it replaces an existing feature.

## Conflicts

If a local implementation conflicts with AI Core:
- data/API meaning → C decides;
- domain workflow/authority → D decides;
- reusable UI/UX behavior/presentation → B decides;
- product-only brand/copy/density exception → product profile, with governance record if it changes a common contract.

## Gate

`npm run uiux:validate` checks Feature Registry structure/semantics.
`npm run uiux:runtime` checks token/component/interaction/runtime convergence.

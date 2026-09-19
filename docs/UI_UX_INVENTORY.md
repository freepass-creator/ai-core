# UI/UX Common Inventory v1.1

**Canonical common-feature SSOT:** `registry/ui-ux-features.json` validated by `contracts/ui-ux-feature-registry.schema.json` and `npm run uiux:validate`.

This document is an inventory/readable summary. If it conflicts with the registry or `docs/SCREEN_DESIGN_STANDARD.md`, the registry plus the normative screen standard wins.

This inventory separates reusable interaction contracts from product-specific visual choices. A product reuses behavior, semantics, states and verification rules while keeping its own brand, density and workflow priorities.

## Existing evidence

| Asset | Current coverage | Reuse decision |
|---|---|---|
| `design-system/tokens.css` | color, spacing, type, radius, focus, 44px controls | extend as the common token floor |
| `examples/ui-components.html` | buttons, native select, populated responsive table | extend without replacing the verified examples |
| `test/ui-components.test.mjs` | semantics, contrast and source-bound browser receipt | extend with state and interaction tests |
| `contracts/development-form.schema.json` | UI devices/states and UX journey fields | keep as delivery planning input |
| Sales v187 audit | mobile call workflow, drafts, navigation, delayed save and SMS boundaries | reuse workflow lessons; do not copy Sales colors or shape choices |

## Common component coverage

| Family | Common elements | Required states or behavior | Current status |
|---|---|---|---|
| Actions | primary, secondary, destructive, icon button, link | default, hover, pressed, focus, disabled, busy, success, error | partial |
| Forms | text, textarea, search, select, checkbox, radio, switch, date/file input | label, hint, required, validation, disabled, read-only, saving | partial: text, email, select, checkbox, radio and validation samples |
| Navigation | header, breadcrumb, tabs, pagination, bottom navigation | current location, keyboard order, overflow, back/restore | partial: keyboard tabs and bounded pagination samples |
| Feedback | inline error, alert, status, toast, progress, skeleton | polite/assertive announcement, retry, dismissal, reduced motion | partial: error, status, toast, progress and retry samples |
| Data display | list, card, badge, table, definition list | loading, empty, error, populated, sorting, selection | partial |
| Overlays | dialog, confirmation, drawer, popover, tooltip | focus entry/trap/return, Escape, backdrop, destructive boundary | partial: native confirmation dialog sample |
| Disclosure | accordion, details, expandable filters | `aria-expanded`, keyboard activation, retained state | partial: native details/summary sample |
| Workflow UX | draft, local preservation, submit, retry, leave during save | stable work key, duplicate prevention, recovery, outcome receipt | covered in local simulation; real API idempotency and navigation integration remain product-owned |

## UX rules shared across products

1. Show system status close to the action that caused it and announce important changes programmatically.
2. Preserve user input across navigation and recover from retryable failures without duplicating writes.
3. Keep destructive, external and irreversible actions behind an explicit boundary.
4. Let keyboard, touch and pointer users reach the same outcome; hover only adds feedback.
5. Define loading, empty, error and populated states before calling a data surface complete.
6. Keep navigation possible when business rules do not require blocking it; explain every disabled action.
7. Bind success to the actual saved or released target, not to opening another app or starting a request.
8. Test mobile, desktop, zoom, reduced motion, light/dark themes and read-only permissions where applicable.

## Product-owned choices

Brand colors, corner shape, content density, icon family, tone of voice, domain labels and priority actions belong to each product. They may vary when contrast, target size, semantics and state behavior still meet the common contract.

## Build order

1. Form controls and validation.
2. Navigation and disclosure.
3. Feedback and data states.
4. Dialog and confirmation.
5. Draft, save, retry and leave-while-saving workflow.
6. Automated consumer verification and per-product exception registry.


## Registry adoption gate

A reusable function is not complete merely because a component exists. Before reuse across products it must have:

- a stable feature ID in `registry/ui-ux-features.json`;
- required states and failure behavior;
- keyboard/touch/accessibility verification;
- mobile/desktop behavior;
- localization/direction behavior where applicable;
- engine or adapter binding when runtime execution is involved.

Product-specific visual decisions stay in product profiles. Common interaction semantics do not fork locally.

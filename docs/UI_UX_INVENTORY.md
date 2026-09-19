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
| Action | primary, secondary, destructive, icon, link, overflow | focus, active, disabled, busy, confirmation and bottom-action placement | registry-covered; browser examples remain partial |
| Form | text, number, money, phone/email, textarea, search, select/combobox, checkbox/radio/switch, date/time, file/image, reorder | label, locale parsing, validation, read-only, saving/uploading, IME safety | registry-covered; example coverage partial |
| Navigation | header, breadcrumb, tabs, bottom navigation, pagination, stepper, back/restore | current location, keyboard order, overflow, restore and responsive task order | registry-covered; example coverage partial |
| Data | list, card, badge, table, sort/filter, virtual list, detail, definition, provenance, audit | loading, empty, error, populated, selection, stable identity and source trust | registry-covered; consumer evidence varies |
| Feedback | inline error, alert, toast, progress, skeleton, empty, retry | announcement, dismissal, reduced motion, retry and completion semantics | registry-covered; browser evidence partial |
| Overlay | dialog, bottom sheet, drawer, tooltip | focus entry/trap/return, Escape, modal intent, gesture equivalents | registry-covered; product adoption evidence partial |
| Workflow | draft, autosave, explicit save, submit, delete, undo, optimistic update, conflict, offline, permission, session expiry | authoritative completion, idempotency, recovery, conflict and authority | registry-covered; backend enforcement remains product-owned |
| Integration | engine job, adapter connection, sync, import/export, external action, document preview, AI action, notification, webhook | queued/running/partial/completed, health, receipt and retry boundaries | registry-covered; runtime binding evidence varies |
| System | responsive, localization, focus, safe-area/keyboard, locale formatting, bidi, text expansion, motion, contrast, reflow/orientation, input method | locale-neutral semantics, RTL, zoom/reflow, preference and modality resilience | registry-covered; conformance matrix now required |

## UX rules shared across products

1. Show system status close to the action that caused it and announce important changes programmatically.
2. Preserve user input across navigation and recover from retryable failures without duplicating writes.
3. Keep destructive, external and irreversible actions behind an explicit boundary.
4. Let keyboard, touch and pointer users reach the same outcome; hover only adds feedback.
5. Define loading, empty, error and populated states before calling a data surface complete.
6. Keep navigation possible when business rules do not require blocking it; explain every disabled action.
7. Bind success to the actual saved or released target, not to opening another app or starting a request.
8. Test mobile, desktop, 200% zoom, 400% reflow, reduced motion, high-contrast/forced colors, RTL/mixed bidi, representative locale formatting, virtual keyboard/IME and read-only permissions where applicable.

## Product-owned choices

Brand colors, corner shape, content density, icon family, tone of voice, domain labels and priority actions belong to each product. They may vary when contrast, target size, semantics and state behavior still meet the common contract.

## Build order

1. Form controls and validation.
2. Navigation and disclosure behavior.
3. Feedback and data states.
4. Dialog, bottom sheet and confirmation.
5. Draft, save, retry, conflict, offline and leave-while-saving workflow.
6. Integration state/receipt surfaces for engines and adapters.
7. Globalization system conformance: locale formatting, bidi/RTL, text expansion, motion, contrast, reflow/orientation and input methods.
8. Automated consumer verification and per-product exception registry.


## Registry adoption gate

A reusable function is not complete merely because a component exists. Before reuse across products it must have:

- a stable feature ID in `registry/ui-ux-features.json`;
- required states and failure behavior;
- keyboard/touch/accessibility verification;
- mobile/desktop behavior;
- localization/direction behavior where applicable;
- engine or adapter binding when runtime execution is involved;
- evidence provenance for System-family standards;
- logical-direction CSS and safe-area handling when the common implementation owns layout behavior.

Product-specific visual decisions stay in product profiles. Common interaction semantics do not fork locally.

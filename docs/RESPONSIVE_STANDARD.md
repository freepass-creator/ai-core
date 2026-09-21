# AI Core Responsive Standard v1.0

## Principle

Responsive behavior preserves **meaning, reading order and task priority** while layout adapts. Mobile is the canonical single-panel task grammar; desktop reuses that grammar and may compose multiple equivalent panels side by side.

## Reference probes, not device classes

Required regression widths are 360 / 390 / 412 / 1280 / 1440 CSS px. They are verification probes, not a rule that all layout decisions happen exactly at those widths.

The shared compatibility breakpoint at 640px is a current implementation reference. New components choose breakpoints from content pressure and record reusable changes in the Core rather than inventing product-specific device names.

## User-locked mobile → web projection — 2026-09-21

The company baseline uses the same UI grammar across mobile and web.

- **Mobile: one task surface = one screen/panel.**
- **Web: the same mobile-equivalent surfaces may be shown side by side as multiple panels.**
- Desktop width is used primarily to reduce navigation depth and preserve context, not to invent a separate desktop design language.
- A list panel may remain visible while a detail panel opens beside it; a third supporting/history panel may be added when useful.
- Panel internals preserve the mobile information hierarchy, card structure, status semantics, icon actions and bottom action hierarchy.
- Widening the viewport does not justify moving task actions into a top toolbar.
- Card lists do not automatically become dense tables on desktop. Use a table only when relational row/column comparison is intrinsic to the task.
- As width contracts, reduce the number of simultaneous panels until the UI converges to the mobile single-panel flow.

Canonical user decision:
- `docs/UI_UX_USER_DECISION_2026-09-21_WEB_PANEL_EXTENSION.md`

## Portable task panel gate

Responsive layout is considered reusable only when a task panel can operate in isolation.

- Desktop side-by-side panes are composition, not separate workflow implementations.
- The detail/task panel must remain complete when shown alone on mobile.
- Keyboard shortcuts, hover actions, right-click, drag-and-drop and sibling-pane visibility are optional accelerators only.
- Stable entity/work IDs and canonical state/command bindings carry context between panes.
- Collapsing 3 → 2 → 1 panes preserves selection, draft, workflow state, async ownership and completion meaning.

See `docs/PORTABLE_TASK_PANEL_STANDARD_2026-09-21.md`.

## Layout and grid

- Base page gutters: 12px mobile, 16px desktop compatibility baseline.
- Card padding: 16px compact/mobile, 24px standard desktop.
- Maximum shared content width: 1200px unless a product profile explicitly owns a different reading/data surface.
- Spacing uses the canonical 4/8/12/16/24/32/48 scale.
- Do not create a universal fixed column count. Use content-driven grid templates and stable reading/task order.
- Dense relational data may scroll horizontally rather than shrinking text below a usable size.
- When a desktop table becomes a mobile list/card projection, stable entity identity, sort/filter meaning and action availability remain the same.

## Density roles

- desktop compact control/row: 40px
- desktop standard row: 48px
- touch action minimum: 44px effective target
- frequent quick action: 48px preferred
- mobile tappable business row: 64px minimum

Density is a role, not a per-screen pixel choice.

## Fixed and sticky regions

- Task actions use the bottom action boundary.
- Bottom actions include safe-area padding.
- Headers, footers, sheets and keyboards must not obscure focused content or validation messages.
- Virtual keyboard opening must not make the current required action unreachable.

## Reflow and orientation

- 200% zoom is a required probe.
- Ordinary one-dimensional content must support 400% reflow without requiring simultaneous horizontal and vertical scrolling.
- Portrait/landscape changes preserve task order, selection, draft and focus context.
- Critical labels and actions wrap/adapt rather than disappear.

## C/D boundary

Responsive projection may change layout, never canonical data meaning (C) or workflow transition availability (D).

## Machine sources

- `design-system/tokens.json`
- `design-system/runtime-v2.css`
- `design-system/interaction.contract.json#responsive`
- `registry/ui-ux-features.json#system.responsive`

# AI Core Responsive Standard v1.0

## Principle

Responsive behavior preserves **meaning, reading order and task priority** while layout adapts. Mobile is not a scaled desktop and desktop is not a widened mobile stack.

## Reference probes, not device classes

Required regression widths are 360 / 390 / 412 / 1280 / 1440 CSS px. They are verification probes, not a rule that all layout decisions happen exactly at those widths.

The shared compatibility breakpoint at 640px is a current implementation reference. New components choose breakpoints from content pressure and record reusable changes in the Core rather than inventing product-specific device names.

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

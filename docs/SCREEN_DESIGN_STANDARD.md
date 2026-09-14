# Screen Design Standard v1.0

## Normative baseline

- WCAG 2.2 AA is the accessibility conformance target.
- Native HTML semantics come first; custom widgets follow the WAI-ARIA Authoring Practices keyboard and role patterns.
- Interactive targets use a 44px minimum control height for touch usability. WCAG's minimum target-size requirement remains the compliance floor.
- Text contrast is at least 4.5:1 for ordinary text; UI boundaries and focus indicators use at least 3:1 against adjacent colors.
- Keyboard focus is visible, is not obscured, follows a logical order and returns to the invoker after a modal closes.
- Meaning is never communicated by color alone.

Official references:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/patterns/
- https://developer.apple.com/design/human-interface-guidelines/buttons

## Tokens

`design-system/tokens.css` is the shared visual contract. Components use tokens for color, spacing, radius, typography, focus and control height. Product pages may extend tokens but do not hard-code a second competing system.

## Button

- Use a verb-first label describing the immediate action.
- One primary action per section; secondary actions are visually quieter.
- Destructive actions use the danger style and a separate confirmation boundary when reversal is difficult.
- Disabled controls remain discoverable and expose a nearby reason.
- Every custom button has default, hover, focus-visible, active, disabled and busy behavior.
- Icon-only buttons require an accessible name.

## Dropdown

- Prefer native `select` for a short single-choice list.
- A persistent visible label is required; placeholder text is not a label.
- Start with an explicit unselected option when selection is required.
- Custom comboboxes must implement the corresponding APG keyboard and focus pattern.
- Validation errors identify the field and correction, and are programmatically associated.

## Table

- Use a table only for relational rows and columns; use CSS layout for visual alignment.
- Provide a caption or accessible name, column headers with `scope="col"`, and row headers when useful.
- Preserve horizontal scrolling on narrow screens instead of shrinking text below readable size.
- Sorting and selection controls are keyboard operable and expose state programmatically.
- Loading, empty, error and populated states are specified independently.
- Large datasets define pagination or virtualization, result count and stable row identity.

## Responsive baseline

- Start with a single-column mobile layout and enhance at content-driven breakpoints.
- At 640px and below, form controls and primary task buttons fill available width in the sample.
- Do not depend on hover. Touch, keyboard and pointer paths must reach the same action.
- Test at mobile and desktop widths, 200% zoom, keyboard-only operation and reduced-motion preference.

## Sample

Open `examples/ui-components.html` through a local web server. It demonstrates working button actions plus busy and disabled buttons, a native dropdown and the populated state of a responsive accessible table using the canonical tokens. Loading, empty and error table examples remain required when a product adopts the table component; this first sample does not claim to demonstrate them.

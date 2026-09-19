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

## Action placement

**Top is informational; bottom is actionable.**

- App/page headers are display-only by default: brand, page title, context, progress and non-interactive status may appear there.
- Do not place task CTAs such as Save, Submit, Share, Send, Reset, Complete, Preview or Export in the top app/page header.
- Primary and secondary task actions belong in a bottom action area: a sticky/fixed footer on mobile and an anchored bottom action bar on desktop.
- Dialog task actions also belong in the dialog footer rather than the dialog header. The header carries the dialog title and passive options only.
- Direct-selection controls that are the content itself (vehicle, model, trim, option, row, radio, checkbox, dropdown) remain where the choice is presented; they are not treated as page CTAs.
- Back/Next/Complete navigation in a stepped flow uses the bottom action area. For single-choice auto-advance steps, selection itself advances and a redundant Next button is omitted.
- When an action cannot fit safely, prefer overflow or a secondary bottom sheet/menu from the bottom action area rather than moving the action into the top header.
- Products may deviate only when a platform convention or safety/accessibility requirement makes bottom placement materially worse; document the exception.

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

## Form controls

- Every control has a persistent label. Hints explain format; they do not replace the label.
- Required, invalid, disabled and read-only states are distinguishable in text or semantics as well as color.
- Validation runs at a useful boundary, moves focus to the first invalid field and preserves the entered values.
- Checkbox and radio controls keep their native input semantics. Switches are reserved for settings that take effect immediately.

## Navigation and disclosure

- Current location is exposed with `aria-current` or the component-specific selected state.
- Tabs follow the APG tab pattern, including one tab stop and Arrow, Home and End keys.
- Native `details` and `summary` are preferred for simple disclosure.
- Pagination exposes the current position and disables unavailable directions with a visible reason.

## Feedback and data states

- Inline errors identify the field and correction. Status updates use a polite live region; urgent blocking errors use an alert.
- Toasts confirm a completed background-safe action and disappear without stealing focus. Critical information stays inline.
- Loading, empty, error and populated states have distinct messages and actions. Loading indicators honor reduced motion.
- A retry does not duplicate an already completed write and does not clear recoverable user input.

## Dialog and confirmation

- Use a dialog only when the user must finish or dismiss a focused task before continuing.
- The dialog has an accessible name and description, receives focus on open, closes with Escape and returns focus to its invoker.
- Destructive confirmation names the affected object and consequence. Starting a request is not described as successful completion.

## Responsive baseline

- Start with a single-column mobile layout and enhance at content-driven breakpoints.
- At 640px and below, form controls and primary task buttons fill available width in the sample.
- Do not depend on hover. Touch, keyboard and pointer paths must reach the same action.
- Test at mobile and desktop widths, 200% zoom, keyboard-only operation and reduced-motion preference.

## Sample

Open `examples/ui-components.html` through a local web server. It demonstrates working button actions plus busy and disabled buttons, a native dropdown and the populated state of a responsive accessible table using the canonical tokens. Loading, empty and error table examples remain required when a product adopts the table component; this first sample does not claim to demonstrate them.

Open `examples/ui-patterns.html` for the next common layer: form validation, radio and checkbox choices, keyboard tabs, disclosure, inline alerts, loading/empty/error/populated data states, pagination, toast feedback and destructive confirmation.


## Universal feature registry

The machine-readable SSOT for reusable interaction behavior is `registry/ui-ux-features.json`. Its grammar is `contracts/ui-ux-feature-registry.schema.json`.

Normative hierarchy:

1. This document defines the human-readable universal interaction/accessibility baseline.
2. `registry/ui-ux-features.json` enumerates each common feature by stable ID and fixes its states, behaviors, shared profiles and verification requirements.
3. Product profiles such as `docs/FREEPASS_PRODUCT_UI_PROFILE.md` may select brand, density, icon family, domain copy and business priority, but may not fork the common feature semantics.
4. A new reusable feature is not a local standard until it has a registry entry or a documented temporary exception.

Run `npm run uiux:validate` before adopting or modifying common UI/UX behavior.

### Global consistency rule

A feature ID means the same thing in every product, country, team and implementation language. Visual presentation may adapt, but state names, completion meaning, failure/retry semantics, accessibility behavior and data-safety boundaries remain invariant.

This does not mean every product has identical colors or spacing. It means that, for example, `form.file-upload`, `workflow.explicit-save`, `integration.engine-job` and `integration.adapter-connection` have one shared behavioral contract wherever they appear.

### Internationalization and direction

- Store canonical values separately from localized presentation for dates, times, numbers and currency.
- Declare language and text direction explicitly. Do not infer text direction solely from locale or language.
- Layout must support LTR and RTL, long translated labels and locale-specific formatting without changing business behavior.
- Do not build translated sentences by concatenating fragments whose word order may differ by language.
- Keyboard, focus, state, failure and completion semantics do not change with locale.

Official references:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/
- https://www.w3.org/International/docs/bp-html-bidi/
- https://www.w3.org/International/articles/lang-bidi-use-cases/

### Engine and adapter presentation contracts

Long-running engine work uses explicit states: `queued → running → partial|succeeded|failed|cancelled`. A request being accepted or started is never rendered as completed. Job identity, retry eligibility, progress/result and completion receipt are observable.

Adapters use explicit health states: `disconnected → connecting → connected`, with `syncing`, `degraded` and `error` as distinct observable conditions. The UI exposes source identity and last successful synchronization when that affects trust.

External actions such as phone, SMS, email or third-party deep links distinguish `launched` from verified completion. Opening another app is not a success receipt.

### Exception contract

Product-specific exceptions must identify the feature ID, product, reason, owner, verification evidence and expiry/review date. Accessibility, data integrity, authority and completion-proof requirements are not waived by visual preference. Temporary exceptions never become a second standard by copy-paste.

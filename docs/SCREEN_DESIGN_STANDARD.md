# Screen Design Standard v1.1

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

## Simple, minimal, still unambiguous (border policy)

Concept, set by the owner on 2026-09-23: *simple and minimal — but the surfaces must still be distinguishable, the states must still show, and the functionality must stay complete. Not "line" or "no line", but how much can be taken away while the thing still works.*

So the rule is a removal test, not a taste. Take the border, shadow, divider or box away, then check three things:

1. **Is the surface still distinguishable?** (surface tint page ↔ surface, spacing, text hierarchy)
2. **Is every state still readable?** (selected, pressed, disabled, invalid, busy — at least two of tint, weight, glyph or text; never colour alone)
3. **Is the capability unchanged?** (same commands, same keyboard path)

Keep the element only when one of those three fails. The table below is the result of that test, not a preference:

| Surface | Line | Why |
| --- | --- | --- |
| text input, textarea, search, select/dropdown, combobox, date, file drop, data-grid cell rules | **keep** | nothing else says "a value goes here"; test (1) fails without it |
| buttons, button-like links, chips, badges, toggles, segmented controls, tabs | none | tint + weight + icon carry both identity and state |
| cards, select cards, previews, panels, toolbars, app bars, bottom action bars, dialogs, alerts | none | a box is still a box without a line: surface tint and spacing separate it from the page |
| table row rules, list separators | allowed | they help *read data* — never to express selection or disabled state |
| keyboard `:focus-visible` outline | **mandatory** | not a border for this rule; never suppressed |
| forced-colors / high contrast | system decides | the product does not suppress restored system borders |

## Surface scale — what replaces the line

Removing borders moves the whole job of "this is a separate object" onto surface colour. So the surface steps are measured, not chosen by eye. `scripts/measure-surface-contrast.mjs` computes WCAG 2.2 contrast from `design-system/tokens.json`, writes `docs/evidence/SURFACE-CONTRAST.json`, and `test/design-surface-scale.test.mjs` recomputes it on every run — a token edited by eye turns the suite red.

| Token | Value | Sits on | Used for |
| --- | --- | --- | --- |
| `--color-bg` | `#eaeef4` | — | the page canvas |
| `--color-surface` | `#ffffff` | canvas, **1.16:1** | cards, panels, app bar, toolbars, dialogs |
| `--color-surface-sunken` | `#dfe5ee` | surface, **1.27:1** | chip at rest, segmented track, table head, wells |
| `--color-selected-surface` | `#e3ecfd` | surface, **1.19:1** | the selected chip, tab, card |
| `--color-scrim` | `rgba(16,24,40,.45)` | — | dialogs and sheets separate from what is under them by a scrim, never a border |

Floors the measurement enforces: a surface that must read as its own object ≥ **1.12:1** against the surface under it; text and muted text ≥ **4.5:1** on every surface; the focus ring and the primary action ≥ **3:1** on every surface (WCAG 1.4.11).

Two consequences worth stating, because both were found by measuring rather than by looking:

- Selected vs unselected is only **1.07:1** — deliberately quiet. That is why selection is never carried by tint alone: weight and the Lucide check change with it.
- Deepening the canvas pushed the old focus colour `#dc6803` to **2.99:1**, under the 3:1 floor. The focus ring is now `#b54708`, which measures 4.66 on canvas, 5.43 on surface and 4.29 on the sunken step.

`design-system/tokens.runtime.css` is the live projection of the token SSOT and is what screens load. `design-system/tokens.css` is the older projection frozen by the 2026-09-14 browser receipt (`docs/evidence/UI-PATTERNS-BROWSER.json`); it keeps the pre-scale values until that receipt is re-run.

## Icons — one set, Lucide

Decided by the owner on 2026-09-23: every icon and every check mark comes from **Lucide**. No emoji, no icon font, no second set, no hand-drawn glyph.

- The canonical geometry is recorded in `design-system/icons.lucide.json` (ISC licence; the attribution travels with any redistribution). Adding an icon means recording it there first.
- Markup inlines the recorded `svg_body` on `<svg class="ui-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">`.
- Marks that CSS generates — the selected chip, the pressed toggle — use the matching `--icon-*` mask in `runtime-v2.css` with `background-color: currentColor`, so the mark is the same drawing, not a text character that shifts with font or locale.
- An icon is 1em and takes its colour from `currentColor`: it follows tint and state instead of carrying its own palette.
- A decorative icon is `aria-hidden` and never the only carrier of meaning; an icon-only control has its own accessible name.

`test/ui-shell-samples.test.mjs` fails when a sample's SVG body drifts from the record, when a generated mark stops using the Lucide mask, or when a stray glyph appears.

Machine form: `design-system/interaction.contract.json#rules.border_policy` and `#rules.icon_policy`; enforced in `design-system/runtime-v2.css` and checked by `test/ui-shell-samples.test.mjs`. `design-system/components.css` is pinned by the 2026-09-14 browser receipt and is overridden from runtime-v2, never edited.

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

**Mobile: top is informational; bottom is actionable. Web: preserve the same command semantics while allowing productivity accelerators.**

- On **mobile**, app/page headers are display-only by default: brand, page title, context, progress and non-interactive status may appear there.
- On **mobile**, do not place task CTAs such as Save, Submit, Send, Reset, Complete or other workflow-changing commands in the top app/page header.
- On **mobile**, Primary and Secondary task actions belong in the bottom action area.
- On **web**, the same canonical task command may be exposed through a sticky footer, inline action, keyboard shortcut or utility/action toolbar when this materially improves desktop productivity.
- A web accelerator must invoke the same canonical command and share the same permission, busy/disabled, validation, result and error semantics.
- Search, filter, sort, column control, refresh, export, print, density and batch-selection utilities may live in a desktop utility toolbar.
- A desktop toolbar or inline action must not create a second workflow or a desktop-only business rule.
- Do not make a required business outcome available only through hover, right-click, drag-and-drop or a keyboard shortcut.
- Dialog task actions also belong in the dialog footer rather than the dialog header. The header carries the dialog title and passive options only.
- Direct-selection controls that are the content itself (vehicle, model, trim, option, row, radio, checkbox, dropdown) remain where the choice is presented; they are not treated as page CTAs.
- On **mobile**, Back/Next/Complete navigation in a stepped flow uses the bottom action area. For single-choice auto-advance steps, selection itself advances and a redundant Next button is omitted. On web, equivalent commands may also be exposed through adaptive desktop accelerators.
- On **mobile**, when an action cannot fit safely, prefer overflow or a secondary bottom sheet/menu from the bottom action area rather than moving the workflow action into the top header.
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
- Test at mobile and desktop widths, 200% zoom, 400% reflow for ordinary one-dimensional content, portrait/landscape changes, keyboard-only operation, virtual-keyboard overlap and reduced-motion preference.

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
5. System-level common standards carry machine-readable evidence provenance. The registry records evidence level and source references so a company value is distinguishable from a normative floor, platform consensus or project-only observation.

Run `npm run uiux:validate` before adopting or modifying common UI/UX behavior. System features without evidence provenance fail validation.

### Global consistency rule

A feature ID means the same thing in every product, country, team and implementation language. Visual presentation may adapt, but state names, completion meaning, failure/retry semantics, accessibility behavior and data-safety boundaries remain invariant.

This does not mean every product has identical colors or spacing. It means that, for example, `form.file-upload`, `workflow.explicit-save`, `integration.engine-job` and `integration.adapter-connection` have one shared behavioral contract wherever they appear.

### Internationalization and direction

Internationalization is a behavioral contract, not a translation-only task. The minimum machine-readable baseline is represented by `system.localization`, `system.locale-formatting`, `system.bidi`, `system.text-expansion`, `system.motion-preference`, `system.contrast-preference`, `system.reflow-orientation` and `system.input-method`.

#### Locale and value semantics

- Store canonical values separately from localized presentation for dates, times, numbers, percentages, currency and units.
- Treat language, region, script, calendar, numbering system, hour cycle, time zone and currency as distinct concerns when the product allows them to vary.
- Use platform internationalization APIs or CLDR-derived locale data; do not hand-build decimal/group separators, date order, currency placement, plural forms or unit strings.
- Currency code and time zone are explicit wherever omitting them could change business meaning.
- Parsing and display are round-trip tested for representative locales; `null`, zero and empty input remain distinct domain values.

#### Direction and mixed content

- Declare content language and text direction explicitly. Do not infer direction solely from locale or language.
- Use logical start/end layout semantics so LTR and RTL share one component contract instead of separate implementations.
- Isolate user-entered or external identifiers, phone numbers, email addresses, URLs and other mixed-direction values when they can reorder surrounding text.
- Do not mirror every icon or visual automatically. Directional meaning determines mirroring; brand marks and direction-invariant symbols remain unchanged.

#### Text expansion and reflow

- Layout must support long translated labels and multiline helper/error text without hiding required actions or meaning.
- Critical actions are not truncated solely to preserve a fixed width. Prefer wrapping, adaptive layout or an explicit exception.
- Ordinary one-dimensional content reflows at high zoom/text scaling instead of requiring both horizontal and vertical scrolling.
- Sticky bottom actions, headers and overlays must not cover focused fields or validation messages after reflow or when the virtual keyboard is open.

#### User preferences and input methods

- Reduced-motion preference removes or simplifies non-essential animation without removing status, hierarchy or completion meaning.
- High-contrast or forced-color environments preserve focus, selection, errors and control boundaries without relying on authored color alone.
- Touch, pointer, keyboard and assistive input reach the same business outcome unless the task intrinsically requires a modality.
- IME composition is preserved. Intermediate composition events must not trigger destructive validation, submission or auto-advance.

#### Minimum representative verification matrix

The matrix is a conformance probe, not a list of supported market locales:

| Probe | What it catches |
|---|---|
| `ko-KR` | CJK density, Korean copy, local date/number conventions |
| `en-US` | baseline Latin LTR behavior |
| `de-DE` | long labels and comma-decimal formatting |
| `ar-SA` RTL sample | RTL layout, bidi isolation and mirrored directional affordances |
| `hi-IN` numbering sample | non-Western grouping/numbering assumptions |
| long-label synthetic copy | text expansion and multiline actions |
| 200% zoom + 400% reflow | zoom, sticky regions and reading/task order |
| reduced-motion + forced-color/high-contrast | user preference resilience |
| virtual keyboard + IME composition | mobile input and composition safety |

Official references:

- https://www.w3.org/TR/WCAG22/
- https://www.w3.org/WAI/ARIA/apg/
- https://www.w3.org/International/docs/bp-html-bidi/
- https://www.w3.org/International/articles/lang-bidi-use-cases/
- https://cldr.unicode.org/
- https://www.unicode.org/reports/tr35/
- https://developer.apple.com/design/human-interface-guidelines/inclusion

### Engine and adapter presentation contracts

Long-running engine work uses explicit states: `queued → running → partial|succeeded|failed|cancelled`. A request being accepted or started is never rendered as completed. Job identity, retry eligibility, progress/result and completion receipt are observable.

Adapters use explicit health states: `disconnected → connecting → connected`, with `syncing`, `degraded` and `error` as distinct observable conditions. The UI exposes source identity and last successful synchronization when that affects trust.

External actions such as phone, SMS, email or third-party deep links distinguish `launched` from verified completion. Opening another app is not a success receipt.

### Exception contract

Product-specific exceptions must identify the feature ID, product, reason, owner, verification evidence and expiry/review date. Accessibility, data integrity, authority and completion-proof requirements are not waived by visual preference. Temporary exceptions never become a second standard by copy-paste.

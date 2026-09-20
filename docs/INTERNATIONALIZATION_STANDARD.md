# AI Core Internationalization Standard v1.0

## Principle

Internationalization is a behavior/data-presentation contract, not translation after implementation.

## Canonical versus presentation

C owns canonical date/time/money/currency/data meaning. B formats and parses presentation without changing that meaning.

Keep independently representable when applicable:

- language
- region
- script
- direction
- calendar
- numbering system
- hour cycle
- time zone
- currency

Use platform Intl APIs or CLDR-derived data. Do not hand-code separators, date order, currency placement, plural rules or units.

## Direction and bidi

- `lang` and direction are explicit.
- Use logical start/end layout properties.
- Do not infer direction solely from country or locale.
- Isolate mixed-direction user/external values such as identifiers, phone numbers, email and URLs.
- Mirror only directional affordances. Brand marks and direction-invariant icons do not mirror automatically.

## Text expansion

Translated labels, helper text, validation and actions may wrap. Critical actions must not be truncated solely to keep fixed width. Layouts must tolerate representative long-label probes.

## Input methods

IME composition must not trigger destructive validation, submit or auto-advance before composition completes. Dictation/handwriting/virtual keyboards must not hide the focused field or action boundary.

## Required conformance probes

- ko-KR
- en-US
- de-DE
- ar-SA RTL
- hi-IN numbering/grouping
- mixed bidi content
- synthetic long labels
- locale-aware number/date/time/currency/unit rendering
- virtual keyboard + IME composition

These probes test assumptions; they are not the supported-market list.

## Machine sources

- `registry/ui-ux-features.json#system.localization`
- `system.locale-formatting`
- `system.bidi`
- `system.text-expansion`
- `system.input-method`
- `design-system/interaction.contract.json#internationalization`

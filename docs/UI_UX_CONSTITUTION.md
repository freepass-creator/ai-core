# AI Core Global UI/UX Constitution v1.0

Status: **B SESSION CANONICAL CANDIDATE**

## Purpose

AI Core UI/UX is a behavioral and implementation contract, not a mood board. A consumer should be able to adopt the Core without inventing basic interaction, accessibility, responsive, localization or state-feedback decisions.

## Normative order

1. `docs/SCREEN_DESIGN_STANDARD.md` — human-readable accessibility and interaction floor.
2. `registry/ui-ux-features.json` — stable feature IDs, required states, shared behavior and verification.
3. `design-system/tokens.json` — machine-readable Design Token SSOT.
4. `design-system/components.registry.json` — all component-kind feature projections.
5. `design-system/patterns.registry.json` — all pattern/workflow/surface projections with B runtime vs contract-only ownership.
6. `design-system/interaction.contract.json` — cross-component interaction invariants.
7. `contracts/ui-screen-manifest.schema.json` — consumer screen composition contract with explicit C/D bindings.
8. `registry/ui-ux-governance.json` — temporary exception and deprecation registry.
9. `registry/ui-ux-consumers.json` — real-product adoption/conformance status; evidence sources are not automatically conformant consumers.
10. Product profiles — brand, density, icon family, domain copy and allowed exceptions.

A lower layer may specialize presentation but may not redefine the meaning of a higher-layer feature.

## Ownership boundary

### B — Global UI/UX Standard

Owns visual tokens, component contracts, interaction behavior, responsive layout behavior, accessibility, input modality, localization presentation, image/file UI, feedback semantics and UI verification.

### C — Core Contract Standard

Owns canonical domain data, IDs, API/event/error/result contracts, money/date/time data meaning and provider/adapter payload contracts. B may format or render these values but does not redefine their canonical representation.

### D — Workflow Standard

Owns domain state machines, transitions, guards, authority, retry/rollback rules and audit meaning. B renders workflow state and allowed commands; B does not create new business workflow states because a screen needs a button.

## Development Center execution boundary

This Constitution remains the normative UI/UX source. It is not a second project implementation center.

For real project work, Development Center **Design Hub** is the official execution entrypoint. It consumes a pinned AI Core revision, selects reusable assets/patterns, applies product profiles, coordinates project changes and hands verification to Quality Hub.

Therefore:

- AI Core B owns common semantics and canonical machine contracts.
- Design Hub owns execution/orchestration of design adoption across projects.
- Projects own allowed brand/domain specialization.
- Quality Hub owns revision-bound conformance evidence.
- Delivery Hub owns release/runtime evidence when deployment is in scope.
- Project-verified patterns may return as candidates; they do not become Core standard merely because Design Hub reused them.

See `docs/DEVELOPMENT_CENTER_EXECUTION_HANDOFF.md`.

## Global invariants

- The same `feature_id` means the same behavior in every country, product and implementation language.
- UI state is not domain workflow state unless D explicitly defines it.
- A request being accepted, launched or queued is not business completion.
- Top regions are informational by default; task actions live in the bottom action boundary unless an exception is registered.
- Mobile is not a scaled desktop; task order and meaning remain stable while layout changes.
- Keyboard, touch, pointer and assistive input must reach the same business outcome unless modality is intrinsic to the task.
- Canonical values remain locale-neutral; localized formatting is presentation.
- Product branding may vary, but accessibility, completion meaning, failure semantics and data-safety boundaries do not.

## Design Token SSOT

`design-system/tokens.json` is the machine source. Every locked role carries `scope`, `evidence_level`, source `refs` and a governance `decision`; a numeric value without provenance is incomplete. `design-system/tokens.runtime.css` is its CSS projection for new consumers. Legacy `tokens.css` stays as compatibility evidence until migration completes; it is not a second semantic source.

Company role values currently fixed from normative/platform/internal evidence:

- desktop compact control: 40px
- touch target minimum: 44px
- frequent quick action preferred: 48px
- mobile interactive row minimum: 64px
- spacing: 4/8/12/16/24/32/48
- focus ring: 3px with 2px offset
- regression viewports: 360/390/412/1280/1440
- zoom/reflow probes: 200% / 400%

## Feature → component → pattern → screen

A reusable screen feature starts with `registry/ui-ux-features.json`. Component features are projected into `design-system/components.registry.json`; pattern/workflow/surface features are projected into `design-system/patterns.registry.json`. Cross-component behavior is governed by `design-system/interaction.contract.json`. Consumer screens declare their feature set with `contracts/ui-screen-manifest.schema.json`, including explicit `C:` data/API and `D:` workflow bindings. Screens compose those contracts; they do not invent local substitutes.

## A-session promotion intake

When A session sends a project pattern:

1. bind evidence to project and revision;
2. classify NORMATIVE / PLATFORM_CONSENSUS / CROSS_PROJECT_VERIFIED / PROJECT_VERIFIED / PROPOSED;
3. generalize away product-specific labels and pixels;
4. compare with existing feature IDs and C/D boundaries;
5. update feature/token/component/interaction contract only when the common meaning is clear;
6. add or update validator/test coverage;
7. record evidence and revision;
8. keep project-only behavior in the product profile when generalization is not justified.

## Exception rule

An exception must name the feature ID, product, reason, owner, evidence and expiry/review date. Accessibility, authority, data integrity and completion proof cannot be waived by visual preference. Expired exceptions fail migration review.

## Verification

Minimum static gate:

- `npm run uiux:validate`
- `npm run uiux:runtime`

Browser/visual gates follow `docs/UI_QA_VISUAL_REGRESSION.md`.

## Revision rule

Canonical changes require a Git revision and passing validation. A document edit without matching machine contracts/tests is not a completed standard change.

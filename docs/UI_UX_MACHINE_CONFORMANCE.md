# UI/UX Machine Conformance Gate v1

Status: **B SESSION CANONICAL CANDIDATE**

## Purpose

A visual standard is not complete when tokens and component roles exist only in documentation. A consumer must be able to fail CI when an implemented, actually-used selector drifts outside the allowed semantic token/value set.

This primitive is reverse-imported from independent project evidence in FP Settlement and TeamJPKWork, then generalized so no product-specific pixel values, retro-theme rules, Korean selector names or business-domain semantics become AI Core canon.

## Contract

Consumer manifest:

- schema: `contracts/ui-ux-machine-conformance.schema.json`
- engine: `src/engine/ui-ux-machine-conformance.mjs`
- CLI: `scripts/validate-ui-ux-machine-conformance.mjs`

A manifest names stylesheet files, implementation source files that prove which classes are actually used, and semantic rules containing target classes, CSS property and allowed values or patterns.

## Required behavior

- **Used selectors only.** Unused legacy/theme selectors do not create noise.
- **Effective declaration view.** Within the supported flat-selector subset, later declarations for the same selector/property are treated as the effective value.
- **Off-grid fail closed.** A used target class with a disallowed final value fails the gate.
- **Explicit missing rule.** `require_match=true` fails when the expected effective declaration is absent.
- **Profile boundary.** Product-specific styling remains outside a rule unless B explicitly promotes it.
- **No false canon.** Passing this gate proves only the declared semantic CSS constraints for the inspected files. It does not prove browser rendering, accessibility, locale/RTL, workflow correctness or production release freshness.

## Supported selector scope

v1 deliberately supports flat CSS blocks and class-based implementation usage. It does not claim to evaluate the complete browser cascade, nested at-rules, computed styles, CSS-in-JS runtime generation or shadow DOM. Those require browser/runtime receipts.

## CI

AI Core executable proof:

`npm run uiux:machine`

Consumers should bind the manifest contract to their own stylesheet and usage files and run the same CLI or an equivalent adapter in CI.

## Source evidence

A routed `ui.machine-conformance-gate` as **CROSS_PROJECT_VERIFIED** based on:

- `freepass-creator/fp-settlement@b406da67a9cb2b85b5572a7f5d28d350ca84cb58`
- `freepass-creator/teamjpkwork@75bb285a241b68c13acbe532c30d6d91110f8082`

The reusable common behavior is machine enforcement of semantic selector/token constraints and rejection of unapproved drift. Project-local visual rules remain local.

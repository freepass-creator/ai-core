# UI QA / Visual Regression Standard v1.0

## Goal

Visual regression proves that a contract still renders and behaves correctly. It is not permission to freeze every pixel.

## Required probe matrix

- viewport: 360, 390, 412, 1280, 1440 CSS px
- 200% zoom
- 400% reflow for ordinary one-dimensional content
- LTR and RTL
- long translated labels
- reduced motion
- forced colors / high contrast where the browser supports it
- keyboard-only
- touch-sized targets
- virtual keyboard / IME composition for editable flows
- loading / empty / error / populated
- default / focus-visible / active / disabled / busy for actions

## Evidence layers

1. static contract validation
2. DOM/semantic assertions
3. browser interaction receipt
4. screenshot/visual diff
5. product-specific workflow verification

A screenshot alone is never sufficient for semantics, focus, keyboard, live-region or completion proof.

## Baseline rules

- Every browser receipt or screenshot baseline records source revision and source hashes.
- Do not rewrite a historical receipt to match changed source.
- A changed shared CSS/token source requires a new receipt.
- Baseline updates require an explanation of the intended contract change.
- Pixel diffs may be ignored only when semantics, hierarchy, target size, focus and overflow remain valid.

## Required shared scenes

- component gallery
- form validation
- tabs/disclosure
- list/card/table states
- bottom task action
- dialog and focus return
- toast and inline error
- RTL mixed-content sample
- long-label sample
- safe-area bottom action sample
- forced-colors sample

## Failure classes

- BLOCKER: action unreachable, focus obscured/lost, wrong completion meaning, inaccessible label, destructive action exposed incorrectly, content clipped at required reflow.
- MAJOR: wrong hierarchy, target below contract, RTL order broken, critical text truncated, state feedback missing.
- MINOR: non-semantic decorative drift within product profile allowance.

## Migration

Legacy receipts remain valid only for the exact source hashes they bind. New runtime-v2 adoption creates new evidence; it does not mutate old evidence.

# UI/UX Conformance Receipt Standard v1.0

## Purpose

A browser screenshot, green CI run or prose review is not by itself a conformance claim. PILOT and CONFORMANT promotions require a revision-bound receipt that identifies exactly what was tested.

## Receipt identity

Every receipt binds:

- product repository + exact subject revision
- product consumer manifest path
- AI Core repository + exact revision + Feature Registry version
- controlled runner/browser/command
- observation time
- required probe matrix
- per-feature results
- source hashes
- evidence artifacts

## Required PILOT matrix

- viewport: 360 / 390 / 412 / 1280 / 1440
- locale/direction probes: ko-KR / en-US / de-DE / ar-SA
- input: keyboard / touch / pointer / IME composition
- preference: reduced motion / forced colors / 200% zoom
- data states: loading / empty / error / populated

400% reflow is additionally required by the QA standard for ordinary one-dimensional content and should be included in the receipt where applicable.

## Claim levels

### PILOT

May bind a CANDIDATE_PR AI Core revision. All required probes must be present and every feature claimed PASS must carry evidence.

### CONFORMANT

Requires:

- AI Core revision status CANONICAL
- receipt status PASS
- no non-PASS claimed feature
- target product manifest status CONFORMANT
- no unresolved pending-conformance item or active unapproved exception

## Evidence integrity

Receipts are immutable evidence. If source, product revision, Core revision or required matrix changes, generate a new receipt. Never edit an old receipt to make a later implementation look verified.

Machine contract: `contracts/ui-ux-conformance-receipt.schema.json`.
Semantic validator: `src/engine/ui-ux-conformance-receipt.mjs`.

# UI/UX Consumer Promotion Gate v1.0

## Purpose

Adoption status is not manually edited as a conclusion. AI Core evaluates whether the next status is supported by exact evidence.

## Allowed path

`EVIDENCE_ONLY → MAPPED → PILOT → CONFORMANT`

Skipping a state is forbidden.

## EVIDENCE_ONLY → MAPPED

Requires:

- target product consumer manifest
- exact product revision
- product PR reference
- successful product CI reference
- mapping revision bound to the manifest/revision

This proves the product is wired to the Core contract; it does not prove cross-locale/browser conformance.

## MAPPED → PILOT

Requires:

- a matching PASS `PILOT` conformance receipt
- exact product/repository match
- exact AI Core revision match
- exact Feature Registry version match

## PILOT → CONFORMANT

Requires everything above plus:

- PASS `CONFORMANT` receipt
- AI Core status CANONICAL
- exact canonical Core revision match
- no pending conformance item
- no active product exception requiring review

## Boundary

This is governance of B-standard adoption, not a business workflow state machine. D remains owner of product/business workflow states.

Implementation: `src/engine/ui-ux-consumer-promotion.mjs`.

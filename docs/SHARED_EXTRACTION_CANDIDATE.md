# Shared Extraction Candidate Compiler v1

## Purpose

This compiler is the review boundary before any `EXTRACT_SHARED` execution.

It answers a narrow question:

> Are two or more real project implementations actually equivalent enough to justify shared extraction review?

It does **not** extract code or promote a DevCenter package.

## Required evidence

Each implementation must provide:

- distinct project identity;
- repository and exact 40-hex revision;
- source path/export;
- Git blob SHA;
- explicit semantic contract;
- common behavior cases with input + output/error;
- evidence references.

The compiler never derives semantic equivalence from function names or source similarity.

## Comparison

It compares:

1. semantic contract dimensions;
2. presence of the same behavior case IDs;
3. canonical behavior inputs;
4. canonical behavior outputs/errors;
5. evidence completeness.

Any mismatch produces a named blocker such as:

- `CONTRACT_MISMATCH:negative_policy`
- `BEHAVIOR_MISMATCH:negative-one`
- `BEHAVIOR_CASE_MISSING:<case>`
- `EVIDENCE_MISSING:<project>`

## Safety boundary

Even a perfectly matching candidate only becomes:

`READY_FOR_EXTRACTION_REVIEW`

The output always keeps:

- `extraction_allowed=false`
- `package_promotion_allowed=false`
- `source_authority_transfer=false`

Actual extraction still requires consumer analysis, versioning, rollback planning, Work Packet compilation, authority and regression proof.

## Pilot

`docs/audits/shared-extraction-krw-pilot-2026-09-20.json` compares ERP4 `wonKo` with Welrix `krw`.

The pilot intentionally lands as **HOLD** because negative-value semantics differ. This is a successful safety result, not a failed compiler.

The existing DevCenter `fp4-format-preview` remains a derived preview, not shared authority.

# A Session Gap Backport — FreePassERP3 Approximate Canonicalization

상태: **CORE_AHEAD / DATA_MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: FreePassERP3
- Repository: `freepass-creator/freepasserp3`
- Default branch: `master`
- Source path:
  - `src/core/ssot-snap.js`
  - `src/core/ssot-source.js`
- Revision:
  - observed repository head: `8d8b7a559272a37823f879b77099b3bc17bf5a16`
  - snap implementation blob: `82d272c27f051731986b577e13d41e39457b4203`
  - source loader blob: `2fb3412b892c6186f358f809b580540e2eb2455c`
- Category: Data / SSOT / Normalization / Review Gate

## Current implementation

`ssot-snap.js` explicitly states:

- raw pass-through is prohibited;
- if the raw trim does not exist, choose the most similar existing trim;
- even when the canonical standard may be wrong, force the record into an existing SSOT combination.

The trim matcher returns the nearest real trim even when similarity is weak.

The file does have a useful confidence mechanism and was improved to flag several high-risk cases as `review`, including:

- inferred import model;
- fuel mismatch;
- missing displacement when multiple variants exist;
- ambiguous Gravity-seat configurations.

However, some uncertainty remains non-blocking:

- multi-generation vehicle with unknown year is only an `info` flag;
- trim similarity below 0.2 is only `트림추정` info;
- `confidence` is still returned as `high` whenever the `review` array is empty.

That means a very weak trim match can still be returned as canonical-looking data with `confidence: high`.

## AI Core equivalent

Current AI Core C-session research already requires:

- raw/source fact preservation;
- normalized value stored separately;
- confidence / verification state;
- unknown and ambiguous source must not be silently guessed;
- `REVIEW_REQUIRED` as a first-class normalization result;
- source provenance retained through parsing/normalization.

## Classification

- **Core > Project** for uncertainty handling and canonical-write gating.
- Project remains valuable as evidence that production normalizers need explicit review flags and domain-specific ambiguity detection.

## Gap

The issue is not that approximate matching exists.

The issue is:

**approximate match result can become canonical-looking output without a threshold that forces review or preserves the raw unresolved value as first-class truth.**

This can convert uncertainty into false precision.

## Recommended migration

1. Preserve raw source fields independently from normalized/canonical fields.
2. Split normalization result into at least:
   - MATCHED
   - REVIEW_REQUIRED
   - UNRESOLVED/REJECTED
3. Define per-axis confidence/evidence, not one `high/review` shortcut.
4. Low trim similarity must not return `confidence: high`.
5. Unknown generation/year with multiple valid generations should require review unless an independent discriminator resolves it.
6. Canonical write should require an explicit verification threshold/policy.
7. Keep suggested candidate values for operator review, but do not overwrite source truth.
8. Store source master version/revision used for the match.
9. Add regression fixtures for deliberately ambiguous and weak-similarity inputs.

## Breaking impact

- MEDIUM.
- Existing records may already contain forced canonical selections that need review rather than automatic rewrite.
- Do not bulk-clear or replace them without provenance/consumer analysis.

## Verification needs

- weak trim similarity fixture → REVIEW_REQUIRED
- unknown year + multi-generation fixture → REVIEW_REQUIRED
- exact/high-confidence fixture → MATCHED
- raw source preserved in all paths
- canonical candidate and raw source distinguishable
- re-normalization under a new master version does not erase prior source/evidence

## Destination

- C — Data / SSOT / Normalizer backport.
- No new C canonical standard is required; this is application of existing Core rules.

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → MEDIUM
Migration 방법 → RAW + NORMALIZED + REVIEW GATE
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING

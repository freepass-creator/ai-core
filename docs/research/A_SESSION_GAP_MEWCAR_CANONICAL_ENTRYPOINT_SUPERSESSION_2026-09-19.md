# A Session Gap Backport — Mewcar Canonical Entrypoint Supersession

상태: **CORE_AHEAD / STALE_ENTRYPOINT / MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: Mewcar Automobile Subscription
- Repository: `freepass-creator/mewcar`
- Source path:
  - `PROJECT_READ_FIRST.md`
  - `정본/README.md`
  - `정본/00_값.md`
  - `정본/01_정책.md`
  - `정본/02_실무가이드.md`
  - `정본/03_체크리스트.md`
  - `결정/사업준비표.md`
- Revision:
  - observed repository head: `232f0fee0f0004a1e525444b9ddeb61d04e286f5`
  - `PROJECT_READ_FIRST.md` blob: `9bf0e6156ac767688f320c283029d0eec461545e`
  - `정본/README.md` blob: `0699926e96a25241bb22a886195ae98f9c6f6a9c`
  - canonical-set establishment lineage:
    - `a6d67ac995b8bbf67afc91d637c4b655cec9346c` — canonical draft set
    - `403238144c31659077e1ddbec719e57462fdf775` — canonical finalized after Claude/GPT/Gemini review
- Category: Data / SSOT / Provenance / Supersession

## Current implementation

Mewcar has a strong domain-document SSOT model:

- `정본/README.md` declares four canonical files:
  - values
  - policy
  - operating guide
  - launch checklist
- historical pre-canonical documents are retained as history instead of silently deleted.
- business assertions use explicit maturity/status semantics:
  - 확정
  - 대표 의견
  - 내부안
  - 미정
- representative statements are not automatically promoted to legal/corporate execution.
- document render/PDF evidence is kept separate from business/legal execution evidence.

However, the repository's designated entrypoint `PROJECT_READ_FIRST.md` still opens with the older 2026-09-16 authority rule:

- `결정/2026-09-16_김건식대표_구독사업원칙_의견.md` as the planning canonical,
- with `01_사업기획/사업기획안.md` secondary.

Later, `정본/README.md` dated 2026-09-18 explicitly supersedes that arrangement by declaring the four files under `정본/` canonical and earlier documents historical/source material.

The entrypoint includes later appended context, but its top-level canonical routing has not been fully rewritten around the 2026-09-18 canonical set.

## AI Core equivalent

AI Core current operating rules require:

- one current project entrypoint;
- revision-bound authority/source pointers;
- explicit supersession;
- stale plan/source pointers to be treated as stale instead of allowing multiple apparent canonicals;
- old history may remain, but the current read-first route must resolve the latest authority unambiguously.

## Gap

This is not a content-quality failure. It is a **routing/supersession gap**.

A new AI or human following `PROJECT_READ_FIRST.md` from the top can reasonably resolve the 9/16 principle document as canonical before discovering the later 9/18 `정본/` authority.

That creates a risk of:

- reading an older planning authority as current truth;
- regenerating documents from superseded content;
- re-opening decisions already normalized into `정본/`;
- divergent AI behavior depending on which file was opened first.

## Project ahead / Core ahead / Different

- **Project ahead** on domain assertion maturity and history preservation.
- **Core ahead** on canonical-entrypoint/supersession discipline.
- Net migration direction: **Core > Project for entrypoint routing**.

## Recommended migration

1. Do not delete old planning/decision documents.
2. Rewrite the very top of `PROJECT_READ_FIRST.md` so the first canonical pointer is `정본/README.md`.
3. State that `정본/README.md` resolves the four current canonical content files.
4. Reclassify the 2026-09-16 principle document and `01_사업기획/사업기획안.md` as source/history unless a specific canonical file points to them as evidence.
5. Keep the existing source lineage and review history intact.
6. Optionally add machine-readable metadata:
   - canonical_set_version
   - canonical_paths
   - supersedes
   - source_revision
   - observed_at
7. Verify all document generators/read-first instructions resolve the same canonical set.

## Breaking impact

- Runtime breaking impact: LOW.
- Knowledge/decision drift impact: **MEDIUM-HIGH**, because this project is used as business-content SSOT.

## Verification needs

- fresh-session test: start only from `PROJECT_READ_FIRST.md` and resolve the same four canonical files.
- no ambiguous second canonical declaration.
- old source/history remains reachable.
- generated operating hub/document inputs come from the current canonical set.
- no business fact is silently rewritten during migration.

## Destination

- C — SSOT / Source Provenance / Supersession backport.
- No new C standard candidate is required; this applies existing AI Core principles.

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → LOW runtime / MEDIUM-HIGH knowledge drift
Migration 방법 → ENTRYPOINT REPOINT + EXPLICIT SUPERSESSION
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING

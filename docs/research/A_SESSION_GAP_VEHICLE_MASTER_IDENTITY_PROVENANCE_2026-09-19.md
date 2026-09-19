# A Session Gap Backport — Vehicle Master Identity & Provenance

상태: **CORE_AHEAD / MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: Vehicle Master
- Repository: `freepass-creator/vehicle-master`
- Source path:
  - `README.md`
  - `dist/SCHEMA.md`
  - `dist/manifest.json`
  - `scripts/export.py`
- Revision:
  - observed repository head: `233115fb1daf9f17ba58a4fae2c30eaaf99b2e8c`
  - export implementation blob: `53bbad2b25dec1af783185905567422c869c0607`
- Category: Data / SSOT / Identity / Provenance
- Current implementation:
  - project is a 5-level vehicle master SSOT with export manifest and content-hash versioning.
  - documentation calls IDs stable and recommends them as external ERP reference keys.
  - export constructs IDs from semantic/display attributes:
    - manufacturer fallback: slug(name)
    - model fallback: slug(name)
    - generation fallback: slug(sub-model name)
    - powertrain: fuel + displacement/battery + drivetrain
    - trim: slug(trim name)
  - manifest has one coarse `source` string and one generated/version value.
- AI Core equivalent:
  - current A-session Data/SSOT findings require stable identity independent from mutable display labels.
  - source fact vs normalized fact and source provenance should preserve source revision/observation/normalizer lineage.
  - snapshot revision and source revision are distinct concepts.
- Gap:
  1. **Identity drift risk** — correcting/renaming a trim, generation name fallback, or powertrain semantics can change the externally referenced ID.
  2. **Provenance granularity gap** — manifest cannot identify which source revision/observation/normalizer produced a specific export.
  3. **Version conflation** — output content version exists, but source revisions and schema/normalizer versions are not separately represented.
- Project ahead / Core ahead / Different:
  - **Core > Project** for stable identity and provenance contract.
  - Project remains useful/strong on 5-level domain hierarchy, content-hash export version and explicit consumer manifest.
- Evidence:
  - `scripts/export.py` directly builds trim ID with `slug(t["name"])`.
  - generation/model/manufacturer have name-based fallback ID construction.
  - `dist/manifest.json` records `source: "encar + welrix + namuwiki crosscheck"` but not per-source revision, observed_at or normalizer version.
- Generalizable: Gap backport, not reverse import.
- Destination:
  - C — Core Contract owner for identity/provenance rules
- Recommended action / migration:
  1. Do **not** rewrite current IDs in place.
  2. Inventory all consumers using current IDs as foreign keys.
  3. Introduce immutable canonical IDs (assigned stable code/opaque ID) for nodes that currently depend on mutable semantics.
  4. Preserve current IDs as `legacy_id` / alias mapping.
  5. Add an adapter translating legacy IDs to canonical IDs during a dual-read migration period.
  6. Add manifest `schema_version` plus source entries carrying source identifier, observed/source revision and normalizer version where available.
  7. Keep output snapshot/version separate from source lineage.
  8. Verify rebuild stability and consumer regression before cutover.
- Breaking impact:
  - **HIGH** if IDs are replaced directly because README explicitly instructs external ERP consumers to reference them.
  - migration should therefore be additive and alias-based first.
- Verification needs:
  - same-source rebuild preserves canonical IDs
  - display-name correction does not change canonical ID
  - legacy ID resolves to the same canonical entity
  - duplicate/collision test across all five hierarchy levels
  - manifest/source-lineage schema validation
  - at least one real consumer regression
- Status: `MIGRATION_CANDIDATE / CONSUMER_INVENTORY_REQUIRED`

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → HIGH
Migration 방법 → ALIAS + DUAL READ
적용 우선순위 → P1 (before next cross-system master cutover)
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING

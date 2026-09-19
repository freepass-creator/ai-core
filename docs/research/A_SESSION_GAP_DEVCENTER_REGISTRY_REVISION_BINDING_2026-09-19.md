# A Session Gap Backport — DevCenter Registry Revision Binding

상태: **CORE_AHEAD / MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: DevCenter
- Repository: `freepass-creator/devcenter`
- Source path:
  - `registry.json`
  - `README.md`
- Revision:
  - observed repository head: `6a838a28b3c25b068e5bbe010071fd1de0242d30`
  - registry blob: `269db48f2901f066027803bbae9215b85631df60`
- Category: Data / Registry / Provenance / SSOT
- Current implementation:
  - registry entries identify project, role, kind and source locator.
  - many entries are marked `authoritative` or `candidate`.
  - entry-level source revision/hash is not stored in `registry.json`.
  - README tells consumers to confirm original repository/path/version, but the registry itself cannot mechanically prove that the pointer still refers to the reviewed bytes.
  - deeper standard cards do carry source SHA values, so the project already demonstrates the stronger pattern in another layer.
- AI Core equivalent:
  - project registry stores `head_revision` and authoritative source revision/observed time.
  - AI Core operating rules require revision-bound observations and stale treatment when source revisions change.
- Gap:
  - DevCenter registry discovery pointer and evidence layer are split; registry can remain syntactically valid while the source behind an authoritative locator changes.
- Project ahead / Core ahead / Different:
  - **Core > Project** for revision-bound registry provenance.
- Recommended migration:
  1. add optional source revision/hash metadata to DevCenter registry entries;
  2. mark entries with unknown revision as `UNVERIFIED/HOLD` for promotion purposes rather than deleting them;
  3. on refresh, compare stored revision/hash to current source;
  4. stale entries require re-review before authoritative/candidate promotion evidence is reused;
  5. preserve locator and ID compatibility; this is an additive schema migration.
- Breaking impact:
  - LOW for additive metadata.
  - MEDIUM if consumers currently treat `role: authoritative` as sufficient without revision verification.
- Verification needs:
  - stale source fixture
  - missing revision fixture
  - unchanged revision pass
  - registry refresh does not silently rewrite evidence
  - existing `틀.mjs` lookup remains compatible
- Status: `MIGRATION_CANDIDATE`

## Additional stale observation

AI Core `registry/projects.json` currently records DevCenter head as
`132189799a1701e34b8b9196c59ec26848353f76`.

Actual observed DevCenter head is
`6a838a28b3c25b068e5bbe010071fd1de0242d30`.

The delta is one commit modifying only
`standards/backend/FREEPASS-ADMIN-PILOT.md`.

This does not invalidate the discovery above, but the central project observation is stale and should be refreshed by the registry owner/process.

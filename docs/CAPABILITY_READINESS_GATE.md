# Capability Readiness Gate v1

## Purpose

This gate answers one narrow question:

> What machine-detectable gaps still prevent a registered capability from being safely reviewed for activation?

It is intentionally read-only. It does **not** mutate `registry/capabilities.json`, promote HOLD to ACTIVE, grant authority, execute adapters, or reinterpret a project's SSOT.

## Why this exists

AI Core already has a Capability Registry and runtime. Many capabilities remain HOLD because their project, adapter, revision, authority boundary, or runtime binding is incomplete. Until now those gaps were mostly embedded in free-text `hold_reason` fields.

The readiness gate converts the machine-checkable portion into a deterministic report while preserving the declared hold reason for canonical-owner review.

## Readiness states

- `ACTIVE_HEALTHY` — currently ACTIVE and no machine-detectable runtime prerequisite gap was found.
- `ACTIVE_WITH_GAP` — currently ACTIVE but the registry/project state exposes a runtime prerequisite gap.
- `BLOCKED` — HOLD with one or more machine blockers.
- `REVIEW_REQUIRED` — HOLD with no machine blocker; a canonical owner must still review the declared hold reason and revision-bound evidence.
- `REFERENCE_ONLY` — REFERENCE capabilities are never treated as activation candidates.

Every item returns `promotion_allowed: false`. This is deliberate.

## Checks

The v1 gate checks:

- target project registration and ACTIVE state;
- target project head revision presence;
- adapter contract presence and supported shape;
- local path availability for project module/command execution;
- project command availability for registry-command adapters;
- required authority scopes for external mutation capabilities;
- known project approval boundaries and blockers as advisories;
- terminal receipt absence for external mutation as an advisory.

A wildcard capability is evaluated as route-dependent rather than pretending every project is ready.

## Run

```bash
node scripts/capability-readiness.mjs
node scripts/capability-readiness.mjs --hold-only
node scripts/capability-readiness.mjs --fail-on-active-gap
```

The existing `npm test` glob automatically includes `test/capability-readiness.test.mjs`.

## Promotion boundary

A report may reduce a HOLD item to `REVIEW_REQUIRED`, but only the canonical owner may change registry status after checking the current source revision, project evidence, authorization boundary, and the original declared hold reason.

This gate is a diagnosis surface, not a second capability registry and not a second authority system.

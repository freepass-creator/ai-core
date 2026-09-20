# No-Actions Integration Log — 2026-09-20

## Operating mode

User direction: do not use GitHub Actions for the current AI Core work. Continue implementation on branch-only work without opening a PR.

Working branch: `work/ai-core-no-actions-20260920`

## C bundle

Integrated:
- #129 — `core-proof-input-binding/v1`
- #130 — `core-fact-evidence/v1`
- #131 — `core-schedule-observation/v1`

Intentionally excluded from this branch:
- all `.github/workflows/*` changes
- PR-specific `docs/episodes/ORDER-DESK-001.json` inventory edits

Status:
- schemas/runtime helpers/tests copied from source branches
- Core Contract registry consolidated without duplicate entries
- Core Contract Standard consolidated
- `core-receipt/v1` linked additively to proof input freshness
- CI: NOT RUN by user direction
- canonical promotion: NOT CLAIMED

Next:
- integrate D #133 + #134 with the same no-Actions rule.

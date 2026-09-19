# A Session Discovery — TeamJPKWork as Second UI Conformance Evidence

상태: **CROSS_PROJECT_EVIDENCE / ROUTED_TO_B / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: TeamJPKWork
- Repository: `freepass-creator/teamjpkwork`
- Source path:
  - `lib/erp/화면규격.ts`
  - `scripts/화면규격-검사.mjs`
  - `scripts/규격대조-검사.mjs`
  - `scripts/입체각도-검사.mjs`
  - `scripts/동선-검사.mjs`
  - `scripts/문지기-검사.mjs`
  - `package.json`
- Revision:
  - observed repository head: `75bb285a241b68c13acbe532c30d6d91110f8082`
  - UI conformance implementation blob: `scripts/화면규격-검사.mjs@b17d1b9d790d889dfe16aef8c99b076bd3c0da33`
  - API boundary checker blob: `scripts/문지기-검사.mjs@eee653224b3cab07188caa25d3c3eb65afb9534b`
  - flow checker blob: `scripts/동선-검사.mjs@a42c03cd98ee97ea4f58bdb77861bccc12b42cd7`
- Category: UI/UX / Design System / Design QA
- Compared candidate: `ui.machine-conformance-gate`
- Existing first evidence:
  - `fp-settlement@b1e833dfed37ed08f5cc5ed83bdd55a29bf5bc24`
- Current implementation:
  - UI standard values are centralized in `lib/erp/화면규격.ts`.
  - CSS values are generated/validated against that source rather than independently redefined.
  - checker recursively reads UI source files instead of only one monolithic component.
  - rule scope is profile-aware: modern UI and classic UI can have different approved conventions instead of treating every difference as a violation.
  - off-standard font sizes, heights, colors, raw hex values, unauthorized depth/screen names, badge variants, popup usage and misleading interactive affordances are rejected.
  - negative-control lessons are explicitly encoded: comments are stripped, CRLF cases are handled, manually enumerated file lists are avoided where they would cause blind spots.
  - separate route/API guard checker verifies each handler has an actual authorization gate.
  - separate data-flow checker traces producer collections to consumers/screens and fails on silent 'written but never read/rendered' paths.
- AI Core equivalent:
  - AI Core has declarative design tokens/components and screen design standards.
  - A-session first identified FP Settlement as project-verified evidence that design standards can be machine-enforced.
- Gap / comparison:
  - TeamJPKWork independently implements the same **mechanism class**:
    `canonical UI roles/tokens → source/effective-use inspection → rule-scope exceptions → machine failure on drift`.
  - Its exact values, 4-depth workflow, classic-theme rules, no-popup profile and business-specific badge rules are project-local.
- Project ahead / Core ahead / Different:
  - **Project > Core on executable UI conformance enforcement.**
  - Together with FP Settlement this candidate becomes **CROSS_PROJECT_VERIFIED**.
- Evidence:
  - TeamJPKWork head `75bb285a...` includes production-discovered UI/security/data-path checker corrections.
  - `화면규격-검사.mjs` explicitly documents prior false-green failures and expands scanner coverage to all relevant UI source.
  - `package.json` exposes multiple repeatable conformance commands.
- Generalizable: Yes
  - Generalize the checker contract, not local visual values:
    1. canonical token/role source
    2. machine-readable allowed roles/values
    3. project/profile scoped exceptions
    4. coverage over actually relevant files/components
    5. negative controls for checker blindness
    6. CI/release failure on unapproved drift
- Destination:
  - B — Global UI/UX Standard
- Recommended action:
  - B can now evaluate `ui.machine-conformance-gate` as `COMMON_ADOPTED_CANDIDATE`.
  - final schema, tooling and mandatory-rule set remain B-owned.
- Migration impact:
  - start with report/warn mode for legacy projects.
  - hard CI enforcement can be opt-in per standard/profile until migration debt is cleared.
- Status: `CROSS_PROJECT_VERIFIED / COMMON_ADOPTED_CANDIDATE`

## Promotion Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Second independent project → DONE
Generalize → DONE
Assign B → DONE
Evidence level promotion → DONE
B canonical adoption → PENDING

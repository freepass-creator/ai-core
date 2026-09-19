# A Session Discovery — FP Settlement Machine UI Conformance Gates

상태: **PROJECT_VERIFIED / ROUTED_TO_B / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: FP Settlement
- Repository: `freepass-creator/fp-settlement`
- Source path:
  - `package.json`
  - `scripts/check-brick.mts`
  - `scripts/check-pad.mts`
  - `scripts/check-head.mts`
  - `scripts/check-groove.mts`
  - `components/settlement/classic.css`
  - `components/settlement/IntakeStation.tsx`
- Revision:
  - observed repository head: `b406da67a9cb2b85b5572a7f5d28d350ca84cb58`
  - conformance gate consolidation evidence: `b1e833dfed37ed08f5cc5ed83bdd55a29bf5bc24`
  - header gate evidence: `56e1e862a908e39e8787ee90147329edfb371825`
  - boundary/groove gate evidence: `ab6211ffc306a1537d757479d54b5ba8b975f0af`
- Category: UI/UX / Design System / QA
- Current implementation:
  - `check:all` composes brick/pad/head/groove plus engine/skin/typecheck gates.
  - checkers inspect only classes actually rendered by the screen instead of flagging unused inherited CSS.
  - checkers reason about the **last effective CSS declaration** rather than treating overridden historical rules as live violations.
  - layout dimensions/padding/header roles are constrained to semantic token families and CI fails on off-grid values.
  - project-specific `groove` gate also enforces a retro visual texture rule.
- AI Core equivalent:
  - `design-system/tokens.css` defines shared tokens.
  - `design-system/components.css` provides shared component implementations.
  - `docs/SCREEN_DESIGN_STANDARD.md` defines normative UI behavior/accessibility.
  - no equivalent machine conformance gate was found that checks effective CSS/runtime-used selectors against design-token/role constraints.
- Gap:
  - AI Core currently has declarative UI standards but lacks a reusable project-side **design conformance checker contract**.
- Project ahead / Core ahead / Different:
  - **Project > Core on machine-enforced UI conformance mechanism.**
  - FP Settlement's actual token numbers and retro `groove` aesthetics are domain/project-specific and must not become global defaults.
- Evidence:
  - `b1e833d...` records six padding variants reduced to two semantic padding roles and reports all four gates passing.
  - `3cb5ae5...` records uncontrolled component heights reduced to a bounded semantic scale and documents checker false-positive lessons.
  - checker source confirms used-class filtering and last-effective-rule handling.
- Generalizable: Yes
  - Generalize **mechanism**, not the settlement skin:
    1. semantic role/token allowlist
    2. effective-style/static-source inspection
    3. used-component/used-selector scope
    4. project extension exceptions with explicit rationale
    5. CI failure on unapproved off-grid values
- Destination:
  - B — Global UI/UX Standard
- Recommended action:
  - B should define whether the common design system exposes a machine-readable token/role manifest and a conformance-gate interface.
  - B should decide which rules are universal vs product-profile extensions.
  - A does not choose global pixel values or copy `brick/pad/head/groove` names into canonical standards.
- Migration impact:
  - additive if introduced as warning/measurement first.
  - potentially breaking only when projects opt into hard CI enforcement.
- Status: `PROJECT_VERIFIED / SECOND_PROJECT_REQUIRED`

## Reverse Import Pipeline

Discover → DONE
Evidence → DONE
Compare → DONE
Extract Pattern → DONE
Generalize → DONE
Assign B/C/D → DONE (B)
Create Core Candidate → DONE (`ui.machine-conformance-gate`)
Core adoption 확인 → PENDING (B owner)
Source revision 기록 → DONE
완료 → PENDING

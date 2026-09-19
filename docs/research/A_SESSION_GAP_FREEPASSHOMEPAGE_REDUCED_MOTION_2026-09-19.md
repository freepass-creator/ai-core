# A Session Gap Backport — FreePass Homepage Reduced Motion

상태: **CORE_AHEAD / ACCESSIBILITY_MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: FreePass Homepage
- Repository: `freepass-creator/freepasshomepage`
- Source path:
  - `css/style.css`
  - `js/main.js`
  - `index.html`
- Revision:
  - observed repository head: `5f0152c26ac1f106a5f5aee46a3e0020d653c8f5`
  - CSS blob: `e4cfcf2ba0990bcfa596bf93ce472701afdfcd2c`
  - JS blob: `4dd78ae86e2915e821727642c7feda2040b56f11`
- Category: UI/UX / Accessibility / Motion

## Current implementation

The homepage uses multiple motion mechanisms:

- global `scroll-behavior: smooth`;
- reveal transitions;
- animated marquee;
- animated buttons/navigation;
- continuously animated canvas network using `requestAnimationFrame`;
- animated count-up effects.

No `@media (prefers-reduced-motion: reduce)` branch was found in the current CSS, and the JavaScript animation loops do not inspect `matchMedia('(prefers-reduced-motion: reduce)')`.

## AI Core equivalent

AI Core `docs/SCREEN_DESIGN_STANDARD.md` and `design-system/tokens.css` already require/support reduced-motion behavior:

- loading/motion must honor reduced motion;
- users must not depend on hover/motion to reach actions;
- sample tokens globally reduce transition/animation duration under `prefers-reduced-motion: reduce`.

## Classification

- **Core > Project**
- This is a Backport Gap, not a new B standard candidate.

## Recommended migration

1. Add a reduced-motion media query that disables:
   - smooth scrolling;
   - reveal transforms/transitions;
   - marquee animation;
   - non-essential button/decoration transitions.
2. In JS, evaluate `prefers-reduced-motion` before starting:
   - canvas network animation;
   - count-up animation.
3. For reduced-motion mode:
   - render the canvas network as a static frame or hide non-essential motion;
   - show final count values immediately;
   - reveal content immediately.
4. Listen for runtime preference changes if feasible.
5. Keep information and controls fully usable when all decorative motion is removed.

## Breaking impact

- LOW.
- Visual presentation changes only for users requesting reduced motion.

## Verification needs

- browser test with `prefers-reduced-motion: reduce`;
- no continuous animation loop in reduced mode;
- all reveal content visible without animation;
- counts show final values;
- no layout or navigation regression on desktop/mobile.

## Destination

- B — UI/UX accessibility backport.
- No canonical B standard change required.

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → LOW
Migration 방법 → REDUCED-MOTION PROFILE
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING

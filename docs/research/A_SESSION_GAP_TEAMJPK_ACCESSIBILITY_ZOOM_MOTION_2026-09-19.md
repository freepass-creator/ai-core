# A Session Gap Backport — TeamJPK Accessibility Zoom & Motion

상태: **CORE_AHEAD / ACCESSIBILITY_MIGRATION_REQUIRED / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: TeamJPK Homepage
- Repository: `freepass-creator/teamjpk`
- Source path:
  - `index.html`
  - `css/style.css`
  - `js/main.js`
- Revision:
  - observed repository head: `b26cd298f07023dab38ee33b7de7ce95528df29b`
  - viewport HTML blob: `7426cf15e5b424167364430c6588a1d6587c2675`
  - CSS blob: `144a9f2bbb5e08764d58ac1791ae549865fc74b2`
  - JS blob: `e229f38f5e4f0c0ad5003330e07f20246281758f`
  - explicit pinch-zoom lock commit: `dffbc055ceb9f616f672105609fd138f667d724d`
- Category: UI/UX / Accessibility

## Current implementation

The mobile viewport explicitly sets:

- `maximum-scale=1`
- `user-scalable=no`

and CSS sets:

- `touch-action: pan-y`

The commit message explicitly states that pinch zoom was locked to prevent mobile size changes.

The site also contains non-essential motion:

- continuously animated star canvas;
- reveal effects;
- count-up animation;
- marquee animation;
- hover/transition movement.

No `prefers-reduced-motion` handling was found in the current CSS/JS.

## AI Core equivalent

AI Core B standard currently targets WCAG 2.2 AA and explicitly requires testing at:

- 200% zoom;
- keyboard-only operation;
- reduced-motion preference.

The existing FreePass Homepage audit already found the same missing reduced-motion backport in a separate company website.

## Classification

- **Core > Project**
- This is a project migration gap, not a new B standard.

## Gap

Two accessibility issues:

1. **User zoom is intentionally disabled.**
2. **Decorative/continuous motion has no reduced-motion profile.**

The first is more severe because it prevents users from using browser/mobile zoom as an accessibility aid.

## Recommended migration

1. Remove `maximum-scale=1` and `user-scalable=no`.
2. Remove any touch-action rule whose purpose is to block pinch zoom; preserve normal scrolling/gesture behavior.
3. Verify layout at 200% zoom and high text scaling instead of freezing scale.
4. Add `prefers-reduced-motion: reduce` handling:
   - stop/pause decorative canvas animation;
   - disable marquee/reveal/count-up motion;
   - show final content immediately.
5. Ensure mobile hero/layout adapts to zoom instead of relying on fixed one-screen geometry.

## Breaking impact

- LOW functional impact.
- MEDIUM visual migration because the current mobile hero was explicitly tuned around a locked viewport.

## Verification needs

- pinch zoom works on mobile;
- browser 200% zoom remains usable;
- no horizontal data/control loss;
- reduced-motion mode has no continuous decorative animation;
- all text/content remains visible without reveal/count-up effects;
- mobile navigation and contact form remain usable.

## Destination

- B — Accessibility backport.

## Gap Backport Pipeline

Core Standard 확인 → DONE
Project Gap 확인 → DONE
Breaking 여부 → LOW functional / MEDIUM visual
Migration 방법 → ZOOM-ENABLED RESPONSIVE + REDUCED-MOTION
적용 우선순위 → P1
Project 적용 후보 → READY FOR OWNER REVIEW
검증 → PENDING

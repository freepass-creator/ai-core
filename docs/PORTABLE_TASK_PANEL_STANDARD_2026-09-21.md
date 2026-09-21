# Portable Task Panel Standard — 2026-09-21

Status: **USER-DIRECTION + AI CORE NORMATIVE BASELINE**
Decision date: **2026-09-21**
Scope: **AI Core UI/UX / mobile-web portability**
Depends on:
- `docs/UI_UX_USER_DECISION_2026-09-21_MOBILE_BASELINE.md`
- `docs/UI_UX_USER_DECISION_2026-09-21_WEB_PANEL_EXTENSION.md`
- `docs/SCREEN_DESIGN_STANDARD.md`
- `docs/RESPONSIVE_STANDARD.md`

## 0. Why this exists

The purpose of the mobile-first panel grammar is not merely visual consistency.

The operational goal is:

> **A task built for PC should be movable to mobile quickly by isolating the same task panel, preserving its content/state/actions, and letting the bottom action boundary carry completion actions.**

Therefore AI Core treats a task panel as a portable unit of work, not as a decorative card or desktop column.

## Adaptive web clarification — 2026-09-21

Portable Task Panel remains the preferred reusable **business task unit**, not a mandatory desktop visual container.

- Mobile keeps the stricter panel grammar.
- Web may transform the same task into a grid, denser workspace, inline workflow, utility toolbar or multi-panel composition when that improves desktop productivity.
- The invariant is business portability: same command/state/workflow semantics, not pixel or interaction identity.
- See `docs/ADAPTIVE_WEB_STANDARD_2026-09-21.md`.

## 1. Core portability invariant

For every reusable task surface, ask:

> **Can the same business task be projected to a mobile-complete surface without changing its canonical state, command, authority, error or completion semantics?**

If the answer is no, the surface is not portable and does not satisfy this standard.

A desktop surface may gain convenience from adjacent panels, tables/grids, keyboard shortcuts, inline actions, pointer hover, larger width, simultaneous context or bulk controls.
Those conveniences may change the interaction model, but they may not create a different canonical business outcome or a desktop-only business rule.

## 2. Panel anatomy

A portable task panel has four semantic zones.

1. **Status/Header**
   - title
   - current state
   - compact context/count/progress
   - informational by default
   - not a task CTA toolbar

2. **Body**
   - card list, form, detail, preview, or task content
   - preserves the same business meaning across mobile/web
   - desktop may use denser or comparative presentation
   - no required business meaning may exist only as visually implied sibling context

3. **Auxiliary actions**
   - filter / search / sort / share / refresh / overflow where appropriate
   - familiar icon action may be used
   - accessible name required
   - not a substitute for the primary business completion action

4. **Bottom action boundary**
   - explicit save / submit / approve / complete / send / next / confirm
   - primary and secondary hierarchy
   - remains reachable with safe area / virtual keyboard
   - same command meaning on mobile and web

## 3. Action layout

Company baseline:

### One action
- Primary 100%

### Two actions
- Secondary 30%
- Primary 70%
- ratio **3 : 7**

### Three actions
- Secondary 30%
- Secondary 30%
- Primary 40%
- ratio **3 : 3 : 4**

These ratios are a company UX rule, not an external accessibility standard.

Additional rules:

- same height within one action row
- one prominent Primary per active task panel
- when several panels are visible on web, do not create several competing prominent Primary buttons without workflow need
- a passive list/navigation panel normally does not need a prominent task Primary
- desktop keyboard shortcuts may accelerate the same command, but never become the only path
- hover, right-click, drag-and-drop, or pointer precision may enhance a task but cannot be required to complete it

## 4. Panel roles on wide screens

Default adaptive roles:

1. **Primary/List panel**
   - collection / search / selection / queue

2. **Detail/Task panel**
   - selected entity detail / form / processing task
   - usually owns the active bottom task action boundary

3. **Supporting/Extra panel**
   - history / evidence / comparison / memo / preview / supplemental context

This is a default composition model, not a hard three-panel maximum.
More simultaneous panes require a demonstrated workflow need and must not reduce readability or target usability.

## 5. Mobile ↔ web projection

### Compact/mobile
- one active task panel at a time
- selecting an item moves to/replaces the current panel
- state, selection, draft, scroll and entity identity are preserved
- bottom action boundary remains local to the active task

### Wide/web
- the same panels may appear side by side
- list selection updates the detail panel without losing list context
- supporting panel may be added when it removes unnecessary navigation depth
- desktop may use a productivity-optimized presentation, while preserving the same canonical state/command/workflow semantics

### Collapse
When width decreases:

```text
3 panels → 2 panels → 1 panel
```

The visible composition changes.
The business state, command meaning, selection identity and task completion semantics do not.

## 6. Desktop-to-mobile transfer rule

A PC feature is considered mobile-ready when all of the following are true:

- the feature belongs to a portable panel
- required commands exist in the panel action model
- no required action exists only in a desktop top toolbar
- no required action depends only on mouse hover, right-click, keyboard shortcut, drag-and-drop, or multi-column visibility
- required context can be supplied by stable entity/work IDs rather than visual adjacency
- the panel can load, save, fail, retry and complete in isolation
- the mobile single-panel route restores the same entity, revision, draft and workflow state
- desktop conveniences are accelerators, not separate business logic

This is the main mechanism for reducing PC → mobile implementation cost.

## 7. No sibling dependency

A portable panel must not depend on a sibling panel being visible for correctness.

Allowed:
- selected entity ID is passed to the detail panel
- supporting panel reads the same stable entity/work context
- web shows list + detail together for speed

Not allowed:
- "Save only exists in the other panel"
- "Required field meaning is visible only in the left panel"
- "Completion requires dragging an item between panels"
- "The user must remember an unshown value from a sibling panel"
- "Mobile omits a command because desktop has it elsewhere"

When a panel needs context from another surface, pass canonical context through C/D bindings and display the minimum necessary context locally.

## 8. Standards floor vs company pattern

External standards establish the floor; company rules establish the operating pattern.

### Accessibility floor

- WCAG 2.2 AA remains the conformance target.
- WCAG 2.2 SC 2.5.8 establishes a minimum pointer target size/spacing floor; AI Core keeps a larger internal touch-control role for frequent actions.
- Native HTML semantics first; custom widgets follow WAI-ARIA/APG role, state, accessible-name and keyboard behavior.
- All required business outcomes must be reachable by touch, pointer, keyboard and assistive technology unless the task intrinsically requires a modality.

### Company interaction floor

- 44px effective touch target minimum for authored controls
- 48px preferred frequent primary action
- top informational / bottom actionable
- 3:7 and 3:3:4 action proportions
- mobile card-list default
- mobile single-panel → web multi-panel composition
- desktop convenience must not fork completion semantics

Reference guidance:
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/ARIA/apg/
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.android.com/develop/adaptive-apps/guides/list-detail
- https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts

## 9. Conformance gates

A task panel cannot be called portable/conformant until it passes:

### Isolation
- panel works as a standalone mobile surface
- status/context are understandable without sibling panes

### Action parity
- same canonical individual task outcomes and completion/failure meaning
- desktop composite/bulk accelerators map to canonical commands rather than inventing new business semantics
- required mobile business outcomes remain reachable through mobile controls
- desktop-only pointer accelerators have an accessible non-pointer alternative on web

### State continuity
- stable entity/work ID
- selection preserved
- draft preserved
- async response bound to the right entity/revision
- collapse/expand does not reset task state

### Input parity
- touch
- pointer
- keyboard
- accessible name / focus
- IME / virtual keyboard

### Responsive composition
- single-panel compact
- two-panel wide where useful
- three-panel wide where useful
- collapse from multi-panel to single-panel without losing state

### Action visibility
- bottom task action remains reachable
- no required task CTA is hidden only in a top toolbar or desktop-only surface

## 10. Design review questions

Before approving a new business screen:

1. What is the portable task panel?
2. What stable entity/work context enters it?
3. What is the single Primary command?
4. What are the Secondary commands?
5. Does the task complete with this panel alone on mobile?
6. Which desktop affordances are only accelerators?
7. What additional panel reduces depth on web?
8. What happens when 3 → 2 → 1 panels collapse?
9. Is any required action pointer/hover/keyboard-only?
10. Are mobile and web using the same C/D command and state contracts?

## 11. One-line rule

> **Design the business task once so mobile can complete it; let web render that same task contract as panels or a productivity-optimized workspace.**

The value of the system is not merely consistent appearance.
It is that PC and mobile reuse the same task semantics, commands and state contracts while allowing different surface structures where productivity requires them.

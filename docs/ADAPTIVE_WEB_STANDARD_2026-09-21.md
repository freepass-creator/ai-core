# Adaptive Web Standard — 2026-09-21

Status: **USER-LOCKED WEB BASELINE**
Decision date: **2026-09-21**
Scope: **AI Core UI/UX / web productivity extension**
Mobile baseline:
- `docs/UI_UX_USER_DECISION_2026-09-21_MOBILE_BASELINE.md`

Related:
- `docs/UI_UX_USER_DECISION_2026-09-21_WEB_PANEL_EXTENSION.md`
- `docs/PORTABLE_TASK_PANEL_STANDARD_2026-09-21.md`

## 0. Core decision

Mobile and web do not have equal rigidity.

### Mobile
Mobile is the strong common baseline.

- top = status / title / context
- body = task content
- bottom = task actions
- 2 actions = 3:7
- 3 actions = 3:3:4
- card list is the default browse/list grammar
- one active task surface at a time

### Web
Web reuses the same business model, state, commands and component semantics, but may change composition and interaction to improve desktop productivity.

> **Same business logic. Same state/command contract. Adaptive desktop presentation.**

Web is allowed to improve density, comparison, bulk work and speed when doing so does not fork the business workflow.

## 1. What must remain the same

Across mobile and web, preserve:

- canonical entity/work IDs
- workflow state and transition meaning
- save/submit/complete semantics
- validation and failure semantics
- permissions/authority
- async ownership and receipts
- draft/conflict/retry semantics
- primary vs secondary command meaning
- accessibility and input equivalence

A different desktop UI is allowed.
A different desktop business rule is not.

## 2. Web default composition

Start from the mobile task surface and compose it for the available width.

Preferred default:

- list/queue panel
- detail/task panel
- optional supporting/history/preview panel

Use multi-panel composition when it reduces navigation depth or preserves context.

However, panel composition is a default, not a mandatory visual shape for every desktop task.

## 3. Desktop productivity exceptions

Web may intentionally diverge from the mobile visual pattern in the following cases.

### 3.1 Data grid / table

Use a table or grid when the task is primarily:

- row/column comparison
- financial/settlement review
- bulk editing
- inventory control
- repeated scanning across many records
- sorting/filtering many entities
- reconciliation
- spreadsheet-like work

Do not force card lists when a relational grid is objectively faster.

The grid must still preserve canonical entity identity, states, commands and mobile-equivalent completion paths.

### 3.2 Multi-select and bulk actions

Web may expose:

- multi-select
- bulk status change
- bulk export
- bulk assignment
- bulk processing

Bulk commands must map to canonical workflow commands and authority checks.
Mobile may expose the same bulk feature differently or omit high-density bulk convenience when the canonical individual workflow remains available.

### 3.3 Inline actions

Web may use inline row/cell actions for speed.

Examples:
- edit
- open detail
- assign
- download
- copy
- retry

Rules:
- inline actions are accelerators
- destructive/irreversible commands retain a clear confirmation boundary
- important task completion cannot exist only on hover
- required commands remain keyboard/touch accessible

### 3.4 Keyboard shortcuts

Keyboard shortcuts are encouraged for repeated desktop work.

Rules:
- shortcut is never the only path
- visible discoverability/help exists where useful
- shortcut invokes the same canonical command as the visible action

### 3.5 Drag-and-drop

Drag-and-drop may accelerate ordering, assignment or movement.

Rules:
- provide an equivalent button/menu/keyboard path
- drag is not the only completion mechanism
- resulting workflow transition is canonical, not UI-local

### 3.6 Desktop utility toolbar

Web may have a utility toolbar for high-frequency non-destructive operations such as:

- search
- filter
- sort
- column control
- density
- refresh
- export
- print
- view mode
- batch selection tools

A toolbar may also mirror a canonical task command when that materially improves desktop productivity, but the command meaning must be identical to the panel/bottom action model.

The web toolbar is not a license to invent a second workflow.

## 4. Primary action policy on web

Mobile:
- one prominent Primary in the active bottom action boundary

Web:
- one dominant Primary per active task context
- the same Primary may be mirrored in a sticky footer, inline context or toolbar only when productivity clearly benefits
- duplicated affordances must invoke the same command and share busy/disabled/result state
- avoid multiple visually competing Primary actions across simultaneously visible panels

## 5. Information density

Mobile optimizes clarity and touch.

Web may increase density.

Allowed:
- tighter rows
- denser tables
- more columns
- persistent filters
- side-by-side comparison
- richer metadata
- compact controls where touch is not the primary modality

Not allowed:
- unreadably small text
- hidden required state
- inconsistent semantics
- desktop-only business fields that change completion meaning without an equivalent mobile path

## 6. Panel independence — softened rule

Portable panels remain the preferred reusable task unit, but desktop panels do not need to duplicate all context.

A panel must receive enough canonical context to operate safely, but web may rely on shared workspace context for efficiency.

Allowed:
- list panel establishes selected customer
- detail panel inherits selected customer ID
- history panel reads the same customer ID
- shared workspace header shows common context once

Required:
- if the detail/task panel is rendered alone on mobile, the minimum missing context is projected into that mobile surface
- correctness must not depend on visually reading an adjacent pane

Thus:
> **No sibling dependency for correctness; shared workspace context is allowed for efficiency.**

## 7. Mobile parity vs interaction parity

Require **business capability parity**, not identical interaction parity.

The same task may be:

- mobile: card → detail → bottom action
- web: grid row → detail panel → shortcut/inline/sticky action

This is conformant when both invoke the same workflow command, authority rule and result semantics.

Do not require every desktop accelerator to have the same visual control on mobile.

## 8. When not to use the multi-panel model

Prefer a dedicated full-width desktop surface when the task is dominated by:

- wide relational tables
- financial reconciliation
- complex scheduling/timeline
- large canvas/diagram
- large document editing
- high-density comparison
- spreadsheet-like bulk manipulation

Even then, mobile should expose an appropriate reduced task flow where meaningful, using the same underlying domain commands.

## 9. Responsive projection

Default progression:

```text
mobile: single active task surface
tablet/medium: 1–2 task surfaces
desktop: 2–3 task surfaces OR a productivity-optimized desktop surface
```

The breakpoint is content-driven, not device-name-driven.

On collapse:
- preserve selection
- preserve draft
- preserve entity/work ID
- preserve workflow state
- preserve unsaved warning/conflict state
- preserve async ownership

## 10. Review decision tree

For every new web screen, ask:

1. Can the mobile task be reused as a panel without hurting desktop productivity?
   - Yes → use multi-panel composition.
   - No → continue.

2. Is the work primarily comparative, relational or bulk?
   - Yes → use grid/table/bulk desktop surface.
   - No → continue.

3. Would inline actions/shortcut/toolbar materially reduce repeated work?
   - Yes → add them as accelerators bound to the same canonical commands.

4. Does the desktop adaptation change workflow meaning, authority or completion semantics?
   - Yes → reject; this is a business-logic fork.
   - No → valid adaptive presentation.

## 11. Conformance model

### Mobile conformance
Stricter visual/interaction grammar:
- top informational
- bottom actions
- action ratios
- card-list default
- touch/safe-area/keyboard rules

### Web conformance
Stricter semantic/productivity grammar:
- same canonical command/state contract
- adaptive composition allowed
- grid/table when justified
- bulk/inline/shortcut/toolbar accelerators allowed
- accessibility alternatives required
- no business-logic fork

## 12. One-line rule

> **Mobile standardizes the task. Web optimizes the workstation. Both run the same business contract.**

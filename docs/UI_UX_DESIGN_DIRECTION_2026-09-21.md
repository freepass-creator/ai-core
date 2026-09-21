# UI/UX Design Direction — 2026-09-21

Status: **USER-LOCKED DESIGN DIRECTION**
Date: **2026-09-21**

## Core direction

### Mobile
Mobile is the strict common baseline.

- top = title / status / context
- main content = task content
- bottom = task actions
- 1 action = Primary 100%
- 2 actions = Secondary 3 : Primary 7
- 3 actions = Secondary 3 : Secondary 3 : Primary 4
- card-list is the default list pattern
- cards use 2–3 information lines with the first line as the primary line
- auxiliary operations such as search/filter/share/sort may use icon actions
- one active task surface at a time
- a mobile task must be completable without relying on desktop-only UI

### Web
Web reuses the same business task/state/command model but optimizes desktop productivity.

Preferred default:
- list/queue panel
- detail/task panel
- optional support/history/preview panel

Allowed when productivity benefits:
- table/data grid
- multi-select
- bulk action
- inline action
- keyboard shortcut
- utility/action toolbar
- drag-and-drop with equivalent accessible path
- side-by-side comparison
- denser information layout

Web is not required to preserve mobile pixels or interaction shape.

## Shared invariant

Mobile and web must share:

- canonical entity/work IDs
- workflow states
- permission/authority
- validation
- save/submit/complete semantics
- retry/conflict/error semantics
- async result ownership
- canonical commands

Presentation may adapt.
Business logic may not fork.

## Portable task principle

Default review question:

> Can the same business task be completed on mobile without changing its canonical state, command, authority, validation, error, or completion semantics?

If yes:
- mobile gets the strict task surface
- web may compose the task as panels or a productivity surface

If no:
- the design is not portable enough and must be reviewed

## Design priority

1. Business-task completeness
2. Clear action hierarchy
3. Mobile usability
4. Web productivity
5. Visual consistency
6. Decorative styling

## One-line rule

> **Mobile standardizes the task. Web optimizes the workstation. Both run the same business contract.**

## Canonical references

- `docs/UI_UX_USER_DECISION_2026-09-21_MOBILE_BASELINE.md`
- `docs/UI_UX_USER_DECISION_2026-09-21_WEB_PANEL_EXTENSION.md`
- `docs/PORTABLE_TASK_PANEL_STANDARD_2026-09-21.md`
- `docs/ADAPTIVE_WEB_STANDARD_2026-09-21.md`
- `docs/SCREEN_DESIGN_STANDARD.md`
- `docs/RESPONSIVE_STANDARD.md`
- `docs/FREEPASS_PRODUCT_UI_PROFILE.md`
- `registry/ui-ux-features.json`
- `design-system/interaction.contract.json`

# UI/UX starter independent review record

## Review basis

- Branch: `codex/ui-ux-new-project-starter`
- Baseline reviewed: `608efbd2cabf1c277cf54476011bad1d1804c039`
- DocsHub sources were read only: `양식/화면.css`, `_화면.html`, `자료디자인.css`, `범용.css`, `문서v2.css`, `비즈니스A4.css`.

The adopted patterns are the existing navigation/tab, filter chip, single outer-card list, bordered table and input, KPI, badge, document hierarchy, report table and note patterns. A4 sizing and print layout are not copied into app controls. DocsHub did not provide a complete mobile bottom action or search control, so those are carried from current FreePass/TeamJPK product patterns rather than claimed as DocsHub patterns.

## Gemini CLI

Status: **UNAVAILABLE**. A read-only review call returned HTTP 403: `This service has been disabled in this account for a violation of the Terms of Service.` This is not a pass.

## Cursor Agent

Initial status: **HOLD**. The review found declarations that were broader than the implemented state behavior, weak tests for those states, no explicit viewport evidence for 360/390/412/1280/1440, and a missing `aria-describedby` link on the invalid phone field.

The follow-up implementation changes the declaration to `data-supported-states`, adds working loading/empty/error/populated preview behavior and `aria-busy`, tests behavior markers instead of only the declaration string, adds explicit viewport rules, and links the phone error through `aria-describedby`. The shared shell duplication and compact one-line example markup remain acceptable starter-template maintenance costs; they do not change the rendered contract.

## Claude Code

Deferred by instruction until 2026-09-22 13:00 KST. The prepared handoff is `UI_UX_STARTER_CLAUDE_HANDOFF_2026-09-22.md`. No Claude result is represented as available.

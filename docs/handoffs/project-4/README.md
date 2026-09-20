# Project 4 — Audit Handoff Index

Status: ACTIVE HANDOFF REGISTRY  
Date: 2026-09-20

Project 4 converts revision-bound audits into **read-only implementation/discovery handoffs**. It does not write consumer repositories, open consumer PRs, deploy, or promote AI Core standards.

## Current packets

| Project | Bound revision | CI | Implementation | Discovery | Packet |
|---|---|---:|---:|---:|---|
| FreePass Admin | `2747ef32e96c550d7dea05c58ee012880cb42dd3` | UNKNOWN | 4 | 0 | `FREEPASS_ADMIN_AUDIT_HANDOFF_2026-09-20.md` |
| FreePass ERP4 | `0cf39d7c639b8583c5d1244cff1ea8ce51a07329` | PASS | 4 | 0 | `FREEPASS_ERP4_AUDIT_HANDOFF_2026-09-20-r5.md` |
| FreePass Estimate | `57a75aaeaa8b91f14c6bc22faa01e745daaa3112` | UNKNOWN | 3 | 1 | `FREEPASS_ESTIMATE_AUDIT_HANDOFF_2026-09-20.md` |
| AIOps | `03dd804962eb4e345b7a34b3e0e97e8bc6d5efe3` | UNKNOWN | 4 | 1 | `AIOPS_AUDIT_HANDOFF_2026-09-20.md` |

## Routing rule

Audit verdicts route as follows:

- `MIGRATION_GAP` → **PROJECT_IMPLEMENTATION**
- `UNKNOWN` → **PROJECT_DISCOVERY**
- `PROJECT_AHEAD` → **CORE_CANDIDATE_REVIEW**
- `RESEARCH_ADVISORY` → **STANDARD_RESEARCH**
- `CORE_MATCH` → **NO_PROJECT_ACTION**

A `CORE_MATCH` axis can still contain Core-level or production-observation limitations. Those limitations do **not** become consumer project remediation merely because they are written in the audit.

## Standard-owner routing

| Axis | Standard owner |
|---|---|
| ui-ux | B / Global UI/UX Standard |
| data-ssot | C / Core Contract Standard |
| engine-adapter | C / Core Contract Standard |
| api-event-error | C / Core Contract Standard |
| workflow | D / Workflow Standard |
| security-audit | Security/Audit Standard |
| qa-observability | QA/Observability Standard |
| build-deploy-governance | Build/Deploy/Governance Standard |

Project 4 only routes evidence. It does not redefine those standards.

## Before implementation

A consumer session must not execute a packet from memory alone.

1. Read the packet.
2. Re-check the packet's `subject revision` against the live repository HEAD.
3. Re-check the AI Core audit standard baseline.
4. If either moved, regenerate the packet with:
   ```bash
   npm run audit:handoff -- <project_id> --format md --require-ready
   ```
5. Only implement tasks under **Project implementation**.
6. Treat **Discovery** as evidence-gathering, not implementation authorization.
7. Do not implement **No-project-action** items merely to make every axis look green.

## Portfolio commands

```bash
npm run audit:portfolio
npm run audit:portfolio:live
npm run audit:handoff -- <project_id> --format md
```

## Hard boundary

- no automatic consumer repository write
- no automatic consumer PR
- no automatic AI Core canonical promotion
- no deploy
- no scheduler enablement
- no production mutation
- stale audit/handoff → HOLD


## Machine issuance records

Each human-readable handoff has a machine JSON issuance record:

- `freepass-admin.handoff.json`
- `freepasserp4-r5.handoff.json` — active\n- `freepasserp4.handoff.json` — superseded history
- `freepass-estimate.handoff.json`
- `aiops.handoff.json`

Do not reconstruct a closure from prose if the JSON issuance record exists.

## Return / closure loop

1. Generate a completion report template from the issued JSON:
   ```bash
   npm run audit:completion-template -- <handoff.json> <result_revision>
   ```
2. Project owner fills each actionable task as `DONE`, `PARTIAL`, `NOT_DONE`, or `NOT_APPLICABLE` with evidence and remaining gaps.
3. Without a successor audit, closure status can be at most `REAUDIT_REQUIRED`.
4. Run a successor v2 audit at the returned result revision.
5. Re-check live project freshness.
6. Build the closure receipt:
   ```bash
   npm run audit:closure -- <handoff.json> <completion.json> --successor <successor-audit.json> --require-closed
   ```
7. Only `CLOSED_VERIFIED` closes the handoff.

A project statement such as "done", a merged PR, or a green CI run does not by itself close an audit finding.


## Closure queue

Current status board:

- `CLOSURE_STATUS_2026-09-20-r2.md`
- `closure-status-2026-09-20-r2.json`

Historical stale-detection snapshot:

- `CLOSURE_STATUS_2026-09-20.md`
- `closure-status-2026-09-20.json`

Use:

```bash
npm run audit:closure-queue
npm run audit:closure-queue -- --live --format md
npm run audit:closure-queue -- --live --require-clean
```

The queue separates **project-reported completion** from **audit closure**. A handoff moving to a new live revision becomes `HANDOFF_STALE` until a fresh audit/handoff supersedes it.

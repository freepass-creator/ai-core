# AI Core Document Domain Architecture v0.1

Status: DESIGN candidate. No production adoption or automatic document generation authority.

## Why this exists
AI Core should treat document work as a first-class domain, not as a weaker form of software development. Document tasks have two different truths:

1. **Content truth** — facts, decisions, legal/business meaning, numbers, recipients, source dates.
2. **Presentation truth** — page size, hierarchy, typography, tables, spacing, pagination, PDF/print behavior, template grammar.

Mixing them causes two common failures: a visually correct document with wrong content, or accurate content rendered outside the agreed document system.

## Ownership model

| Layer | Owner | Responsibility |
|---|---|---|
| Content SSOT | Project / AIOPS / approved source | facts, decisions, current numbers, legal/business meaning |
| Document Design SSOT | DocsHub | A4/PDF layout, template grammar, visual hierarchy, print/render rules |
| Capability Registry + QA | DevCenter | pointers to DocsHub capabilities, reusable profiles, document verification methods |
| Orchestration | AI Core | select sources/template/executor/verification depth and create Work Packet |
| Execution | Chat or Work/Codex | content drafting, rendering, PDF generation, screenshot/print checks |

**Rule:** DevCenter must not duplicate DocsHub templates. It registers and verifies them. DocsHub remains the document design system of record.

## Current DocsHub interpretation
DocsHub currently exposes document types such as general memo, internal/weekly reports, meeting note, decision memo, project plan/progress, strategy/performance/issue reports, proposal, ERP-style contract, and terms. Its design language is A4/PDF-first and borrows clear ERP/SaaS hierarchy without web interaction chrome.

## Proposed capability scopes
- `doc.system.docshub` — root document design system
- `doc.layout.a4`
- `doc.layout.a4.landscape`
- `doc.template.memo.general`
- `doc.template.report.internal`
- `doc.template.report.weekly`
- `doc.template.meeting`
- `doc.template.decision`
- `doc.template.project.plan`
- `doc.template.project.progress`
- `doc.template.strategy`
- `doc.template.performance`
- `doc.template.issue`
- `doc.template.proposal`
- `doc.template.contract.erp`
- `doc.template.contract.terms`
- `doc.verify.content`
- `doc.verify.layout`
- `doc.verify.pagination`
- `doc.verify.pdf`

These are pointers/capabilities, not copied templates.

## Document task pipeline

`Intent → Content Source Resolver → Document Profile Resolver → Context Compiler → Draft → Render → Content Verification → Layout/Pagination Verification → Evidence → Outcome`

### 1. Content Source Resolver
Reads only sources that can change the document's meaning. Examples: current project decision, meeting notes, approved contract terms, official legal source, current financial figure.

### 2. Document Profile Resolver
Uses DevCenter registry to locate the authoritative DocsHub template/profile and pins its revision.

### 3. Context Compiler
Creates two separate packets:
- `content_context`: facts, decisions, evidence, uncertainty.
- `presentation_context`: template ID, A4 orientation, hierarchy, table grammar, branding overlay if explicitly approved.

### 4. Execution routing
- `GPT_DIRECT`: content rewrite, memo/report drafting, small deterministic template fills where no real rendering check is required.
- `WORK_CODEX`: multi-page rendering, PDF generation, browser/print checks, pagination debugging, template/code change, document batch generation.
- `HUMAN_GATE`: court filing, external signature, payment/authority action, final legal filing, or other consequential submission.

### 5. Verification
Content and layout must never share one PASS flag.

Required evidence may include:
- content source revisions
- explicit done_when / audience / purpose
- template revision
- page count / orientation
- overflow/page-break checks
- table clipping checks
- heading hierarchy consistency
- PDF render output
- content accuracy review
- legal/financial source freshness where relevant

Possible states:
`CONTENT_VERIFIED`, `LAYOUT_VERIFIED`, `PDF_VERIFIED`, `REVIEW_REQUIRED`, `PARTIAL`, `HOLD`.

## Transfer Gate
This architecture applies to reports, proposals, contracts, internal memos, meeting/decision records, structured legal documents, and other repeatable business documents.

Do not force DocsHub when the task is exploratory notes, raw brainstorming, chat-only text, or a document type with no stable layout requirement. In those cases content can remain local until a reusable pattern is proven.

## Current defect to fix before adoption
DevCenter currently registers `dev.doc.form` as authoritative at `docshub/양식`, but the current DocsHub repository root contains `README.md`, `app.js`, `index.html`, and `styles.css`; that registered directory does not exist. The registry should be corrected by a reviewed DevCenter change, ideally by replacing the single coarse scope with explicit DocsHub system/template/layout pointers.

## Next validation
Use one real but non-consequential document task as Shadow Pilot:
1. Produce once using ad-hoc document handling.
2. Produce once through AI Core document routing + DocsHub profile.
3. Compare rework count, page/layout defects, content corrections, context loaded, and elapsed time.
4. Promote only if correctness is not reduced and repeat work is measurably lower.

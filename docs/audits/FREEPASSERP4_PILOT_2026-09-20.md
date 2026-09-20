# FreePass ERP4 — AI Core 8-axis Pilot Audit

Status: `READ_ONLY_AUDIT_COMPLETE_WITH_GAPS`

Subject:
- repository: `freepass-creator/freepasserp4`
- main revision: `f01b91c7f68fc2f55d8d642bc3d39f5e07368967`
- exact-revision CI: `CI #35480578527 = PASS`
- branch protection observed: `false`

This is the second project audit under the AI Core Project Audit Readiness Gate. ERP4 source is not modified.

## Result

| Axis | Verdict | Meaning |
|---|---|---|
| UI/UX | MIGRATION_GAP | strong local gates, AI Core consumer conformance not yet landed on main |
| Data / SSOT | CORE_MATCH | explicit owner/writer/source/snapshot semantics and no hidden fallback align |
| Engine / Adapter | CORE_MATCH | pinned writer, shadow pipeline and truthful partial-batch semantics align |
| API / Event / Error | MIGRATION_GAP | large API boundary is not yet bound to the canonical request/error profile |
| Workflow | MIGRATION_GAP | rich lifecycle/recovery semantics exist but D consumer parity is not yet bound |
| Security / Audit | RESEARCH_ADVISORY | ERP4 contains strong reverse-import evidence; Core axis is not canonical |
| QA / Observability | RESEARCH_ADVISORY | checker manifest/known-bad/ops watch are ahead; Core axis is not canonical |
| Build / Deploy / Governance | PROJECT_AHEAD | ERP4 has mechanisms AI Core should generalize |

## The most important finding

ERP4 proves the intended two-way relationship:

```
AI Core canonical contracts
        ↓
ERP4 shadow adoption for SSOT/pipeline
        ↓
project evidence reveals stronger operational mechanisms
        ↓
AI Core reverse-import candidates
```

ERP4 is not simply a migration target. In several operational areas it is a **reference implementation candidate**.

## Reverse-import candidates for AI Core

These are evidence candidates, not automatic promotions.

### 1. Checker manifest

ERP4 does not pretend every script is a CI gate. `scripts/ci-checker-manifest.json` distinguishes:

- required;
- manual with a reason;
- pending/broken/unknown;
- known-bad coverage.

AI Core Governance should eventually express the same concept as a canonical checker manifest rather than inferring quality from the existence of scripts.

### 2. Known-bad / negative control

ERP4 explicitly tests whether a checker can fail for the defect it claims to detect. This is stronger than “the checker is green”.

The reusable idea is:

```
checker
+ known-good
+ known-bad
+ mutation/guard removal
→ prove the detector turns red for the intended reason
```

This belongs in the future AI Core QA profile.

### 3. Production proof separation

ERP4 separates:

```
source revision
→ CI/build
→ deployment
→ production alias/domain
→ observed production revision
```

This is already directionally aligned with AI Core Shared Release Gate and supplies project evidence for stronger machine enforcement.

### 4. Security negative tests

Firebase/Storage rules use allow/deny probes and role-based smoke evidence. Combined with PII-scrub audit practice, this is useful source evidence for the future Security/Audit standard.

### 5. Operational watch reuses domain semantics

`ops-watch` does not reimplement “stuck deal” or settlement-warning rules. It calls the same domain functions as the app. This reduces dashboard-vs-runtime semantic drift and is a strong observability principle to generalize.

## Project-local gaps

### Main protection
Current GitHub observation says `protected=false`. Green CI exists, but green CI that is not required is not a complete enforcement boundary.

### SSOT Source Contract push filter
The current workflow has AI Core shadow files in `pull_request.paths` but not the equivalent `push.paths`. A main-only shadow change can therefore miss this dedicated contract workflow. Audit 80 already identified this and current main still shows the asymmetry.

### API contract adoption
Core request/error/idempotency semantics need a bounded write-API pilot before repository-wide adoption.

### D Workflow adoption
Do not map the entire ERP at once. Pick one bounded lifecycle and prove shadow parity first.

## Production proof limitation

The repository contains a strong `/api/version` and deploy-verification design, but this audit could not independently bind the current public production domain to the audited revision:

- connected Vercel team exists but returns zero projects;
- available fetch paths could not retrieve the public `/api/version` response.

Therefore this report does not claim that the audited main revision is what production currently serves.

## No-touch boundary

No ERP4 application, workflow, rule, data, deployment or branch setting was changed.

Machine-readable source:
`docs/audits/freepasserp4-pilot-2026-09-20.json`.

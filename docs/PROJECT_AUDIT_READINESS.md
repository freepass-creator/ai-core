# Project Audit Readiness Gate v1.1

Status: `READ_ONLY_AUDIT_READY / PARTIAL_CANONICAL_AXES`

AI Core audits eight standard axes. The maturity levels are:

- `MACHINE_ENFORCED` — canonical contract plus repeatable machine gates.
- `CANONICAL_PARTIAL` — canonical baseline and machine-checkable contracts exist, but one or more group-wide enforcement/production proof gaps remain.
- `RESEARCH_ONLY` — advisory evidence only.
- `MISSING` — not safe to score.

## Current maturity

1. UI/UX — MACHINE_ENFORCED
2. Data / SSOT — MACHINE_ENFORCED
3. Engine / Adapter — MACHINE_ENFORCED
4. API / Event / Error — CANONICAL_PARTIAL
5. Workflow — MACHINE_ENFORCED
6. Security / Audit — CANONICAL_PARTIAL
7. QA / Observability — CANONICAL_PARTIAL
8. Build / Deploy / Governance — CANONICAL_PARTIAL

The three formerly research-only axes were promoted after their machine contracts landed in AI Core main and project-side SHADOW evidence landed in AIOps, ERP4, Admin and Estimate.

## Safety boundary

Read-only audits may score MACHINE_ENFORCED and CANONICAL_PARTIAL axes against the exact project revision. Partial axes must preserve their stated gaps and cannot be used to claim production proof, permission, scheduler health or deployment truth that was not observed.

The audit gate does not:
- auto-remediate projects;
- grant runtime authority;
- deploy;
- enable schedules;
- promote HOLD execution readiness;
- infer production from CI.

## Current remaining global blocker

AI Core GitHub Actions has an observed runner-entry failure mode where jobs can terminate with zero executed steps. Until central validators execute reliably at the exact main revision, Security, QA/Observability and Governance remain CANONICAL_PARTIAL rather than MACHINE_ENFORCED.

Run:

```bash
node scripts/project-audit-readiness.mjs
node scripts/project-audit-readiness.mjs --require-pilot
node scripts/project-audit-readiness.mjs --require-full
```

`--require-full` must continue to fail until all eight axes are MACHINE_ENFORCED.

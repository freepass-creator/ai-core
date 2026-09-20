# Project Audit Readiness Gate v1

Status: `READ_ONLY META-GATE / NO AUTO-PROMOTION`

## Purpose

AI Core already has machine contracts for several headquarters standards, while Security/Audit, QA/Observability and parts of Build/Deploy/Governance are still research or partial canon. Without an explicit boundary, a project audit can accidentally turn a research finding into a company-wide PASS/FAIL rule.

This gate records that boundary in one revision-bound registry.

## Current decision

At the recorded baseline revision, AI Core is **ready to pilot read-only audits and gap reports across other applications**. It is **not ready to auto-remediate, auto-promote standards, mutate production, or claim full cross-project conformance**.

The eight audit axes are:

1. UI/UX
2. Data / SSOT
3. Engine / Adapter
4. API / Event / Error
5. Workflow
6. Security / Audit
7. QA / Observability
8. Build / Deploy / Governance

Each axis is one of:

- `MACHINE_ENFORCED` — canonical sources and repeatable machine checks exist.
- `CANONICAL_PARTIAL` — useful canonical material exists, but the full axis is not one machine-enforced profile.
- `RESEARCH_ONLY` — findings may inform an audit, but cannot produce a conformance PASS/FAIL by themselves.
- `MISSING` — the axis is not safe to include even as an advisory pilot until its source is identified.

## Safety boundary

A read-only project audit may:

- inspect the exact project revision;
- map existing implementation to canonical AI Core standards;
- report `CORE_MATCH`, `PROJECT_AHEAD`, `MIGRATION_GAP`, `RESEARCH_ADVISORY`, or `UNKNOWN` findings;
- propose an isolated migration plan;
- preserve project-specific business logic and adapters.

It may not:

- rewrite a project automatically;
- promote research into canonical policy;
- mark an advisory-only axis as conformant;
- merge/deploy/enable schedules or perform external writes;
- claim current CI/branch protection/runtime proof without observing those external facts.

## Run

```bash
node scripts/project-audit-readiness.mjs
node scripts/project-audit-readiness.mjs --require-pilot
node scripts/project-audit-readiness.mjs --require-full
```

`--require-full` intentionally fails until all eight axes are machine-enforced.

## Why this does not overlap the current capability work

This gate does not edit `registry/projects.json`, `registry/capabilities.json`, capability readiness, B/C/D contracts, A-session claim/routing machinery, or any project implementation. It only states which headquarters standards are mature enough to score and which remain advisory.

## Next use

For each registered project, first build/read its revision-bound Project Capsule. Then run a project-specific read-only audit against only the scorable axes. Security/QA/Governance research can be attached as advisory findings until their canonical contracts and validators land.

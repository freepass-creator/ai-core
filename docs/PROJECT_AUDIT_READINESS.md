# Project Audit Readiness Gate v1.2

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

## Project 4 execution boundary

Project 4 owns the audit-readiness and read-only audit planning path. It consumes canonical standards owned elsewhere but does not rewrite them.

The execution sequence is:

1. read `registry/projects.json`;
2. inspect the target repository at its exact default-branch HEAD;
3. build a revision-bound Project Capsule;
4. combine that capsule with `registry/project-audit-readiness.json`;
5. emit an eight-axis audit plan;
6. preserve `CANONICAL_PARTIAL` gaps as hard limitations.

A `CANONICAL_PARTIAL` axis may run its declared machine checks, but `conformance_pass_allowed` remains false until that axis is MACHINE_ENFORCED. This prevents a green local check from being promoted into a group-wide conformance claim.

The Project 4 lane does not edit Security/Audit, QA/Observability, or Build/Deploy/Governance contract semantics. Those standards remain owned by their respective standard lanes.

## Current remaining global blocker

AI Core GitHub Actions has an observed runner-entry failure mode where jobs can terminate with zero executed steps. Until central validators execute reliably at the exact main revision, Security, QA/Observability and Governance remain CANONICAL_PARTIAL rather than MACHINE_ENFORCED.

## Commands

Read the current standard readiness:

```bash
npm run audit:readiness
npm run audit:readiness:pilot
npm run audit:readiness:full
```

`audit:readiness:full` must continue to fail until all eight axes are MACHINE_ENFORCED.

Build a revision-bound audit plan for one registered project:

```bash
npm run audit:plan -- <project_id>
npm run audit:plan -- <project_id> --require-ready
npm run audit:plan -- <project_id> --output artifacts/audit/<project_id>.json
```

The audit-plan command is read-only. It inspects GitHub through the existing Project Capsule inspector, binds the exact subject revision into evidence, and emits no project writes or production mutations.


## Freshness and re-audit queue

Audit results are immutable revision-bound observations. They do not stay current when a project moves.

Check one saved audit against the live GitHub project HEAD:

```bash
npm run audit:freshness -- docs/audits/freepass-admin-pilot-2026-09-20.json
npm run audit:freshness -- docs/audits/freepass-admin-pilot-2026-09-20.json --require-current
```

Freshness states:

- `CURRENT` — audited revision equals the live project revision and project identity matches.
- `STALE` — project identity matches but the live project revision has moved.
- `HOLD` — project/repository/default-branch identity is contradictory.

The project registry is not allowed to overrule a live GitHub observation. If the audit matches live HEAD but `registry/projects.json` lags, the audit may remain `CURRENT` while the report separately emits `PROJECT_REGISTRY_OBSERVATION_STALE`.

Build the stored-audit refresh queue:

```bash
npm run audit:queue
npm run audit:queue -- --require-clean
```

The queue scans saved `ai-core-project-audit-result/v1` JSON files under `docs/audits` and compares them to the current project registry. It is a prioritization layer only:

- `REGISTRY_DRIFT` -> re-audit candidate;
- `REGISTRY_MATCH` -> still requires live `audit:freshness` before being presented as current;
- `HOLD` -> project identity mismatch must be resolved first;
- `UNKNOWN` -> registry evidence is insufficient.

This split prevents a stale registry from certifying a stale audit and prevents a registry match from being mistaken for live proof.


## Audit Result v2 — dual revision binding

New audits must use `ai-core-project-audit-result/v2`.

v2 binds two revisions:

1. `subject_revision` — the exact target project revision audited.
2. `standard_baseline_revision` — the exact AI Core audit-standard baseline used.

It also records `audited_at`.

This means an audit becomes stale when either side moves:

- project code moves -> `SUBJECT_REVISION_MOVED`;
- AI Core audit standard moves -> `STANDARD_BASELINE_MOVED`;
- legacy v1 has no standard baseline -> `STANDARD_BASELINE_UNBOUND_LEGACY`.

Legacy v1 audit results remain readable historical evidence, but they cannot be presented as current under the v2 freshness rules.

Generate a review workbook directly from the live project and current Core baseline:

```bash
npm run audit:workbook -- <project_id>
npm run audit:workbook -- <project_id> --output artifacts/audit/<project_id>-workbook.json
```

The workbook is read-only and defaults all axis verdicts to `UNKNOWN`. It preserves partial-standard gaps and produces a finalization target of `ai-core-project-audit-result/v2`.


## Current v2 pilot portfolio

The four original pilot audits have now been refreshed into v2:

- FreePass Admin
- FreePass ERP4
- FreePass Estimate
- AIOps

Use:

```bash
npm run audit:portfolio
npm run audit:portfolio -- --require-clean
```

The portfolio selects one active audit per project, prefers v2 over legacy v1, and keeps superseded results as history.

Current expected rollup for the four active v2 pilots:

- active projects: 4
- active axis observations: 32
- CORE_MATCH: 15
- MIGRATION_GAP: 15
- UNKNOWN: 2
- exact-head CI PASS: 1 (ERP4 r5)
- exact-head CI UNKNOWN: 3 (Admin, Estimate, AIOps)
- branch protection false: 4
- registry drift requiring live freshness review: ERP4 only

Important project-specific observations:

- Admin exact-head Actions exist but terminate at runner entry with zero repository steps.
- ERP4 exact-head CI executes real steps and passes through production build.
- Estimate main is canonical, but its New-car CI and QA SHADOW push triggers still point to `work/ui-baseline`, leaving exact-main CI unobserved.
- AIOps current main contains Security SHADOW and read-only Insurance evidence adapter work, but required verification remains fragmented and the Insurance workflow has no main-push trigger.

These are audit findings only. Project 4 does not change the consumer projects from this audit lane.


## Live portfolio verification

Use the live portfolio command when the registry may lag or several audited repositories may have moved:

```bash
npm run audit:portfolio:live
npm run audit:portfolio:live -- --require-current
```

This command:

1. selects the active saved audit per project;
2. re-inspects every audited repository at its live default-branch HEAD;
3. applies project-revision and Core-standard freshness together;
4. reports CURRENT / STALE / HOLD per project;
5. keeps registry drift separate from live project freshness;
6. treats inspection failure as HOLD, never CURRENT.

The current four-pilot portfolio includes one useful registry-lag case: ERP4 can remain live-current while the central project registry is stale. A later live ERP4 head automatically makes the saved audit STALE until a newer v2 result supersedes it.


## Revision-bound project handoff

Project 4 can convert one active v2 audit into an implementation/discovery handoff only after live freshness re-check:

```bash
npm run audit:handoff -- <project_id>
npm run audit:handoff -- <project_id> --format md
npm run audit:handoff -- <project_id> --format md --require-ready
```

Routing is verdict-driven:

- `MIGRATION_GAP` -> project implementation
- `UNKNOWN` -> project discovery
- `PROJECT_AHEAD` -> standard-owner candidate review
- `RESEARCH_ADVISORY` -> standard research
- `CORE_MATCH` -> no project remediation

A stale project revision or stale AI Core audit baseline produces `HOLD_STALE_AUDIT` and blocks handoff execution.

Machine contract:

- `contracts/project-audit-handoff.schema.json`

Current human-readable Project 4 handoffs:

- `docs/handoffs/project-4/FREEPASS_ADMIN_AUDIT_HANDOFF_2026-09-20.md`
- `docs/handoffs/project-4/FREEPASS_ERP4_AUDIT_HANDOFF_2026-09-20.md`
- `docs/handoffs/project-4/FREEPASS_ESTIMATE_AUDIT_HANDOFF_2026-09-20.md`
- `docs/handoffs/project-4/AIOPS_AUDIT_HANDOFF_2026-09-20.md`

Project 4 routes work only. Consumer-repository writes, consumer PRs, canonical promotion, deploy and production mutation remain disabled.


## Completion and closure lifecycle

Project 4 does not treat "implementation completed" as "audit closed".

The closure loop is:

```
Handoff Packet
→ Completion Report
→ successor Audit Result v2
→ live freshness check
→ Closure Receipt
```

Commands:

```bash
npm run audit:completion-template -- <handoff.json> <result_revision>
npm run audit:closure -- <handoff.json> <completion.json>
npm run audit:closure -- <handoff.json> <completion.json> --successor <successor-audit.json>
npm run audit:closure -- <handoff.json> <completion.json> --successor <successor-audit.json> --format md --require-closed
```

Closure states:

- `OPEN_PARTIAL` — project work is still partial/not done
- `REAUDIT_REQUIRED` — project reports completion but no successor v2 audit exists
- `REAUDIT_GAPS_REMAIN` — successor audit still reports unresolved handoff axes
- `CLOSED_VERIFIED` — successor v2 audit matches the completion revision, the Core audit baseline is current, live freshness is CURRENT, and all original implementation/discovery axes are audit-closed

Machine contracts:

- `contracts/project-audit-completion-report.schema.json`
- `contracts/project-audit-closure-receipt.schema.json`

Current machine-issued handoffs:

- `docs/handoffs/project-4/freepass-admin.handoff.json`
- `docs/handoffs/project-4/freepasserp4.handoff.json`
- `docs/handoffs/project-4/freepass-estimate.handoff.json`
- `docs/handoffs/project-4/aiops.handoff.json`

A completion report is evidence returned by the project. It is not proof that the audit finding disappeared. Only a successor revision-bound audit can close the finding.


## Closure queue dashboard

The closure queue rolls active handoffs, completion reports and closure receipts into one operational view.

```bash
npm run audit:closure-queue
npm run audit:closure-queue -- --live --format md
```

Machine contract:

- `contracts/project-audit-closure-queue.schema.json`

Current refreshed snapshot:

- `docs/handoffs/project-4/closure-status-2026-09-20-r2.json`
- `docs/handoffs/project-4/CLOSURE_STATUS_2026-09-20-r2.md`

Current state:
- 4 active projects
- 5 handoff records
- 1 superseded ERP4 handoff
- 17 actionable tasks
- 0/17 project-reported complete
- 0/17 audit-closed
- 4 live-current active handoffs

The queue does not infer completion from commits or CI. It waits for a completion report, successor audit and verified closure receipt.


## Operational accountability and SLA

Closure Queue v2 adds task-level operational control without inventing a human-assignee registry.

Each actionable task now carries:

- `accountable_scope = PROJECT:<project_id>`
- standard lane / standard owner
- P1/P2/P3 priority
- aging basis
- age in hours
- warning timestamp
- due timestamp
- SLA state
- overdue hours
- completion state
- audit-closure state

Project 4 local policy:

- `registry/project-audit-ops-policy.json`

Current default:
- P1 warning 48h, SLA 72h
- P2 warning 120h, SLA 168h
- P3 warning 240h, SLA 336h

Current status board:

- `docs/handoffs/project-4/OWNERSHIP_SLA_STATUS_2026-09-20-r3.md`
- `docs/handoffs/project-4/closure-status-2026-09-20-r3.json`

At the 2026-09-20 21:45 KST snapshot:
- P1 15 / P2 2
- ON_TRACK 17
- AT_RISK 0
- OVERDUE 0
- oldest open task age 1.4h
- nearest P1 due 2026-09-23 20:20 KST

A DONE completion report stops the project-work SLA clock and moves the task to `REAUDIT_PENDING`; only verified successor audit closure moves it to `CLOSED`.

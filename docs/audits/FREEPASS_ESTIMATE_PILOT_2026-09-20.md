# FreePass Estimate — AI Core 8-axis Pilot Audit

Status: `READ_ONLY_AUDIT_COMPLETE_WITH_GAPS`

Subject:
- repository: `freepass-creator/freepass-estimate`
- candidate canonical branch: `work/ui-baseline`
- revision: `b526fdc73e812dcb0594d10caf2123bbade1d38b`
- exact-revision CI: `New-car baseline CI #35479102648 = PASS`
- branch protection observed: `false`

Default `main` is only the initialization commit, so this audit explicitly targets PR #1's candidate canonical head rather than pretending main contains the estimator.

## Result

| Axis | Verdict | Meaning |
|---|---|---|
| UI/UX | CORE_MATCH | interaction and accessibility contracts are machine checked |
| Data / SSOT | CORE_MATCH | estimator authority, calculation truth ownership and snapshot provenance are explicit |
| Engine / Adapter | CORE_MATCH | provider-neutral contracts, server adapters and fail-closed routing align strongly |
| API / Event / Error | CORE_MATCH | stable errors, retryability, public/internal detail separation align for the applicable subset |
| Workflow | UNKNOWN | no D-owned business workflow was established; UI navigation is not promoted into D artificially |
| Security / Audit | RESEARCH_ADVISORY | provider privacy/credential boundaries are good evidence; Core axis is not canonical |
| QA / Observability | RESEARCH_ADVISORY | exact-revision verification is strong; production observability is absent |
| Build / Deploy / Governance | MIGRATION_GAP | candidate is verified but not promoted to main or production |

## Most important positive finding

FreePass Estimate is a strong example of the architecture AI Core wants projects to use:

```
shared UI
  ↓
semantic QuoteRequest
  ↓
configured authoritative provider
  ↓
Adapter translation
  ↓
normalized QuoteResult
  ↓
execution evidence
```

A provider may own calculation truth without owning the shared estimator product.

That distinction prevents a partner-specific Excel/API from becoming accidental group SSOT.

## Fail-closed provider behavior

The audited branch proves:

- timeout = distinct code;
- unavailable = distinct code;
- invalid upstream response = distinct code;
- unregistered adapter = distinct code;
- automatic fallback = none;
- automatic retry = none;
- retryability is explicit;
- upstream secret/error detail is not copied into public response or logs.

The NEXO hydrogen cases follow the same principle: unknown cost policy stops the calculation instead of fabricating a plausible number.

## Reverse-import candidate

### Contract ↔ checker freshness

`verification-manifest.json` binds semantic contract IDs to the checker responsible for proving them.

This is stronger than only having a CI file because it makes stale validation discoverable when a contract changes but its checker does not.

This should be considered evidence for the future AI Core QA/Governance standard, but it is not automatically promoted by this audit.

## Central observation drift

AI Core currently knows:

- main: initialization revision;
- work branch: older verified revision `8df0fdfe...`.

The actual candidate head is now:

`b526fdc73e812dcb0594d10caf2123bbade1d38b`

with exact-revision green CI.

The central registry should be refreshed after concurrent Core work settles; this audit does not edit `registry/projects.json`.

## Why Workflow is UNKNOWN instead of GAP

The estimator does have stateful behavior, but:

- mobile step navigation belongs to UI/UX interaction semantics;
- quote execution `SUCCEEDED/HOLD/FAILED` belongs to execution result semantics.

No separate D-owned business lifecycle was proven here.

Creating a fake D workflow only to make all eight boxes green would reduce architectural quality.

## Promotion blockers

1. candidate work branch is not default main;
2. branch is unprotected;
3. production project/deployment is not observable;
4. live `/api/version` cannot be checked;
5. central AI Core registry points to an older branch revision;
6. second independent external provider has not yet validated the same provider contract.

## No-touch boundary

No FreePass Estimate source, provider configuration, pricing policy, CI, branch, deployment or calculation behavior was modified.

Machine-readable source:
`docs/audits/freepass-estimate-pilot-2026-09-20.json`.

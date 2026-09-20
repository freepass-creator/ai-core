# Capability Readiness Gate v1.1

This read-only gate reports machine-detectable gaps before a capability is reviewed for activation.

Project Registry v1.1 separates two axes:
- `repository_lifecycle_status` — authority/lifecycle;
- `execution_readiness_status` — whether AI Core may execute the project runtime.

The gate uses **execution readiness** for runtime admission. Lifecycle does not implicitly grant execution. A REFERENCE repository may remain executable when explicitly ACTIVE for execution (for example a temporary reference runtime), but the gate reports that as an advisory. RETIRE is always fail-closed.

The gate never mutates capability/project state and always returns `promotion_allowed:false`.

Checks include project registration, execution readiness, lifecycle retirement, revision binding, adapter binding, local path/command availability, approval boundaries, external-mutation scopes and receipt advisories.

Run:

```bash
node scripts/capability-readiness.mjs
node scripts/capability-readiness.mjs --hold-only
node scripts/capability-readiness.mjs --fail-on-active-gap
```

A result may identify a HOLD capability as `REVIEW_REQUIRED`, but only a separately authorized registry change may activate it.

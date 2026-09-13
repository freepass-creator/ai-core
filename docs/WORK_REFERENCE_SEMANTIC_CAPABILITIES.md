# Work Reference — Semantic Capability Fabric

Status: FORWARD REFERENCE / RESEARCH_CANDIDATE

Read this only when the task involves capability reuse, DevCenter function warehouse, Engine/Adapter reuse, duplicate implementation avoidance, or cross-project composition.

## Do not widen the current task automatically

This research does not replace the current Work Packet, project SSOT, DevCenter registry, or adopted Engine/Adapter rules.

## Work question

Before writing a new reusable function/module/adapter, ask:

1. Does DevCenter or the target repository already contain a candidate?
2. Is it only a raw symbol/static discovery, or does it have enough semantic contract/evidence to reuse?
3. Are input/output meaning, units, null semantics, errors, side effects, and invariants compatible?
4. If meaning matches but representation/provider differs, can an Adapter solve the mismatch without changing business meaning?
5. If evidence is weak or semantics are inferred, return HOLD rather than presenting reuse as proven.

## Minimal return when a capability candidate is considered

```json
{
  "capability_candidate": "",
  "decision": "REUSE_EXACT | REUSE_WITH_ADAPTER | COMPOSE | EXTEND_CANDIDATE | NEW_REQUIRED | HOLD_*",
  "source_revision": "",
  "semantic_basis": [],
  "evidence_refs": [],
  "unknowns": [],
  "reason": ""
}
```

## Important

- Static function count is not capability count.
- Name similarity is not semantic equivalence.
- AI-generated descriptions remain hypotheses until grounded.
- External-write adapters need explicit idempotency and authority boundaries.
- Reuse should reduce implementation delta, not create a second SSOT.
- Prefer demand-first promotion of a few relevant symbols over cataloging all functions.

If adopted later, this should extend DevCenter capability metadata rather than create a parallel permanent registry inside AI Core.
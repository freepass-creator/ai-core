# A Session Evidence Registry v1

Status: **RESEARCH ROUTING INDEX / NOT CANONICAL**

A-session now separates two machine indexes:

1. `a-session-repo-coverage.v1.json` — which repository revision was inspected.
2. `a-session-evidence-registry.v1.json` — what material conclusion was reached from that evidence.

The evidence registry makes the A decision model explicit:

- `PROJECT_GT_CORE` — reusable project implementation is ahead of current Core treatment. A generalizes and routes; it does not edit B/C/D canon.
- `CORE_GT_PROJECT` — Core already has the stronger contract. A records a migration/backport gap, breaking impact and verification needs.
- `DIFFERENT` — evidence reveals a distinct problem/shape but does not justify declaring either side ahead.

Every material finding must bind:

- exact repository revision;
- evidence type (code, schema, test, CI, deployment, runtime or docs);
- evidence maturity;
- B/C/D route;
- current status;
- append-style state history.

For `CORE_GT_PROJECT`, machine validation requires migration target, breaking impact and verification needs.

For `DIFFERENT`, machine validation requires an explicit reason why the evidence is neither a promotion nor a backport.

This registry does not grant canonical authority. B/C/D owners remain the only sessions that can modify their canonical standards.

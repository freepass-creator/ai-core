# AI Core Security / Audit P0 — Canonical Partial Baseline

Status: `CANONICAL_PARTIAL / NO EXECUTION AUTHORITY`

This candidate exists because four read-only project audits show that Security/Audit is the largest remaining Core maturity gap while multiple projects already contain reusable evidence.

The shared contracts/policy are now a canonical partial baseline. They do not grant runtime permission or replace project authentication/authorization adapters.

## Sources generalized

### AIOps
- exact-subject approval;
- plan/template/target digest binding;
- command binding;
- TTL;
- separation of duties;
- BLOCK precedence;
- emergency override by risk class;
- protected non-bypass;
- append-only + cross-ledger tamper evidence.

### ERP4
- allow/deny security tests;
- role-account smoke;
- PII scrub;
- candidate vs production rule separation;
- security release gate.

### FreePass Estimate
- credentials server-side;
- upstream diagnostic secrecy;
- public/internal error separation.

### FreePass Admin
- Actor/Port boundary;
- production auth adapter intentionally unbound rather than fabricated.

## P0 machine contracts

### 1. Authorization context

`security-authz-context/v1`

Separates:
- authentication subject;
- business principal;
- role;
- organization;
- scopes;
- action;
- resource ownership;
- action risk class.

UI visibility is never the final enforcement boundary.

### 2. Action policy

`security-action-policy/v1`

Common risk classes:

1. READ_ONLY
2. LOCAL_MUTATION
3. REVERSIBLE_EXTERNAL_MUTATION
4. PRIVILEGED_MUTATION
5. IRREVERSIBLE_EXTERNAL_ACTION

A policy declares:
- external effect;
- reversibility;
- independent reviewer count;
- human approval;
- emergency rule;
- audit criticality.

The risk class is about the action, not whether the implementation happens to use Drive, Firebase, HTTP or another technology.

### 3. Exact-subject approval bundle

`security-approval-bundle/v1`

Approval is bound to:
- subject revision;
- plan digest;
- target digest;
- optional artifact digest;
- optional command digest;
- target count.

Changing the subject invalidates the previous approval.

Semantic enforcement additionally checks:
- live TTL;
- separation of duties;
- BLOCK veto;
- owner approval;
- emergency eligibility;
- command binding where required.

### 4. Security audit record

`security-audit-record/v1`

Records:
- actor;
- action;
- resource;
- result;
- correlation;
- subject revision;
- changed field names;
- redaction profile;
- evidence references;
- audit criticality;
- optional integrity chain.

The contract explicitly requires `sensitive_values_embedded=false`.

Audit logs should say that a sensitive field changed, not copy passwords, tokens, resident numbers, bank account values, raw signatures or private documents into the audit stream.

## Canonical partial action policies

`registry/security-action-policies.candidate.json` (historical filename retained; registry status is `CANONICAL_PARTIAL`)

The candidate deliberately keeps policy data separate from code.

Important default:
- reversible external mutation may support a tightly bound short emergency path;
- privileged and irreversible external actions do not.

This is the common baseline for policy shape and approval semantics; concrete action authority remains project-owned.

## Machine validation

```bash
node scripts/validate-security-audit-p0.mjs
node --test test/security-audit-p0.test.mjs
```

The test suite includes:
- subject digest mismatch;
- self-review rejection;
- BLOCK veto;
- standard review + owner approval;
- command-bound short emergency path;
- protected emergency rejection.

## Remaining gates to MACHINE_ENFORCED

The baseline remains CANONICAL_PARTIAL until:

1. schemas + semantic tests execute in AI Core CI;
2. AIOps approval behavior can be represented without semantic loss;
3. ERP4 security negative-test profile can consume the policy model;
4. at least one project without AIOps lineage consumes the approval/authz contracts;
5. sensitive audit redaction has a consumer test;
6. branch/check enforcement is stable;
7. canonical owner explicitly promotes the profile.

## Explicit non-goals

This candidate does not:
- implement authentication providers;
- replace Firebase/OAuth/provider SDKs;
- grant permissions;
- create a bypass;
- modify project rules;
- approve any real action;
- read or copy private audit ledgers.

## Promotion evidence — 2026-09-20

- AIOps SHADOW parity merged to main at `dd47662ec6e92a689cbc4b8a50504e6013845ff9`.
- Exact-subject digest continuity, separation of duties, BLOCK precedence, bounded emergency path and protected non-bypass are mapped without transferring runtime authority.
- AIOps required workflow now includes the Security SHADOW test and fixes the previous push-path omission for finance/security coverage.
- Central AI Core Actions still has a runner-entry issue; this prevents calling the axis MACHINE_ENFORCED today.

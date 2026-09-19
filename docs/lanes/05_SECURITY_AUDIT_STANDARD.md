# L5 — Security / Authority / Audit Standard

## Mission
Make authority boundaries explicit and machine-checkable across AI Core and project integrations.

## Scope
- authentication boundary
- user/service/AI actor identity
- RBAC/ABAC/scopes
- least privilege
- project/tenant/data isolation
- approval references
- external/irreversible action gates
- secret/config handling
- PII classification/minimization
- logging redaction
- audit event contract
- retention/deletion policy
- incident and emergency authority boundaries
- supply-chain/dependency controls

## Reuse
- existing approval-boundary rules
- emergency runbook/incident template
- capability walls/scopes
- development-form external-write authority fields

## Required artifacts
- authority model
- scope taxonomy
- sensitive-data handling matrix
- audit log minimum fields
- irreversible-action checklist
- security conformance tests

## Definition of done
A reviewer can answer “who/what may perform this action, on which target, with what evidence, and how it is audited” from machine-readable policy rather than prose inference.

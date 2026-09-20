# AI Core Security / Audit — Machine Enforcement Lane

Status: `ACTIVE FOLLOW-UP / CURRENT=CANONICAL_PARTIAL / TARGET=MACHINE_ENFORCED`

## Why this lane exists

Security/Audit has already been promoted to `CANONICAL_PARTIAL` on AI Core main.

This lane starts **after** that promotion. It does not redo the candidate design or the canonical-partial decision.

Its sole purpose is to make the remaining seven promotion conditions machine-readable and fail-closed so the axis cannot be called `MACHINE_ENFORCED` from chat confidence, a merged document, or partial project evidence.

## Non-overlap boundary

This lane does not own:

- A — repository audit, evidence collection, routing or review allocation;
- B — UI/UX contracts or consumer conformance;
- C — Data/SSOT, Engine/Adapter, API/Event/Error contracts;
- D — Workflow/state/retry/compensation contracts;
- the already-completed CANONICAL_PARTIAL promotion.

It consumes evidence produced by those areas only as references.

## Source of truth

- Canonical partial baseline: `docs/SECURITY_AUDIT_P0_CANDIDATE.md`
- Evidence registry: `registry/security-audit-machine-enforcement.json`
- Gate schema: `contracts/security-machine-enforcement-gate.schema.json`
- Semantic engine: `src/security/machine-enforcement-gate.mjs`
- Validator: `scripts/validate-security-audit-machine-enforcement.mjs`
- Tests: `test/security-audit-machine-enforcement.test.mjs`

## Commands

```bash
npm run security:validate
npm run security:machine:validate
npm run security:machine:ready
```

- `security:validate` checks the existing canonical-partial Security contracts.
- `security:machine:validate` checks that the enforcement evidence ledger is structurally and semantically valid even while HOLD.
- `security:machine:ready` is fail-closed and must exit non-zero until every required gate is PASS and the ledger is explicitly marked READY.

## Current evidence

PASS:

- AIOps semantic representation / SHADOW parity.

HOLD or pending:

- exact-main AI Core CI execution;
- ERP4 Security policy consumption;
- independent non-AIOps consumer;
- consumer-side sensitive audit redaction test;
- stable branch/check enforcement;
- explicit canonical-owner promotion to MACHINE_ENFORCED.

## Rule

`CANONICAL_PARTIAL` means the shared policy shape is canonical. It does **not** mean execution authority is universal or that the axis is machine-enforced across the company.

The axis may become `MACHINE_ENFORCED` only when:

1. all seven gates are PASS;
2. each PASS has explicit evidence;
3. the ledger is marked READY;
4. promotion is reviewed against the exact AI Core revision;
5. project runtime authority remains with project-specific authentication/authorization adapters.

Until then, the correct state is `CANONICAL_PARTIAL`.

# AI Core Security / Audit Promotion Gate

Status: `ACTIVE FOLLOW-UP / NON-CANONICAL / NO PRODUCTION AUTHORITY`

## Ownership

This lane owns the promotion decision machinery for the Security/Audit P0 candidate already merged to `main`.

It does **not** take ownership from:

- A — repository audit, evidence collection and routing;
- B — UI/UX standards and consumer conformance;
- C — Core data/engine/API/event/error contracts;
- D — workflow/state/retry/compensation contracts.

It also does not redesign the Security candidate contracts unless a promotion gate exposes a concrete semantic defect.

## Purpose

The existing Security/Audit P0 candidate is intentionally non-canonical. Its own promotion section requires seven conditions before promotion.

This lane turns those prose conditions into a machine-readable, fail-closed promotion gate so that chat conclusions, partial project evidence, or a merged candidate branch cannot silently become company-wide authority.

## Source of truth

- Candidate: `docs/SECURITY_AUDIT_P0_CANDIDATE.md`
- Evidence registry: `registry/security-audit-promotion.json`
- Gate schema: `contracts/security-promotion-gate.schema.json`
- Semantic engine: `src/security/promotion-gate.mjs`
- Validator: `scripts/validate-security-audit-promotion.mjs`
- Tests: `test/security-audit-promotion.test.mjs`

## Commands

```bash
npm run security:validate
npm run security:promotion:validate
npm run security:promotion:ready
```

`security:promotion:validate` checks that the registry is structurally and semantically valid even while the lane is on HOLD.

`security:promotion:ready` is fail-closed. It exits non-zero until every required gate is PASS and the registry is explicitly marked READY.

## Current state

The current registry intentionally stays `HOLD`.

Already represented:

- AIOps approval semantics are represented by candidate contracts and semantic tests.

Still required:

- current-main machine execution proof;
- ERP4 policy consumption proof;
- an independent non-AIOps consumer;
- a consumer-side sensitive-audit-redaction test;
- observed branch/check enforcement;
- explicit canonical-owner authorization.

## Promotion rule

No project, AI session or automation may infer canonical Security/Audit authority from the existence of candidate schemas alone.

Promotion is allowed only when:

1. every gate is `PASS`;
2. every PASS has evidence;
3. the registry is explicitly changed to `READY`;
4. the change is reviewed against the exact revision being promoted.

Until then the Security/Audit axis remains advisory/candidate and production permission semantics stay project-owned.

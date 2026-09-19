# A Session HOLD — Chakhandeal Consent Grant Is Design, Not Implemented Evidence

상태: **DESIGN_IMPLEMENTATION_GAP / HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: Chakhandeal
- Repository: `freepass-creator/chakhandeal`
- Source path:
  - `docs/PHASE4-BRIEF.md`
  - `lib/server/authz.js`
  - `lib/server/consent.js`
  - `tests/phase2-authz.test.js`
  - `tests/phase3-crypto.test.js`
  - `tests/econtract-scaffold.test.js`
- Revision:
  - observed repository head: `f6b348051eb468f8944cb70dbab146919838caf3`
  - authz blob: `834f7d897ee9a69198f4c93aaf18281439635cf3`
  - Phase 4 brief blob: `bc7d1479089a0bc9d5b6c4c63eefe6d63dc1fdc6`
- Category: Core Contract / Authorization / Consent / Evidence

## Verified implementation that does exist

The project has real tested mechanisms for:

- signed identity token with expiry;
- verified subject binding to a deterministic match key;
- ignoring/inhibiting body-supplied subject identity in favor of the verified token;
- owner-company or data-subject read authorization;
- identity mismatch / access denial audit;
- PII vault separation and pseudonymized transaction storage;
- contract template selection and contract-version metadata preserved with completed consent;
- required read-through before e-contract consent completion.

These are concrete code/test evidence.

## Design that does NOT yet count as implementation

`docs/PHASE4-BRIEF.md` specifies a first-class `consent_grants` model with:

- grantee company;
- field whitelist;
- start/expiry;
- max uses / used count;
- revocation;
- reshare/download policy;
- transactional grant consumption;
- audit on each view.

But current `lib/server/authz.js` still contains:

`hasValidConsentGrant(_actor, _record) { return false; }`

and labels it a Phase 4 stub.

The repository tree does not contain the planned `tests/phase4-grant.test.js`.

Therefore Phase 4 is an implementation plan/brief, not project-verified behavior.

## Classification

- Current identity/subject binding: real project evidence.
- Granular consent-grant authorization: **NOT IMPLEMENTED / HOLD**.
- No B/C/D promotion is made from the Phase 4 design alone.

## Why this matters to A session

A session must not promote:

`design document exists → project implements it → AI Core should learn it`.

The correct evidence chain is:

`brief/spec → code → tests → runtime/deploy evidence when required`.

This project is an explicit counterexample that protects the promotion pipeline from design-only false positives.

## Recommended action

- Keep Phase 4 as a project migration/implementation candidate.
- If the project resumes:
  1. implement `consent_grants`;
  2. replace the authz stub;
  3. add the planned field/time/use/revoke tests;
  4. verify concurrent `usedCount` enforcement;
  5. only then reconsider reverse import into C's authorization/consent contracts.

## Status

`HOLD / IMPLEMENTATION_REQUIRED / NO_PROMOTION`

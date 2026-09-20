# A Session Repository Audit — 2026-09-20T12:13Z

## Scope

Evidence-only A-session delta audit. This record does **not** modify B/C/D canonical standards.

Baseline:
- AI Core A evidence head before this audit: `9b520f3e1f79b54813159b4deb0f020d8ca64bde`
- Previous audited FreePass ERP4 revision: `8e4bcb7a484f1ae024f05297923be100d8a21628`
- A `registry/projects.json` observed revision for `freepasserp4`: `06e18ff8a7e564076e62679b657f0b3734a042ba`

Observed current FreePass ERP4 head:
- `0cf39d7c639b8583c5d1244cff1ea8ce51a07329`
- exact-head CI run: `35509593784` — success
- Vercel commit deployment status context: success; this is deployment/build evidence, **not** production runtime behavior proof.

Evidence:
- https://github.com/freepass-creator/freepasserp4/commit/0cf39d7c639b8583c5d1244cff1ea8ce51a07329
- https://github.com/freepass-creator/freepasserp4/commit/173824906e79e254a4e864a013d64653a99a13f6
- https://github.com/freepass-creator/freepasserp4/commit/1b31af44fac362085649c13d155e4e0c089ae929
- https://github.com/freepass-creator/freepasserp4/actions/runs/35509593784

## Classification 1 — Core > Project

### Delta

Commit `1b31af44fac362085649c13d155e4e0c089ae929` closes a material portion of the previously recorded Core C optimistic-concurrency migration gap.

First-party settlement UIs now round-trip the Core-compatible resource revision:

1. API read exposes `resource_revision` derived from Firestore `DocumentSnapshot.updateTime`.
2. Settlement Board and Intake Station keep that revision in edit state.
3. First-party update requests send `expected_revision`.
4. The API compares expected/current revision transactionally.
5. Stale writes return HTTP `409 VERSION_MISMATCH`.
6. First-party UI handles the stale response with `TOAST_AND_RELOAD`, reloading the authoritative record rather than silently overwriting it.
7. Successful updates refresh the local revision from the server response.

The source-side shadow manifest remains explicitly `SHADOW_WITH_GAPS`; runtime authority remains FreePass ERP4 and Core cutover is not authorized.

### Evidence-level change

This is stronger than the prior API-only adoption evidence because the first-party UI write path now carries the revision token end-to-end.

Exact-head CI `35509593784` succeeded at `0cf39d7c639b8583c5d1244cff1ea8ce51a07329`. The successful job includes:
- AI Core settlement API shadow checker
- changed-file lint
- production build

The shadow checker now asserts that both first-party UI entry points send `expected_revision`, handle 409 stale conflicts, and retain the compatibility guard against an unauthorized full Core cutover.

### Remaining migration/backport gap

Status: `SHADOW_WITH_GAPS`.

Remaining gaps:
- `request_id`: missing
- `correlation_id`: missing
- legacy/external callers may still omit `expected_revision`
- public error response is not yet a full `core.error.v1` / RFC 9457 projection
- public success response is not yet a full `core.result.v1` projection
- no exact-revision production/runtime observation yet proving a real first-party `VERSION_MISMATCH` conflict and recovery path

Breaking impact:
- making `expected_revision` mandatory immediately can break legacy or external callers that use the compatibility path
- replacing the public success/error envelope in one step can break existing consumers

Verification required before further promotion:
1. Real or controlled two-client stale-write E2E through first-party UI.
2. Observe `VERSION_MISMATCH` and verify authoritative reload with no lost-write overwrite.
3. Enumerate all settlement mutation entry points and confirm each is revision-guarded or deliberately legacy-compatible.
4. Add `request_id` and `correlation_id` propagation.
5. Introduce Core error/result projections behind a compatibility boundary before changing public envelopes.
6. Obtain exact-revision deployment/runtime evidence after the above changes.

No new C canonical candidate is created here: this is adoption/backport of the existing Core revision contract, not a Project > Core pattern.

## Classification 2 — Different

### FreePass Data logical project identity

Commits `173824906e79e254a4e864a013d64653a99a13f6` and `0cf39d7c639b8583c5d1244cff1ea8ce51a07329` introduce and then formalize a logical project identity named **FreePass Data** inside `freepass-creator/freepasserp4`.

The handoff states that FreePass Data owns common reference/master data concerns such as vehicle, insurance, option, and partner reference data, with Firestore `catalog/*` as canonical persistence. It explicitly excludes quote/workflow ownership and treats Sheet/import/API inputs as ingestion/feed rather than canonical persistence. RTDB is documented as retired for this project form.

This is not merely a repository rename. The same repository still contains ERP4 application/runtime responsibilities while declaring a distinct logical project mission for FreePass Data.

### A-session contradiction / stale revision

Current A `registry/projects.json` still represents the repository as one project row named `Freepass ERP4` and observes revision `06e18ff8a7e564076e62679b657f0b3734a042ba`. Actual repository head is `0cf39d7c639b8583c5d1244cff1ea8ce51a07329`.

Action required:
- re-observe `freepasserp4` at the exact current revision
- do **not** blindly rename the existing ERP4 registry entry
- model or candidate-model `FreePass Data` as a distinct logical project capsule / project alias tied to the same repository, preserving the ERP4 runtime/app identity separately
- verify lifecycle, ownership, SSOT boundaries, and consumer dependencies before any registry promotion

This is classified `Different` because the issue is project-identity / registry modeling, not superiority of Project or Core implementation.

## Routing

No new `Project > Core` candidate was found in this delta.

Therefore:
- B UI/UX candidate routing: none
- C Core Contract candidate routing: none
- D Workflow candidate routing: none

B/C/D canonical standards were not changed.

## A-session follow-up

1. Refresh A revision evidence for `freepasserp4` to exact head `0cf39d7c639b8583c5d1244cff1ea8ce51a07329` using the normal re-observation/evidence flow.
2. Track the narrowed Core > Project settlement migration gap until real stale-conflict runtime evidence exists.
3. Add a project-registry candidate/capsule treatment for `FreePass Data` rather than collapsing the ERP4 application and data-platform identities into one name.
4. Keep the current shadow compatibility path until legacy/external caller impact is measured.

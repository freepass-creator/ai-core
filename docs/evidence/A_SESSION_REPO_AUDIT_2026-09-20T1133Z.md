# A Session Repo Audit Delta Evidence — 2026-09-20T11:33Z

Scope: cross-repository A-session evidence audit only. This record does **not** modify B/C/D canonical standards.

Baseline AI Core revision inspected: `9728f9974b4a087c5f610a8c5f9cfb2bcdff3f6f`.

Latest A project-registry evidence inspected: `registry/projects.json` on that baseline.

## A1 — FreePass ERP4 settlement API Core adoption advanced

A-session recorded ERP4 revision: `freepass-creator/freepasserp4@06e18ff52e14ec4e3670361d89a873913be4f51b`.

Current inspected ERP4 head: `freepass-creator/freepasserp4@8e4bcb7a484f1ae024f05297923be100d8a21628`.

Revision relation: current head is 7 commits ahead of the A-session recorded revision.

Classification: `Core > Project`.

Why:

- AI Core already defines `expected_revision` in `core-request-context/v1`.
- AI Core already defines `VERSION_MISMATCH` as a non-retryable USER error with HTTP 409.
- ERP4 is adopting those existing C/Core Contract semantics in a bounded settlement write path rather than introducing a new canonical contract.

Material project delta:

- Added a revision-pinned SHADOW contract for `settlement.intake.create`.
- Added a second SHADOW contract for `settlement.intake.update`.
- Added `resource_revision` exposure on settlement reads and successful guarded updates.
- Added opt-in `expected_revision` on updates.
- Uses Firestore `DocumentSnapshot.updateTime` as an opaque resource revision token.
- When `expected_revision` is supplied, update runs transactionally, compares before write, and returns HTTP 409 / `VERSION_MISMATCH` on stale state.
- Legacy clients that omit `expected_revision` remain on the existing unguarded update path.
- Added a fail-closed source checker that verifies the SHADOW manifests and route implementation.
- CI and `SSOT Source Contract` both passed on exact head `8e4bcb7a484f1ae024f05297923be100d8a21628`; CI includes the AI Core API SHADOW checker and production build.

No Project > Core candidate was found in this delta, so nothing is routed to B/C/D for canonicalization. The Firestore updateTime token is a project adapter binding of the existing Core revision contract, not a new C standard.

### Remaining migration/backport gap

Current state remains `SHADOW_WITH_GAPS`, not Core-contract cutover.

Open gaps evidenced by the project contracts:

- `request_id` is not accepted/emitted.
- `correlation_id` is not accepted/emitted.
- Create path does not accept a Core idempotency key or bind `semantic_payload_digest`.
- Legacy update clients do not send `expected_revision`; normal user edits therefore remain last-write-wins unless the UI is upgraded.
- Errors are not fully emitted as `core.error.v1` / RFC 9457-compatible envelopes.
- Success is not fully emitted as `core.result.v1`.
- Runtime authority remains ERP4 and Core cutover is explicitly unauthorized.

Breaking impact if backported incorrectly:

- Making `expected_revision` mandatory before all edit clients preserve `resource_revision` would break legacy settlement edits.
- Switching error/result envelopes in place would break callers that consume the current project-native JSON shapes.
- Enabling optimistic concurrency in the API without UI stale-write handling would surface 409 conflicts that the current UI may not recover from.
- Replacing project runtime authority with Core before request/correlation/error/result parity would create an incomplete contract cutover.

Verification required before promotion beyond SHADOW:

1. Wire settlement edit UI to retain GET/success `resource_revision` and send it as `expected_revision`.
2. Prove two-client stale-write behavior end-to-end: first write succeeds, second stale write returns `VERSION_MISMATCH`, refresh/retry succeeds.
3. Verify every settlement update entry point either uses the revision guard or is explicitly excluded.
4. Add/propagate `request_id` and `correlation_id`.
5. Bind create idempotency to Core request context while preserving deterministic receipt identity.
6. Verify stable Core error/result projections before any public envelope cutover.
7. Obtain exact-revision deployment/runtime evidence; current exact-head evidence is CI/source verification, not production-runtime proof.

## A2 — Current A project registry is stale and time-inconsistent

Classification: `Different` / A-evidence integrity.

Evidence:

- Current `registry/projects.json` declares top-level `observed_at = 2026-09-20T11:25:00Z`.
- The latest commit that changed that file is `9728f9974b4a087c5f610a8c5f9cfb2bcdff3f6f`, created at `2026-09-20T11:15:55Z`; therefore the committed snapshot claims an observation time later than its own immutable commit time.
- The same registry records AI Core itself at `c72e081a6c6d0f9090695c724da69387e4b0356b` observed on 2026-09-17, while actual AI Core main is `9728f9974b4a087c5f610a8c5f9cfb2bcdff3f6f`.
- It records ERP4 at `06e18ff52e14ec4e3670361d89a873913be4f51b` observed at `2026-09-20T11:10:00Z`, even though ERP4 had already advanced to `0b3f9d13ef12a86a6e83ac3c95d2c6985c08226c` by `11:16:43Z`, before the registry's claimed top-level `11:25Z` observation time; ERP4 is now at `8e4bcb7a484f1ae024f05297923be100d8a21628`.

Action required:

- Re-issue the A project registry from actual repository heads using the real collection time.
- Do not treat the current top-level `observed_at` as freshness/completion evidence.
- Refresh the AI Core self-head and ERP4 head before closing repo-rescan work for these subjects.

## A3 — AI Core exact-head consistency evidence remains red

Classification: `Different` / verification evidence.

At exact AI Core head `9728f9974b4a087c5f610a8c5f9cfb2bcdff3f6f`, `Main State Consistency` run `35507345497` completed with `failure`.

The only job has zero reported steps and no runner assignment, so this observation supports a runner-entry/execution failure state but does not support asserting a code/test root cause.

Action required:

- Do not mark the current AI Core A baseline exact-head CI-verified.
- Re-observe a successful `Main State Consistency` run on the same or a successor exact head before promoting A-session completion evidence.

# GitHub Release Automation

Status: `CI AUTOMATED / PRODUCTION HOLD`

AI Core now has a revision-bound release admission gate. It does not invent a
deployment platform or treat a successful push as a production release.

## Current observed state (2026-09-21)

- canonical repository: `freepass-creator/ai-core`
- canonical branch: `main`
- GitHub Actions workflows before this change: `Main State Consistency` and the
  manually dispatched `Shared Order Repository Check`
- GitHub Actions repository secrets: none
- GitHub environments: none
- GitHub deployments: none
- Vercel/Firebase/other deploy configuration in AI Core: not established
- branch protection/ruleset readback: unavailable for this private repository on
  the current GitHub plan (API returned 403)
- current `main` full test suite: failing before release enablement (durable
  coordination, pinned revision/fixture, current-episode diff and Windows path
  parity failures remain); production admission therefore stays HOLD even apart
  from the missing provider

The repository-specific source of truth is
`registry/releases/ai-core.json`. The workflow never falls back to Firebase
Realtime Database and does not contain an RTDB adapter, listener or deploy path.

## Gate behavior

1. Pull requests run the complete test suite and publish a status artifact bound
   to the exact GitHub commit. Preview deployment remains explicitly
   unconfigured.
2. Only a push to the manifest's canonical branch can reach production
   admission.
3. Production admission requires a named provider, exact revision readback and
   live consumer verification. Missing configuration is `HOLD`, not success.
4. The attempt key is derived from repository, environment and exact revision.
   GitHub concurrency prevents simultaneous duplicate runs and production
   admission rejects a GitHub rerun beyond the manifest attempt limit.
5. Status artifacts are retained for 30 days as a GitHub handoff record.

## Required final setup

Before enabling production deployment, the repository owner must decide:

1. the actual provider and project/site identifier;
2. the production URL and an endpoint/field that returns the deployed Git SHA;
3. the live smoke URLs and success criteria;
4. the provider-specific secret names and least-privilege credentials;
5. whether to upgrade/make the repository public so `main` can require the
   `Release Gate / verify` check, or enforce PR-only merges by another control.

After those choices, add a provider-specific deployment adapter in a separate
review. Do not place secret values in the manifest, logs, artifacts or source.
The adapter must pass only the names of secrets actually injected to
`release:status --available-secrets`; a declared but unavailable secret is
`HOLD` and secret values are never read or printed by the status evaluator.
Production should deploy the already tested artifact and then create a
`governance-release-proof/v1` record only after exact-commit readback and live
verification succeed.

## Local verification

```powershell
npm test
npm run release:status -- --event pull_request --ref refs/pull/1/merge --revision aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --repository freepass-creator/ai-core
npm run release:status -- --event push --ref refs/heads/main --revision aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --repository freepass-creator/ai-core --strict true
```

The last command is expected to exit non-zero until a real production target is
configured.

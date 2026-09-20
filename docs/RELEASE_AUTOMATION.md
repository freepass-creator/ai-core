# Release Automation

Status: `IMPLEMENTED / AI-CORE PRODUCTION TARGET HOLD`

## Current canonical facts

- Repository: `freepass-creator/ai-core`
- Default branch: `main`
- CI: GitHub Actions (`Main State Consistency` plus the release manifest gate)
- Deploy platform: not registered
- GitHub Actions repository secrets and variables: none observed on 2026-09-21
- GitHub environments: none observed on 2026-09-21
- Branch protection/ruleset readback: unavailable for this private repository under the current GitHub plan (API 403)

AI Core is currently a Node library, CLI, local HTTP service and governance repository. No production platform, project ID, URL, immutable revision endpoint or rollback target was found. Therefore the production job writes `HOLD_DEPLOY_TARGET_UNCONFIGURED`; it does not invent a deployment or restore any RTDB path.

## Automatic path

1. Pull requests run the existing full CI and the release-manifest/schema tests.
2. A push to `main` serializes in the `production-release-<repository>` concurrency group.
3. The controller checks repository, default branch, exact 40-character commit, required environment names, rollback declaration and retry limit.
4. Before deploying it reads the production revision. An exact match becomes `SKIP_ALREADY_DEPLOYED`, preventing a duplicate deployment on rerun. If the revision cannot be read, or the exact revision is current but smoke fails, it stops at HOLD and never redeploys.
5. Only a successfully read, non-empty revision mismatch permits the manifest's argv-based deploy command to run without a shell.
6. It then re-reads the production revision and smoke URLs. Only exact commit equality is `VERIFIED`; mismatch or unreadable runtime is `HOLD`.
7. Every run uploads a secret-free operational status plus the canonical `governance-release-proof/v1` artifact and writes a GitHub job summary. Deployment command failure is `FAILED`; any production HOLD fails the job visibly.

## Enabling a repository

Edit `registry/releases.json` through a reviewed pull request. A deployable entry must include:

- a real platform and `production.enabled: true`;
- an argv deploy command owned by that repository;
- required secret/variable **names**, never values;
- an HTTPS revision endpoint that returns the exact Git commit;
- at least one HTTPS smoke URL;
- a tested rollback plan reference;
- a maximum GitHub rerun attempt count.

The workflow must map the declared secret names into the production step and, when GitHub supports it, bind the job to a protected `production` environment. Do not add a generic RTDB adapter or fallback. Firestore parity gaps remain HOLD.

## Final GitHub settings still required

1. Decide and register AI Core's actual production consumer/platform, or explicitly keep it non-deployable.
2. Add a protected `production` environment with required reviewers if the account/plan supports it.
3. Add only the repository/environment secrets required by the chosen platform.
4. Make `Main State Consistency` and `Release Gate and Production Deploy / manifest` required before merge. The current private-repository plan must support rulesets/branch protection first; the API currently rejects inspection.
5. Set the production revision endpoint and rollback plan, then test first against a non-production target.

## GitHub handoff

Another agent should start with `registry/releases.json`, this file, `.github/workflows/release.yml`, and the latest release-status artifact. A green manifest job proves configuration shape and controller tests only. Production is complete only when the status artifact says `VERIFIED` and `observed_revision` exactly equals the merged `main` SHA.

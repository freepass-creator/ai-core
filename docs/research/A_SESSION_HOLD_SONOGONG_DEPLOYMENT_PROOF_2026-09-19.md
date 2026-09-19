# A Session HOLD — Sonogong Estimator Production Proof

상태: **CONTRADICTED / RUNTIME_PROOF_HOLD / NOT_CANONICAL**

발견일: 2026-09-19 KST

## Discovery

- Project: Sonogong Estimator
- Repository: `freepass-creator/sonogong-estimator`
- Source path:
  - `scripts/check-deploy.mjs`
  - `scripts/lib/live-bundle-compat.mjs`
  - `vite.config.js`
  - `_인계_배포장애_2026-08-07.md`
  - `_진행상황_인계.md`
- Revision:
  - observed repository head: `c79b8cdc453ef52793081c1d9a51b605b77755dd`
  - deployment checker introduced/strengthened around `95ba8b493565e8f7974dc9ae602d2bd72166283354` and `c5f598932562e533abe3f470bb8f63ac6c357c4e`
- Category: Build / Deploy / Production Proof

## What is strong in the project

The repository contains a strong **mechanism**:

1. build injects an `app-commit` meta value;
2. deploy checker fetches the live entry HTML and every referenced JS chunk;
3. it checks durable feature markers in the deployed bundle;
4. strengthened checker can require live `app-commit` to equal current Git commit;
5. config mutation is blocked until the live bundle proves it can understand the new config structure.

This is materially aligned with AI Core's principle:

`git commit exists != deployment exists != production serves expected revision`.

## Why it is NOT promoted as second production-proof evidence

Historical repository docs state:

- `sonogong-estimator.vercel.app` was live;
- a historical commit was described as code=live;
- deployment failure had previously gone unnoticed for 32 days;
- a prebuilt/manual workaround was used while Git-triggered deployment was broken.

Current external observation through the connected Vercel account:

- connected team: `freepass-projects`
- visible Vercel projects: **0**
- therefore current project/deployment/revision cannot be independently resolved from the connected deployment control plane.

The public URL could not be verified through the available public web fetch path either.

## Classification

- Mechanism quality: **Project > Core adjacent evidence**
- Current runtime proof: **HOLD**
- Candidate affected: `release.production-revision-proof`
- Evidence level: **NO CHANGE**
  - remains `PROJECT_VERIFIED` from FreePass ERP4 only.
  - Sonogong Estimator is not counted as second production evidence.

## Required evidence to clear HOLD

Any one authoritative deployment path must resolve:

1. exact Vercel project/deployment identity for `sonogong-estimator.vercel.app`;
2. current production deployment state;
3. deployment commit SHA or injected `app-commit`;
4. live readback matching the target repository revision;
5. successful current `check:deploy` or equivalent readback bound to that deployment.

Do not infer this from old handoff prose or checker code alone.

## Recommended action

- Keep the deploy checker pattern as a useful reference.
- Do not promote `release.production-revision-proof` until a second project has **current runtime evidence**, not only code capable of producing that evidence.
- If this project returns to active operation, bind its Vercel project/team/deployment target into the project registry so production evidence is resolvable without relying on remembered URLs.

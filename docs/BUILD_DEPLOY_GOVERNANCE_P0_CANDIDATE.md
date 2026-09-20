# AI Core Build / Deploy / Governance P0 — Canonical Partial Baseline

Status: `CANONICAL_PARTIAL / NO DEPLOYMENT AUTHORITY`

This canonical partial baseline converts repeated project evidence and the existing Shared Release Gate into machine-readable governance contracts.

It does not change repository lifecycle decisions, project deployment commands, branch protection, production targets or the current audit-readiness maturity.

## Ownership boundary

AI Core owns common proof semantics:

- what counts as a reproducible build record;
- how source/build/deploy/production states differ;
- what a verified release must prove;
- what rollback readiness means;
- how stale/unknown project observation is represented;
- how exceptions expire;
- how deprecation/removal progresses;
- how repository lifecycle decisions carry purpose/gates/evidence.

Projects continue to own:
- Vercel/Firebase/Cloud Run/etc. details;
- domains;
- deploy commands;
- credentials;
- migration implementation;
- runtime-specific rollback commands.

## Existing main work preserved

The new `docs/REPOSITORY_LIFECYCLE_AUDIT_2026-09-20.md` and
`examples/repository-lifecycle-2026-09-20.json` remain the current observed repository classification.

This baseline does not rewrite that register.

It only adds a generic record contract so future ACTIVE/REFERENCE/HOLD/RETIRE decisions can be machine-checked for missing authority, reference purpose and retirement gates.

## Canonical partial P0 contracts

### 1. Build Manifest

`governance-build-manifest/v1`

Separates:
- source revision;
- runtime/package manager;
- install/build commands;
- lockfile;
- checker-manifest reference;
- output artifact identity/digest;
- builder/build identity and time.

Projects with no build artifact may declare artifact kind `NONE`; they should not invent a bundle merely to satisfy the form.

### 2. Release Proof

`governance-release-proof/v1`

A verified production release requires:

1. build PASS;
2. deployment READY;
3. production target reachable;
4. observed production revision;
5. observed revision == expected revision;
6. runtime smoke PASS;
7. rollback candidate + plan available.

Merge, green CI and deployment READY are all insufficient by themselves.

### 3. Rollback Plan

`governance-rollback-plan/v1`

Records:
- previous known-good revision;
- rollback path;
- data strategy;
- trigger;
- verification;
- irreversible side effects.

Git revert alone is not treated as a complete data/runtime rollback strategy.

### 4. Project Observation

`governance-project-observation/v1`

Preserves the lesson from landed observations:

- `OBSERVED` and `UNKNOWN` are different;
- failed observation is not evidence of no activity;
- observations age and become stale;
- exact repository/default branch/head revision are explicit.

This supports registry freshness without making an observation cache a new SSOT.

### 5. Exception

`governance-exception/v1`

An exception records:
- rule;
- project/scope;
- reason;
- risk;
- approver;
- creation/expiry;
- replacement plan.

Expired exceptions stop being active. A permanent exception should be reviewed as a product/profile rule instead of living forever as an invisible bypass.

### 6. Deprecation / Removal

`governance-deprecation/v1`

Lifecycle:

```
ACTIVE
→ DEPRECATED
→ READ_ONLY
→ RETIRED
→ REMOVED
```

The semantic helper rejects backward movement and skipped stages.

This is separate from the observed repository register's ACTIVE/REFERENCE/HOLD/RETIRE classification; the former is a removal lifecycle, while the latter describes current repository authority/use.

### 7. Decision Record

`governance-decision-record/v1`

Captures why a group-level rule exists, alternatives, consequences and supersession links.

### 8. Repository Lifecycle Record

`governance-repository-lifecycle/v1`

Uses the already-adopted observed vocabulary:

- ACTIVE
- REFERENCE
- HOLD
- RETIRE

Minimum semantics:
- ACTIVE needs an authority;
- REFERENCE needs a declared purpose;
- RETIRE needs explicit retirement gates.

## Relationship to QA P0

This PR deliberately does not redefine checker manifests or negative-control semantics.

Those belong to QA/Observability candidate PR #152.

Governance stores references to the checker manifest and asks whether release gates were satisfied; QA defines what the check evidence means.

## Relationship to Security P0

This PR does not define who may approve a privileged release or exception.

Security/Audit candidate PR #150 defines authorization and exact-subject approval semantics.

Governance defines the release/exception records those decisions may later authorize.

## Supply-chain boundary

SLSA/SBOM are not made mandatory by this P0 candidate.

The Build Manifest provides source/build/artifact identity slots so future SLSA provenance or CycloneDX/SPDX references can be added without redefining release truth.

Higher-risk projects may later adopt stronger supply-chain profiles.

## Machine validation

```bash
node scripts/validate-build-deploy-governance-p0.mjs
node --test test/build-deploy-governance-p0.test.mjs
```

Semantic tests prove:
- deployment READY + wrong production revision != verified;
- missing rollback != verified;
- UNKNOWN observation != no activity;
- stale observation is explicit;
- expired exception is no longer active;
- REFERENCE requires a purpose;
- deprecation cannot skip stages or reverse.

## Promotion gates

Remain non-canonical until:

1. validators/tests execute in AI Core CI;
2. ERP4 release proof can consume the Release Proof contract without semantic loss;
3. Estimate/Admin can represent production-proof HOLD honestly;
4. AIOps no-build repository can use Build Manifest with `NONE` artifact without fabrication;
5. current repository lifecycle register can be represented with explicit authority/purpose/gates;
6. QA #152 checker-manifest reference is integrated without duplicate ownership;
7. Security #150 approval semantics can authorize protected governance actions without circular ownership;
8. canonical owner explicitly promotes the profile.

## Explicit non-goals

This candidate does not:
- deploy anything;
- change branch protection;
- retire/delete/archive repositories;
- change Vercel/Firebase state;
- force SemVer on projects without a public versioned contract;
- require an SBOM for every internal script;
- modify current project registry or capability registry.

## Promotion evidence — 2026-09-20

- ERP4 Governance SHADOW merged to main at `06e18ff52e14ec4e3670361d89a873913be4f51b`; dedicated SHADOW and existing CI were PASS.
- FreePass Admin Governance SHADOW merged to main at `2747ef32e96c550d7dea05c58ee012880cb42dd3` and intentionally preserves HOLD for unverified production auth/persistence/deploy/runtime smoke.
- Repository lifecycle and execution readiness are now distinct in Project Registry v1.1.
- Production release verification still requires live target observation and rollback proof, so this axis is not MACHINE_ENFORCED yet.

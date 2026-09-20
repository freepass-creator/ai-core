# AI Core QA / Observability P0 Candidate

Status: `CANDIDATE / NOT CANONICAL / NO PRODUCTION AUTHORITY`

Four revision-bound project audits show that QA/Observability is still research-only in AI Core even though multiple projects already implement compatible mechanisms.

This candidate converts those repeated mechanisms into machine contracts without changing the current project-audit readiness state.

## Evidence generalized

### ERP4
- checker manifest with required/manual/pending classification;
- known-bad / negative-control harness;
- CI gates that protect product boundaries beyond typecheck/build;
- ops-watch reusing domain functions rather than reimplementing business state.

### FreePass Estimate
- semantic contract -> checker binding;
- verification-manifest freshness;
- exact-revision CI;
- provider failure/privacy matrix;
- CI success separated from production proof.

### AIOps
- stale source -> HOLD;
- scheduler health separates review wait from technical failure;
- terminal manifest required for business completion;
- read-only health inspection.

### FreePass Admin
- clean typecheck/test/build evidence;
- production persistence/auth/deployment explicitly remain NOT VERIFIED.

## P0 machine contracts

### 1. QA Checker Manifest

`qa-checker-manifest/v1`

Every meaningful checker declares:
- checker identity;
- REQUIRED / MANUAL / NOT_APPLICABLE / PENDING;
- reproducible command when applicable;
- semantic contract IDs it protects;
- strongest proof level it provides;
- whether a negative control is required and proven;
- why it belongs in that class.

A script existing in the repository is not proof that it is part of the release gate.

### 2. QA Result

`qa-result/v1`

A result is revision-bound and records:
- environment;
- suite;
- proof level;
- checks;
- evidence;
- limitations.

`SKIP` and `UNKNOWN` are not PASS.

A result may claim production proof only when:
- proof level = PRODUCTION;
- environment = PRODUCTION;
- a concrete target was observed;
- observed revision == subject revision.

### 3. Health

`observability-health/v1`

Health kinds are separated:
- LIVENESS
- READINESS
- DEPENDENCY
- FRESHNESS
- SCHEDULER
- TERMINAL_EVIDENCE

A process can be alive while its data is stale or scheduler is disabled.

Freshness is evaluated against an explicit observation timestamp and stale threshold.

### 4. Background Job Status

`observability-job-status/v1`

Records:
- schedule enabled/disabled/unknown;
- last start/completion/success;
- next due;
- last result;
- heartbeat;
- lease owner;
- run revision;
- checkpoint;
- terminal evidence.

A job cannot claim SUCCEEDED merely because a process exited successfully. The run revision and terminal evidence must be observable.

### 5. Correlation Context

`observability-context/v1`

Provides a provider-neutral context for logs/traces/metrics/jobs:
- service + environment + version;
- request/correlation/causation;
- trace/span;
- job;
- actor;
- entity;
- source revision.

This does not force a specific telemetry vendor.

## Proof levels

Candidate proof hierarchy:

1. FIXTURE
2. SYNTHETIC
3. EMULATOR
4. PREVIEW
5. PRODUCTION

Higher-level claims cannot be inferred from lower-level evidence.

In particular:
- emulator security PASS != production rules observed;
- CI build PASS != production revision observed;
- synthetic scheduler test != actual scheduler enabled.

## Negative controls

A required checker that claims to guard a failure mode may itself need proof that it fails when the guard is removed or a known-bad fixture is supplied.

This candidate therefore makes negative-control status explicit:
- PROVEN
- PENDING
- NOT_APPLICABLE

This generalizes ERP4 known-bad practice and the Estimate verification-drift lesson.

## Machine validation

```bash
node scripts/validate-qa-observability-p0.mjs
node --test test/qa-observability-p0.test.mjs
```

Semantic tests cover:
- required checker missing negative-control proof -> HOLD;
- SKIP/UNKNOWN are not PASS;
- production observed revision mismatch -> reject;
- stale source -> DEGRADED;
- job success without terminal evidence/revision -> HOLD.

## Promotion gates

Remain non-canonical until:

1. schemas and semantic tests execute in AI Core CI;
2. ERP4 checker manifest can be represented without loss;
3. Estimate contract/checker freshness can consume the manifest;
4. AIOps health/job status can consume the health/job contracts;
5. one independent project produces a qa-result artifact;
6. correlation context is shown compatible with the existing Core request/execution identity contracts;
7. canonical owner explicitly promotes the profile.

## Explicit non-goals

This candidate does not:
- require OpenTelemetry SDK adoption;
- require a vendor such as Sentry, Datadog or Vercel Observability;
- alter project CI;
- enable/disable schedulers;
- declare production health;
- turn research-only project audit findings into normative PASS/FAIL yet.

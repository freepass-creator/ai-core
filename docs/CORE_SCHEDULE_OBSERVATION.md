# Core Schedule Observation v1

Status: **C SESSION EXPERIMENTAL / FAILURE-RUNTIME-EVIDENCE CANDIDATE**

## Purpose

Scheduled automation must not collapse four different facts into one status:

1. the logical slot that should have run;
2. the concrete dispatch/run that was actually created;
3. the execution attempt/path that processed it;
4. the downstream completion evidence.

`core-schedule-observation/v1` provides a typed observation envelope for these facts.

## Boundary

C owns representation and identity. D owns timing policy:

- what counts as late;
- when an un-dispatched slot becomes missed;
- retry/fallback eligibility;
- SLA/escalation consequences.

For that reason `timing_assessment` requires a `policy_ref`. The C contract can carry `ON_TIME | LATE | MISSED | UNKNOWN`, but it does not define thresholds.

## Relationship to execution identity

`execution` reuses `core-execution-identity/v1#/$defs/binding`, so native/fallback/downstream attempts remain attached to the same logical execution while the schedule slot and dispatch identity remain independently observable.

## Failure evidence

The candidate is motivated by ERP4 runtime evidence where a very-late native run succeeded, making it important to distinguish expected schedule slot, actual dispatch identity and downstream completion instead of treating 'a run eventually succeeded' as proof that scheduling itself was healthy.

Source evidence: `freepass-creator/freepasserp4@606a761683345869400274e4dea360908d2622bf`.

This remains EXPERIMENTAL because the source evidence proves the ambiguity/failure class, not a second independently verified reusable implementation.

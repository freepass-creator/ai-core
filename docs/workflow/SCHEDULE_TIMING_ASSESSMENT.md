# Schedule Timing Assessment — Proposed D Contract

Status: **PROPOSED / FAILURE_RUNTIME_EVIDENCE**

## Why this exists

A later successful scheduled run does not prove that the nominal logical slot was delivered on time. ERP4 runtime evidence showed a direct scheduled run appearing hours after the declared slot window, while GitHub run metadata did not expose a reliable nominal-slot identity.

D therefore keeps these questions separate:

- when should a dispatch have happened;
- did a dispatch actually happen;
- how late was that dispatch relative to the expected slot;
- if no dispatch exists yet, when may the slot be classified as missed.

## Policy boundary

`assessScheduleTiming()` never invents a threshold. Callers must supply:

- `late_after_ms`
- `missed_after_ms`

The repository-level policy intentionally leaves both values `null` while status is PROPOSED.

Promotion to PILOT requires:

1. a concrete domain timing policy with explicit thresholds;
2. implementation evidence, not only failure evidence;
3. C `core.schedule-observation/v1` available as the observation envelope;
4. exact-revision validation evidence.

## Classification semantics

- dispatch observed within late threshold → `ON_TIME`
- dispatch observed after late threshold → `LATE`
- no dispatch and miss threshold not reached → `UNKNOWN`
- no dispatch by miss threshold → `MISSED`

An eventual late dispatch does not retroactively prove that the schedule was healthy. Historical assessments remain evidence; a later observation may add new facts.

## C/D boundary

C owns the observation envelope and execution identity. D owns timing thresholds and the interpretation of ON_TIME/LATE/MISSED for a workflow or scheduler policy.

C `core.schedule-observation/v1` is integrated on the same no-Actions work branch and is available as the observation envelope. Timing thresholds remain intentionally unset, so D stays PROPOSED.

## Source evidence

- `freepass-creator/freepasserp4@606a761683345869400274e4dea360908d2622bf`
- Audit 77: direct 19:17 slot had no native scheduled event more than three hours after nominal time.
- Audit 78: a later native run succeeded very late, but cadence/timeliness HOLD correctly remained open.

# AI Core Recovery Mode — 2026-09-20

Status: ACTIVE while GitHub Actions blocker #128 is open.

## Why recovery mode exists

Main State Consistency is currently failing before a GitHub-hosted runner is assigned.
Affected jobs end with `steps=[]` and `runner_id=0`, so these are not test or validator failures.

At the same time, A/B/C/D sessions advanced main and created successor/refresh/final/replay branches faster than CI could provide revision-bound verification. This created stale bases and avoidable rework.

## Operating rules

1. Do not write directly to `main` from A/B/C/D work while blocker #128 is open.
2. Keep one active branch per lane. Update the existing lane branch instead of creating refresh/final/replay successors.
3. Batch related changes. Do not create a commit solely to provoke another Actions run.
4. Do not repeatedly re-run pre-runner failures.
5. A red run with `steps=[]` / `runner_id=0` is infrastructure-blocked, not a code validation result.
6. Do not claim CI PASS, promotion, adoption, or canonical completion without a runner-backed successful verification.
7. Existing active lane PRs remain draft/HOLD until recovery is proven.
8. Stale/superseded PRs should be closed rather than stacked again.
9. After recovery, resolve #138 first and #139 second before opening new A coordination successors.
10. The Main State workflow uses concurrency cancellation so only the latest verification for the same PR/main ref remains active.

## Recovery proof

Recovery is proven only by a fresh Main State Consistency run that:
- receives a nonzero runner id,
- executes checkout/setup/test/validator steps,
- and concludes successfully.

## Resume order

1. Confirm runner-backed green on current main.
2. Merge/resolve #138.
3. Retarget and resolve #139.
4. Rebase or refresh each B/C/D lane once, not repeatedly.
5. Run one verification per lane.
6. Resume normal A/B/C/D work only after the baseline is stable.

# AI Core project entrypoint

Start at [the AI continuation guide](docs/coordination/AI_CONTINUATION.md). Then read [WORK_READ_FIRST.md](WORK_READ_FIRST.md) and [the common AI entrypoint](docs/coordination/CROSS_AI_ENTRYPOINT.md). They are the shared instructions; do not create a separate session ledger or copy their state here.

Read the coordinator's current scoped work packet. A read-only packet, role name or intake claim does not authorize execution. Missing canonical linkage, scope, freshness or execution authority means HOLD. Respect explicitly assigned checkout and file ownership. Do not change global trust, login or approval settings.

## Current continuation checkpoint

- Canonical repository: `freepass-creator/ai-core`.
- Integration branch: `codex/order-control-integration`; draft pull request: `22`.
- Last exact remote and CI-verified handoff baseline: `1575f467b5356fe351d877da4b561cdc67af9175`.
- Before reviewing, run or request the one-repository preflight in `docs/coordination/AI_CONTINUATION.md`. Confirm canonical remote, branch, source commit, dirty/ahead/behind state and latest remote HEAD. If a later commit exists, review the actual fetched diff and name that commit. Do not continue silently from stale state.

Read in this order:

1. `docs/coordination/AI_CONTINUATION.md`
2. `WORK_READ_FIRST.md`
3. `docs/coordination/CROSS_AI_ENTRYPOINT.md`
4. `docs/integration/INTEGRATION_STATUS.md`
5. `docs/integration/DURABLE_COORDINATION.md`
6. The relevant source and tests named below; do not rely on the implementer's summaries alone.

Completed in the verified baseline: the one-file free-chat emergency handoff and proposal-only return contract are published on PR22; the earlier synthetic integration/durable laboratory passed its recorded tests. Still HOLD: production connection, live database or ledger migration, automatic conversation ingestion, external execution, the canonical order/work mapping for the latest request, and the missing independent high-risk review. A weekly Claude usage-limit response from an earlier attempt is availability evidence, not PASS.

## Next work, in priority order

1. **Independent source review only:** review PR22's latest HEAD, especially `scripts/ai-continuation-pack.mjs`, `scripts/repo-sync-preflight.mjs`, `src/integration/durable-order-work-sandbox.mjs`, `src/orders/store.mjs`, and their tests against the original order/work-ledger contracts and current requirements. Find contradictions, missing failure cases and production-activation risks.
2. Verify that `docs/coordination/EMERGENCY_HANDOFF.md` is self-contained for a chat without repository access and that its `RETURN_PACKET` can be safely recovered without granting authority.
3. Return findings in the `docs/coordination/RETURN_PACKET.md` shape, bound to the actual reviewed source commit and target work ID. If the work ID is still unverified, report HOLD and use the documented UNVERIFIED marker; do not invent one.

Claude's role is design, logic, counterexample and independent review. Default to read-only, non-interactive work. Do not edit files, execute project commands, push, merge, deploy, send, change access or claim/complete work unless the user later gives Claude a specific implementation assignment and the canonical gates permit it. Do not request or publish raw local `docs/context` files, customer/case/mail content, personal data, credentials or tokens. Verify the current work, branch and source commit so another AI/session's work is not duplicated.

Return plain findings plus exactly one final JSON block following `docs/coordination/RETURN_PACKET.md`. Include reviewed commit, scope, assumptions, proposed files/changes, tests not run, risks and evidence pointers. Mark the result `PROPOSAL_ONLY`; review does not alter the original or authorize implementation.

Start Claude with this sentence:

> Read `CLAUDE.md`, preflight the registered PR22 branch, then independently review the latest Cross-AI emergency-continuation and durable-coordination source/tests against the original order/work-ledger requirements; edit nothing and return contradictions, omissions and production risks as `RETURN_PACKET.md`.

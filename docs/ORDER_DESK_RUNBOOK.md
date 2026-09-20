# AI Core local order desk runbook

Status: local, private, manual-handoff workflow. No deployment, external sending, production mutation or automatic Codex task creation is authorized by this document.

## Canonical boundaries

- The central OrderStore records the user's request, requirement revisions, task leases, reports and acceptance history.
- The Work Ledger and Control Tower remain canonical for business-work state. An OrderStore `REVIEW`, report, lease or session packet is not canonical completion or execution authority.
- Each project repository remains canonical for its code and deployment. GitHub commit IDs are development handoff evidence, not business outcome evidence.
- `docs/coordination/AI_CONTINUATION.md` is the repository-capable AI entrypoint. A free chat receives only a reviewed one-work Markdown pack and returns `PROPOSAL_ONLY`.

## One-time local setup

Use Node.js 24.19 or newer. From one reviewed checkout, run `npm ci`. Re-run it only when `package-lock.json` changes or `node_modules` is missing; every separate worktree does not need to become another order server.

Start exactly one private loopback service against the preserved ledger:

```powershell
npm run orders:serve -- --db C:\dev\ai-core\.local\orders.sqlite
npm run orders -- connect http://127.0.0.1:4318
npm run orders -- meta
```

`meta` must show the expected ledger ID and `SHARED_PRIVATE_SERVICE`. Missing/unreachable/mismatched connections stop; they never create a fallback ledger. Do not start two writers over copied databases with the same ledger ID.

## User order to work session

The user speaks naturally in the coordinating chat. The coordinator resolves project, completion criteria and risk, then writes a request JSON with a fresh `requestId` and runs:

```powershell
npm run orders -- create .local\requests\request.json
npm run orders -- work-intake ORD-...
npm run orders -- next codex
npm run orders -- claim-next codex
```

`create` durably records intake and routing provenance. `work-intake` is required before calling the item canonical Work; it reconciles the immutable binding/outbox and still grants no execution authority. `claim-next` deterministically chooses the oldest eligible preassigned task, uses the existing optimistic version plus lease gate, and refreshes after bounded selection races. One actor cannot use this helper to hold two live leases. Its stdout contains the lease token needed for heartbeat/report, so it is local-operator output and must never be pasted into a handoff or committed. It does not bypass project approvals or capability gates.

To prepare a bounded handoff for another task or chat:

```powershell
npm run orders -- session-pack ORD-... T1 .local\handoffs\ORD-...-T1.md
```

The command refuses to overwrite a file. The pack excludes the lease token and labels its authority as false. Review it for sensitive data before manually providing it to another AI. Never commit generated packs containing user or customer material.

Repository-capable Claude/Cursor/Gemini should start from `docs/coordination/AI_CONTINUATION.md`, pin the current commit and re-read the central order. A free chat receives the reviewed `EMERGENCY_HANDOFF.md` pattern and must return a proposal packet; it cannot claim repository access, tests, commits or execution.

## Reporting and successor assignment

The working session re-reads `show` before reporting, then submits `act ... report` with the current order version, requirement revision, task ID, actor, live lease token, summary and evidence. Requirement changes invalidate old reports and leases.

After a report, run `next ACTOR` or `claim-next ACTOR`. The predefined task order is the successor rule: a later task is eligible only after every earlier task is `REPORTED`. A live lease blocks duplicate work; an expired lease may be reclaimed; optimistic version conflicts force a fresh read. No task is auto-started merely because another task completed.

User acceptance remains `REVIEW / USER_ACCEPTED_NOT_CANONICAL`. Canonical closure must be re-read from the Work/Control path and verified against the current requirement revision and project revision.

## Local/GitHub drift gate

Before continuing a repository task, record the checkout, branch and `HEAD`, then run the registered preflight without update:

```powershell
npm run repo:preflight -- --repo C:\path\to\checkout --registry examples\project-registry.json --project PROJECT_ID --branch EXPECTED_BRANCH
```

Only `REMOTE_AHEAD` on a clean, registered, non-diverged branch is eligible for a reviewed retry with `--update`. Dirty, ahead, diverged, wrong-branch, remote-mismatch or missing-upstream results are HOLD. The preflight never pushes, resets, cleans, stashes, switches or force-updates. A local result is not published until its exact commit and intended file are read back from `origin`.

## Verification

Focused checks for this flow:

```powershell
npm ci
node --test test/order-session-flow.test.mjs test/orders.test.mjs test/shared-orders.test.mjs test/repo-sync-preflight.test.mjs test/ai-continuation-pack.test.mjs
npm run verify
npm test
```

For one real-user rehearsal, use a disposable `--standalone --db :memory:` server, create an order, inspect and claim the next task, generate a local session pack, report with the returned lease, and confirm that the successor becomes eligible while a duplicate claimant is rejected. Never use a copied production ledger for rehearsal.

## GitHub Actions budget recovery checklist

Current Actions failures before runner assignment are infrastructure/budget evidence, not a code-test failure or PASS. After the budget is restored:

1. Re-run the exact branch/head workflow and confirm a runner was assigned.
2. Confirm checkout SHA equals the reviewed branch SHA.
3. Run the focused order-flow checks, `npm run verify`, then the complete `npm test` suite.
4. Record failing test names separately from runner-start failures.
5. Read back the workflow run, job conclusion and exact commit from GitHub.
6. Do not merge while required checks are missing, skipped, cancelled or still blocked by billing.

## Known limits

- Codex desktop task creation is still an app-level/manual coordinator action; this repository creates a safe handoff packet, not a desktop task.
- Capability execution stays fail-closed unless the registered capability, canonical Work projection, authorization boundary and explicit server flag all permit it.
- The central service has SSH/host access as its security boundary and does not provide multi-user role authorization.
- Free-chat output is advice only. Sensitive source text must not be placed in GitHub handoff files.

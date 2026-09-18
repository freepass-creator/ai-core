# Continue AI Core work from GitHub

This is the single start point for an AI that needs to continue or advise on AI Core work. GitHub contains reviewed, minimized work context and evidence pointers. It is not the canonical business ledger and does not contain every conversation.

## If you can read this repository

1. Read `WORK_READ_FIRST.md`, then `docs/coordination/CROSS_AI_ENTRYPOINT.md`.
2. Read `docs/integration/INTEGRATION_STATUS.md` for the current integration checkpoint and its unresolved items. Treat owner-reported facts and remote-verified facts separately.
   Then run `npm run core:brief -- --refresh --env-file C:\dev\freepasserp.com\.env.local` — one screen: operations watch, what landed in the last 24h, ledger work and revision drift, live/draft directions, and what is waiting on the owner. `npm run work:recent` shows the landed commits in detail and what arrived after each ledger work's bound revision. Read these instead of re-surveying; UNKNOWN means «not observed», never «nothing happened». See `docs/integration/LANDED_OBSERVATIONS.md` and `docs/integration/OPS_WATCH.md`.
3. Obtain the coordinator's current scoped packet. Re-read the canonical order/work state before choosing implementation work. A repository clone, role name, packet, proposal or intake claim grants no execution authority.
4. If work ID, current requirement revision, target revision, checkout/file ownership, dependencies, freshness or claim is missing, return a HOLD report. Do not create another ledger or infer identity from a title.
5. Default to read-only advice. Implement only when the current assignment and project gate permit it. Never infer permission to deploy, send, complete, pay, change access or write live data.

Give Claude Code this sentence:

> Read `docs/coordination/AI_CONTINUATION.md`, follow its repository-access path, and report the current verified work target, HOLD reasons, and one safe next action before editing anything.

## If you cannot read the private repository

The coordinator exports one reviewed Markdown pack using `scripts/ai-continuation-pack.mjs`. The user downloads `EMERGENCY_HANDOFF.md` from the private repository and copies or uploads only that file. Do not ask a free chat to browse a private repository it cannot access, make the repository public or publish a gist.

Give a free chat this sentence with the pack:

> 이 `EMERGENCY_HANDOFF.md` 기준으로 [업무]를 이어서 하고, 결과를 `RETURN_PACKET.md` 형식으로 줘. 저장소 접근·실행·커밋·배포·발송은 했다고 가정하지 마.

The pack is intentionally short. It contains source/time, verified target IDs when available, decisions, corrections, completed work, remaining work and evidence pointers. The scanner rejects common email, phone, credential label, bearer token, local absolute path and evidence-URL query patterns. It cannot prove arbitrary prose is anonymous or detect every secret/customer/case detail; a human/coordinator reviews the input and diff before publication.

```powershell
node scripts/ai-continuation-pack.mjs export examples/ai-continuation-input.json EMERGENCY_HANDOFF.md
```

The input contains exactly one selected work target; it is the filter. The command creates a new file only and refuses overwrite. `EMERGENCY_HANDOFF.md` is a review artifact; committing or uploading it is a separate action. Without any command, copy `examples/ai-continuation-input.json`, keep one work only, review each field, and have the coordinator generate the file.

A free chat can analyze the bounded context, draft prose/checklists, propose a code patch and recommend next steps. It cannot read the private repository from a URL, run local tests, commit/push, deploy, send messages or prove current canonical state. The return must list proposed files, assumptions, tests not run and risks.

## Bring advice back

Ask the AI to follow `docs/coordination/RETURN_PACKET.md`. Preserve the AI name, generation time, target work ID and handoff SHA-256. Save the received answer as `RETURN_PACKET.md`, review/redact it, then normalize the single embedded JSON record:

```powershell
node scripts/ai-continuation-pack.mjs recover RETURN_PACKET.md proposal-record.json
```

The record is always `PROPOSAL_ONLY`, with every authority flag false. It never overwrites source documents or updates an order/work ledger. A coordinator compares its handoff digest and target against the current canonical state, records a new suggestion/note through the existing order process if authorized, and separately implements/verifies accepted changes. Stale target, changed requirement, digest mismatch, sensitive content or unavailable canonical read means HOLD. Keep the raw response in its approved restricted source; GitHub receives only the reviewed minimal proposal record or a pointer.

Before committing a pack or proposal record, run the focused test, inspect the exact diff and repeat the sensitive-value check. After push, read back the exact remote commit and file; a local file or commit alone is not GitHub evidence.

```powershell
node --test test/ai-continuation-pack.test.mjs
git diff --check
```

This flow does not ingest the local, partial `docs/context` working set. That owner must first extract a reviewed minimal record; the eight local files are not approved for wholesale publication.

## Repository freshness preflight

Before work, run the preflight for the one explicitly selected repository. It reads the existing project registry to pin repository/default branch and permits only a registered work branch. It fetches that branch, compares local HEAD with `origin/<branch>`, reports dirty/ahead/behind/diverged state and emits JSON. With `--update`, it fast-forwards only when the worktree is clean, local has no unpushed commit and histories are not diverged.

```powershell
node scripts/repo-sync-preflight.mjs --repo . --registry examples/project-registry.json --project ai-core --branch codex/order-control-integration
```

Add `--update` only after reviewing a `REMOTE_AHEAD` result. It never pushes, forces, resets, cleans, stashes or switches branches. Dirty worktree, divergence, unpushed commit, wrong/unregistered branch, remote mismatch, missing upstream comparison or fetch failure returns HOLD. It does not scan other repositories, touch operating databases or make GitHub the source for non-Git evidence. A result is `LOCAL_ONLY` until its exact commit and file are read back from the configured remote.

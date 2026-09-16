# Control Tower Consolidation Register — 2026-09-15

## Decision

Keep product repositories independent. Consolidate order intake, project routing, work-state control, evidence binding and authority checks in AI Core. Never merge or delete a dirty checkout from inventory evidence alone.

## AI Core integration order

1. PR #20 is the control plane: project registry, fail-closed decision evaluator, append-only work ledger and evidence/authorization binding.
2. PR #21 is the order-intake plane: natural-language order desk, claim UI and local/server client. Its SQLite order store is not a second control ledger.
3. Integrate through one adapter: `order_id → work_id`, `project_id`, current requirement revision and ledger head.
4. Rebase or retarget PR #21 after PR #20 is adopted; do not merge their overlapping README, package, verification and episode files independently.
5. PR #19 remains the measurement form. PR #1/#17/#18 and research PRs remain candidates/indexed research until a real episode requires them.

The active “본사 합병 관련 잔여사항 찾기” Codex task received this boundary directly. It added `docs/ORDER_CONTROL_INTEGRATION.md` in PR #21 at commit `21b1e16`. That review keeps OrderStore as intake/claim interaction, recognizes PR #20's ledger as the controlling work state, and leaves the adapter unimplemented. It also identified the need for persistent UUID order-to-work mapping, an outbox/command ID for partial-write recovery, and authoritative readback.

## Local workspace findings

- `C:\dev` contains many independent repositories plus repeated checkouts of the same remote.
- The largest concentration is `freepass-creator/freepasserp4`, spread across the main working tree, named worktrees, detached deployment/review copies and feature branches.
- `ai-core` currently has the order-desk checkout, this control-tower checkout and an older cognitive-runtime audit checkout.
- `freepass-sales` has a dirty main checkout and a clean mail-automation checkout.
- `teamjpkwork` also has multiple focused worktrees.
- High dirty counts exist in `docshub`, `webtoon-studio`, `aiops`, `devcenter`, `freepasserp4`, `sales` and other repositories. They are preservation/HOLD signals, not permission to normalize or delete files.

Run `node scripts/inventory-repositories.mjs C:\\dev` to refresh exact paths, branches, revisions, remotes, dirty counts and duplicate-checkout groups.

## GitHub work landscape

- AI Core: PR #20 control plane and PR #21 order desk are the two active implementation lines requiring integration. Older PRs are mostly research, experiments or stacked candidates.
- Freepass ERP4: 13 open PRs were observed. Current topics include ERP5 Firestore source separation, supplied-sheet atoms, orphan-branch monitoring, trim gates, white-label UI, residual values and the RTDB-removal line. RTDB references remain migration debt; they are not fallback candidates.
- Freepass Sales: PR #4 server MyData/contact intake and stacked UI PRs #2/#3. The active sales Codex task is working in the same domain, so new intake/UI work must start by checking those PRs and the dirty main checkout.
- DocsHub: two open PRs for the Mewcar template and development environment.
- No open PRs were observed in DevCenter, AIOPS, TeamJPKWork, Casemap or Webtoon Studio at this snapshot, despite substantial dirty local work in several of them.

## Consolidation classes

| Class | Treatment |
|---|---|
| Canonical product repository | Keep independent; register exact remote, default branch, SSOT and deployment boundary. |
| Clean feature worktree with open PR | Keep until PR disposition; link branch/PR/work ID. |
| Dirty checkout | HOLD; identify owning task and preserve before any move, merge or cleanup. |
| Detached clean checkout | Review purpose and reachability; archive/remove only after explicit evidence and authorization. |
| Research PR/branch | Index by claim and revision; do not treat as adopted runtime. |
| Duplicate implementation | Select one controlling line, extract missing behavior through review, then close or supersede the other line. |

## Next controlled actions

1. Generate and commit a current machine-readable local inventory snapshot.
2. Register canonical repositories first; keep extra worktrees as checkout observations rather than separate projects.
3. Bind active Codex tasks and GitHub PRs to project/work IDs.
4. Integrate PR #21 through the order-to-work adapter after PR #20.
5. Audit dirty checkouts with their owning tasks before proposing archive, merge or deletion.

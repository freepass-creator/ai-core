# Standard Development Form v1.0

Status: `IMPLEMENTED_CONTRACT_AND_SEMANTIC_VALIDATOR`

This form is the shared contract for Codex, Cursor, Claude, Gemini and a future Dev Control Room. JSON is canonical; a UI or Google document is a view over the same fields.

## Screen sections

1. **Request** — title, user intent, unknowns and decisions that change implementation.
2. **Sources** — repository or Workspace source, exact revision and last verification time.
3. **Scope** — included work, exclusions, affected paths and minimum necessary data scope.
4. **Acceptance** — independently testable criteria and evidence references.
5. **Work lane** — one actor, branch, worktree and current revision.
6. **Proof** — checks and artifacts bound to the subject revision.
7. **Review** — independent reviewers, findings and unresolved severity.
8. **Authorization** — whether external execution needs a person, exact scope and expiry state.
9. **Release and outcome** — merge/deploy state and later real-world observation remain separate.
10. **Handoff** — compact current truth, next action and blockers.

## Primary buttons

| Button | Enabled only when | Result |
|---|---|---|
| Save draft | identity and intent exist | persists without readiness claims |
| Mark ready | sources have revisions; no decision-required items | request stage becomes `READY` |
| Start isolated work | ready; owned `work/<actor>/<task>` lane is available | records branch/worktree/head |
| Run verification | implementation exists at an exact revision | records checks and artifacts |
| Request review | verification is bound to the current revision | review becomes `PENDING` |
| Safe commit and push | configured checks pass and exact paths are selected | invokes the checkpoint engine |
| Request authorization | operation requires merge, deploy, external write or another protected action | records a scoped pending request |
| Merge or deploy | verification and required review pass; authorization is valid | performs only the approved action |
| Observe outcome | a released revision and target exist | records field/runtime evidence |
| Close | criteria pass and required outcome evidence exists | request becomes `CLOSED` |

Any failed prerequisite renders the action disabled with its `HOLD` reasons. A button never silently advances more than one boundary.

Validate a form before enabling state-changing buttons:

```powershell
npm run form:validate -- examples/development-form.json
```

## Cross-field invariants

- `READY` cannot coexist with unresolved `decisions_required` or unrevisioned authoritative sources.
- Verification `PASS` requires a subject revision, at least one passing check and evidence for every acceptance criterion.
- Review `PASSED` requires at least one reviewer distinct from the lane actor and no unresolved failing finding.
- Authorization `GRANTED` requires named authorizer, timestamp and exact scope; AI actors cannot self-authorize protected execution.
- `MERGED` or `DEPLOYED` requires verification of that same revision and any required authorization.
- Outcome `SUCCESS` requires observation evidence from the released target; tests and reviews are insufficient.
- Google Workspace sources store file ID, tab/range where relevant, revision or modified time, and minimum disclosed scope. A local pointer is not a verified Workspace source.

## Four-AI review record

- Gemini: completed read-only review. Its source/revision, minimal disclosure, handoff, acceptance, evidence and separated outcome recommendations are represented.
- Cursor: attempted read-only review; non-interactive process produced no result and was stopped.
- Claude: attempted read-only review; weekly limit blocked execution.
- Codex: owns synthesis, implementation and deterministic validation. Missing reviews do not count as agreement.
